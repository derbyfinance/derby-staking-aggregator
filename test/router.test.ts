/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import type { Router} from '../typechain-types';
import { deployRouter } from './helpers/deploy';


describe("Deploy router contract", async () => {
  let router: Router, owner: Signer, addr1: Signer, ownerAddr: string, addr1Addr: string;

  beforeEach(async function() {
    [owner, addr1] = await ethers.getSigners();

    [ownerAddr, addr1Addr, router] = await Promise.all([
      owner.getAddress(),
      addr1.getAddress(),
      deployRouter(owner),
    ]);
  });

  it("Should add a protocol", async function() {
    const ETFNumber = 1;
    const protocolNumber = 1;
    const providerAddress = addr1Addr;

    await router.addProtocol(ETFNumber, protocolNumber, providerAddress);
    const protocol = await router.protocol(ETFNumber, protocolNumber);

    expect(protocol).to.be.equal(providerAddress);
  });
  
});