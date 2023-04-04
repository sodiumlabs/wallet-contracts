// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMPCManager {
    function checkIsValidMPCWithRound(uint256 round, address mpc) external view returns (bool);
    function checkIsValidCurrentActiveMPC(address mpc) external view returns (bool);
}
