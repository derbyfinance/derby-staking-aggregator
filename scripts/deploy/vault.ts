import { ethers, hardhatArguments } from 'hardhat';
import { deployMainVault } from '@testhelp/deploy';
import { addAddress, INetwork, readAddressFile } from './helpers/helpers';
import { vaultDeploySettings } from './helpers/settings';

export default async function deployVaultLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const addresses = readAddressFile();

  const vault = await deployMainVault(
    wallet,
    addresses[network].swapLibrary,
    addresses[network].dao,
    addresses[network].game,
    addresses[network].controller,
    vaultDeploySettings,
  );
  addAddress(network, 'vault', vault.address);
}

deployVaultLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
