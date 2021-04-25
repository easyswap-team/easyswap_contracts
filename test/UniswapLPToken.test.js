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


contract("LP Token 2", function() {

    const name = "EasySwap LP Token";
    const symbol = "ELP";
    const decimals = 18;
    
    beforeEach(async function() {
        this.token2 = await LPToken.new();
    });

    it('has proper LP name', async function() {
        const expectedName = await this.token2.name();
        assert.equal(expectedName, name);
    });

    it('has proper LP symbol', async function() {
        const expectedSymbol = await this.token2.symbol();
        assert.equal(expectedSymbol, symbol);
    })

    it('has 18 decimals', async function() {
        const expectedDecimals = await this.token2.decimals();
        assert.equal(expectedDecimals, decimals);
    })
});
