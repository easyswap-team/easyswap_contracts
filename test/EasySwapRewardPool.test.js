const { ethers } = require("hardhat")
const { expect } = require("chai")
const { BN } = require("bn.js")
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

describe("EasySwapRewardPool", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.deployer = this.signers[4]

    this.EasySwapRewardPool = await ethers.getContractFactory("EasySwapRewardPoolMock")
    this.EasySwapMakerToken = await ethers.getContractFactory("EasySwapMakerToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function () {
    this.esm = await this.EasySwapMakerToken.deploy(this.alice.address, 10000)
    await this.esm.deployed()
    this.esg = await this.ERC20Mock.deploy("EasySwap Governance", "ESG", "10000")
    await this.esg.deployed()
  })

  it("should set correct state variables", async function () {
    this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
    await this.rewardPool.deployed()
    const esm = await this.rewardPool.esm()
    const esg = await this.rewardPool.esg()
    const devaddr = await this.rewardPool.devaddr()
    const owner = await this.esm.owner()

    expect(esm).to.equal(this.esm.address)
    expect(esg).to.equal(this.esg.address)
    expect(devaddr).to.equal(this.dev.address)
    expect(owner).to.equal(this.signers[0].address)
  })

  it("dev address and its setter", async function () {
    this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
    await this.rewardPool.deployed()
    expect(await this.rewardPool.devaddr()).to.equal(this.dev.address)

    await expect(this.rewardPool.connect(this.bob).setDevAddr(this.bob.address, { from: this.bob.address })).to.be.revertedWith("Ownable: caller is not the owner")
    await this.rewardPool.setDevAddr(this.bob.address)
    expect(await this.rewardPool.devaddr()).to.equal(this.bob.address)
  })

  it("Fee and its setter", async function () {
    this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
    await this.rewardPool.deployed()
    expect(await this.rewardPool.devFeePpm()).to.equal(0)

    await expect(this.rewardPool.connect(this.bob).setDevFee(this.bob.address, { from: this.bob.address })).to.be.revertedWith("Ownable: caller is not the owner")
    await this.rewardPool.setDevFee(123456)
    expect(await this.rewardPool.devFeePpm()).to.equal(123456)
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
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("123", "99999", "1" /*ESM per block*/, "1" /*ESG per block*/)
      await this.rewardPool.add("100", this.lp.address, true)

      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")

      await this.rewardPool.connect(this.bob).deposit(0, "100")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.rewardPool.connect(this.bob).emergencyWithdraw(0)

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })


    it("should revert when totalAllocPoint equals 0, if ADDidng LP pair with 0 allocPoint", async function () {
      // deploying contract and adds Reward Stages
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("123", "99999", "60" /*ESM per block*/, "60" /*ESG per block*/)
      

      // Add LP token to the Reward Pool  with allocPoints = 0, update=false 
      await expect(this.rewardPool.add('0', this.lp.address, false)).to.be.revertedWith("add: totalAllocPoint can't be 0")
      await expect(this.rewardPool.add('0', this.lp2.address, true)).to.be.revertedWith("add: totalAllocPoint can't be 0")

    })

    it("should revert when totalAllocPoint equals 0, if SETting LP pair with 0 allocPoint", async function () {
      // deploying contract and adds Reward Stages
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("123", "99999", "60" /*ESM per block*/, "60" /*ESG per block*/)
      
      // Add LP tokens to the RewardPool, with allocPoint != 0
      await this.rewardPool.add("10", this.lp.address, true)
      await this.rewardPool.add("10", this.lp2.address, true)

      expect(await this.rewardPool.totalAllocPoint()).to.equal('20')
      expect(await this.rewardPool.poolLength()).to.equal('2')

      // set first LPpool's allocPoints to zero, after trying to set second pool to zero and get revert
      // regardless of value massUpdate (false or true)
      await this.rewardPool.set(0, 0, false)
      await expect(this.rewardPool.set(1, 0, true)).to.be.revertedWith("set: totalAllocPoint can't be 0")
      await expect(this.rewardPool.set(1, 0, false)).to.be.revertedWith("set: totalAllocPoint can't be 0")

      await this.rewardPool.set(0, 0, true)
      await expect(this.rewardPool.set(1, 0, true)).to.be.revertedWith("set: totalAllocPoint can't be 0")
      await expect(this.rewardPool.set(1, 0, false)).to.be.revertedWith("set: totalAllocPoint can't be 0")

      // set second LPpool's allocPoints to zero, after trying to set first pool to zero and get revert
      // regardless of the value massUpdate (false or true)
      await this.rewardPool.set(0, 10, false)
      await this.rewardPool.set(1, 0, false)

      await expect(this.rewardPool.set(0, 0, true)).to.be.revertedWith("set: totalAllocPoint can't be 0")
      await expect(this.rewardPool.set(0, 0, false)).to.be.revertedWith("set: totalAllocPoint can't be 0")

      await this.rewardPool.set(1, 0, true)
      await expect(this.rewardPool.set(0, 0, true)).to.be.revertedWith("set: totalAllocPoint can't be 0")
      await expect(this.rewardPool.set(0, 0, false)).to.be.revertedWith("set: totalAllocPoint can't be 0")
    })

    it("should revert when totalAllocPoint == 0, if SETting LP pair with 0 allocPoint, with user deposit", async function () {
      // deploying contract and adds Reward Stages
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("123", "99999", "60" /*ESM per block*/, "60" /*ESG per block*/)
      
      await this.rewardPool.add("100", this.lp.address, true)

      expect(await this.rewardPool.poolLength()).to.equal("1")
      expect(await this.rewardPool.totalAllocPoint()).to.equal('100')

      // Bob makes 'Deposit' for 100 LP tokens to fuerst pool
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")    
      await this.rewardPool.connect(this.bob).deposit(0, "100")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      // Time goes and became first reward block
      await this.rewardPool.setCurrentBlock("124")

      // Check ESM rewards for Bob
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("60")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("60")

      // Add new LP pool with update and check ESM rewards
      await this.rewardPool.add("100", this.lp2.address, true)
      expect(await this.rewardPool.poolLength()).to.equal("2")
      expect(await this.rewardPool.totalAllocPoint()).to.equal('200')

      // SET first pool points to zero
      await this.rewardPool.set(0, 0, true)

      // Then trying to set second pool to zero and get revert
      await expect(this.rewardPool.set(1, 0, false)).to.be.revertedWith("set: totalAllocPoint can't be 0")

    })

    it("should give out ESMs and ESGs at farming time w.o. fees", async function () {
      // 100 ESM and 10 ESG per block farming rate starting at block 100 and ending at block 199
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("100", "199", "12" /*ESM per block*/, "6" /*ESG per block*/)

      // Check basic math of getting total rewards
      // inside one period's boundaries
      /*
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[0]).to.equal("12")
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[1]).to.equal("6")
      expect((await this.rewardPool.getTotalEsxRewards("100","101"))[0]).to.equal("24")
      expect((await this.rewardPool.getTotalEsxRewards("100","101"))[1]).to.equal("12")
      expect((await this.rewardPool.getTotalEsxRewards("100","102"))[0]).to.equal("36")
      expect((await this.rewardPool.getTotalEsxRewards("100","102"))[1]).to.equal("18")
      expect((await this.rewardPool.getTotalEsxRewards("100","199"))[0]).to.equal("1200")
      expect((await this.rewardPool.getTotalEsxRewards("100","199"))[1]).to.equal("600")
      */

      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[0]).to.equal("12")
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[1]).to.equal("6")
      expect((await this.rewardPool.getTotalEsxRewards("100","101"))[0]).to.equal("24")
      expect((await this.rewardPool.getTotalEsxRewards("100","101"))[1]).to.equal("12")
      expect((await this.rewardPool.getTotalEsxRewards("100","102"))[0]).to.equal("36")
      expect((await this.rewardPool.getTotalEsxRewards("100","102"))[1]).to.equal("18")
      expect((await this.rewardPool.getTotalEsxRewards("100","201"))[0]).to.equal("1200")
      expect((await this.rewardPool.getTotalEsxRewards("100","201"))[1]).to.equal("600")

      await this.esm.transfer(this.rewardPool.address, 1200) // 100blocks x 12 ESM
      await this.esg.transfer(this.rewardPool.address, 600) // 100blocks x 6 ESG
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.connect(this.bob).deposit(0, "100")
      // console.log("depo2Tx: ", depo2Tx)

      await this.rewardPool.setCurrentBlock("90")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("600")

      await this.rewardPool.setCurrentBlock("99")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("600")

      // The zero block of reward period doesnt get paid.
      // Fixme: probably it's a subject to fix
      await this.rewardPool.setCurrentBlock("100")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("0")
      
      await this.rewardPool.setCurrentBlock("101")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("12")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("6")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("24")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("12")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")

      await this.rewardPool.setCurrentBlock("103")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("24")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("12")
      await this.rewardPool.connect(this.bob).deposit(0, "0") // this probably incremented block number
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("60")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("30")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")

      // On the last block all the period's payout gets paid
      await this.rewardPool.setCurrentBlock("199")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")

      // On the block after last all the period's payout gets paid
      await this.rewardPool.setCurrentBlock("200")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("0")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")
    })

    it("With 5% fees, single LP, single block, single stage", async function () {
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.setDevFee(50000) //5%
      await this.rewardPool.addStage("100", "100", "1000" /*ESM per block*/, "2000" /*ESG per block*/)
      await this.esm.transfer(this.rewardPool.address, 1000)
      await this.esg.transfer(this.rewardPool.address, 2000)
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[0]).to.equal("1000")
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[1]).to.equal("2000")
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.connect(this.bob).deposit(0, "100")
      await this.rewardPool.setCurrentBlock("101")
      await this.rewardPool.connect(this.bob).withdraw(0, "100")
      // Bob got all his LP tokens back ...
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      // ...plus ESM and ESG rewards
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("950")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("1900")
    })

    it("With 5% fees, single LP, two blocks, single stage", async function () {
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.setDevFee(50000) //5%
      await this.rewardPool.addStage("100", "101", "1000" /*ESM per block*/, "2000" /*ESG per block*/)
      await this.esm.transfer(this.rewardPool.address, 2000)
      await this.esg.transfer(this.rewardPool.address, 4000)
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[0]).to.equal("1000")
      expect((await this.rewardPool.getTotalEsxRewards("100","100"))[1]).to.equal("2000")
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.connect(this.bob).deposit(0, "100")
      await this.rewardPool.setCurrentBlock("102")
      await this.rewardPool.connect(this.bob).withdraw(0, "100")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1900")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("3800")
      // Got all his LP tokens back
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should not distribute ESMs if no one deposit", async function () {
      // 100 per block farming rate starting at block 200 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.esm.transfer(this.rewardPool.address, 1200) // 100blocks x 12 ESM
      await this.esg.transfer(this.rewardPool.address, 600) // 100blocks x 6 ESG
      await this.rewardPool.addStage("100", "1000", "12", "6")
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.setCurrentBlock("200")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.setCurrentBlock("205")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.setCurrentBlock("210")
      await this.rewardPool.connect(this.bob).deposit(0, "10")
      await this.rewardPool.setCurrentBlock("211")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("12")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("6")
    })

    /*
    it("should distribute ESMs properly for each staker", async function () {
      // 100 per block farming rate starting at block 300 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100")
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
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100")
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
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address, "100")
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
    */

    context('Reward stages', function () {
      beforeEach(async function () {
        // 100 blocks period, 10ESM and 1 ESG per block
        this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.
        address, this.esg.address, this.dev.address)
        await this.rewardPool.deployed()
        await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", { from: this.alice.address })
        await this.rewardPool.addStage("100", "199", "10", "5")
        await this.rewardPool.addStage("200", "299", "9", "4")
        await this.rewardPool.addStage("300", "399", "8", "3")
        await this.rewardPool.addStage("400", "499", "7", "2")
        await this.rewardPool.addStage("500", "599", "0", "0") // Zero periods may be useful in the future
        await this.rewardPool.add("1", this.lp.address, true)
      })

      it('addStage reverts if non-adjacent blocks', async function () {
        await expect(this.rewardPool.addStage("501", "599", "1", "1")).to.be.revertedWith("addStage: new startBlock should be adjacent to previous stage")
      })

      it('addStage reverts if new endBlock less than start', async function () {
        await expect(this.rewardPool.addStage("321", "320", "1", "1")).to.be.revertedWith("addStage: new endBlock shouldn't be less than startBlock")
      })

      it('stages are displayed correctly', async function () {
        stage_0 = await this.rewardPool.stages(0)
        stage_1 = await this.rewardPool.stages(1)
        stage_2 = await this.rewardPool.stages(2)
        stage_3 = await this.rewardPool.stages(3)
        stage_4 = await this.rewardPool.stages(4)
        await expect(this.rewardPool.stages(5)).to.be.reverted

        expect(stage_0.startBlock).to.equal("100")
        expect(stage_0.endBlock).to.equal("199")
        expect(stage_0.esmPerBlock).to.equal("10")
        expect(stage_0.esgPerBlock).to.equal("5")

        expect(stage_1.startBlock).to.equal("200")
        expect(stage_1.endBlock).to.equal("299")
        expect(stage_1.esmPerBlock).to.equal("9")
        expect(stage_1.esgPerBlock).to.equal("4")

        expect(stage_2.startBlock).to.equal("300")
        expect(stage_2.endBlock).to.equal("399")
        expect(stage_2.esmPerBlock).to.equal("8")
        expect(stage_2.esgPerBlock).to.equal("3")

        expect(stage_3.startBlock).to.equal("400")
        expect(stage_3.endBlock).to.equal("499")
        expect(stage_3.esmPerBlock).to.equal("7")
        expect(stage_3.esgPerBlock).to.equal("2")

        expect(stage_4.startBlock).to.equal("500")
        expect(stage_4.endBlock).to.equal("599")
        expect(stage_4.esmPerBlock).to.equal("0")
        expect(stage_4.esgPerBlock).to.equal("0")
      })

      it('getTotalEsxRewards for different block ranges', async function () {
        expect((await this.rewardPool.getTotalEsxRewards(0, 100000))[0]).to.equal("3400") //total rewards
        expect((await this.rewardPool.getTotalEsxRewards(0, 100000))[1]).to.equal("1400") //total rewards
        expect((await this.rewardPool.getTotalEsxRewards(0, 99))[0]).to.equal("0")
        expect((await this.rewardPool.getTotalEsxRewards(0, 99))[1]).to.equal("0")
        expect((await this.rewardPool.getTotalEsxRewards(99, 100))[0]).to.equal("10")
        expect((await this.rewardPool.getTotalEsxRewards(99, 100))[1]).to.equal("5")
        expect((await this.rewardPool.getTotalEsxRewards(100, 100))[0]).to.equal("10")
        expect((await this.rewardPool.getTotalEsxRewards(100, 100))[1]).to.equal("5")
        expect((await this.rewardPool.getTotalEsxRewards(100, 101))[0]).to.equal("20")
        expect((await this.rewardPool.getTotalEsxRewards(100, 101))[1]).to.equal("10")
        expect((await this.rewardPool.getTotalEsxRewards(100, 199))[0]).to.equal("1000")
        expect((await this.rewardPool.getTotalEsxRewards(100, 199))[1]).to.equal("500")
        expect((await this.rewardPool.getTotalEsxRewards(199, 199))[0]).to.equal("10")
        expect((await this.rewardPool.getTotalEsxRewards(199, 199))[1]).to.equal("5")
        expect((await this.rewardPool.getTotalEsxRewards(200, 200))[0]).to.equal("9")
        expect((await this.rewardPool.getTotalEsxRewards(200, 200))[1]).to.equal("4")
        expect((await this.rewardPool.getTotalEsxRewards(199, 200))[0]).to.equal("19") // 10+9
        expect((await this.rewardPool.getTotalEsxRewards(199, 200))[1]).to.equal("9") // 5+4
        expect((await this.rewardPool.getTotalEsxRewards(499, 499))[0]).to.equal("7")
        expect((await this.rewardPool.getTotalEsxRewards(499, 499))[1]).to.equal("2")
        expect((await this.rewardPool.getTotalEsxRewards(499, 500))[0]).to.equal("7")
        expect((await this.rewardPool.getTotalEsxRewards(499, 500))[1]).to.equal("2")
        expect((await this.rewardPool.getTotalEsxRewards(500, 500))[0]).to.equal("0")
        expect((await this.rewardPool.getTotalEsxRewards(500, 500))[1]).to.equal("0")
      })
    })

    context('Esm emission scenario', function () {
      beforeEach(async function () {
        this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
        await this.rewardPool.deployed()

        await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000", { from: this.alice.address })
        await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000", { from: this.bob.address })
        await this.lp.connect(this.carol).approve(this.rewardPool.address, "1000", { from: this.carol.address })

        await this.rewardPool.addStage("100","290000", "1000", "100")
        await this.rewardPool.add("1", this.lp.address, true)
      })

      it('1st week rewards are correct', async function () {
        // day 1
        await this.rewardPool.setCurrentBlock("100")
        await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })

        // day 2
        await this.rewardPool.setCurrentBlock("28800")
        await this.rewardPool.connect(this.bob).deposit(0, "20", { from: this.bob.address })

        /*
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
        */
      })
    })
  })
})
