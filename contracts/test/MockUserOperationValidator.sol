// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../securityengine/IUserOperationValidator.sol";

contract MockUserOperationValidator is IUserOperationValidator {
    uint8 private validationData;

    event SetValidationData(uint8 _validationData);

    constructor() {
        validationData = 0;
    }

    function setValidationData(uint8 _validationData) external {
        validationData = _validationData;

        emit SetValidationData(_validationData);
    }

    /**
     * Validate UserOperation from EIP-4337
     * @return validationData
     * Indicates that there is no physical loss of the user's assets, similar to swap, bridge
     * 0 => safe
     *
     * Indicates that the calling dapp is authenticated.
     * 1 => medium security
     *
     * Indicates that the calling contract is not authenticated
     * 2 => nosafe
     */
    function validateUserOp(
        UserOperation calldata /*userOp*/
    ) external view returns (uint8) {
        return validationData;
    }
}
