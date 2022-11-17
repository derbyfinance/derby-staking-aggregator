import { ethers, hardhatArguments } from 'hardhat';
import { deployGame } from '@testhelp/deploy';
import { addAddress, INetwork, readAddressFile } from './helpers/helpers';

import { gameDeploySettings } from './helpers/settings';

export default async function deployGameLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const addresses = readAddressFile();

  const game = await deployGame(
    wallet,
    gameDeploySettings.nftName,
    gameDeploySettings.nftSymbol,
    addresses[network].derbyToken,
    addresses[network].dao,
    addresses[network].guardian,
    addresses[network].controller,
  );
  addAddress(network, 'game', game.address);
}

deployGameLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
