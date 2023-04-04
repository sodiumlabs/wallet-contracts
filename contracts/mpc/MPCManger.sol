// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IMPCManager.sol";

contract MPCManager is IMPCManager {
    MPC public pendingMPC;

    struct MPC {
        address addr;
        uint256 round;
        uint256 activeTime;
    }

    mapping(uint256 => MPC) public getMPCByRound;

    uint256 public currentRound = 0;

    // timelock for next round
    uint256 public nextRoundDelay = 1 days;

    // timelock for admin
    uint256 public adminDelay = 7 days;

    address public admin;

    event ChangeMPC(address _mpc);

    constructor(address _admin, address _genesisMPC) {
        admin = _admin;
        MPC memory genesisMPC = MPC(_genesisMPC, 0, block.timestamp);
        getMPCByRound[0] = genesisMPC;
    }

    function _onlyMPC() internal view {
        MPC memory currentMPC = getMPCByRound[currentRound];
        require(
            msg.sender == currentMPC.addr,
            "only entryPoint or wallet self"
        );
    }

    function _onlyAdmin() internal view {
        require(msg.sender == admin, "only entryPoint or wallet self");
    }

    // change admin
    function changeAdmin(address _admin) external {
        require(_admin != address(0), "MPCManager: invalid admin address");
        _onlyAdmin();
        admin = _admin;
    }

    function checkIsValidMPCWithRound(
        uint256 round,
        address _mpc
    ) external view returns (bool) {
        MPC memory currentMPC = getMPCByRound[round];
        return _mpc == currentMPC.addr;
    }

    function checkIsValidCurrentActiveMPC(
        address _mpc
    ) external view returns (bool) {
        MPC memory currentMPC = getMPCByRound[currentRound];
        return _mpc == currentMPC.addr;
    }

    function setNextRand(address _mpc) external {
        require(_mpc != address(0), "MPCManager: invalid mpc address");
        _onlyMPC();
        pendingMPC = MPC(
            _mpc,
            currentRound + 1,
            block.timestamp + nextRoundDelay
        );
    }

    function setNextRandWithAdmin(address _mpc) external {
        require(_mpc != address(0), "MPCManager: invalid mpc address");
        _onlyAdmin();
        pendingMPC = MPC(_mpc, currentRound + 1, block.timestamp + adminDelay);
    }

    function confirmNextRand() external {
        require(pendingMPC.addr != address(0), "MPCManager: no pending mpc");
        require(
            block.timestamp >= pendingMPC.activeTime,
            "MPCManager: not active time"
        );
        currentRound = pendingMPC.round;
        getMPCByRound[currentRound] = pendingMPC;
        emit ChangeMPC(pendingMPC.addr);
        delete pendingMPC;
    }
}
