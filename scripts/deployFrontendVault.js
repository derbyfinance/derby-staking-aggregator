const { ethers } = require("hardhat");
var { exec } = require('child_process');
const { setTimeout } = require("timers/promises");

const abi = require('../artifacts/contracts/Mocks/FrontendVault.sol/Vault.json').abi;
const bytecode = require('../artifacts/contracts/Mocks/FrontendVault.sol/Vault.json').bytecode;


const privateKey = process.env.PRIVATE_KEY !== undefined ? process.env.PRIVATE_KEY : [];

const main = async () => {
    const deploying = async (testnet) => {
      // deploy
      let url = config.networks[testnet].url;
      let provider = ethers.getDefaultProvider(url);
      let wallet = new ethers.Wallet(privateKey, provider);
      let wallet_address = await wallet.getAddress();
      console.log("wallet address on %s: %s", testnet, wallet_address);

      console.log("deploying vault on %s", testnet);
      let factory = new ethers.ContractFactory(abi, bytecode, wallet);
      // saved total underlying of 1 million USDC, exchangerate 2 USDC per LP token
      let vault = await factory.deploy('DerbyUSDC', 'dUSDC', 6, 1E12, 2E6, '0x07865c6e87b9f70255377e024ace6630c1eaa37f');
      await vault.deployed();
      console.log("vault_%s: %s", testnet, vault.address);

      //verify source code 
      await setTimeout(60000); //timeout to make sure that Etherescan has processed 
      exec(`npx hardhat verify --network ${testnet} ${vault.address} DerbyUSDC dUSDC 6 1000000000000 2000000 0x07865c6e87b9f70255377e024ace6630c1eaa37f`, (err, stdout, stderr) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log(stdout);
      });
    }
    await deploying("goerli");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 