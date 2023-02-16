// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMPCManager {
    function checkMPCActivate(address mpc) external view returns(bool);
}
