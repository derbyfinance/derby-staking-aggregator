/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import type { FeeTestContract} from '../typechain-types';
import FeeTestContractArtifact from '../artifacts/contracts/Tests/FeeTestContract.sol/FeeTestContract.json';
import { deployContract } from "ethereum-waffle";

const deployFeeTestContract = (deployerSign: Signer, ): Promise<FeeTestContract> => {
  return (deployContract(deployerSign, FeeTestContractArtifact,  []) as Promise<FeeTestContract>);
};

const protocols = [
  [1, 30],
  [3, 10],
  [5, 20],
  [8, 50],
  [10, 20],
  [12, 30],
  [14, 10],
  [17, 20],
  [18, 30],
  [20, 60],
]

describe("Test gas", async () => {
  let feeTestContract: FeeTestContract, owner: Signer;
  
  beforeEach(async function() {
    [owner] = await ethers.getSigners();
    feeTestContract = await deployFeeTestContract(owner)
  });

  it("set and read array", async function() {
    await feeTestContract.deleteArray();

    for (const protocol of protocols) {
      await feeTestContract.setMapping(protocol[0], protocol[1])
    }
    
    for (const protocol of protocols) {
      await feeTestContract.setArray(protocol[0]);
    }

    await feeTestContract.loopArray();
  });

  it("set mapping", async function() {
    for (const protocol of protocols) {
      await feeTestContract.setMapping(protocol[0], protocol[1])
    }
    await feeTestContract.setLatestProtol(20);

    await feeTestContract.loopMapping();
  });

  it("set protocolsInETF array", async function() {
    const latestProtocol = await feeTestContract.latestProtocol();
    console.log(`latest ${latestProtocol}`);
  });
  
});