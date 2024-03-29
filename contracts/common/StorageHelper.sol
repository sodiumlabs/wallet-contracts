// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

library StorageHelper {
    function writeBytes32(bytes32 _key, bytes32 _val) internal {
        assembly {
            sstore(_key, _val)
        }
    }

    function readBytes32(bytes32 _key) internal view returns (bytes32 val) {
        assembly {
            val := sload(_key)
        }
    }

    function writeBytes32Map(
        bytes32 _key,
        bytes32 _subKey,
        bytes32 _val
    ) internal {
        bytes32 key = keccak256(abi.encode(_key, _subKey));
        assembly {
            sstore(key, _val)
        }
    }

    function readBytes32Map(bytes32 _key, bytes32 _subKey)
        internal
        view
        returns (bytes32 val)
    {
        bytes32 key = keccak256(abi.encode(_key, _subKey));
        assembly {
            val := sload(key)
        }
    }
}
