import { ethers, hardhatArguments } from 'hardhat';
import { deploySwapLibrary } from '@testhelp/deploy';
import { addAddress, INetwork } from './helpers/helpers';

export default async function deploySwapLibraryLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const swapLibrary = await deploySwapLibrary(wallet);

  addAddress(network, 'swapLibrary', swapLibrary.address);
}

deploySwapLibraryLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
