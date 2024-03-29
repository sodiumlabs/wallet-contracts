// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../eip4337/core/BasePaymaster.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IERC20Paymaster.sol";

// Sodium Token paymaster token
contract StableCoinPaymaster is IERC20Paymaster, BasePaymaster {
    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20Metadata;

    uint128 public constant PRECENT_DENOMINATOR = 10000000000;
    uint128 public constant COST_OF_POST = 35000;
    // calculated cost of the postOp

    // 3%
    uint256 public fee = 300000000;
    IOracle private constant NULL_ORACLE = IOracle(address(0));

    mapping(IERC20Metadata => bool) public isTokenSupported;

    // Cost of last gas purchase
    uint256 private latestCost;

    event UpdateLatestCost(uint256 newLatestCost);

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {
        transferOwnership(tx.origin);
    }

    // Integer cost of buying gas
    function updateLatestCost(uint256 _cost) external onlyOwner {
        latestCost = _cost * 10 ** 18;
        emit UpdateLatestCost(latestCost);
    }

    function _addToken(address tokenAddress) internal {
        IERC20Metadata token = IERC20Metadata(tokenAddress);
        require(!isTokenSupported[token], "Token already set");
        isTokenSupported[token] = true;
    }

    /**
     * owner of the paymaster should add supported tokens
     */
    function addToken(address token) external onlyOwner {
        _addToken(token);
    }

    /**
     * owner of the paymaster should update supported tokens
     */
    function disableToken(IERC20Metadata token) external onlyOwner {
        require(!isTokenSupported[token], "Token already set");
        isTokenSupported[token] = false;
    }

    /**
     * return amount of tokens
     */
    function getTokenAllowanceCast(
        IERC20Metadata token
    )
        external
        view
        returns (uint256 miniAllowance, uint256 suggestApproveValue)
    {
        require(isTokenSupported[token], "Token not set");
        uint8 decimals = token.decimals();
        miniAllowance = 10 * 10 ** decimals;
        suggestApproveValue = 1000 * 10 ** decimals;
    }

    /**
     * withdraw tokens.
     * can only be called after unlock() is called in a previous block.
     * @param token the token deposit to withdraw
     * @param target address to send to
     * @param amount amount to withdraw
     */
    function withdrawTokensTo(
        IERC20Metadata token,
        address target,
        uint256 amount
    ) public onlyOwner {
        token.safeTransfer(target, amount);
    }

    /**
     * translate the given eth value to token amount
     * @param token the token to use
     * @param ethBought the required eth value we want to "buy"
     * @return requiredTokens the amount of tokens required to get this amount of eth
     */
    function getTokenValueOfEth(
        IERC20Metadata token,
        uint256 ethBought
    ) public view virtual returns (uint256 requiredTokens) {
        require(isTokenSupported[token], "Token not set");
        uint8 decimals = token.decimals();
        return
            Math.mulDiv(
                ethBought * latestCost,
                10 ** decimals,
                10 ** 36,
                Math.Rounding.Up
            );
    }

    /**
     * Validate the request:
     * The sender should have enough deposit to pay the max possible cost.
     * Note that the sender's balance is not checked. If it fails to pay from its balance,
     * this deposit will be used to compensate the paymaster for the transaction.
     */
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    )
        internal
        view
        override
        returns (bytes memory context, uint256 validationData)
    {
        (userOpHash);
        // verificationGasLimit is dual-purposed, as gas limit for postOp. make sure it is high enough
        require(
            userOp.verificationGasLimit > COST_OF_POST,
            "ERC20Paymaster: gas too low for postOp"
        );

        bytes calldata paymasterAndData = userOp.paymasterAndData;

        // kecc256(approve(address,uint256))
        // 095ea7b3
        require(
            paymasterAndData.length == 20 + 4 + 20,
            "ERC20Paymaster: paymasterAndData must specify token"
        );
        IERC20Metadata token = IERC20Metadata(
            address(bytes20(paymasterAndData[24:]))
        );
        address account = userOp.getSender();
        uint256 maxTokenCost = getTokenValueOfEth(token, maxCost);
        uint256 gasPriceUserOp = userOp.gasPrice();
        require(
            token.allowance(account, address(this)) >= maxTokenCost,
            "ERC20Paymaster: deposit too low"
        );
        require(token.balanceOf(account) >= maxTokenCost);
        return (
            abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost),
            0
        );
    }

    /**
     * perform the post-operation to charge the sender for the gas.
     * in normal mode, use transferFrom to withdraw enough tokens from the sender's balance.
     * in case the transferFrom fails, the _postOp reverts and the entryPoint will call it again,
     * this time in *postOpReverted* mode.
     * In this mode, we use the deposit to pay (which we validated to be large enough)
     */
    function _postOp(
        PostOpMode /*mode*/,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        (
            address account,
            IERC20Metadata token,
            uint256 gasPricePostOp,
            uint256 maxTokenCost,
            uint256 maxCost
        ) = abi.decode(
                context,
                (address, IERC20Metadata, uint256, uint256, uint256)
            );

        uint256 feeGasCost = Math.mulDiv(
            actualGasCost,
            fee,
            PRECENT_DENOMINATOR
        );

        // use same conversion rate as used for validation.
        uint256 actualTokenCost = ((actualGasCost +
            feeGasCost +
            COST_OF_POST *
            gasPricePostOp) * maxTokenCost) / maxCost;

        token.safeTransferFrom(account, address(this), actualTokenCost);
    }
}
