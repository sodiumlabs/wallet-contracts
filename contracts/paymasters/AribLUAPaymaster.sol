// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./StableCoinPaymaster.sol";

contract AribLUAPaymaster is StableCoinPaymaster {
    constructor(IEntryPoint _entryPoint) StableCoinPaymaster(_entryPoint) {
        // LUA
        _addToken(0xc3aBC47863524ced8DAf3ef98d74dd881E131C38);
    }
}
