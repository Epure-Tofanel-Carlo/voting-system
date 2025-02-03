const fs = require("fs");
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const ERC20Token = await hre.ethers.getContractFactory("ERC20Token");
    const token = await ERC20Token.deploy("VotingToken", "VOTE", 18, hre.ethers.parseEther("1000000"));
    await token.waitForDeployment();
    console.log("ERC20 Token deployed to:", await token.getAddress());

    const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
    const voting = await VotingSystem.deploy(await token.getAddress());
    await voting.waitForDeployment();
    console.log("VotingSystem deployed to:", await voting.getAddress());

    const initialFunding = hre.ethers.parseEther("1000");
    await token.transfer(await voting.getAddress(), initialFunding);


    const abi = JSON.parse(fs.readFileSync("artifacts/contracts/VotingSystem.sol/VotingSystem.json")).abi;

    const config = {
        contract_address: await voting.getAddress(),
        tokenEC20_address: await token.getAddress(),
        rpc_url: process.env.GANACHE_RPC_URL, 
        abi: abi
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