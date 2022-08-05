const { ethers } = require("hardhat");
var { exec } = require('child_process');
const { setTimeout } = require("timers/promises");

const abi_xprovider = require('../artifacts/contracts/Mocks/LayerZero/LZXProviderMock.sol/LZXProviderMock.json').abi;
const abi_receive = require('../artifacts/contracts/Mocks/XReceiveMock.sol/XReceiveMock.json').abi;
const abi_send = require('../artifacts/contracts/Mocks/XSendMock.sol/XSendMock.json').abi;
const bytecode_xprovider = require('../artifacts/contracts/Mocks/LayerZero/LZXProviderMock.sol/LZXProviderMock.json').bytecode;
const bytecode_receive = require('../artifacts/contracts/Mocks/XReceiveMock.sol/XReceiveMock.json').bytecode;
const bytecode_send = require('../artifacts/contracts/Mocks/XSendMock.sol/XSendMock.json').bytecode;

const privateKey = process.env.PRIVATE_KEY !== undefined ? process.env.PRIVATE_KEY : [];
const handlers = {
    "rinkeby": "0x4cAA6358a3d9d1906B5DABDE60A626AAfD80186F",
    "goerli": "0x6c9a905Ab3f4495E2b47f5cA131ab71281E0546e",
    "bsc": "0x0000000000000000000000000000000000000000"
};
const lz_endpoints = {
  "rinkeby": "0x79a63d6d8BBD5c6dfc774dA79bCcD948EAcb53FA",
  "goerli": "0x0000000000000000000000000000000000000000",
  "bsc": "0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1"
};

const main = async () => {
    const deploying = async (testnet, send) => {
      // deploy
      let url = config.networks[testnet].url;
      let provider = ethers.getDefaultProvider(url);
      let wallet = new ethers.Wallet(privateKey, provider);
      let wallet_address = await wallet.getAddress();
      console.log("wallet address on %s: %s", testnet, wallet_address);

      console.log("deploying xprovider on %s", testnet);
      let factory = new ethers.ContractFactory(abi_xprovider, bytecode_xprovider, wallet);
      let xProvider = await factory.deploy(lz_endpoints[testnet], wallet_address, handlers[testnet]);
      await xProvider.deployed();
      console.log("xProvider_%s: %s", testnet, xProvider.address);

      if (send) {
        console.log("deploying xsend on %s", testnet);
        factory = new ethers.ContractFactory(abi_send, bytecode_send, wallet);
        let xSend = await factory.deploy(wallet_address);
        await xSend.deployed();
        await xSend.setXProvider(xProvider.address);
        console.log("xSend_%s: %s", testnet, xSend.address);
      } else {
        console.log("deploying xreceive on %s", testnet);
        factory = new ethers.ContractFactory(abi_receive, bytecode_receive, wallet);
        let xReceive = await factory.deploy(wallet_address);
        await xReceive.deployed();
        await xReceive.setXProvider(xProvider.address);
        console.log("xReceive_%s: %s", testnet, xReceive.address);
      }
    }
    await deploying("rinkeby", true);
    await deploying("goerli", false);
    await deploying("bsc", false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 