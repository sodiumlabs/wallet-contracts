// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./SelfAuthorized.sol";

contract Singleton is SelfAuthorized {
    // singleton always needs to be first declared variable, to ensure that it is at the same location as in the Proxy contract.
    // It should also always be ensured that the address is stored alone (uses a full word)
    address public singleton;

    event Upgrade(address preSingleton, address newSingleton);

    function upgradeTo(address newSingleton) external authorized {
        address preSingleton = singleton;
        singleton = newSingleton;
        emit Upgrade(preSingleton, newSingleton);
    }
}
