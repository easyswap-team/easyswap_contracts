// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EasySwapMakerToken is ERC20, Ownable {
    constructor(address _to, uint256 _supply) public ERC20("EasySwap Maker", "ESM") {
        _mint(_to, _supply);
    }
}
