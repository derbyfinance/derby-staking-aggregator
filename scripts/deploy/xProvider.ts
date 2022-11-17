import { ethers, hardhatArguments } from 'hardhat';
import { addAddress, INetwork, readAddressFile } from './helpers/helpers';
import { xProviderDeploySettings } from './helpers/settings';
import { deployXProvider } from '@testhelp/deploy';

export default async function deployXProviderLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const addresses = readAddressFile();

  const xProvider = await deployXProvider(
    wallet,
    addresses[network].endPoint,
    addresses[network].connextHandler,
    addresses[network].dao,
    addresses[network].game,
    addresses[network].xChainController,
    xProviderDeploySettings.homeChainId,
  );

  addAddress(network, 'xProvider', xProvider.address);
}

deployXProviderLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
