import { GameMock, MainVaultMock } from '@typechain';
import { BigNumberish, Signer } from 'ethers';
import { Result } from 'ethers/lib/utils';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function mintBasket(game: GameMock, user: Signer, vaultNumber: BigNumberish) {
  const tx = await game.connect(user).mintNewBasket(vaultNumber);
  const receipt = await tx.wait();
  const { basketId } = receipt.events![1].args as Result;
  return Number(basketId);
}

export async function allNamedAccountsToSigners({
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const accounts = await getNamedAccounts();
  const signers = await Promise.all([
    ethers.getSigner(accounts.dao),
    ethers.getSigner(accounts.guardian),
    ethers.getSigner(accounts.user),
    ethers.getSigner(accounts.user2),
    ethers.getSigner(accounts.user3),
    ethers.getSigner(accounts.gameUser1),
    ethers.getSigner(accounts.gameUser2),
    ethers.getSigner(accounts.gameUser3),
  ]);

  return [...signers];
}

export type IVaultUser = {
  user: Signer;
  chain: number;
  vault: MainVaultMock;
  depositAmount: BigNumberish;
};

export type IGameUser = {
  user: Signer;
  basketId: number;
  allocations: BigNumberish[][];
  totalAllocations: number;
};

export type IChainId = {
  id: number;
  totalAllocations: number;
};

export type IVaults = {
  vault: MainVaultMock;
  homeChain: number;
  underlying: BigNumberish;
  totalSupply: BigNumberish;
  totalWithdrawalRequests: BigNumberish;
};
