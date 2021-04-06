// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../MasterChef.sol";
import "../SushiToken.sol";

contract MasterChefMock is MasterChef {
    uint256 private currentBlock;

    constructor(
        SushiToken _sushi,
        address _devaddr,
        uint256 _sushiPerBlock,
        uint256 _startBlock,
        uint256 _firstStageEndBlock,
        uint256 _firstStageMultiplier
    )
        public
        MasterChef(_sushi, _devaddr, _sushiPerBlock, _startBlock, _firstStageEndBlock, _firstStageMultiplier)
    {}

    function setCurrentBlock(uint256 _currentBlock) public {
        currentBlock = _currentBlock;
    }

    function _getCurrentBlock() override internal view returns (uint256) {
        return currentBlock;
    }
}
