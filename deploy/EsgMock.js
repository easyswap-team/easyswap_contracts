const { BigNumber } = require("@ethersproject/bignumber")

const tokens = BigNumber.from("1000000000000000000")

module.exports = async function ({ getNamedAccounts, deployments, ethers }) {
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy("ERC20Mock", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: ["EasySwap Governance", "ESG", BigNumber.from("100000").mul(tokens)]
  })

  const esg = await ethers.getContract("ERC20Mock")

  console.log("Now Deployer has " + (await esg.balanceOf(deployer)/1e18) + " ESG")
}

module.exports.tags = ["ERC20Mock"]
