const { ethers } = require("hardhat")
const { expect } = require("chai")
const { BN } = require("bn.js")

describe("EasySwapRewardPool", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.EasySwapRewardPool = await ethers.getContractFactory("EasySwapRewardPoolMock")
    this.EasySwapMakerToken = await ethers.getContractFactory("EasySwapMakerToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function () {
    this.esm = await this.EasySwapMakerToken.deploy()
    await this.esm.deployed()
    this.esg = await this.ERC20Mock.deploy("EasySwap Governance", "ESG", "10000000000")
    await this.esg.deployed()
  })

  it("should set correct state variables", async function () {
    this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "1000", "0", "1000", "10")
    await this.rewardPool.deployed()

    await this.esm.addMinter(this.rewardPool.address)

    const esm = await this.rewardPool.esm()
    const esg = await this.rewardPool.esg()
    const devaddr = await this.rewardPool.devaddr()
    const owner = await this.esm.owner()

    expect(esm).to.equal(this.esm.address)
    expect(esg).to.equal(this.esg.address)
    expect(devaddr).to.equal(this.dev.address)
    expect(owner).to.equal(this.signers[0].address)
  })

  it("should allow dev and only dev to update dev", async function () {
    this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "1000", "0", "1000", "10")
    await this.rewardPool.deployed()

    expect(await this.rewardPool.devaddr()).to.equal(this.dev.address)

    await expect(this.rewardPool.connect(this.bob).dev(this.bob.address, { from: this.bob.address })).to.be.revertedWith("dev: wut?")

    await this.rewardPool.connect(this.dev).dev(this.bob.address, { from: this.dev.address })

    expect(await this.rewardPool.devaddr()).to.equal(this.bob.address)

    await this.rewardPool.connect(this.bob).dev(this.alice.address, { from: this.bob.address })

    expect(await this.rewardPool.devaddr()).to.equal(this.alice.address)
  })

  context("With ERC/LP token added to the field", function () {
    beforeEach(async function () {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")

      await this.lp.transfer(this.alice.address, "1000")

      await this.lp.transfer(this.bob.address, "1000")

      await this.lp.transfer(this.carol.address, "1000")

      this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2", "10000000000")

      await this.lp2.transfer(this.alice.address, "1000")

      await this.lp2.transfer(this.bob.address, "1000")

      await this.lp2.transfer(this.carol.address, "1000")
    })

    it("should allow emergency withdraw", async function () {
      // 100 per block farming rate starting at block 100 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "100", "1000", "10")
      await this.rewardPool.deployed()

      await this.rewardPool.add("100", this.lp.address, true)

      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")

      await this.rewardPool.connect(this.bob).deposit(0, "100")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.rewardPool.connect(this.bob).emergencyWithdraw(0)

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should give out ESMs only after farming time", async function () {
      // 100 per block farming rate starting at block 100 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "100", "1000", "10")
      //await this.rewardPool.deployed()

      await this.esm.addMinter(this.rewardPool.address)

      await this.rewardPool.add("100", this.lp.address, true)

      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.connect(this.bob).deposit(0, "100")
      await this.rewardPool.setCurrentBlock("90")

      await this.rewardPool.connect(this.bob).deposit(0, "0") // block 90
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      await this.rewardPool.setCurrentBlock("95")

      await this.rewardPool.connect(this.bob).deposit(0, "0") // block 95
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      await this.rewardPool.setCurrentBlock("100")

      await this.rewardPool.connect(this.bob).deposit(0, "0") // block 100
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      await this.rewardPool.setCurrentBlock("101")

      await this.rewardPool.connect(this.bob).deposit(0, "0") // block 101
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1000")

      await this.rewardPool.setCurrentBlock("105")
      await this.rewardPool.connect(this.bob).deposit(0, "0") // block 105

      expect(await this.esm.balanceOf(this.bob.address)).to.equal("5000")
      expect(await this.esm.balanceOf(this.dev.address)).to.equal("500")
      expect(await this.esm.totalSupply()).to.equal("5500")
    })

    it("should not distribute ESMs if no one deposit", async function () {
      // 100 per block farming rate starting at block 200 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "200", "1000", "10")
      await this.rewardPool.deployed()
      await this.esm.addMinter(this.rewardPool.address)
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.setCurrentBlock("200")
      expect(await this.esm.totalSupply()).to.equal("0")
      await this.rewardPool.setCurrentBlock("205")
      expect(await this.esm.totalSupply()).to.equal("0")
      await this.rewardPool.setCurrentBlock("210")
      await this.rewardPool.connect(this.bob).deposit(0, "10") // block 210
      expect(await this.esm.totalSupply()).to.equal("0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.dev.address)).to.equal("0")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
      await this.rewardPool.setCurrentBlock("220")
      await this.rewardPool.connect(this.bob).withdraw(0, "10") // block 220
      expect(await this.esm.totalSupply()).to.equal("11000")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("10000")
      expect(await this.esm.balanceOf(this.dev.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should distribute ESMs properly for each staker", async function () {
      // 100 per block farming rate starting at block 300 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "300", "1000", "10")
      await this.rewardPool.deployed()
      await this.esm.addMinter(this.rewardPool.address)
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", {
        from: this.alice.address,
      })
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000", {
        from: this.bob.address,
      })
      await this.lp.connect(this.carol).approve(this.rewardPool.address, "1000", {
        from: this.carol.address,
      })
      // Alice deposits 10 LPs at block 310
      await this.rewardPool.setCurrentBlock("310")
      await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // Bob deposits 20 LPs at block 314
      await this.rewardPool.setCurrentBlock("314")
      await this.rewardPool.connect(this.bob).deposit(0, "20", { from: this.bob.address })
      // Carol deposits 30 LPs at block 318
      await this.rewardPool.setCurrentBlock("318")
      await this.rewardPool.connect(this.carol).deposit(0, "30", { from: this.carol.address })
      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
      //   EasySwapRewardPool should have the remaining: 10000 - 5666 = 4334
      await this.rewardPool.setCurrentBlock("320")
      await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      expect(await this.esm.totalSupply()).to.equal("11000")
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("5666")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("4334")
      expect(await this.esm.balanceOf(this.dev.address)).to.equal("1000")
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
      await this.rewardPool.setCurrentBlock("330")
      await this.rewardPool.connect(this.bob).withdraw(0, "5", { from: this.bob.address })
      expect(await this.esm.totalSupply()).to.equal("22000")
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("5666")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("6190")
      expect(await this.esm.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("8144")
      expect(await this.esm.balanceOf(this.dev.address)).to.equal("2000")
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await this.rewardPool.setCurrentBlock("340")
      await this.rewardPool.connect(this.alice).withdraw(0, "20", { from: this.alice.address })
      await this.rewardPool.setCurrentBlock("350")
      await this.rewardPool.connect(this.bob).withdraw(0, "15", { from: this.bob.address })
      await this.rewardPool.setCurrentBlock("360")
      await this.rewardPool.connect(this.carol).withdraw(0, "30", { from: this.carol.address })
      expect(await this.esm.totalSupply()).to.equal("55000")
      expect(await this.esm.balanceOf(this.dev.address)).to.equal("5000")
      // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("11600")
      // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("11831")
      // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
      expect(await this.esm.balanceOf(this.carol.address)).to.equal("26568")
      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })

    it("should give proper ESMs allocation to each pool", async function () {
      // 100 per block farming rate starting at block 400 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "400", "1000", "10")
      await this.esm.addMinter(this.rewardPool.address)
      await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", { from: this.alice.address })
      await this.lp2.connect(this.bob).approve(this.rewardPool.address, "1000", { from: this.bob.address })
      // Add first LP to the pool with allocation 1
      await this.rewardPool.add("10", this.lp.address, true)
      // Alice deposits 10 LPs at block 410
      await this.rewardPool.setCurrentBlock("410")
      await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // Add LP2 to the pool with allocation 2 at block 420
      await this.rewardPool.setCurrentBlock("420")
      await this.rewardPool.add("20", this.lp2.address, true)
      // Alice should have 10*1000 pending reward
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("10000")
      // Bob deposits 10 LP2s at block 425
      await this.rewardPool.setCurrentBlock("425")
      await this.rewardPool.connect(this.bob).deposit(1, "5", { from: this.bob.address })
      // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("11666")
      await this.rewardPool.setCurrentBlock("430")
      // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("13333")
      expect(await this.rewardPool.pendingEsm(1, this.bob.address)).to.equal("3333")
    })

    it("should stop giving bonus ESMs after end of all stages", async function () {
      // 100 per block farming rate starting at block 500 with bonus until block 600
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "500", "600", "10")
      await this.esm.addMinter(this.rewardPool.address)
      await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", { from: this.alice.address })
      await this.rewardPool.add("1", this.lp.address, true)

      await this.rewardPool.addStage("700", "5")
      await this.rewardPool.addStage("800", "1")

      // Alice deposits 10 LPs at block 590
      await this.rewardPool.setCurrentBlock("590")
      await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // At block 605, she should have 10*100*10 + 5*100*5 = 12500 pending.
      await this.rewardPool.setCurrentBlock("605")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("12500")
      // At block 606, Alice withdraws all pending rewards and should get 13000.
      await this.rewardPool.setCurrentBlock("606")
      await this.rewardPool.connect(this.alice).deposit(0, "0", { from: this.alice.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("13000")
      // At block 900, she should have 94*100*5 + 100*100*1 + 100*100*0 = 57000 pending.
      await this.rewardPool.setCurrentBlock("900")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("57000")
    })

    context('Multiplier stages', function () {
      beforeEach(async function () {
        this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100", "500", "600", "10")
        await this.rewardPool.deployed()
        await this.esm.addMinter(this.rewardPool.address)
        await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", { from: this.alice.address })
        await this.rewardPool.add("1", this.lp.address, true)

        await this.rewardPool.addStage("700", "5")
        await this.rewardPool.addStage("800", "1")
      })

      it('addStage reverts if new endBlock is less than or equal to previous', async function () {
        await expect(this.rewardPool.addStage("799", "1")).to.be.revertedWith("addStage: new endBlock less than previous")
        await expect(this.rewardPool.addStage("800", "1")).to.be.revertedWith("addStage: new endBlock less than previous")
      })

      it('stages are displayed correctly', async function () {
        stage_0 = await this.rewardPool.stages(0)
        stage_1 = await this.rewardPool.stages(1)
        stage_2 = await this.rewardPool.stages(2)
        await expect(this.rewardPool.stages(3)).to.be.reverted

        expect(stage_0.endBlock).to.equal("600")
        expect(stage_0.multiplier).to.equal("10")

        expect(stage_1.endBlock).to.equal("700")
        expect(stage_1.multiplier).to.equal("5")

        expect(stage_2.endBlock).to.equal("800")
        expect(stage_2.multiplier).to.equal("1")
      })

      it('getMultiplier() works correctly', async function () {
        expect(await this.rewardPool.getMultiplier(500, 600)).to.equal("1000")
        expect(await this.rewardPool.getMultiplier(600, 700)).to.equal("500")
        expect(await this.rewardPool.getMultiplier(700, 800)).to.equal("100")

        expect(await this.rewardPool.getMultiplier(500, 520)).to.equal("200")
        expect(await this.rewardPool.getMultiplier(580, 600)).to.equal("200")

        expect(await this.rewardPool.getMultiplier(600, 620)).to.equal("100")
        expect(await this.rewardPool.getMultiplier(680, 700)).to.equal("100")

        expect(await this.rewardPool.getMultiplier(700, 720)).to.equal("20")
        expect(await this.rewardPool.getMultiplier(780, 800)).to.equal("20")

        expect(await this.rewardPool.getMultiplier(590, 605)).to.equal("125")
        expect(await this.rewardPool.getMultiplier(590, 606)).to.equal("130")
      })
    })

    context('Esm emission scenario', function () {
      beforeEach(async function () {
        this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100000000000000", "0", "201600", "25314")
        await this.rewardPool.deployed()
        await this.esm.addMinter(this.rewardPool.address)

        await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", { from: this.alice.address })
        await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000", { from: this.bob.address })
        await this.lp.connect(this.carol).approve(this.rewardPool.address, "1000", { from: this.carol.address })

        await this.rewardPool.add("1", this.lp.address, true)
      })

      it('1st week rewards are correct', async function () {
        // day 1
        await this.rewardPool.setCurrentBlock("0")
        await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })

        // day 2
        await this.rewardPool.setCurrentBlock("28800")
        await this.rewardPool.connect(this.bob).deposit(0, "20", { from: this.bob.address })

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("72904320000000000000000")

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("72904320000000000000000") // daily * (1)
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0")

        // day 3
        await this.rewardPool.setCurrentBlock("57600")
        await this.rewardPool.connect(this.carol).deposit(0, "30", { from: this.carol.address })

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("145808640000000000000000")

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("97205760000000000000000") // daily * (1 + 1/3)
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("48602880000000000000000") // daily * (2/3)
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0")

        // day 4
        await this.rewardPool.setCurrentBlock("86400")
        await this.rewardPool.updatePool(0)

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("218712960000000000000000")

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("109356480000000000000000") // daily * (1 + 1/3 + 1/6)
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("72904320000000000000000") // daily * (2/3 + 1/3)
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("36452160000000000000000") // daily * 1/2

        // day 5
        await this.rewardPool.setCurrentBlock("115200")
        await this.rewardPool.connect(this.alice).deposit(0, 0, { from: this.alice.address })

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("121507200000000000000000") // daily * (1 + 1/3 + 1/6 + 1/6)
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("170110080000000000000000")

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("0") // withdrawed, now 0
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("97205760000000000000000") // daily * (2/3 + 1/3 + 1/3)
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("72904320000000000000000") // daily * (1/2 + 1/2)

        // day 6
        await this.rewardPool.setCurrentBlock("144000")
        await this.rewardPool.connect(this.carol).withdraw(0, 20, { from: this.carol.address })

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("121507200000000000000000") // daily * (1 + 1/3 + 1/6 + 1/6)
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("109356480000000000000000") // daily * (1/2 + 1/2 + 1/2)
        expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("133657920000000000000000")

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("12150720000000000000000") // daily * (1/6)
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("121507200000000000000000") // daily * (2/3 + 1/3 + 1/3 + 1/3 + 1/2)
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0") // withdrawed, now 0

        // day 7
        await this.rewardPool.setCurrentBlock("172800")
        await this.rewardPool.connect(this.alice).withdraw(0, 10, { from: this.alice.address })
        await this.rewardPool.connect(this.bob).withdraw(0, 20, { from: this.bob.address })
        await this.rewardPool.connect(this.carol).withdraw(0, 10, { from: this.carol.address })

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("151884000000000000000000") // daily * (1 + 1/3 + 1/6 + 1/6 + 1/6 + 1/4)
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("157959360000000000000000") // daily * (2/3 + 1/3 + 1/3 + 1/3 + 1/2 + 1/2)
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("127582560000000000000000") // daily * (1/2 + 1/2 + 1/2 + 1/4)
        expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("0")

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("0") // withdrawed, now 0
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0") // withdrawed, now 0
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0") // withdrawed, now 0

        // end of 1st week
        await this.rewardPool.setCurrentBlock("201600")
        await this.rewardPool.updatePool(0)

        expect(await this.esm.balanceOf(this.alice.address)).to.equal("151884000000000000000000") // daily * (1 + 1/3 + 1/6 + 1/6 + 1/6 + 1/4)
        expect(await this.esm.balanceOf(this.bob.address)).to.equal("157959360000000000000000") // daily * (2/3 + 1/3 + 1/3 + 1/3 + 1/2 + 1/2)
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("127582560000000000000000") // daily * (1/2 + 1/2 + 1/2 + 1/4)
        expect(await this.esm.balanceOf(this.carol.address)).to.equal("127582560000000000000000") // daily * (1/2 + 1/2 + 1/2 + 1/4)
        expect(await this.esm.balanceOf(this.dev.address)).to.equal("43742592000000000000000") // daily * (1/2 + 1/2 + 1/2 + 1/4)

        expect(await this.esm.totalSupply()).to.equal("481168512000000000000000") // 6 daily rewards + dev's 10%

        expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal("0") // withdrawed, now 0
        expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0") // withdrawed, now 0
        expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0") // withdrawed, now 0
      })
    })
  })
})
