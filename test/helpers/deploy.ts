/* eslint-disable prettier/prettier */
import { deployContract } from "ethereum-waffle";
import { Signer, BigNumberish, Wallet } from "ethers";

import IGovernedArtifact from '../../artifacts/contracts/IGoverned.sol/IGoverned.json';
import { IGoverned } from '@typechain/IGoverned';

import XaverTokenArtifact from '../../artifacts/contracts/XaverToken.sol/XaverToken.json';
import { XaverToken } from '@typechain/XaverToken';

import ETFGameArtifact from '../../artifacts/contracts/ETFgame.sol/ETFGame.json';
import { ETFGame } from '@typechain/ETFGame';

import BasketTokenArtifact from '../../artifacts/contracts/BasketToken.sol/BasketToken.json';
import { BasketToken } from '@typechain/BasketToken';

export const deployIGoverned = (deployerSign: Signer, daoAddress: string, guardianAddress: string): Promise<IGoverned> => {
    return (deployContract(deployerSign, IGovernedArtifact, [daoAddress, guardianAddress])) as Promise<IGoverned>;
};

export const deployXaverToken = (deployerSign: Signer, name: string, symbol: string): Promise<XaverToken> => {
    return (deployContract(deployerSign, XaverTokenArtifact, [name, symbol])) as Promise<XaverToken>;
};

export const deployETFGame = (deployerSign: Signer, XaverTokenAddress: string, governedAddress: string): Promise<ETFGame> => {
    return (deployContract(deployerSign, ETFGameArtifact, [XaverTokenAddress, governedAddress])) as Promise<ETFGame>;
};

export const deployBasketToken = (deployerSign: Signer, ETFgame: string, name: string, symbol: string): Promise<BasketToken> => {
    return (deployContract(deployerSign, BasketTokenArtifact, [ETFgame, name, symbol])) as Promise<BasketToken>;
};