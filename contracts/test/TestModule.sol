// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../interfaces/IModule.sol";
import "../Sodium.sol";

contract TestModule is IModule {
    function validateSignature(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/
    ) external pure returns (uint256) {
        // function executeWithModule(
        //     address _module,
        //     uint256 _value,
        //     bytes memory _data
        // )
        // check call data has method sig
        // https://docs.soliditylang.org/zh/v0.8.17/abi-spec.html#id10
        // 132 = 4 + 32 + 32 + 32 + 32
        //    = methodSig + _module + _value + dynamic bytes + 
        // return 0;
        bytes4 methodId = bytes4(userOp.callData[132:136]);

        if (methodId == this.call.selector) {
            return 0;
        }
        return 1;
    }

    function call(address to, bytes calldata data) external payable {
        Sodium wallet = Sodium(payable(msg.sender));
        require(
            wallet.execTransactionFromModule(to, 0, data, Enum.Operation.Call),
            "Could not execute"
        );
    }
}
