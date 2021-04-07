module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const esm = await ethers.getContract("EasySwapMakerToken")

  const deploymentBlockNumber = await ethers.provider.getBlockNumber()

  console.log(`Current block number is: ${deploymentBlockNumber}`)

  stage0EndBlock = deploymentBlockNumber + (28800)
  stage1EndBlock = deploymentBlockNumber + (28800 * 2)
  stage2EndBlock = deploymentBlockNumber + (28800 * 3)

  stage0Multiplier = 100
  stage1Multiplier = 10
  stage2Multiplier = 1

  console.log(`0 stage endBlock: ${stage0EndBlock}, multiplier : ${stage0Multiplier}`)
  console.log(`1 stage endBlock: ${stage1EndBlock}, multiplier : ${stage1Multiplier}`)
  console.log(`2 stage endBlock: ${stage2EndBlock}, multiplier : ${stage2Multiplier}`)

  const { address } = await deploy("EasySwapRewardPool", {
    from: deployer,
    args: [esm.address, dev, "1000000000000000000000", deploymentBlockNumber, stage0EndBlock, stage0Multiplier],
    log: true,
    deterministicDeployment: false
  })

  if (await esm.owner() !== address) {
    // Transfer Esm Ownership to Chef
    console.log("Transfer Esm Ownership to Chef")
    await (await esm.transferOwnership(address)).wait()
  }

  const rewardPool = await ethers.getContract("EasySwapRewardPool")

  await (await rewardPool.addStage(stage1EndBlock, stage1Multiplier)).wait()
  await (await rewardPool.addStage(stage2EndBlock, stage2Multiplier)).wait()

  if (await rewardPool.owner() !== dev) {
    // Transfer ownership of RewardPool to dev
    console.log("Transfer ownership of RewardPool to dev")
    await (await rewardPool.transferOwnership(dev)).wait()
  }
}

module.exports.tags = ["RewardPool"]
module.exports.dependencies = ["UniswapV2Factory", "UniswapV2Router02", "EasySwapMakerToken"]
