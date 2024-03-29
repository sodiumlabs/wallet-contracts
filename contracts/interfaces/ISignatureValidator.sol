// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

contract ISignatureValidatorConstants {
    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x20c13b0b;
}

abstract contract ISignatureValidator is ISignatureValidatorConstants {
    /**
     * @dev Should return whether the signature provided is valid for the provided data
     * @param _data Arbitrary length data signed on the behalf of address(this)
     * @param _signature Signature byte array associated with _data
     *
     * MUST return the bytes4 magic value 0x20c13b0b when function passes.
     * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
     * MUST allow external calls
     */
    function isValidSignature(
        bytes calldata _data,
        bytes calldata _signature
    ) public view virtual returns (bytes4);

    // /**
    //  * @dev Should return whether the signature provided is valid for the provided data
    //  * @param _dataHash Arbitrary length data signed on the behalf of address(this)
    //  * @param _signature Signature byte array associated with _data
    //  *
    //  * MUST return the bytes4 magic value 0x20c13b0b when function passes.
    //  * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
    //  * MUST allow external calls
    //  */
    // function checkValidSodiumSignature(
    //     bytes32 _dataHash,
    //     bytes calldata _signature
    // ) public view virtual returns (bool);
}
