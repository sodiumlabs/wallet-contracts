// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "../eip4337/core/BasePaymaster.sol";

contract DeployPaymaster is BasePaymaster {
    using UserOperationLib for UserOperation;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;

    uint256 private constant SIGNATURE_OFFSET = 84;

    constructor(
        IEntryPoint _entryPoint,
        address _owner
    ) BasePaymaster(_entryPoint, _owner) {
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 requiredPreFund
    ) internal override returns (bytes memory context, uint256 validationData) {
        if (userOp.initCode.length == 0) {
            // this is a call, not a create.
            // we don't need to pay for it.
           revert("not a deploy");
        }
        return ("", 0);
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {

    }
}