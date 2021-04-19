const { BigNumber } = require("@ethersproject/bignumber")

const tokens = BigNumber.from("1000000000000000000").mul("10000000")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy("EasySwapMakerToken", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [deployer, tokens]
  })

  const esm = await ethers.getContract("EasySwapMakerToken")
  console.log("Now Deployer has " + (await esm.balanceOf(deployer)) + " ESM")
}

module.exports.tags = ["EasySwapMakerToken"]
