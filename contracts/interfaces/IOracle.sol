// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

interface IOracle {
    /**
     * return amount of tokens that are required to receive that much eth.
     */
    function getTokenValueOfNativeToken(
        uint256 ethOutput
    ) external view returns (uint256 tokenInput);

    /**
     * return amount of tokens
     */
    function getTokenAllowanceCast() external view returns (uint256 miniAllowance, uint256 suggestApproveValue);
}
