const { BigNumber } = require("@ethersproject/bignumber")

const tokens = BigNumber.from("1000000000000000000")

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const esm = await ethers.getContract("EasySwapMakerToken")
  const esg = await ethers.getContract("ERC20Mock")

  const deploymentBlockNumber = await ethers.provider.getBlockNumber()
  console.log(`Current block number is: ${deploymentBlockNumber}`)

  const { address } = await deploy("EasySwapRewardPool", {
    from: deployer,
    args: [esm.address, esg.address, dev],
    log: true,
    deterministicDeployment: false
  })

  const rewardPool = await ethers.getContract("EasySwapRewardPool")

  console.log("Transfer ESM to RP address")
  await (await esm.transfer(rewardPool.address, BigNumber.from("10000000").mul(tokens))).wait()
  console.log("Now RewardPool has " + (await esm.balanceOf(rewardPool.address)).div(tokens) + " ESM")

  console.log("Transfer ESG to RewardPool address")
  await (await esg.transfer(rewardPool.address, BigNumber.from("60000").mul(tokens))).wait()
  console.log("Now RewardPool has " + (await esg.balanceOf(rewardPool.address)).div(tokens) + " ESG")

  console.log("Set dev fee to 5%")
  await (await rewardPool.setDevFee(50000)).wait()
  
  console.log("Add stages")
  await (await rewardPool.addStage(8060500, 8060680, BigNumber.from("2835").mul(tokens), BigNumber.from("167").mul(tokens))).wait()
  await (await rewardPool.addStage(8060681, 8060861, BigNumber.from("1610").mul(tokens), BigNumber.from("83").mul(tokens))).wait()
  await (await rewardPool.addStage(8060862, 8061042, BigNumber.from("1298").mul(tokens), BigNumber.from("55").mul(tokens))).wait()
  await (await rewardPool.addStage(8061043, 8061223, BigNumber.from("698").mul(tokens), BigNumber.from("28").mul(tokens))).wait()
  await (await rewardPool.addStage(8061224, 8062304, BigNumber.from("472").mul(tokens), BigNumber.from("0").mul(tokens))).wait()
  await (await rewardPool.addStage(8062305, 8063745, BigNumber.from("343").mul(tokens), BigNumber.from("0").mul(tokens))).wait()
  await (await rewardPool.addStage(8063746, 8065666, BigNumber.from("249").mul(tokens), BigNumber.from("0").mul(tokens))).wait()

  console.log("Add supported LP and well-known tokens")
  console.log("WBNB-USDT")
  await (await rewardPool.add(10000, '0xBEE09E500219e29989e8C32EB129465FF30b0de9', true)).wait()
  console.log("WBNB-BTCB")
  await (await rewardPool.add(10000, '0xaDA474fD70E21108984EeC2dac57c4067FaE9839', true)).wait()
  console.log("WBNB-BBETH")
  await (await rewardPool.add(10000, '0x9a10b3cBE6CCe3E3F136386DB5894e3f214Dc212', true)).wait()
  console.log("WBNB-BUSD")
  await (await rewardPool.add(10000, '0x813aC670f9D1FCa53909327729f06e5ea74BA752', true)).wait()
  console.log("WBNB-ESM")
  await (await rewardPool.add(10000, '0xC0b3c6A13A2B4Ab88Ec6520Fc0CD48E214636C7a', true)).wait()
  console.log("ESM")
  await (await rewardPool.add(10000, '0x605341403C8177f3F446fe049D7d5C5714316f94', true)).wait()

}

module.exports.tags = ["RewardPool"]
module.exports.dependencies = ["UniswapV2Factory", "UniswapV2Router02", "EasySwapMakerToken", "ERC20Mock"]
