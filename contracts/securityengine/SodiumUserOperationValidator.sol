// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IUserOperationValidator.sol";

contract SodiumUserOperationValidator is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IUserOperationValidator
{
    PendingUpgrade private _nextUpgrade;
    uint64 constant _upgradeTimeLock = 3 days;
    struct PendingUpgrade {
        address implementation;
        uint64 lockExpires;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(tx.origin);
    }

    function getNextUpgrade() external view returns (PendingUpgrade memory) {
        return _nextUpgrade;
    }

    /**
     * Validate UserOperation from EIP-4337
     * @return validationData
     * Indicates that there is no physical loss of the user's assets, similar to swap, bridge
     * 0 => safe
     *
     * Indicates that the calling dapp is authenticated.
     * 1 => medium security
     *
     * Indicates that the calling contract is not authenticated
     * 2 => nosafe
     */
    function validateUserOp(
        UserOperation calldata /*userOp*/
    ) external pure returns (uint8 validationData) {
        // TODO
        // 实现最新的userOp的解析以便校验安全性
        return 0;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
