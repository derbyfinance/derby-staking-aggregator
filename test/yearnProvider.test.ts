/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";

import type { YearnProvider } from '../typechain-types'

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9'

describe("Deploy Contract and interact with Yearn", async () => {
  let yearnProvider: YearnProvider, owner: Signer, addr1: Signer;

  beforeEach(async function() {
    [owner, addr1] = await ethers.getSigners();
    const yearnProviderFactory = await ethers.getContractFactory('YearnProvider', owner);
    // console.log(yearnProviderFactory)

    yearnProvider = await yearnProviderFactory.deploy(usdc, yusdc)

    console.log(yearnProvider)
  });

  it("Should deposit tokens to Yearn", async () => {
 
  });
});