// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../interfaces/IOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StableCoinOracle is IOracle, Ownable {
    uint256 private immutable decimals;

    // Cost of last gas purchase
    uint256 private latestCost;

    event UpdateLatestCost(uint256 newLatestCost);

    constructor(uint256 _decimals, address _owner) {
        decimals = _decimals;

        _transferOwnership(_owner);
    }

    // Integer cost of buying gas
    function updateLatestCost(uint256 _cost) external onlyOwner {
        latestCost = _cost * 10 ** decimals;
        emit UpdateLatestCost(latestCost);
    }

    /**
     * return amount of tokens that are required to receive that much eth.
     */
    function getTokenValueOfNativeToken(
        uint256 ethOutput
    ) external view returns (uint256 tokenInput) {
        return (ethOutput * latestCost) / 10 ** 18;
    }

    /**
     * return amount of tokens
     */
    function getTokenAllowanceCast()
        external
        view
        returns (uint256 miniAllowance, uint256 suggestApproveValue)
    {
        miniAllowance = 10 * 10 ** decimals;
        suggestApproveValue = 1000 * 10 ** decimals;
    }
}
