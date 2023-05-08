// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Proxy // This is the user's Smart Account
 * @notice Basic proxy that delegates all calls to a fixed implementation contract.
 * @dev    Implementation address is stored in the slot defined by the Proxy's address
 */
contract Proxy {
    // To be compatible with 4337 not yet deployed network users can have the same address
    function setImpl(address _implementation) external {
        require(
            _implementation != address(0),
            "Invalid implementation address"
        );
        address oldImplementation;
        assembly {
            oldImplementation := sload(address())
        }
        require(oldImplementation == address(0), "Implementation already set");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(address(), _implementation)
        }
    }

    fallback() external payable {
        address target;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            target := sload(address())
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
