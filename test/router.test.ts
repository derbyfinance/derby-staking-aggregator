/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import type { Router} from '../typechain-types';
import { deployRouter } from './helpers/deploy';


describe("Deploy router contract", async () => {
  let router: Router, dao: Signer, addr1: Signer, vault: Signer, daoAddr: string, addr1Addr: string, vaultAddr: string;

  beforeEach(async function() {
    [dao, addr1, vault] = await ethers.getSigners();

    [daoAddr, addr1Addr, vaultAddr] = await Promise.all([
      dao.getAddress(),
      addr1.getAddress(),
      vault.getAddress(),
    ]);
    router = await deployRouter(dao, daoAddr)
  });

  it("Should add a protocol", async function() {
    const ETFNumber = 1;
    const protocolNumber = 1;
    const providerAddress = addr1Addr;

    await router.addProtocol(ETFNumber, protocolNumber, providerAddress, vaultAddr);
    const protocol = await router.protocol(ETFNumber, protocolNumber);

    expect(protocol).to.be.equal(providerAddress);
  });
  
});