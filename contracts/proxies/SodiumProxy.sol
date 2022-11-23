// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../Sodium.sol";

/// @title IProxy - Helper interface to access masterCopy of the Proxy on-chain
/// @author Richard Meissner - <richard@gnosis.io>
interface IProxy {
    function upgrade() external view returns (address);
}

contract SodiumProxy {

    // singleton always needs to be first declared variable, to ensure that it is at the same location in the contracts to which calls are delegated.
    // To reduce deployment costs this variable is internal and needs to be retrieved via `getStorageAt`
    address internal singleton;

    function toString(bytes memory data) public pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    function setup(address _singleton, bytes memory data) public {
        require(_singleton != address(0), "Invalid singleton address provided");
        require(singleton == address(0), "Already initialized");
        require(_singleton.code.length > 0, "Singleton not contract");
        singleton = _singleton;
        (bool success, bytes memory returndata) = _singleton.delegatecall(data);
        if (!success) {
            if (returndata.length == 0) revert(toString(data));
            assembly {
                revert(add(32, returndata), mload(returndata))
            }
        }
    }

    fallback() external payable {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let _singleton := and(
                sload(0),
                0xffffffffffffffffffffffffffffffffffffffff
            )
            // 0xa619486e == keccak("upgrade()"). The value is right padded to 32-bytes with 0s
            if eq(
                calldataload(0),
                0xa619486e00000000000000000000000000000000000000000000000000000000
            ) {
                mstore(0, _singleton)
                return(0, 0x20)
            }
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(
                gas(),
                _singleton,
                0,
                calldatasize(),
                0,
                0
            )
            returndatacopy(0, 0, returndatasize())
            if eq(success, 0) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }
}
