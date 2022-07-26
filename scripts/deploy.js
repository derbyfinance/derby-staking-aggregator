const { ethers } = require("hardhat");
var { exec } = require('child_process');
const { setTimeout } = require("timers/promises");

const abi = require('../artifacts/contracts/MultiChainToken.sol/MultiChainToken.json').abi;
const bytecode = require('../artifacts/contracts/MultiChainToken.sol/MultiChainToken.json').bytecode;
const abi_dummy = require('../artifacts/contracts/DummyContract.sol/DummyContract.json').abi;
const bytecode_dummy = require('../artifacts/contracts/DummyContract.sol/DummyContract.json').bytecode;

const privateKey = process.env.PRIVATE_KEY !== undefined ? process.env.PRIVATE_KEY : [];
const networks = ["rinkeby", "bscTestnet", "polygonMumbai"];
const endpoints = {
    "rinkeby": "0x08a65B184A784aC2E53D57af7d89d614C50fbaB0",
    "bscTestnet": "0x3d04203B09298A701a1250Ac7b5F94c72371E5bA",
    "polygonMumbai": "0xFA98f9DE4444b010AFc0da926b484548b52039Ce"
};
const name = "TestDRB";
const symbol = "DRB";
const deploymentList = [];
const setAddressesList = [];

const main = async () => {
    let deploy = async (wallet, name, symbol, endpoint, testnet) => {
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy(name, symbol, endpoint);
    
        console.log("Contract deployed to:", testnet, " with address: ",contract.address);
    
        await contract.deployed();

        //verify source code Multichain contracts
        await setTimeout(60000); //timeout to make sure that Etherescan has processed the
        exec(`npx hardhat verify --network ${testnet} ${contract.address} ${name} ${symbol} ${endpoint}`, (err, stdout, stderr) => {
            if (err) {
              console.error(err);
              return;
            }
            console.log(stdout);
        });

        return contract.address;
    };
    
    const deployments = async () => {
        for (let testnet of networks){
            const url = config.networks[testnet].url;
            // Connect to the network
            const provider = ethers.getDefaultProvider(url);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            const deployment = deploy(wallet, name, symbol, endpoints[testnet], testnet);
            deploymentList.push(deployment);
        }
        return Promise.all(deploymentList);
    };

    const addresses = await deployments();
    // [0] rinkeby, [1] bsc_testnet, [2] mumbai
    console.log("addresses: ", addresses);

    const setAddresses = async () => {
        for (let i=0; i<networks.length; i++){
            const url = config.networks[networks[i]].url;
            // Connect to the network
            const provider = ethers.getDefaultProvider(url);
            const wallet = new ethers.Wallet(privateKey, provider);

            const contract = new ethers.Contract(addresses[i], abi, wallet);
            const setAddress = contract.setExternalMultiChainAddresses(addresses[0], addresses[1], addresses[2]);
            setAddressesList.push(setAddress);
        }
        return Promise.all(setAddressesList);
    };

    await setAddresses();
}

main();