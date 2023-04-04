// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IExitChain.sol";

interface IExitChain20 is IExitChain {
    event ExitSEP20(address indexed to, uint256 amount);

    function exit(uint256 amount) external;
}