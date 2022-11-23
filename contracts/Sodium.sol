// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./base/ModuleManager.sol";
import "./base/SessionManager.sol";
import "./base/FallbackManager.sol";
import "./base/GuardManager.sol";
import "./common/Singleton.sol";
import "./common/SignatureDecoder.sol";
import "./common/SecuredTokenTransfer.sol";
import "./common/StorageAccessible.sol";
import "./interfaces/ISignatureValidator.sol";
import "./external/GnosisSafeMath.sol";
import "./eip4337/interfaces/IWallet.sol";
import "./eip4337/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Sodium is
    Singleton,
    ModuleManager,
    SessionManager,
    SignatureDecoder,
    SecuredTokenTransfer,
    ISignatureValidatorConstants,
    FallbackManager,
    StorageAccessible,
    GuardManager,
    IWallet
{
    using ECDSA for bytes32;
    using GnosisSafeMath for uint256;

    string public constant VERSION = "0.0.1";

    // keccak256(
    //     "EIP712Domain(uint256 chainId,address verifyingContract)"
    // );
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;

    event SodiumSetup(
        address indexed sessionOwner,
        bytes4 platform,
        address fallbackHandler
    );

    uint256 public nonce;
    bool private initialized;
    IEntryPoint private entryPoint;

    // This constructor ensures that this contract can only be used as a master copy for Proxy contracts
    constructor() {}

    function setup(
        address _sessionOwner,
        bytes4 _platform,
        address _fallbackHandler,
        IEntryPoint _entryPoint
    ) public {
        require(!initialized, "Already initialized");
        require(_fallbackHandler != address(0), "Required fallback handler");
        initialized = true;
        entryPoint = _entryPoint;
        internalSetFallbackHandler(_fallbackHandler);
        internalAddSession(_sessionOwner, _platform);
        entryPoint.depositTo{ value: address(this).balance }(address(this));
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners and then pays the account that submitted the transaction.
    ///      Note: The fees are always transferred, even if the user transaction fails.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param baseGas Gas costs that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) public payable virtual returns (bool success) {
        // bytes32 txHash;
        // // Use scope here to limit variable lifetime and prevent `stack too deep` errors
        // {
        //     bytes memory txHashData = encodeTransactionData(
        //         // Transaction info
        //         to,
        //         value,
        //         data,
        //         operation,
        //         safeTxGas,
        //         // Payment info
        //         baseGas,
        //         gasPrice,
        //         gasToken,
        //         refundReceiver,
        //         // Signature info
        //         nonce
        //     );
        //     // Increase nonce and execute transaction.
        //     nonce++;
        //     txHash = keccak256(txHashData);
        //     // TODO
        //     // checkSignatures(txHash, txHashData, signatures);
        // }
        // // execute(to, value, data, operation, gasPrice == 0 ? (gasleft() - 2500) : safeTxGas)
        // // address guard = getGuard();
        // // {
        // //     if (guard != address(0)) {
        // //         Guard(guard).checkTransaction(
        // //             // Transaction info
        // //             to,
        // //             value,
        // //             data,
        // //             operation,
        // //             safeTxGas,
        // //             // Payment info
        // //             baseGas,
        // //             gasPrice,
        // //             gasToken,
        // //             refundReceiver,
        // //             // Signature info
        // //             signatures,
        // //             msg.sender
        // //         );
        // //     }
        // // }
        // // We require some gas to emit the events (at least 2500) after the execution and some to perform code until the execution (500)
        // // We also include the 1/64 in the check that is not send along with a call to counteract potential shortings because of EIP-150
        // require(
        //     gasleft() >= ((safeTxGas * 64) / 63).max(safeTxGas + 2500) + 500,
        //     "GS010"
        // );
        // // Use scope here to limit variable lifetime and prevent `stack too deep` errors
        // {
        //     uint256 gasUsed = gasleft();
        //     // If the gasPrice is 0 we assume that nearly all available gas can be used (it is always more than safeTxGas)
        //     // We only substract 2500 (compared to the 3000 before) to ensure that the amount passed is still higher than safeTxGas
        //     success = execute(
        //         to,
        //         value,
        //         data,
        //         operation,
        //         gasPrice == 0 ? (gasleft() - 2500) : safeTxGas
        //     );
        //     gasUsed = gasUsed.sub(gasleft());
        //     // If no safeTxGas and no gasPrice was set (e.g. both are 0), then the internal tx is required to be successful
        //     // This makes it possible to use `estimateGas` without issues, as it searches for the minimum gas where the tx doesn't revert
        //     require(success || safeTxGas != 0 || gasPrice != 0, "GS013");
        //     // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
        //     uint256 payment = 0;
        //     if (gasPrice > 0) {
        //         // payment = handlePayment(gasUsed, baseGas, gasPrice, gasToken, refundReceiver);
        //     }
        //     if (success) emit ExecutionSuccess(txHash, payment);
        //     else emit ExecutionFailure(txHash, payment);
        // }
    }

    /// @dev Returns the chain id used by this contract.
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }

    function domainSeparator() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(DOMAIN_SEPARATOR_TYPEHASH, getChainId(), this)
            );
    }

    /// @dev Returns the bytes that are hashed to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param safeTxGas Gas that should be used for the safe transaction.
    /// @param baseGas Gas costs for that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
    /// @param gasPrice Maximum gas price that should be used for this transaction.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash bytes.
    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes memory) {
        // TODO
        bytes32 safeTxHash = keccak256(
            abi.encode(
                "",
                to,
                value,
                keccak256(data),
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                _nonce
            )
        );
        return
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                safeTxHash
            );
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 requestId,
        address aggregator,
        uint256 missingWalletFunds
    ) external view returns (uint256 deadline) {
        require(isSessionOwner(requestId.recover(userOp.signature)), "wallet: wrong signature");
        return 0;
    }

    // return the native token amount
    function balanceOf() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    // add to the deposit of the given account
    function depositTo() public payable {
        return entryPoint.depositTo(address(this));
    }

    // withdraw from the deposit
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount)
        external
    {
        return entryPoint.withdrawTo(withdrawAddress, withdrawAmount);
    }

    receive() external payable {
        entryPoint.depositTo(address(this));
    }

    /// @dev Returns hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param safeTxGas Fas that should be used for the safe transaction.
    /// @param baseGas Gas costs for data used to trigger the safe transaction.
    /// @param gasPrice Maximum gas price that should be used for this transaction.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes32) {
        return
            keccak256(
                encodeTransactionData(
                    to,
                    value,
                    data,
                    operation,
                    safeTxGas,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    _nonce
                )
            );
    }
}
