// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./base/ModuleManager.sol";
import "./base/SessionManager.sol";
import "./base/FallbackManager.sol";
import "./base/GuardManager.sol";
import "./common/Singleton.sol";
import "./common/EtherPaymentFallback.sol";
import "./interfaces/ISignatureValidator.sol";
import "./external/GnosisSafeMath.sol";
import "./eip4337/interfaces/IAccount.sol";
import "./eip4337/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./base/NonceManager.sol";
import "./common/Enum.sol";

struct Transaction {
    Enum.Operation op; // Performs delegatecall
    bool revertOnError; // Reverts transaction bundle if tx fails
    uint256 gasLimit; // Maximum gas to be forwarded
    address target; // Address of the contract to call
    uint256 value; // Amount of ETH to pass with the call
    bytes data; // calldata to pass
}

contract Sodium is
    Singleton,
    ModuleManager,
    SessionManager,
    NonceManager,
    ISignatureValidatorConstants,
    FallbackManager,
    GuardManager,
    IAccount,
    EtherPaymentFallback
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

    bool private initialized;
    address internal immutable entryPoint;

    // This constructor ensures that this contract can only be used as a master copy for Proxy contracts
    constructor(
        IEntryPoint _entryPoint
    ) {
        entryPoint = address(_entryPoint);
    }

    function setup(
        address _sessionOwner,
        bytes4 _platform,
        address _fallbackHandler
    ) public {
        require(!initialized, "Already initialized");
        require(_fallbackHandler != address(0), "Required fallback handler");
        initialized = true;
        internalSetFallbackHandler(_fallbackHandler);
        internalAddSession(_sessionOwner, _platform);
    }

    function _requireFromAdmin() internal view {
        require(
            msg.sender == address(this) || msg.sender == address(entryPoint),
            "only entryPoint or wallet self"
        );
    }

    /**
     * @notice Allow eip-4337 entryPoint or wallet self to execute an action
     * @dev Relayers must ensure that the gasLimit specified for each transaction
     *      is acceptable to them. A user could specify large enough that it could
     *      consume all the gas available.
     * @param _txs Transactions to process
     */
    function execute(Transaction[] memory _txs) public {
        // only allow eip-4337 entryPoint or wallet self to execute an action
        _requireFromAdmin();
        // Execute the transactions
        _execute(_txs);
    }

    /**
     * @notice Executes a list of transactions
     * @param _txs  Transactions to execute
     */
    function _execute(Transaction[] memory _txs) private {
        // Execute transaction
        for (uint256 i = 0; i < _txs.length; i++) {
            Transaction memory transaction = _txs[i];
            bool success;
            bytes memory result;
            require(
                gasleft() >= transaction.gasLimit,
                "Sodium: NOT_ENOUGH_GAS"
            );
            if (transaction.op == Enum.Operation.DelegateCall) {
                (success, result) = transaction.target.delegatecall{
                    gas: transaction.gasLimit == 0
                        ? gasleft()
                        : transaction.gasLimit
                }(transaction.data);
            } else {
                (success, result) = transaction.target.call{
                    value: transaction.value,
                    gas: transaction.gasLimit == 0
                        ? gasleft()
                        : transaction.gasLimit
                }(transaction.data);
            }
            if (!success && transaction.revertOnError) {
                assembly {
                    revert(add(result, 0x20), mload(result))
                }
            }
        }
    }

    function _payPrefund(uint256 missingAccountFunds) internal virtual {
        if (missingAccountFunds != 0) {
            (bool success,) = payable(msg.sender).call{value : missingAccountFunds, gas : type(uint256).max}("");
            (success);
            //ignore failure (its EntryPoint's job to verify, not account.)
        }
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        address,
        uint256 missingWalletFunds
    ) external returns (uint256) {
        _requireFromAdmin();
        bytes32 signedHash = userOpHash.toEthSignedMessageHash();
        // require(
        //     isSessionOwner(signedHash.recover(userOp.signature)),
        //     "wallet: wrong signature"
        // );
        _payPrefund(missingWalletFunds);
        return 0;
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
}
