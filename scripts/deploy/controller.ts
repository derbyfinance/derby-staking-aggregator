import { ethers, hardhatArguments } from 'hardhat';
import { deployController } from '@testhelp/deploy';
import { addAddress, INetwork } from './helpers/helpers';

async function main() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const controller = await deployController(wallet, await wallet.getAddress());

  addAddress(network, 'controller', controller.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
