/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Contract, Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { AaveProvider, ERC20, Router } from '../typechain-types';
import { deployAaveProvider, deployRouter } from './helpers/deploy';
import { usdc, aaveUSDC as ausdc} from "./helpers/addresses";

const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
const protocolNumber = 3;

describe("Deploy Contract and interact with Aave", async () => {
  let aaveProvider: AaveProvider, router: Router, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: Contract, aToken: Contract, daoAddr: string, vaultAddr: string;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vaultAddr, aaveProvider, USDCSigner, IUSDc, aToken] = await Promise.all([
      vault.getAddress(),
      deployAaveProvider(dao, ausdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(ausdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(aaveProvider.address, amountUSDC),
      router.addProtocol(ETFNumber, protocolNumber, aaveProvider.address, vaultAddr)
    ])
  });

  it("Should deposit and withdraw to Aave through Router", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await router.connect(vault).deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC);

    const aTokenbalance = await aaveProvider.balance(vaultAddr);
    expect(formatUSDC(aTokenbalance)).to.be.equal(formatUSDC(amountUSDC));

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(aTokenbalance);

    console.log(`-------------------------Withdraw-------------------------`); 
    await aToken.connect(vault).approve(aaveProvider.address, aTokenbalance);
    await router.connect(vault).withdraw(ETFNumber, protocolNumber, vaultAddr, aTokenbalance);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10)
  });

  it("Should fail when !Router is calling the Provider", async function() {
    await expect(aaveProvider.connect(vault).deposit(vaultAddr, amountUSDC))
    .to.be.revertedWith('ETFProvider: only router');
  });

  it("Should fail when !Vault is calling the Router", async function() {
    await expect(router.deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC))
    .to.be.revertedWith('Router: only Vault');
  });

  it("Should get exchangeRate through Router", async function() {
    const exchangeRate = await router.connect(vault).exchangeRate(ETFNumber, protocolNumber)
    console.log(`Exchange rate ${exchangeRate}`)
  });
  
});