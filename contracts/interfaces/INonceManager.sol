// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

interface INonceManager {
    event NonceChange(uint256 _space, uint256 _newNonce);
    
    /**
     * @notice Returns the next nonce of the default nonce space
     * @dev The default nonce space is 0x00
     * @return The next nonce
     */
    function nonce() external view returns (uint256);

    /**
     * @notice Returns the next nonce of the given nonce space
     * @param _space Nonce space, each space keeps an independent nonce count
     * @return The next nonce
     */
    function readNonce(uint256 _space) external view returns (uint256);
}
