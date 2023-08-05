// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./DefaultCallbackHandler.sol";
import "../interfaces/ISignatureValidator.sol";
import "../Sodium.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CompatibilityFallbackHandler is
    DefaultCallbackHandler,
    ISignatureValidator
{
    using ECDSA for bytes32;
    //keccak256(
    //    "SodiumMessage(bytes message)"
    //);
    bytes32 private constant SODIUM_MSG_TYPEHASH =
        0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;
    bytes4 internal constant UPDATED_MAGIC_VALUE = 0x1626ba7e;

    /**
     * Implementation of ISignatureValidator (see `interfaces/ISignatureValidator.sol`)
     * @dev Should return whether the signature provided is valid for the provided data.
     * @param _data Arbitrary length data signed on the behalf of address(msg.sender)
     * @param _signature Signature byte array associated with _data
     * @return a bool upon valid or invalid signature with corresponding _data
     */
    function isValidSignature(
        bytes calldata _data,
        bytes calldata _signature
    ) public view override returns (bytes4) {
        Sodium so = Sodium(payable(msg.sender));
        bytes32 messageHash = getMessageHashForSodium(so, _data);
        bytes32 ethHash = messageHash.toEthSignedMessageHash();
        (bool valid, address signer, ) = so.checkValidSodiumSignature(
            ethHash,
            _signature
        );
        (bool isSessionKey, bool isSafe) = so.isSessionOwner(signer);

        return
            isSessionKey && isSafe && valid ? EIP1271_MAGIC_VALUE : bytes4(0);
    }

    /// @dev Returns hash of a message that can be signed by owners.
    /// @param message Message that should be hashed
    /// @return Message hash.
    function getMessageHash(
        bytes memory message
    ) public view returns (bytes32) {
        return getMessageHashForSodium(Sodium(payable(msg.sender)), message);
    }

    /// @dev Returns hash of a message that can be signed by owners.
    /// @param so Sodium to which the message is targeted
    /// @param message Message that should be hashed
    /// @return Message hash.
    function getMessageHashForSodium(
        Sodium so,
        bytes memory message
    ) public view returns (bytes32) {
        bytes32 safeMessageHash = keccak256(
            abi.encode(SODIUM_MSG_TYPEHASH, keccak256(message))
        );
        return
            keccak256(
                abi.encodePacked(
                    bytes1(0x19),
                    bytes1(0x01),
                    so.domainSeparator(),
                    safeMessageHash
                )
            );
    }

    /**
     * Implementation of updated EIP-1271
     * @dev Should return whether the signature provided is valid for the provided data.
     *       The save does not implement the interface since `checkSignatures` is not a view method.
     *       The method will not perform any state changes (see parameters of `checkSignatures`)
     * @param _dataHash Hash of the data signed on the behalf of address(msg.sender)
     * @param _signature Signature byte array associated with _dataHash
     * @return a bool upon valid or invalid signature with corresponding _dataHash
     * @notice See https://github.com/gnosis/util-contracts/blob/bb5fe5fb5df6d8400998094fb1b32a178a47c3a1/contracts/StorageAccessible.sol
     */
    function isValidSignature(
        bytes32 _dataHash,
        bytes calldata _signature
    ) external view returns (bytes4) {
        ISignatureValidator validator = ISignatureValidator(msg.sender);
        bytes4 value = validator.isValidSignature(
            abi.encode(_dataHash),
            _signature
        );
        return (value == EIP1271_MAGIC_VALUE) ? UPDATED_MAGIC_VALUE : bytes4(0);
    }
}
