// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./Wallet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Factory - factory responsible for deploying Smart Accounts using CREATE2 and CREATE
 * @dev It deploys Smart Accounts as proxies pointing to `basicImplementation` that is immutable.
 *      This allows keeping the same address for the same Smart Account owner on various chains via CREATE2
 * @author Albert Huang - <albert@sodiums.com>
 */
contract Factory is Ownable {
    event AccountCreation(address indexed account, bytes32 slat);

    // Prevent ddos attacks
    mapping(address => bool) public allowSingleton;

    constructor(address _owner) {
        _transferOwnership(_owner);
    }

    function isContract(address _addr) private view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    function internalAddAllowSingleton(address _singleton) private {
        require(isContract(_singleton), "F01");
        allowSingleton[_singleton] = true;
    }

    function addAllowSingleton(address _singleton) public onlyOwner {
        internalAddAllowSingleton(_singleton);
    }

    function deployProxy(
        address _singleton,
        bytes memory stupCode,
        bytes32 salt
    ) external returns (address proxy) {
        bytes memory creationCode = Wallet.creationCode;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            proxy := create2(
                0x0,
                add(0x20, creationCode),
                mload(creationCode),
                salt
            )
        }
        require(address(proxy) != address(0), "Create2 call failed");
        (bool successSetup, ) = proxy.call(
            abi.encodeWithSignature("setImpl(address)", _singleton)
        );
        require(successSetup, "set proxy failed");
        (bool success, ) = proxy.call(stupCode);
        require(success, "init wallet failed");
    }
    // off-chain calculation
    // return ethers.utils.getCreate2Address(<factory address>, <create2 salt>, ethers.utils.keccak256(creationCode));
}
