// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { UserOperation } from "../eip4337/interfaces/UserOperation.sol";

struct PaymasterData {
    address paymasterId;
    bytes signature;
    uint256 signatureLength;
}

struct PaymasterContext {
    address paymasterId;
    uint256 gasPrice;
}

/**
 * @title PaymasterHelpers - helper functions for paymasters
 */
library PaymasterHelpers {
    using ECDSA for bytes32;

    /**
     * @dev Encodes the paymaster context: paymasterId and gasPrice
     * @param data PaymasterData passed
     * @param gasPrice effective gasPrice
     */
    function paymasterContext(
        UserOperation calldata,
        PaymasterData memory data,
        uint256 gasPrice
    ) internal pure returns (bytes memory context) {
        return abi.encode(data.paymasterId, gasPrice);
    }

    /**
     * @dev Decodes paymaster data assuming it follows PaymasterData
     */
    function _decodePaymasterData(
        UserOperation calldata op
    ) internal pure returns (PaymasterData memory) {
        bytes calldata paymasterAndData = op.paymasterAndData;
        (address paymasterId, bytes memory signature) = abi.decode(
            paymasterAndData[20:],
            (address, bytes)
        );
        return PaymasterData(paymasterId, signature, signature.length);
    }

    /**
     * @dev Decodes paymaster context assuming it follows PaymasterContext
     */
    function _decodePaymasterContext(
        bytes memory context
    ) internal pure returns (PaymasterContext memory) {
        (address paymasterId, uint256 gasPrice) = abi.decode(
            context,
            (address, uint256)
        );
        return PaymasterContext(paymasterId, gasPrice);
    }
}
