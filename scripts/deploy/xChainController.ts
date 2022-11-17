import { ethers, hardhatArguments } from 'hardhat';
import { addAddress, INetwork, readAddressFile } from './helpers/helpers';
import { xChainControllerDeploySettings } from './helpers/settings';
import { deployXChainController } from '@testhelp/deploy';

export default async function deployXChainControllerLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const addresses = readAddressFile();

  const xChainController = await deployXChainController(
    wallet,
    addresses[network].game,
    addresses[network].dao,
    addresses[network].guardian,
    xChainControllerDeploySettings.homeChainId,
  );

  addAddress(network, 'xChainController', xChainController.address);
}

deployXChainControllerLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
