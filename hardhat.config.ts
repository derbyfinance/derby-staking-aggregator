import * as dotenv from 'dotenv';
import 'tsconfig-paths/register';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';

// tasks
import './tasks/controller_tasks';

dotenv.config();

const pkeys = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 5,
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    dao: {
      default: 0,
    },
    guardian: {
      default: 0,
    },
  },
  typechain: {},
  networks: {
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ['local'],
    },
    ropsten: {
      url: process.env.ROPSTEN_URL ?? '',
      accounts: pkeys,
    },
    rinkeby: {
      url: process.env.RINKEBY_URL ?? '',
      accounts: pkeys,
    },
    goerli: {
      url: process.env.GOERLI_URL ?? '',
      accounts: pkeys,
    },
    bsc: {
      url: process.env.BSC_TESTNET_URL ?? '',
      accounts: pkeys,
    },
    hardhat: {
      forking: {
        url: `${process.env.PROVIDER_FORKING}`,
        blockNumber: 15932058,
      },
    },
  },
  // gasReporter: {
  //   enabled: process.env.REPORT_GAS ? true : false,
  //   currency: "USD",
  //   coinmarketcap: process.env.CMC,
  // },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY as string,
      bscTestnet: process.env.BINANCESCAN_API_KEY as string,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY as string,
    },
  },
  mocha: {
    timeout: 3000000,
  },
};

export default config;
