/* eslint-disable no-useless-constructor */
/* eslint-disable prettier/prettier */

import { BigNumber, Signer } from "ethers";
import { ETFVaultMock } from "typechain-types";

// Stable coins
export const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

/// Protocols
// Yearn
export const yearnUSDC = "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE";
export const yearnDAI = "0xdA816459F1AB5631232FE5e97a05BBBb94970c95";
export const yearnUSDT = "0x7Da96a3891Add058AdA2E826306D812C638D87a7";
// compound
export const compoundUSDC = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
export const compoundDAI = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
export const compoundUSDT = "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9"; // 8
// Aave
export const aaveUSDC = "0xBcca60bB61934080951369a648Fb03DF4F96263C";
export const aaveUSDT = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
export const aaveDAI = "0x028171bCA77440897B824Ca71D1c56caC55b68A3";
// TrueFi
export const truefiUSDC = "0xA991356d261fbaF194463aF6DF8f0464F8f1c742";
export const truefiUSDT = "0x6002b1dcB26E7B1AA797A17551C6F487923299d7";
// Homora not really used
export const homoraUSDC = "0x08bd64BFC832F1C2B3e07e634934453bA7Fa2db2";
export const homoraUSDT = "0x020eDC614187F9937A1EfEeE007656C6356Fb13A";
export const homoraDAI = "0xee8389d235E092b2945fE363e97CDBeD121A0439";
// Idle
export const idleUSDC = "0x5274891bEC421B39D23760c04A6755eCB444797C"; // 18 
export const idleUSDT = "0xF34842d05A1c888Ca02769A633DF37177415C2f8";
export const idleDAI = "0x3fE7940616e5Bc47b0775a0dccf6237893353bB4";
// beta
export const betaUSDC = "0xC02392336420bb54CE2Da8a8aa4B118F2dceeB04"; // 6
export const betaUSDT = "0xBe1c71c94FebcA2673DB2E9BD610E2Cc80b950FC"; // 6
export const betaDAI = "0x70540A3178290498B0C6d843Fa7ED97cAe69B86c"; // 18

// Gov Tokens
export const aave = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
export const yearn = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e";
export const truefi = "0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784";
export const alpha = "0xa1faa113cbE53436Df28FF0aEe54275c13B40975";
export const idle = "0x875773784Af8135eA0ef43b5a374AaD105c5D39e";
export const beta = '0xBe1a001FE942f96Eea22bA08783140B9Dcc09D28';

// Uniswap
export const uniswapFactory = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

// Curve Finance
export const curve3Pool = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"; // DAI / USDC / USDT

// others
export const comptroller = "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B";
export const compToken = "0xc00e94Cb662C3520282E6f5717214004A7f26888";
export const WEth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const ChainlinkGasPrice = "0x169e633a2d1e6c10dd91238ba11c4a708dfef37c";

export const CompWhale = '0x7587cAefc8096f5F40ACB83A09Df031a018C66ec';

export interface IProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
}

class ProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  number: number = 0;
  allocation: number = 0;

  constructor({name, protocolToken, underlyingToken, govToken, decimals}: IProtocolVault) {
    this.name = name;
    this.protocolToken = protocolToken;
    this.underlyingToken = underlyingToken;
    this.govToken = govToken;
    this.decimals = decimals;
  }

  async setAllocation(vault: ETFVaultMock, game: Signer, allocation: number): Promise<void> {
    this.allocation = allocation;
    await vault.connect(game).setDeltaAllocations(this.number, allocation)
  };

  async getDeltaAllocationTEST(vault: ETFVaultMock): Promise<BigNumber> {
    return await vault.getDeltaAllocationTEST(this.number);
  };

  async getAllocation(vault: ETFVaultMock): Promise<BigNumber> {
    return await vault.getDeltaAllocationTEST(this.number);
  };
}

export const allProtocols = new Map<string, ProtocolVault>();

allProtocols
.set('beta_usdc_01', new ProtocolVault({
  name: 'beta_usdc_01',
  protocolToken: betaUSDC,
  underlyingToken: usdc,
  govToken: beta, 
  decimals: 1E6,
}))
.set('beta_dai_01', new ProtocolVault({
  name: 'beta_dai_01',
  protocolToken: betaDAI,
  underlyingToken: dai,
  govToken: beta, 
  decimals: 1E18,
}))
.set('beta_usdt_01', new ProtocolVault({
  name: 'beta_usdt_01',
  protocolToken: betaUSDT,
  underlyingToken: usdt,
  govToken: beta, 
  decimals: 1E6,
}))
.set('idle_usdc_01', new ProtocolVault({
  name: 'idle_usdc_01',
  protocolToken: idleUSDC,
  underlyingToken: usdc,
  govToken: idle, 
  decimals: 1E6, /////// check
}));


// export const allProtocols = [
//   betaUSDC01,
//   betaDAI01,
//   betaUSDT01,
//   idleUSDC01
// ]

