// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

contract Temp {
    /**
     * @notice Updates the Wallet implementation
     * @param _imp New implementation address
     * @dev The wallet implementation is stored on the storage slot
     *   defined by the address of the wallet itself
     *   WARNING updating this value may break the wallet and users
     *   must be confident that the new implementation is safe.
     */
    function upgradeTo(address _imp) external {
        assembly {
            sstore(address(), _imp)
        }
    }

    /**
     * @notice Returns the Wallet implementation
     * @return _imp The address of the current Wallet implementation
     */
    function getSingleton() external view returns (address _imp) {
        assembly {
            _imp := sload(address())
        }
    }

    function isSodiumSingleton() external pure returns (bool) {
        return true;
    }
}