// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

interface ISEP20Receiver {
    function onSEP20Received(
        address operator,
        address from,
        uint256 amount,
        bytes calldata data
    ) external returns (bytes4);
}