// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Paymaster {
    /**
     * return amount of tokens
     */
    function getTokenAllowanceCast(
        IERC20 token
    ) external view returns (uint256 tokenInput, uint256 suggestApproveValue);
}
