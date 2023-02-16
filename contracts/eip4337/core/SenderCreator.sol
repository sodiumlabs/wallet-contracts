// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "../../Wallet.sol";

/**
 * helper contract for EntryPoint, to call userOp.initCode from a "neutral" address,
 * which is explicitly not the entryPoint itself.
 */
contract SenderCreator {
    function deployProxy(
        address _singleton,
        bytes memory initCode,
        bytes32 salt
    ) internal returns (address proxy) {
        bytes memory creationCode = abi.encodePacked(
            Wallet.creationCode,
            uint256(uint160(_singleton))
        );
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
        (bool success, ) = proxy.call(initCode);
        require(success, "init wallet failed");
    }

    function getAddress(
        bytes calldata initCode
    ) external view returns (address) {
        bytes32 salt = bytes32(initCode[20:52]);
        address singleton = address(bytes20(initCode[0:20]));
        bytes memory creationCode = abi.encodePacked(
            Wallet.creationCode,
            uint256(uint160(singleton))
        );
        bytes32 has = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(creationCode)
            )
        );
        // NOTE: cast last 20 bytes of hash to address
        return address(uint160(uint(has)));
    }

    function createSender(
        bytes calldata initCode
    ) external returns (address sender) {
        address singleton = address(bytes20(initCode[0:20]));
        bytes32 salt = bytes32(initCode[20:52]);
        bytes memory initCallData = initCode[52:];
        sender = address(deployProxy(singleton, initCallData, salt));
    }
}
