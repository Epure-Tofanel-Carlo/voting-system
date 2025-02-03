const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingSystem", function () {
    let VotingSystem, voting, owner, addr1, addr2, token;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const ERC20Token = await ethers.getContractFactory("ERC20Token");
        token = await ERC20Token.deploy("VotingToken", "VOTE", 18, ethers.parseEther("1000000"));
        await token.waitForDeployment();

        VotingSystem = await ethers.getContractFactory("VotingSystem");
        voting = await VotingSystem.deploy(await token.getAddress());
        await voting.waitForDeployment();

        await token.transfer(await voting.getAddress(), ethers.parseEther("1000"));
    });

    it("Should allow only the owner to add candidates", async function () {
        await voting.addCandidate("Alice");
        const candidate = await voting.getCandidate(0);
        expect(candidate[0]).to.equal("Alice");

        await expect(voting.connect(addr1).addCandidate("Bob"))
            .to.be.revertedWith("Only owner can perform this action");
    });

    it("Should allow voting only after staking", async function () {
        await voting.addCandidate("Alice");

        // ✅ Stake and then vote
        await voting.connect(addr1).stake({ value: ethers.parseEther("0.1") });
        await voting.connect(addr1).vote(0);

        const candidate = await voting.getCandidate(0);
        expect(candidate[1]).to.equal(1);
    });

    it("Should allow users to withdraw staked ETH", async function () {
        await voting.connect(addr1).stake({ value: ethers.parseEther("0.5") });
        await expect(await voting.connect(addr1).withdraw())
            .to.changeEtherBalance(addr1, ethers.parseEther("0.5"));
    });

    it("Should correctly calculate vote percentage", async function () {
        const result = await voting.calculateVotePercentage(25, 100);
        expect(result).to.equal(25);
    
        const zeroVotes = await voting.calculateVotePercentage(0, 100);
        expect(zeroVotes).to.equal(0);
    
        const zeroTotalVotes = await voting.calculateVotePercentage(50, 0);
        expect(zeroTotalVotes).to.equal(0);
    });

    it("Should not allow voting for non-existent candidates", async function () {
        await voting.connect(addr1).stake({ value: ethers.parseEther("0.1") });
    
        await expect(voting.connect(addr1).vote(99)).to.be.revertedWith("Invalid candidate ID");
    });

    it("Should distribute ERC20 tokens as rewards for voting", async function () {
        await voting.addCandidate("Alice");
        await voting.connect(addr1).stake({ value: ethers.parseEther("0.1") });
        await voting.connect(addr1).vote(0);

        const balance = await token.balanceOf(addr1.address);
        expect(balance).to.equal(ethers.parseEther("10")); 
    });
});