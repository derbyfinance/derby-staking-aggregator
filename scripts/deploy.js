const { ethers } = require("hardhat");
// var { exec } = require('child_process');
// const { setTimeout } = require("timers/promises");

const abi_xprovider = require('../artifacts/contracts/Mocks/ConnextXProviderMock.sol/ConnextXProviderMock.json').abi;
const abi_receive = require('../artifacts/contracts/Mocks/XReceiveMock.sol/XReceiveMock.json').abi;
const abi_send = require('../artifacts/contracts/Mocks/XSendMock.sol/XSendMock.json').abi;
const bytecode_xprovider = require('../artifacts/contracts/Mocks/ConnextXProviderMock.sol/ConnextXProviderMock.json').bytecode;
const bytecode_receive = require('../artifacts/contracts/Mocks/XReceiveMock.sol/XReceiveMock.json').bytecode;
const bytecode_send = require('../artifacts/contracts/Mocks/XSendMock.sol/XSendMock.json').bytecode;

const privateKey = process.env.PRIVATE_KEY !== undefined ? process.env.PRIVATE_KEY : [];
const handlers = {
    "rinkeby": "0x4cAA6358a3d9d1906B5DABDE60A626AAfD80186F",
    "goerli": "0x6c9a905Ab3f4495E2b47f5cA131ab71281E0546e"
};

const main = async () => {
    // deploy on rinkeby
    let testnet = "rinkeby";
    let url = config.networks[testnet].url;
    let provider = ethers.getDefaultProvider(url);
    let wallet = new ethers.Wallet(privateKey, provider);
    let wallet_address = await wallet.getAddress();

    console.log("deploying xprovider on rinkeby");
    let factory = new ethers.ContractFactory(abi_xprovider, bytecode_xprovider, wallet);
    let xProvider_rinkeby = await factory.deploy(wallet_address, handlers[testnet]);

    console.log("deploying xsend on rinkeby");
    factory = new ethers.ContractFactory(abi_send, bytecode_send, wallet);
    let xSend_rinkeby = await factory.deploy(xProvider_rinkeby.address);

    // deploy on goerli
    testnet = "goerli";
    url = config.networks[testnet].url;
    provider = ethers.getDefaultProvider(url);
    wallet = new ethers.Wallet(privateKey, provider);
    wallet_address = await wallet.getAddress();

    console.log("deploying xprovider on goerli");
    factory = new ethers.ContractFactory(abi_xprovider, bytecode_xprovider, wallet);
    let xProvider_goerli = await factory.deploy(wallet_address, handlers[testnet]);

    console.log("deploying xsend on rinkeby");
    factory = new ethers.ContractFactory(abi_receive, bytecode_receive, wallet);
    let xReceive_rinkeby = await factory.deploy(xProvider_goerli.address);
}

main();