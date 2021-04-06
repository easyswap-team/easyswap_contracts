// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../EasySwapRewardPool.sol";
import "../EasySwapMakerToken.sol";

contract EasySwapRewardPoolMock is EasySwapRewardPool {
    uint256 private currentBlock;

    constructor(
        EasySwapMakerToken _esm,
        address _devaddr,
        uint256 _esmPerBlock,
        uint256 _startBlock,
        uint256 _firstStageEndBlock,
        uint256 _firstStageMultiplier
    )
        public
        EasySwapRewardPool(_esm, _devaddr, _esmPerBlock, _startBlock, _firstStageEndBlock, _firstStageMultiplier)
    {}

    function setCurrentBlock(uint256 _currentBlock) public {
        currentBlock = _currentBlock;
    }

    function _getCurrentBlock() override internal view returns (uint256) {
        return currentBlock;
    }
}
