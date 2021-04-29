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
        
    it("should return correct pending values", async function () {

      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("121", "132", "100" /*ESM per block*/, "100" /*ESG per block*/)
      await this.esm.transfer(this.rewardPool.address, 300)
      await this.esg.transfer(this.rewardPool.address, 300)

      await this.rewardPool.add("100", this.lp.address, true)

      // deposit
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      let depositTx = await this.rewardPool.connect(this.bob).deposit(0, "20")

      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('0')
      
      await this.rewardPool.setCurrentBlock('121')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('0')

      await this.rewardPool.setCurrentBlock('122')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('100')

      await this.rewardPool.setCurrentBlock('123')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('200')

      await this.rewardPool.setCurrentBlock('124')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('300')

      await this.rewardPool.setCurrentBlock('125')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('400')

      await this.rewardPool.connect(this.bob).withdraw(0, '20')

      expect(await this.esm.balanceOf(this.bob.address)).to.equal(300)
    })


    it("should return correct pending values and ESM", async function () {

      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("121", "132", "100" /*ESM per block*/, "100" /*ESG per block*/)
      await this.esm.transfer(this.rewardPool.address, 300)
      await this.esg.transfer(this.rewardPool.address, 299)

      await this.rewardPool.add("100", this.lp.address, true)

      // deposit
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      let depositTx = await this.rewardPool.connect(this.bob).deposit(0, "20")

      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('0')
      
      await this.rewardPool.setCurrentBlock('121')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('0')

      await this.rewardPool.setCurrentBlock('122')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('100')

      await this.rewardPool.setCurrentBlock('123')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('200')
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(0)
      expect(await this.esg.balanceOf(this.bob.address)).to.equal(0)

      await this.rewardPool.setCurrentBlock('124')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('300')

      await this.rewardPool.setCurrentBlock('125')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('400')

      await this.rewardPool.setCurrentBlock('126')
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal('500')

      await this.rewardPool.connect(this.bob).withdraw(0, '10')

      expect(await this.esm.balanceOf(this.bob.address)).to.equal(300)
      expect(await this.esg.balanceOf(this.bob.address)).to.equal(299)
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

    it("should give out ESMs and ESGs at farming time w.o. fees", async function () {
      // 100 ESM and 10 ESG per block farming rate starting at block 100 and ending at block 199
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("100", "200", "12" /*ESM per block*/, "6" /*ESG per block*/)

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
      expect((await this.rewardPool.getTotalEsxRewards("100","199"))[0]).to.equal("1200")
      expect((await this.rewardPool.getTotalEsxRewards("100","199"))[1]).to.equal("600")
      // two lines below won't happens on prod, because method getTotalEsxRewards get first arg (x+1)
      expect((await this.rewardPool.getTotalEsxRewards("100","200"))[0]).to.equal("1212")  
      expect((await this.rewardPool.getTotalEsxRewards("100","200"))[1]).to.equal("606")
      expect((await this.rewardPool.getTotalEsxRewards("100","201"))[0]).to.equal("1212")
      expect((await this.rewardPool.getTotalEsxRewards("100","201"))[1]).to.equal("606")

      expect((await this.rewardPool.getTotalEsxRewards("300","310"))[0]).to.equal("0")
      expect((await this.rewardPool.getTotalEsxRewards("300","330"))[1]).to.equal("0")



      await this.esm.transfer(this.rewardPool.address, 1201) // 100blocks x 12 ESM
      await this.esg.transfer(this.rewardPool.address, 601) // 100blocks x 6 ESG
      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.rewardPool.connect(this.bob).deposit(0, "100")

      await this.rewardPool.setCurrentBlock("90")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("1201")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("601")

      await this.rewardPool.setCurrentBlock("99")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("1201")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("601")

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
      await this.rewardPool.connect(this.bob).deposit(0, "0") // without block incrementation
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("12")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("6")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")

      await this.rewardPool.setCurrentBlock("103")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("24")  // 2*12
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("12")  // 2*6
      await this.rewardPool.connect(this.bob).deposit(0, "0") // without block incrementation
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("36")  // 12+2*12
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("18")  // 6+2*6
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")

      // On the before last block all the period's payout gets paid
      await this.rewardPool.setCurrentBlock("199")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(1200 - 12)
      expect(await this.esg.balanceOf(this.bob.address)).to.equal(600 - 6)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(12+1)
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal(6+1)

      // On the last block all the period's payout gets paid
      await this.rewardPool.setCurrentBlock("200")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")

      // On the block after last all the period's payout gets paid
      await this.rewardPool.setCurrentBlock("201")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")
      // So 1 ESM andd 1 ESG are still in rewardPool
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("1")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("1")

      // On the 202 block, still without rewards: no changes
      await this.rewardPool.setCurrentBlock("202")
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("1200")
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("600")
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal("0")
      expect(await this.rewardPool.pendingEsg(0, this.bob.address)).to.equal("0")
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal("1")
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal("1")
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
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("0")  // No rewards
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("0")  // No rewards
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
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.rewardPool.setCurrentBlock("102")
      await this.rewardPool.connect(this.bob).withdraw(0, "100")
      // he got rewards for 1 block (101 - 100). And minus Fee
      expect(await this.esm.balanceOf(this.bob.address)).to.equal("950")  
      expect(await this.esg.balanceOf(this.bob.address)).to.equal("1900")
      // Got all his LP tokens back
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")

      // check reward balances:
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(1000)
      expect(await this.esg.balanceOf(this.rewardPool.address)).to.equal(2000)
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

    it("should distribute ESMs properly for each staker. Scenario 1", async function () {
      // 100 ESM and 10 ESG per block farming rate starting at block 300 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("300", "1000", "100", "10")
      await this.esm.transfer(this.rewardPool.address, 7000)
      await this.esg.transfer(this.rewardPool.address, 700)
      // after transfer Alice has 3000 esm and esg tokens
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("3000")
      expect(await this.esg.balanceOf(this.alice.address)).to.equal("9300")
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(0)

      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000")
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.lp.connect(this.carol).approve(this.rewardPool.address, "1000")
     
      // Alice deposits 10 LPs at block 310
      await this.rewardPool.setCurrentBlock("310")
      await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000)
      

      // at block 314: 
      // Alice should gets 4*100 = 400 pendingESM, 
      // Bob deposits 20 LPs, so Alice won't gets 100 pending more!!!
      // Then Carol deposits 30 LPs, and now NO one get more pending!!!
      await this.rewardPool.setCurrentBlock("314")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      await this.rewardPool.connect(this.bob).deposit(0, "20")  // this updates lastRewardBlock
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      await this.rewardPool.connect(this.carol).deposit(0, "30")  // this can't update lastRewarBlock, cause it has been update earlier
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)

      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000)
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(0)
            
      // at block 315: 
      // Alice should get 1*100*(10/60) = 16 pending ESM, total 400+16=416 ESM 
      // Bob should get 1*100*(20/60) = 33 pending ESM, total 33+0=33 ESM
      // Carol should get 1*100*(30/60) = 49 pending ESM, total 49+0=49 ESM
      await this.rewardPool.setCurrentBlock("315")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(416)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(33)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(49)

      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000)
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(0)

      // at block 316: 
      // Alice should get 1*100*(10/60) = 17 pending ESM, total 416+17=433 ESM (rounding)
      // Bob should get 1*100*(20/60) = 33 pending ESM, total 33+33=66 ESM
      // Carol should get 1*100*(30/60) = 49 pending ESM, total 49+50=99 ESM
      await this.rewardPool.setCurrentBlock("316")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(433)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(66)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(99)

      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000)
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(0)
      
      // Alice withdraws her deposit. 
      // So Alice won't get one reward block more ): pendingESM to withdraw 533+17=550
      // So Alice's balance became 3000 + 550 = 3550
      // Bob gets Nothing pending ESM,  total 66
      // Carol gets Nothing pending ESM,  total 99
      await this.rewardPool.connect(this.alice).withdraw(0, 10)
      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000 + 433)
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(0)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(0)

      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(0)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(66) // NOT updated!!!
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(99) // NOT updated!!!
      // Bob and Carol make withdraw too:
      await this.rewardPool.connect(this.bob).withdraw(0, 20)  // it won't change rewards
      await this.rewardPool.connect(this.carol).withdraw(0, 30)  // it won't change rewards

      expect(await this.esm.balanceOf(this.bob.address)).to.equal(66)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(99)
      expect(await this.esg.balanceOf(this.bob.address)).to.equal(6)  // rounding
      expect(await this.esg.balanceOf(this.carol.address)).to.equal(9)  // rounding

      // Pendings are empty
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(0)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)
    })
    
    it("should distribute ESMs properly for each staker. Scenario 2", async function () {
      // 100 per block farming rate starting at block 300 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("300", "1000", "100", "10")
      await this.esm.transfer(this.rewardPool.address, 7000)
      await this.esg.transfer(this.rewardPool.address, 700)
      // after transfer Alice has 3000 esm and esg tokens
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("3000")
      expect(await this.esg.balanceOf(this.alice.address)).to.equal("9300")


      await this.rewardPool.add("100", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.rewardPool.address, "1000")
      await this.lp.connect(this.bob).approve(this.rewardPool.address, "1000")
      await this.lp.connect(this.carol).approve(this.rewardPool.address, "1000")
      
      // Alice deposits 10 LPs at block 310
      await this.rewardPool.setCurrentBlock("310")
      await this.rewardPool.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(0)

      // at block 314: Alice gets 400 pendingESM, Bob deposits 20 LPs, and Alice still has 400 pending
      await this.rewardPool.setCurrentBlock("314")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      await this.rewardPool.connect(this.bob).deposit(0, "20", { from: this.bob.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      
      // at block 315: 
      // Alice should gets 1*100*(1/3) = 33 pending ESM, total 400 + 33 = 433 ESM 
      // Bob sould gets 1*100*(2/3) = 66 pending ESM, total 0 + 66 ESM
      await this.rewardPool.setCurrentBlock("315")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(433)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(66)

      // at block 318
      // Alice should gets 3*100*(1/3) = 100 pending ESM, total 433 + 100 = 533 ESM 
      // Bob should gets 3*100*(2/3) = 200 pending ESM, total 66 + 200 = 266 ESM
      // Carol deposits 0 LPs at block 318. 
      // So Allice still has pending 533, and Bob - 266
      await this.rewardPool.setCurrentBlock("318")
      // console.log(await this.rewardPool.poolInfo(0))  // lastRewardBlock = 0x013a  (314)
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(533)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(266)
      
      await this.rewardPool.connect(this.carol).deposit(0, "0")
      // console.log(await this.rewardPool.poolInfo(0))  
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(533) // NOT updated!
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(266) // NOT updated!
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)
      
      await this.rewardPool.connect(this.bob).deposit(0, "0")
      // console.log(await this.rewardPool.poolInfo(0))  
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(533) // not changed
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0) // not changed
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)

      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000) // no changes, cause no withdraws/deposits was
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(266)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(0)

      // at block 319
      // Alice should gets 1*100*(10/30) = 33, so total Alice Pending became 533 + 33 = 566
      // Bob should gets 1*100(20/30) = 66, so total Bob pending became  66 + 0 = 66
      // Carol should gets 0*100(0/30) = 0, so total Carol pending became 0 + 0 = 0
      // Then Alice makes withdraw and No one gets more tokens:
      // Alice still has 533 (round)
      // Bob still has 66;  Carol = 0   
      await this.rewardPool.setCurrentBlock("319")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(566)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(67)  // rounding
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)
      await this.rewardPool.connect(this.alice).withdraw(0, 10)
      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000+566).to.equal(3566)
      expect(await this.esg.balanceOf(this.alice.address)).to.equal(9300+56).to.equal(9356)
      // And  Alice makes deposit of 0 LP token
      await this.rewardPool.connect(this.alice).deposit(0, 0)
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(0)      
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(67)  // rounding
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)

      // at block 320
      // Bob already has 266 ESM in his wallet
      // Bob gets 100 esm for block. So his pending balance is 66 + 100 = 166 
      // After withdraw his ESM balance became 266 + 167 = 433 (rounding)
      await this.rewardPool.setCurrentBlock("320")

      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(167)

      await this.rewardPool.connect(this.bob).withdraw(0, 20)
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(433)
      expect(await this.esg.balanceOf(this.bob.address)).to.equal(43)

    })

    it("should distribute ESMs properly for each staker. Scenario 3 (full one stage w.o. fee)", async function () {
      // 100 per block farming rate starting at block 300 with bonus until block 1000
      this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
      await this.rewardPool.deployed()
      await this.rewardPool.addStage("310", "380", "100", "100")
      await this.esm.transfer(this.rewardPool.address, 7000)
      await this.esg.transfer(this.rewardPool.address, 7000)
      // after transfer Alice has 3000 esm and esg tokens
      expect(await this.esm.balanceOf(this.alice.address)).to.equal("3000")
      expect(await this.esg.balanceOf(this.alice.address)).to.equal("3000")


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
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(0)
      await this.rewardPool.setCurrentBlock("311")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(100)
      await this.rewardPool.setCurrentBlock("312")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(200)

      // at block 314: Alice gets 400 pendingESM, Bob deposits 20 LPs, and Alice don't gets 100 pending more
      await this.rewardPool.setCurrentBlock("314")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      await this.rewardPool.connect(this.bob).deposit(0, "20", { from: this.bob.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(400)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      
      // at block 315: 
      // Alice should gets 1*100*(1/3) = 33 pending ESM, total 33 + 400 = 433 ESM 
      // Bob sould gets 1*100*(2/3) = 66 pending ESM, total 0 + 66 = 66 ESM
      await this.rewardPool.setCurrentBlock("315")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(433)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(66)

      // at block 316: 
      // Alice should gets 1*100*(1/3) = 33 pending ESM, total 433 + 33 = 466 ESM 
      // Bob sould gets 1*100*(2/3) = 66 pending ESM, total 66+66 = 133 ESM (rounds)
      await this.rewardPool.setCurrentBlock("316")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(466)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(133)

      // at block 318
      // Alice should gets 2*100*(1/3) = 67 pending ESM, total 466 + 67 = 533 ESM 
      // Bob sould gets 2*100*(2/3) = 133 pending ESM, total 133 + 133 = 266 ESM
      // Carol deposits 30 LPs at block 318. So Allice DON'T gets 33 more ESM (total 666), and Bob DON'T gets 67 more ESM (333)
      // Then Bob deposits 0 amount, and resets hit pending balance
      await this.rewardPool.setCurrentBlock("318")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(533)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(266)
      await this.rewardPool.connect(this.carol).deposit(0, "30", { from: this.carol.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(533) // NOT updated!
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(266) // NOT upddated!
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)

      await this.rewardPool.connect(this.bob).deposit(0, "10", { from: this.bob.address })
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(533)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(0)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(0)
      // bob gets his 266 ESM
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(266)
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(7000 - 266) 
      
      // at block 319
      // Alice should gets 1*100*(10/70) = 14, so total Alice Pending became 533 + 14 = 547
      // Bob should gets 1*100(30/70) = 43, so total Bob pending became  43 + 0 = 43
      // Carol should gets 1*100(30/70) = 43, so total Carol pending became 43 + 0 = 43
      await this.rewardPool.setCurrentBlock("319")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(547)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(43)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(43)

      // at block 379 (last reward block)
      // Alice should gets 60*100*(10/70) = 857, so total Alice Pending became 547 + 857 = 1404
      // Bob should gets 60*100(30/70) = 2571, so total Bob pending became  43 + 2572 = 2615
      // Carol should gets 60*100(30/70) = 2571, so total Carol pending became 43 + 2572 = 2615
      await this.rewardPool.setCurrentBlock("379")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(1404)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(2615)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(2615)
      
      // We come to last rewarded block.
      // The rewardPool has 7000 - 266 = 6734 ESM. (But Bob already has 266 ESM.)
      // 
      // Alice should gets 1*100*(10/70) = 14, so total Alice Pending became 1404 + 14 = 1419 (rounds)
      // Bob should gets 1*100(30/70) = 43, so total Bob pending became  2615 + 43 = 2658
      // Carol should gets 1*100(30/70) = 43, so total Carol pending became 2615 + 43 = 2658
      await this.rewardPool.setCurrentBlock("380")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(1419)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(2658)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(2658)
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(1418 + 2658 + 2658).to.equal(6734)

      // We come to firts first unrewarded block. And here pendings will not update. 
      await this.rewardPool.setCurrentBlock("381")
      expect(await this.rewardPool.pendingEsm(0, this.alice.address)).to.equal(1419)
      expect(await this.rewardPool.pendingEsm(0, this.bob.address)).to.equal(2658)
      expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal(2658)

      // So total pending is 1418+2658+2658=6734 
      // ALL total 6734 + 266 = 7000
      // Now all participants make withdraw:
      // Then Alice should has 3000+1418=4418 ESM in her wallet
      // Then Bob should has 266 + 2658 = 2924
      // Then Carol Pending is 2615 + one step 43 = 2658. But there are only 2457 ESMtokens left in the rewardPool 
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(10000 - 3000 - 266).to.equal(6734)
      await this.rewardPool.connect(this.alice).withdraw(0, 10)
      expect(await this.esm.balanceOf(this.alice.address)).to.equal(3000+1419).to.equal(4419) // 3000 + 1418
      
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(10000 - 3000 - 266 - 1419).to.equal(5315)
      await this.rewardPool.connect(this.bob).withdraw(0, 25)
      expect(await this.esm.balanceOf(this.bob.address)).to.equal(266+2658).to.equal(2924)
      
      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(10000 - 3000 - 1419 - 266 - 2658).to.equal(2657)
      await this.rewardPool.connect(this.carol).withdraw(0, 25)
      expect(await this.esm.balanceOf(this.carol.address)).to.equal(2657)  // Carol don't get her 1 esm cause of rounding

      expect(await this.esm.balanceOf(this.rewardPool.address)).to.equal(0)  // All rewards run out! And Carol don't get 1 ESM

    })
    /*
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


    context('ESM and ESG reward', function () {
        beforeEach(async function () {

            this.rewardPool = await this.EasySwapRewardPool.deploy(this.esm.address, this.esg.address, this.dev.address)
            await this.rewardPool.deployed()
            await this.rewardPool.addStage("1", "100", "100", "10")
            await this.esm.transfer(this.rewardPool.address, 1000)
            await this.esg.transfer(this.rewardPool.address, 100)
            await this.rewardPool.add("1", this.lp.address, true)
            await this.lp.connect(this.carol).approve(this.rewardPool.address, "1000")

        })

        it("Should return zero ESM reward for zero deposit.", async function () {
        //Deposit Carol is 0 and ESM reward is 0
            await this.rewardPool.setCurrentBlock("1")
            await this.rewardPool.connect(this.carol).deposit(0, "0", { from: this.carol.address })
            await this.rewardPool.setCurrentBlock("20")

            expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0")
        })

        it("Should return zero ESG reward for zero deposit.", async function () {
        //Deposit Carol is 0 and ESG reward is 0
            await this.rewardPool.setCurrentBlock("1")
            await this.rewardPool.connect(this.carol).deposit(0, "0", { from: this.carol.address })
            await this.rewardPool.setCurrentBlock("20")

            expect(await this.rewardPool.pendingEsg(0, this.carol.address)).to.equal("0")
        })

        it("Should return zero ESM and ESG reward if deposit became zero.", async function () {
        //Carol's deposit was not zero at first
            await this.rewardPool.setCurrentBlock("1")
            await this.rewardPool.connect(this.carol).deposit(0, "10", { from: this.carol.address })
            await this.rewardPool.setCurrentBlock("2")
            await this.rewardPool.connect(this.carol).withdraw(0, "10")
            await this.rewardPool.setCurrentBlock("3")

            expect(await this.rewardPool.pendingEsm(0, this.carol.address)).to.equal("0")
            expect(await this.rewardPool.pendingEsg(0, this.carol.address)).to.equal("0")
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
