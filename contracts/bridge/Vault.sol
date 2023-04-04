// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../mpc/IMPCManager.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC721Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC1155MetadataURI.sol";

contract Vault {
    address private constant native =
        0x4000000000000000000000000000000000000000;
    IMPCManager public mpcManager;

    // timelock for admin
    uint256 public adminDelay = 7 days;

    address public admin;

    /// migration
    struct PendingNewVault {
        address addr;
        uint256 activeTime;
    }
    PendingNewVault public pendingNewVault;
    address public newVault;

    mapping(address => uint256) public nonceMap;

    mapping(address => mapping(address => uint256)) private balances;

    event NativeTokenReceived(
        address indexed sender,
        uint256 value,
        bytes data
    );

    // The advantage of getting metadata on the chain is that we can easily get consistency in the sodium chain
    event ERC20TokenReceived(
        address indexed erc20,
        address indexed sender,
        uint256 value,
        string symbol,
        string name,
        uint8 decimals,
        bytes data
    );
    event ERC721TokenReceived(
        address indexed erc721,
        address indexed sender,
        uint256 tokenId,
        string symbol,
        string name,
        string uri,
        bytes data
    );
    event ERC1155TokenReceived(
        address indexed erc1155,
        address indexed sender,
        uint256[] tokenIds,
        uint256[] values,
        string[] uris,
        bytes data
    );

    // migration
    event PendingMigrationToNewVault(address newVault, uint256 activeTime);
    event MigrationToNewVault(address newVault);

    constructor(address _mpcManager, address _admin) {
        mpcManager = IMPCManager(_mpcManager);
    }

    function _onlyMPC(uint256 round) internal view {
        require(
            mpcManager.checkIsValidMPCWithRound(round, msg.sender),
            "only entryPoint or wallet self"
        );
    }

    function _onlyAdmin() internal view {
        require(msg.sender == admin, "only entryPoint or wallet self");
    }

    function _onlyNotAbandoned() internal view {
        require(newVault == address(0), "Vault: is abandoned");
    }

    // change admin
    function changeAdmin(address _admin) external {
        require(_admin != address(0), "MPCManager: invalid admin address");
        _onlyAdmin();
        admin = _admin;
    }

    function migrationToNewVault(address _newVault) external {
        _onlyAdmin();
        _onlyNotAbandoned();
        require(_newVault != address(0), "Vault: invalid newVault address");
        pendingNewVault = PendingNewVault({
            addr: _newVault,
            activeTime: block.timestamp + adminDelay
        });
        emit PendingMigrationToNewVault(
            _newVault,
            block.timestamp + adminDelay
        );
    }

    // approve
    function approveMigration() external {
        _onlyNotAbandoned();
        require(
            pendingNewVault.addr != address(0),
            "Vault: no pending migration"
        );
        require(
            block.timestamp >= pendingNewVault.activeTime,
            "Vault: not active time"
        );
        newVault = pendingNewVault.addr;
        emit MigrationToNewVault(newVault);
    }

    // migration to new vault erc20
    function migrationToNewVaultERC20(address erc20) external {
        require(newVault != address(0), "Vault: no newVault");
        uint256 amount = IERC20Metadata(erc20).balanceOf(address(this));
        IERC20(erc20).transfer(newVault, amount);
    }

    // migration to new vault native
    function migrationToNewVaultNative() external payable {
        require(newVault != address(0), "Vault: no newVault");
        (bool success, ) = newVault.call{value: address(this).balance}(
            new bytes(0)
        );
        require(success, "transferEther: failed");
    }

    // migration to new vault erc721
    function migrationToNewVaultERC721(
        address erc721,
        uint256 tokenId
    ) external {
        require(newVault != address(0), "Vault: no newVault");
        IERC721(erc721).transferFrom(address(this), newVault, tokenId);
    }

    // migration to new vault erc1155
    function migrationToNewVaultERC1155(
        address erc1155,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external {
        require(newVault != address(0), "Vault: no newVault");
        IERC1155(erc1155).safeBatchTransferFrom(
            address(this),
            newVault,
            tokenIds,
            amounts,
            ""
        );
    }

    fallback() external payable {
        emit NativeTokenReceived(msg.sender, msg.value, "");
    }

    /// native token bridge
    receive() external payable {
        emit NativeTokenReceived(msg.sender, msg.value, "");
    }

    /// native token bridge to
    function transferNativeToken(bytes memory data) external payable {
        require(msg.value > 0, "transferNativeToken: value is 0");
        emit NativeTokenReceived(msg.sender, msg.value, data);
    }

    /// This will allow public chain dapps to send tokens directly to the sodium chain
    function transferERC20(IERC20Metadata erc20, uint256 amount, bytes memory data) external {
        string memory symbol = erc20.symbol();
        string memory name = erc20.name();
        uint8 decimals = erc20.decimals();
        require(amount > 0, "transferERC20: amount is 0");
        uint256 allowanceAmount = erc20.allowance(msg.sender, address(this));
        require(
            allowanceAmount >= amount,
            "transferERC20: allowance not enough"
        );
        erc20.transferFrom(msg.sender, address(this), amount);
        emit ERC20TokenReceived(
            address(erc20), 
            msg.sender, 
            amount,
            symbol,
            name,
            decimals,
            data
        );
    }

    function transferNativeToken(
        uint256 rand,
        address payable to,
        uint256 amount
    ) external {
        _onlyMPC(rand);
        (bool success, ) = to.call{value: amount}(new bytes(0));
        require(success, "transferEther: failed");
    }

    /// ERC721
    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes memory _data
    ) external returns (bytes4) {
        IERC721Metadata erc721 = IERC721Metadata(msg.sender);
        string memory name = erc721.name();
        string memory symbol = erc721.symbol();
        string memory tokenURI = erc721.tokenURI(_tokenId);

        emit ERC721TokenReceived(
            msg.sender, 
            _from, 
            _tokenId, 
            symbol,
            name,
            tokenURI,
            _data
        );
        return this.onERC721Received.selector;
    }

    // ERC1155
    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _id,
        uint256 _value,
        bytes memory _data
    ) external returns (bytes4) {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = _id;
        values[0] = _value;
        bytes4 magic = onERC1155BatchReceived(_operator, _from, ids, values, _data);
        require(magic == this.onERC1155BatchReceived.selector, "invalid magic");
        return this.onERC1155Received.selector;
    }

    // ERC1155
    function onERC1155BatchReceived(
        address _operator,
        address _from,
        uint256[] memory _ids,
        uint256[] memory _values,
        bytes memory _data
    ) public returns (bytes4) {
        IERC1155MetadataURI erc1155 = IERC1155MetadataURI(msg.sender);
        string[] memory uris = new string[](_ids.length);
        for (uint256 i = 0; i < _ids.length; i++) {
            uris[i] = erc1155.uri(_ids[i]);
        }
        emit ERC1155TokenReceived(
            msg.sender,
            _from,
            _ids,
            _values,
            uris,
            _data
        );
        return this.onERC1155BatchReceived.selector;
    }
}
