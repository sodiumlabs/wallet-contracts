// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20Token is ERC20 {
    uint8 internal _decimals;

    constructor(uint8 __decimals) ERC20("TestToken", "TT") {
        _decimals = __decimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function decimals() public virtual view override returns (uint8) {
        return _decimals;
    }
}
