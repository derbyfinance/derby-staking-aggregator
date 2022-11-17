import { ethers, hardhatArguments } from 'hardhat';
import { deployController } from '@testhelp/deploy';
import { addAddress, INetwork, readAddressFile } from './helpers/helpers';

export default async function deployControllerLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const addresses = readAddressFile();

  const controller = await deployController(wallet, addresses[network].dao);

  addAddress(network, 'controller', controller.address);
}

deployControllerLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
