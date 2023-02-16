// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title SafeStorage - Storage layout of the Safe contracts to be used in libraries
/// @author Richard Meissner - <richard@gnosis.io>
contract SodiumStorage {
    // From /common/Singleton.sol
    address public singleton;
    // From /common/ModuleManager.sol
    mapping(address => address) internal modules;

    // kecc256("pc|mobile|web") => session pubkey address
    mapping(bytes4 => address) internal sessionByPlatform;

    // From /Sodium.sol
    bool private initialized;
    address internal entryPoint;
}