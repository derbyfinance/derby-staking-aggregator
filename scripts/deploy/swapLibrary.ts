import { ethers, hardhatArguments } from 'hardhat';
import { deploySwapLibrary } from '@testhelp/deploy';
import { addAddress, INetwork } from './helpers';

async function main() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const swapLibrary = await deploySwapLibrary(wallet);

  addAddress(network, 'swapLibrary', swapLibrary.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
