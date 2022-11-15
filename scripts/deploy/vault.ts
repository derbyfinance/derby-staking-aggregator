import { ethers, hardhatArguments } from 'hardhat';
import { deployMainVault } from '@testhelp/deploy';
import { addAddress, INetwork } from './helpers';
import { vaultDeploySettings } from './settings';
import deployed from './deployedAddresses.json';

async function main() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();

  const vault = await deployMainVault(
    wallet,
    deployed[network].swapLibrary,
    deployed[network].dao,
    deployed.game,
    deployed[network].controller,
    vaultDeploySettings,
  );
  addAddress(network, 'vault', vault.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
