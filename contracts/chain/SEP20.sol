// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./IExitChain20.sol";
import "./ISEP20Receiver.sol";

contract SEP20 is Context, IERC20, IERC20Metadata, IExitChain20 {
    using Address for address;
    using Strings for uint256;

    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _exitChainId;
    address private _exitContractAddress;

    address private _owner;

    constructor(
        string memory name_,
        string memory symbol_, 
        uint8 decimals_,
        uint256 exitChainId_,
        address exitContractAddress_
    ) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _exitChainId = exitChainId_;
        _exitContractAddress = exitContractAddress_;
        _owner = msg.sender;
    }

    modifier onlyOwner {
        require(_msgSender() == _owner, "SEP20: caller is not the owner");
        _;
    }

    function exitInfo() public view override returns (ExitInfo memory) {
        return ExitInfo(_exitContractAddress, _exitChainId);
    }

    function exit(uint256 amount) public override {
        address owner = _msgSender();
        _burn(owner, amount);
        emit ExitSEP20(owner, amount);
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(
        address account
    ) public view virtual override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    function safeTransfer(
        address to,
        uint256 amount,
        bytes memory data
    ) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        require(
            _checkOnSEP20Received(owner, to, amount, data),
            "SEP20: transfer to non ERC20Receiver implementer"
        );
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    bytes4 internal constant SAFE_TRANSFER_SIG = bytes4(keccak256("safeTransfer(address,uint256,bytes)"));
    function mint(address owner, uint256 amount, bytes calldata data) public onlyOwner {
        _mint(owner, amount);
        if (data.length > 0) {
            bytes4 sig = bytes4(data[:4]);
            if (sig == SAFE_TRANSFER_SIG) {
                address to_;
                uint256 amount_;
                bytes memory data_;
                (to_, amount_, data_) = abi.decode(data[4:], (address, uint256, bytes));
                _transfer(owner, to_, amount_);
                require(
                    _checkOnSEP20Received(owner, to_, amount_, data_),
                    "SEP20: transfer to non ERC20Receiver implementer"
                );
            } else {
                revert("SEP20: invalid data");
            }
        }
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);
        require(
            currentAllowance >= subtractedValue,
            "ERC20: decreased allowance below zero"
        );
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        uint256 fromBalance = _balances[from];
        require(
            fromBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        unchecked {
            _balances[from] = fromBalance - amount;
            // Overflow not possible: the sum of all balances is capped by totalSupply, and the sum is preserved by
            // decrementing then incrementing.
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);

        _afterTokenTransfer(from, to, amount);
    }

    function _checkOnSEP20Received(
        address from,
        address to,
        uint256 amount,
        bytes memory data
    ) internal returns (bool) {
        if (!to.isContract()) {
            return true;
        }
        bytes4 retval = ISEP20Receiver(to).onSEP20Received(
            _msgSender(),
            from,
            amount,
            data
        );
        return (retval == ISEP20Receiver(to).onSEP20Received.selector);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        unchecked {
            // Overflow not possible: balance + amount is at most totalSupply + amount, which is checked above.
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
            // Overflow not possible: amount <= accountBalance <= totalSupply.
            _totalSupply -= amount;
        }

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "ERC20: insufficient allowance"
            );
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}
}
