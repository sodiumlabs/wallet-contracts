// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMPCManager {
    function checkIsValidMPC(uint256 round, address mpc) external view returns (bool);
}
