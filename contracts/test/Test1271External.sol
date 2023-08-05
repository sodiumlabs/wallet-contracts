// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

//sample "receiver" contract, for testing "exec" from wallet.
contract Test1271External {
    using ECDSA for bytes32;
    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(
        bytes32 _dataHash,
        bytes calldata _signature
    ) public view returns (bytes4) {
        return
            _dataHash.recover(_signature) == owner
                ? bytes4(0x1626ba7e)
                : bytes4(0);
    }
}
