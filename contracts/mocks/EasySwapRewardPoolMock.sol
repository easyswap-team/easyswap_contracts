// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../EasySwapRewardPool.sol";
import "../EasySwapMakerToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EasySwapRewardPoolMock is EasySwapRewardPool {
    uint256 private currentBlock;

    constructor(
        EasySwapMakerToken _esm,
        IERC20 _esg,
        address _devaddr,
        uint256 _startBlock
    )
        public
        EasySwapRewardPool(_esm, _esg, _devaddr, _startBlock)
    {}

    function setCurrentBlock(uint256 _currentBlock) public {
        currentBlock = _currentBlock;
    }

    function _getCurrentBlock() override internal view returns (uint256) {
        return currentBlock;
    }
}
