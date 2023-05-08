// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ISecurityEngine.sol";

contract SecurityEngine is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ISecurityEngine
{
    PendingUpgrade private _nextUpgrade;
    struct PendingUpgrade {
        address implementation;
        uint64 lockExpires;
    }

    function getNextUpgrade() external view returns (PendingUpgrade memory) {
        return _nextUpgrade;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
