const assert = require('assert');
const ganache = require('ganache');
const { Web3 } = require('web3');
const web3 = new Web3(ganache.provider());

const compiledFactory = require("../ethereum/build/CampaignFactory.json");
const compiledCampaign = require("../ethereum/build/Campaign.json");

let accounts;
let factory;
let campaignAddress;
let campaign;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    // Deploy a factory
    factory = await new web3.eth.Contract(compiledFactory.abi)
    .deploy({ data: compiledFactory.evm.bytecode.object })
    .send({ from: accounts[0], gas: "1400000" });

    await factory.methods.createCampaign("100").send({
        from: accounts[0],
        gas: "1000000"
      });

    // Get the first campaign address
    [campaignAddress] = await factory.methods.getDeployedCampaigns().call();
    campaign = await new web3.eth.Contract(compiledCampaign.abi, campaignAddress);
});

describe("Campaigns", () => {
    it("deploys a factory and a campaign", async () => {
      assert.ok(factory.options.address);
      assert.ok(campaign.options.address);
    });

    it("marks caller as the campaign manager", async () => {
        manager = await campaign.methods.manager().call()
        assert.equal(accounts[0], manager);
    });

    it("allows people to contribute money and marks them as approvers", async () => {
        await campaign.methods.contribute().send({
            value:'200',
            from: accounts[1]
        })
        const isContributor = await campaign.methods.approvers(accounts[1]).call();

        // assert that the value is true
        assert(isContributor)
    });

    it("Require a minimal contribution of 100 wei", async () => {
        //Using try catch for verify require a minimal contribution
        try {
            await campaign.methods.contribute().send({
                value: '5',
                from: accounts[1]
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it("allows a manager to make payment request", async () => {
        await campaign.methods
        .createRequest('Buy batterys', '100', accounts[1])
        .send({
            from:accounts[0],
            gas:'1000000'
        });

        // requests is a mapping, so we need to use call to get the value
        const request = await campaign.methods.requests(0).call();

        assert.equal('Buy batterys', request.description);
        
    })

    // End to end test
    it('processes requests', async () => {
        await campaign.methods.contribute().send({
            from:accounts[0],
            value: web3.utils.toWei('10', 'ether')
        });

        await campaign.methods
        .createRequest('A', web3.utils.toWei('5', 'ether'), accounts[1])
        .send({ from: accounts[0], gas:'1000000'});

        await campaign.methods.approveRequest(0).send({
            from: accounts[0],
            gas:'1000000'
        });

        await campaign.methods.finalizeRequest(0).send({
            from: accounts[0],
            gas:'1000000'
        });

        let balance = await web3.eth.getBalance(accounts[1]);
        balance = web3.utils.fromWei(balance, 'ether');
        balance = parseFloat(balance);
        assert(balance > 104);

    })



});
