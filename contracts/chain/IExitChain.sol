// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IExitChain {
    struct ExitInfo {
        address exitContractAddress;
        uint256 exitChainId;
    }

    function exitInfo() external view returns (ExitInfo memory);
}