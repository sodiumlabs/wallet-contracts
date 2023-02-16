// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IMPCManager.sol";

contract MPCManager is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IMPCManager
{
    struct PeerInfo {
       string peerId;
       string connectInfo;
       uint256 points;
    }

    struct MPCInfo {
        bool activate;
        PeerInfo[] peers;
    }

    mapping(address => MPCInfo) public mpcs;

    event AddMPC(address _mpc);
    event DisableMPC(address _mpc);
    event UpdateMPCPeers(address _mpc);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function checkMPCActivate(address _mpc) external view returns(bool) {
        MPCInfo memory info = mpcs[_mpc];
        return info.activate;
    }

    function addNewMPC(address _mpc, MPCInfo calldata info) external onlyOwner {
        require(!mpcs[_mpc].activate, "MPC01");
        mpcs[_mpc] = info;
        emit AddMPC(_mpc);
    }

    function updateMPCPeers(address _mpc, PeerInfo[] memory _peers) external {
        address sender = _msgSender();
        require(mpcs[_mpc].activate, "MPC03");
        require(owner() == sender || sender == _mpc,"MPC04");
        delete mpcs[_mpc].peers;
        for (uint256 i = 0; i < _peers.length; i++) {
            mpcs[_mpc].peers[i] = _peers[i];
        }
        emit UpdateMPCPeers(_mpc);
    }

    function disableMPC(address _mpc) external onlyOwner {
        require(mpcs[_mpc].activate, "MPC02");
        mpcs[_mpc].activate = false;
        emit DisableMPC(_mpc);
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
