// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Token is ERC20 {
    constructor(address sender) ERC20("TestToken", "TT") {
        _mint(sender, 10000000000000 * 10 ** 18);
    }
}
