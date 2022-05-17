/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { MockContract, MockProvider } from "ethereum-waffle";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers, network } from "hardhat";
import { AaveProvider, CompoundProvider, YearnProvider, ETFGame } from "typechain-types";
import { aave, aaveUSDC, aaveUSDT, compoundDAI, compoundUSDC, compToken, comptroller, CompWhale, curve3Pool, dai, usdc, usdt, yearn, yearnUSDC } from "./addresses";
import { deployAaveProvider, deployCompoundProvider, deployETFVaultMock, deployController, deployYearnProvider, deployETFGameMock, deployXaverToken } from "./deploy";
import { deployAaveProviderMock, deployYearnProviderMock, deployCompoundProviderMock } from "./deployMocks";
import { getUSDCSigner, erc20, controllerAddProtocol, getWhale, parseEther } from './helpers';

export interface Protocol {
  number: number;
  allocation: number;
  address: string;
}

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const gasFeeLiquidity = 10_000 * uScale;
const totalXaverSupply = parseEther(1E8.toString()); 

export async function beforeEachETFVault(
  amountUSDC: BigNumber,
  providerMocks: boolean = false,
  gameMockAsSigner: boolean = false
) {
  // stock protocols
  const protocolCompound = { number: 0, allocation: 40, address: compoundUSDC };
  const protocolAave = { number: 0, allocation: 60, address: aaveUSDC };
  const protocolYearn = { number: 0, allocation: 20, address: yearnUSDC };
  const allProtocols = [protocolCompound, protocolAave, protocolYearn];

  // new protocols
  const protocolCompoundDAI = { number: 0, allocation: 0, address: compoundDAI };
  const protocolAaveUSDT = { number: 0, allocation: 0, address: aaveUSDT };

  let yearnProvider, compoundProvider, aaveProvider;
  let yearnProviderMock, compoundProviderMock, aaveProviderMock;
  const [dao, user] = await ethers.getSigners();

  // Get Addresses
  const [daoAddr, userAddr] = await Promise.all([
    dao.getAddress(),
    user.getAddress(),
  ]);
  const controller = await deployController(dao, daoAddr);
  const xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
  const gameMock = await deployETFGameMock(user, name, symbol, xaverToken.address, controller.address, daoAddr, controller.address);  
  await controller.connect(dao).addGame(gameMock.address);
  let vaultMock = undefined;
  if (gameMockAsSigner) {
    vaultMock = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameMock.address, controller.address, usdc, uScale, gasFeeLiquidity);
  } else {
    vaultMock = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);
  }
  
  // Deploy all providers and Vault
  if (!providerMocks) {
    [compoundProvider, aaveProvider, yearnProvider] = await Promise.all([
      deployCompoundProvider(dao, controller.address, comptroller),
      deployAaveProvider(dao, controller.address),
      deployYearnProvider(dao, controller.address),
    ]);

    [protocolCompound.number, protocolCompoundDAI.number, protocolAave.number, protocolAaveUSDT.number, protocolYearn.number] = await Promise.all([
      controllerAddProtocol(controller, 'compound_usdc_01', ETFnumber, compoundProvider.address, compoundUSDC, usdc, compToken, 1E6.toString()),
      controllerAddProtocol(controller, 'compound_dai_01', ETFnumber, compoundProvider.address, compoundDAI, dai, compToken, 1E18.toString()),
      controllerAddProtocol(controller, 'aave_usdc_01', ETFnumber, aaveProvider.address, aaveUSDC, usdc, aave, 1E6.toString()),
      controllerAddProtocol(controller, 'aave_usdt_01', ETFnumber, aaveProvider.address, aaveUSDT, usdt, aave, 1E6.toString()),
      controllerAddProtocol(controller, 'yearn_usdc_01', ETFnumber, yearnProvider.address, yearnUSDC, usdc, yearn, 1E6.toString()),
      controller.setClaimable(compoundProvider.address, true),
    ]);
  }

  if (providerMocks) {
    [compoundProviderMock, aaveProviderMock, yearnProviderMock] = await Promise.all([
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      deployYearnProviderMock(dao),
    ]);

    [protocolCompound.number, protocolCompoundDAI.number, protocolAave.number, protocolAaveUSDT.number, protocolYearn.number] = await Promise.all([
      controllerAddProtocol(controller, 'compound_usdc_01', ETFnumber, compoundProviderMock.address, compoundUSDC, usdc, compToken, 1E6.toString()),
      controllerAddProtocol(controller, 'compound_dai_01', ETFnumber, compoundProviderMock.address, compoundDAI, dai, compToken, 1E18.toString()),
      controllerAddProtocol(controller, 'aave_usdc_01', ETFnumber, aaveProviderMock.address, aaveUSDC, usdc, aave, 1E6.toString()),
      controllerAddProtocol(controller, 'aave_usdt_01', ETFnumber, aaveProviderMock.address, aaveUSDT, usdt, aave, 1E6.toString()),
      controllerAddProtocol(controller, 'yearn_usdc_01', ETFnumber, yearnProviderMock.address, yearnUSDC, usdc, yearn, 1E6.toString()),
    ]);
  }

  // Get Signers and interfaces
  const [USDCSigner, compSigner, IUSDc, IComp, IcUSDC] = await Promise.all([
    getUSDCSigner(),
    getWhale(CompWhale),
    erc20(usdc),
    erc20(compToken),
    erc20(compoundUSDC)
  ]);

  // Transfer USDC to User address, add Vault address to controller, set Curve pool index
  await Promise.all([
    controller.addVault(vaultMock.address),
    controller.addVault(userAddr),
    controller.addCurveIndex(dai, 0),
    controller.addCurveIndex(usdc, 1),
    controller.addCurveIndex(usdt, 2),
    IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(100)),
    IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(100)),
  ]);

  return Promise.all([
    vaultMock,
    user,
    userAddr,
    [protocolCompound, protocolAave, protocolYearn, protocolCompoundDAI, protocolAaveUSDT],
    allProtocols,
    IUSDc,
    yearnProviderMock as MockContract, 
    compoundProviderMock as MockContract, 
    aaveProviderMock as MockContract,
    USDCSigner,
    controller,
    IcUSDC,
    IComp,
    compSigner,
    yearnProvider as YearnProvider,
    compoundProvider as CompoundProvider,
    aaveProvider as AaveProvider,
    dao,
    gameMock,
    xaverToken
  ]);
};

