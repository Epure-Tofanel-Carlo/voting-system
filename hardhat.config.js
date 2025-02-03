require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {},
    local: {
      url: process.env.HARDHAT_RPC_URL,
      accounts: [`${process.env.PRIVATE_KEY}`],
    },
  },
};