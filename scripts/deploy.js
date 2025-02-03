const fs = require("fs");
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const ERC20Token = await hre.ethers.getContractFactory("ERC20Token");
    const token = await ERC20Token.deploy(
        "Voting Reward Token",
        "VRT",
        18,
        1000000
    );
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("ERC20Token deployed to:", tokenAddress);

    const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
    const votingSystem = await VotingSystem.deploy(tokenAddress);
    await votingSystem.waitForDeployment();
    const votingAddress = await votingSystem.getAddress();
    console.log("VotingSystem deployed to:", votingAddress);

    const transferAmount = hre.ethers.parseEther("1000");
    await token.transfer(votingAddress, transferAmount);
    console.log("Transferred initial tokens to VotingSystem");

    await votingSystem.addCandidate("Candidate 1");
    await votingSystem.addCandidate("Candidate 2");
    console.log("Added initial candidates");

    const votingABI = JSON.parse(fs.readFileSync("artifacts/contracts/VotingSystem.sol/VotingSystem.json")).abi;
    const tokenABI = JSON.parse(fs.readFileSync("artifacts/contracts/ERC20Token.sol/ERC20Token.json")).abi;

    const config = {
        contract_address: votingAddress,
        tokenEC20_address: tokenAddress,
        abi: votingABI,
        tokenABI: tokenABI
    };

    fs.writeFileSync("frontend/config.json", JSON.stringify(config, null, 2));
    console.log("✅ Config.json updated!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });