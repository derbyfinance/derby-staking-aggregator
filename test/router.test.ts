/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import type { Router} from '../typechain-types';
import { deployRouter } from './helpers/deploy';
import { usdc, yearn, yearnUSDC as yusdc} from "./helpers/addresses";


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
    const protocolNumber = 1;
    const providerAddress = addr1Addr;

    await router.addProtocol(providerAddress, yusdc, usdc, yearn);
    const protocol = await router.protocolProvider(protocolNumber);

    expect(protocol).to.be.equal(providerAddress);
  });
  
});