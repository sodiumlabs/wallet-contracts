// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "../common/SelfAuthorized.sol";
import "../common/StorageHelper.sol";
import "../interfaces/INonceManager.sol";

contract NonceManager is SelfAuthorized, INonceManager {
    // NONCE_KEY = keccak256("org.sodium.base.nonce");
    bytes32 private constant NONCE_KEY =
        bytes32(
            0x1ec7ef52f8bbd89fae80c55c6884305d3fb5ef41070638221dac337a4377b7df
        );

    uint256 private constant NONCE_BITS = 96;
    bytes32 private constant NONCE_MASK = bytes32((1 << NONCE_BITS) - 1);

    /**
     * @notice Returns the next nonce of the default nonce space
     * @dev The default nonce space is 0x00
     * @return The next nonce
     */
    function nonce() external view returns (uint256) {
        return readNonce(0);
    }

    /**
     * @notice Decodes a raw nonce
     * @dev A raw nonce is encoded using the first 160 bits for the space
     *  and the last 96 bits for the nonce
     * @param _rawNonce Nonce to be decoded
     * @return _space The nonce space of the raw nonce
     * @return _nonce The nonce of the raw nonce
     */
    function _decodeNonce(uint256 _rawNonce)
        private
        pure
        returns (uint256 _space, uint256 _nonce)
    {
        _nonce = uint256(bytes32(_rawNonce) & NONCE_MASK);
        _space = _rawNonce >> NONCE_BITS;
    }

    /**
     * @notice Returns the next nonce of the given nonce space
     * @param _space Nonce space, each space keeps an independent nonce count
     * @return The next nonce
     */
    function readNonce(uint256 _space) public view returns (uint256) {
        return
            uint256(StorageHelper.readBytes32Map(NONCE_KEY, bytes32(_space)));
    }

    /**
     * @notice Changes the next nonce of the given nonce space
     * @param _space Nonce space, each space keeps an independent nonce count
     * @param _nonce Nonce to write on the space
     */
    function _writeNonce(uint256 _space, uint256 _nonce) private {
        StorageHelper.writeBytes32Map(
            NONCE_KEY,
            bytes32(_space),
            bytes32(_nonce)
        );
    }

    /**
     * @notice Verify if a nonce is valid
     * @param _rawNonce Nonce to validate (may contain an encoded space)
     * @dev A valid nonce must be above the last one used
     *   with a maximum delta of 100
     */
    function _validateNonce(uint256 _rawNonce) private {
        // Retrieve current nonce for this wallet
        (uint256 space, uint256 providedNonce) = _decodeNonce(_rawNonce);
        uint256 currentNonce = readNonce(space);

        // Verify if nonce is valid
        require(
            providedNonce == currentNonce,
            "MainModule#_auth: INVALID_NONCE"
        );

        // Update signature nonce
        uint256 newNonce = providedNonce + 1;
        _writeNonce(space, newNonce);
        emit NonceChange(space, newNonce);
    }
}
