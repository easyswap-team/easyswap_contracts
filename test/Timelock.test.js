const { ethers } = require("hardhat")
const { expect } = require("chai")
const { encodeParameters, time } = require("./utilities")

describe("Timelock", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.EasySwapMakerToken = await ethers.getContractFactory("EasySwapMakerToken")
    this.Timelock = await ethers.getContractFactory("Timelock")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
    this.EasySwapRewardPool = await ethers.getContractFactory("EasySwapRewardPool")
  })

  beforeEach(async function () {
    this.esm = await this.EasySwapMakerToken.deploy()
    await this.esm.deployed()
    this.esg = await this.ERC20Mock.deploy("EasySwap Governance", "ESG", "10000000000")
    await this.esg.deployed()
    this.timelock = await this.Timelock.deploy(this.bob.address, "259200")
  })

  it("should not allow non-owner to do operation", async function () {
    await this.esm.transferOwnership(this.timelock.address)
    // await expectRevert(this.esm.transferOwnership(carol, { from: alice }), "Ownable: caller is not the owner")

    await expect(this.esm.transferOwnership(this.carol.address)).to.be.revertedWith("Ownable: caller is not the owner")
    await expect(this.esm.connect(this.bob).transferOwnership(this.carol.address)).to.be.revertedWith("Ownable: caller is not the owner")

    await expect(
      this.timelock.queueTransaction(
        this.esm.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [this.carol.address]),
        (await time.latest()).add(time.duration.days(4))
      )
    ).to.be.revertedWith("Timelock::queueTransaction: Call must come from admin.")
  })

  it("should do the timelock thing", async function () {
    await this.esm.transferOwnership(this.timelock.address)
    const eta = (await time.latest()).add(time.duration.days(4))
    await this.timelock
      .connect(this.bob)
      .queueTransaction(this.esm.address, "0", "transferOwnership(address)", encodeParameters(["address"], [this.carol.address]), eta)
    await time.increase(time.duration.days(1))
    await expect(
      this.timelock
        .connect(this.bob)
        .executeTransaction(this.esm.address, "0", "transferOwnership(address)", encodeParameters(["address"], [this.carol.address]), eta)
    ).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.")
    await time.increase(time.duration.days(4))
    await this.timelock
      .connect(this.bob)
      .executeTransaction(this.esm.address, "0", "transferOwnership(address)", encodeParameters(["address"], [this.carol.address]), eta)
    expect(await this.esm.owner()).to.equal(this.carol.address)
  })

  it("should also work with EasySwapRewardPool", async function () {
    this.lp1 = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")
    this.lp2 = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")
    this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "1000", "0", "1000", "10")
    await this.esm.transferOwnership(this.rewardPool.address)
    await this.rewardPool.add("100", this.lp1.address, true)
    await this.rewardPool.transferOwnership(this.timelock.address)
    const eta = (await time.latest()).add(time.duration.days(4))
    await this.timelock
      .connect(this.bob)
      .queueTransaction(
        this.rewardPool.address,
        "0",
        "set(uint256,uint256,bool)",
        encodeParameters(["uint256", "uint256", "bool"], ["0", "200", false]),
        eta
      )
    await this.timelock
      .connect(this.bob)
      .queueTransaction(
        this.rewardPool.address,
        "0",
        "add(uint256,address,bool)",
        encodeParameters(["uint256", "address", "bool"], ["100", this.lp2.address, false]),
        eta
      )
    await time.increase(time.duration.days(4))
    await this.timelock
      .connect(this.bob)
      .executeTransaction(
        this.rewardPool.address,
        "0",
        "set(uint256,uint256,bool)",
        encodeParameters(["uint256", "uint256", "bool"], ["0", "200", false]),
        eta
      )
    await this.timelock
      .connect(this.bob)
      .executeTransaction(
        this.rewardPool.address,
        "0",
        "add(uint256,address,bool)",
        encodeParameters(["uint256", "address", "bool"], ["100", this.lp2.address, false]),
        eta
      )
    expect((await this.rewardPool.poolInfo("0")).allocPoint).to.equal("200")
    expect(await this.rewardPool.totalAllocPoint()).to.equal("300")
    expect(await this.rewardPool.poolLength()).to.equal("2")
  })
})
