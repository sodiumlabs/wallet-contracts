// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import { ISodiumAuth } from './ISodiumAuth.sol';

interface ISodiumAuthWeighted is ISodiumAuth {
    error InvalidOperators();
    error InvalidThreshold();
    error DuplicateOperators();
    error MalformedSigners();
    error LowSignaturesWeight();
    error InvalidWeights();

    event OperatorshipTransferred(address[] newOperators, uint256[] newWeights, uint256 newThreshold);

    function currentEpoch() external view returns (uint256);

    function hashForEpoch(uint256 epoch) external view returns (bytes32);

    function epochForHash(bytes32 hash) external view returns (uint256);
}