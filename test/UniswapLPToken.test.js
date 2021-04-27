const { expect } = require('chai');
const LPToken = artifacts.require("UniswapV2ERC20");


contract("LP Token", function(accounts) {

    const name = "EasySwap LP Token";
    const symbol = "ELP";

    beforeEach(async function() {
        this.token = await LPToken.new();
    })    

    it('has proper LP name', async function() {
        expect(await this.token.name()).to.equal(name);
    });

    it('has a proper symbol', async function() {
        expect(await this.token.symbol()).to.equal(symbol);
    });

    it('has 18 decimals', async function() {
        expect(await this.token.decimals()).to.be.bignumber.equal('18');
    });
});
