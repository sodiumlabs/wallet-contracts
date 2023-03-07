// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "../common/SelfAuthorized.sol";

contract SessionManager is SelfAuthorized {
    event AddedSession(address owner, bytes4 sessionKey);
    event RemovedSession(address owner, bytes4 sessionKey);

    bytes4 internal constant sessionPlatformPC = bytes4(keccak256("pc"));
    bytes4 internal constant sessionPlatformMobile =
        bytes4(keccak256("mobile"));
    bytes4 internal constant sessionPlatformWeb = bytes4(keccak256("web"));

    // kecc256("pc|mobile|web") => session pubkey address
    mapping(bytes4 => address) internal sessionByPlatform;

    function checkPlatform(bytes4 platform) internal pure {
        require(
            platform == sessionPlatformPC ||
                platform == sessionPlatformMobile ||
                platform == sessionPlatformWeb,
            "invalid platform"
        );
    }

    function internalAddSession(address owner, bytes4 platform) internal {
        checkPlatform(platform);
        sessionByPlatform[platform] = owner;
        emit AddedSession(owner, platform);
    }

    function addSession(address owner, bytes4 platform) public authorized {
        if (sessionByPlatform[platform] != address(0)) {
            removeSession(sessionByPlatform[platform], platform);
        }
        internalAddSession(owner, platform);
    }

    function removeSession(address owner, bytes4 platform) public authorized {
        require(
            sessionByPlatform[platform] == owner,
            "platform session expired"
        );
        sessionByPlatform[platform] = address(0);
        emit RemovedSession(owner, platform);
    }

    function isSessionOwner(address owner) public view returns (bool) {
        if (owner == address(0)) {
            return false;
        }
        address[] memory owners = getSessionOwners();
        for (uint256 i = 0; i < owners.length; i++) {
            if (owner == owners[i]) {
                return true;
            }
        }
        return false;
    }

    /// @dev Returns array of owners.
    /// @return Array of session owners.
    function getSessionOwners() public view returns (address[] memory) {
        address[] memory array = new address[](3);
        array[0] = sessionByPlatform[sessionPlatformPC];
        array[1] = sessionByPlatform[sessionPlatformMobile];
        array[2] = sessionByPlatform[sessionPlatformWeb];
        return array;
    }
}
