// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

struct Session {
    address owner;
    bytes4 uniqueId;
    uint64 expires;
}

/// @title SodiumStorage - Storage layout of the Sodium contracts to be used in libraries
contract SodiumStorage {
    // From /common/Singleton.sol
    address private singleton;
    // From /common/ModuleManager.sol
    mapping(address => bool) internal modules;

    // From /base/SessionManager.sol
    // uniqueId => session
    mapping(bytes4 => Session) internal _sessions;
    mapping(address => bytes4) internal _ownerToUniqueId;

    // safe session
    Session internal _safeSession;
    bytes32 public salt;

    // From /Sodium.sol
    bool private initialized;
    address internal entryPoint;
}
