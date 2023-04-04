// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

interface IVault {
    function transferERC20(IERC20Metadata erc20, uint256 amount, bytes memory data) external;
}