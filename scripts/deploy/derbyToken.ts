import { ethers, hardhatArguments } from 'hardhat';
import { addAddress, INetwork } from './helpers/helpers';
import { derbyTokenSettings } from './helpers/settings';
import { deployDerbyToken } from '@testhelp/deploy';

export default async function deployDerbyTokenLive() {
  const { network } = hardhatArguments as INetwork;
  const [wallet] = await ethers.getSigners();
  const { name, symbol, totalSupply } = derbyTokenSettings;

  const derbyToken = await deployDerbyToken(wallet, name, symbol, totalSupply);
  console.log(derbyToken.address);

  addAddress(network, 'derbyToken', derbyToken.address);
}

deployDerbyTokenLive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
