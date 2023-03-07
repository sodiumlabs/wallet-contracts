// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IMPCManager.sol";

contract MPCManager is IMPCManager {
    address public pendingMPC;

    mapping (uint256 => address) getMPCByRound;

    uint256 public currentRound = 0;

    event ChangeMPC(address _mpc);

    function _onlyMPC() internal view {
        require(
            msg.sender == getMPCByRound[currentRound],
            "only entryPoint or wallet self"
        );
    }

    function checkIsValidMPC(uint256 round, address _mpc) external view returns (bool) {
        return _mpc == getMPCByRound[round];
    }

    function changeMPC(address _mpc) external {
        require(_mpc != address(0), "MPCManager: invalid mpc address");
        pendingMPC = _mpc;
    }

    // function 
}
