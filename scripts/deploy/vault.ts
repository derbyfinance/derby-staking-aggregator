import { ethers, hardhatArguments } from 'hardhat';
import { deployController, deployMainVault } from '@testhelp/deploy';
import { addAddress } from './helpers';
import dep from './deployedAddresses.json';

async function main() {
  const { network } = hardhatArguments;
  const [wallet] = await ethers.getSigners();

  console.log(dep);
  // const vault = await deployMainVault(
  //   dao,
  //   name,
  //   symbol,
  //   decimals,
  //   vaultNumber,
  //   daoAddr,
  //   daoAddr,
  //   gameAddr,
  //   controller.address,
  //   usdc,
  //   uScale,
  //   gasFeeLiquidity,
  // );
  // addAddress(network!, 'vault', vault.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
