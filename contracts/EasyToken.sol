// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract EasyToken is ERC20, Ownable {
    constructor() public ERC20("Easy Token", "ESM") {}
    mapping (address => bool) minters;
    function mint(address _to, uint256 _amount) onlyMinter public  {
        _mint(_to, _amount);
    }

    function addMinter(address _address) onlyOwner public {
        minters[_address] = true;
    }

     function delMinter(address _address) onlyOwner public {
        minters[_address] = false;
    }
    modifier onlyMinter() {
        require(minters[msg.sender],"Ownable: caller is not the owner");
        _;
    }
}
