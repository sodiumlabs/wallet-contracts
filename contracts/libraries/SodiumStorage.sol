// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title SodiumStorage - Storage layout of the Sodium contracts to be used in libraries
contract SodiumStorage {
    // From /common/Singleton.sol
    address private singleton;
    // From /common/ModuleManager.sol
    mapping(address => bool) internal modules;

    // From /base/SessionManager.sol
    mapping(bytes4 => address) internal sessionByPlatform;

    // From /Sodium.sol
    bool private initialized;
    address internal entryPoint;
}
