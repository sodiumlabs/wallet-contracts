// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./StableCoinPaymaster.sol";

contract AribStablePaymaster is StableCoinPaymaster {
    constructor(IEntryPoint _entryPoint) StableCoinPaymaster(_entryPoint) {
        // luausd
        _addToken(0x1DD6b5F9281c6B4f043c02A83a46c2772024636c);
        // usdt
        _addToken(0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9);
        // usdc
        _addToken(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
        // usdc.e
        _addToken(0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8);
    }
}
