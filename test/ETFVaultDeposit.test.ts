/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils } from "ethers";
import { ethers, waffle } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, formatUnits } from './helpers/helpers';
import type { ETFVaultMock, ERC20, Router } from '../typechain-types';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAaveProviderMock, deployCompoundProviderMock, deployRouterMockContract, deployYearnProviderMock } from './helpers/deployMocks';
import { usdc } from "./helpers/addresses";
import { MockContract } from "ethereum-waffle";
import { setDeltaAllocations } from "./helpers/vaultHelpers";

const name = 'XaverUSDC';
const symbol = 'xUSDC'
const amountUSDC = parseUSDC('100000');
const threshold = parseUSDC('0');
const ETFNumber = 1;
let protocolYearn = [1, 1];
let protocolCompound = [2, 1];
let protocolAave = [3, 1];
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let router: Router, dao: Signer, USDCSigner: Signer, IUSDc: ERC20, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock, yearnProvider: MockContract, compoundProvider: MockContract, aaveProvider: MockContract ;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, yearnProvider, compoundProvider, aaveProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, daoAddr, ETFNumber, router.address, usdc, threshold),
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
      router.addProtocol(ETFNumber, protocolYearn[0], yearnProvider.address, vaultMock.address),
      router.addProtocol(ETFNumber, protocolCompound[0], compoundProvider.address, vaultMock.address),
      router.addProtocol(ETFNumber, protocolAave[0], aaveProvider.address, vaultMock.address)
    ])
  });

  it("Deposit, mint and return Xaver tokens", async function() {
    await setDeltaAllocations(vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await yearnProvider.mock.balanceUnderlying.returns(5)
    await compoundProvider.mock.balanceUnderlying.returns(5)
    await aaveProvider.mock.balanceUnderlying.returns(5)

    const balanceVault = await vaultMock.getTotalUnderlying();

    console.log(Number(balanceVault))

    console.log(Number(await vaultMock.totalSupply()));
  });

});

