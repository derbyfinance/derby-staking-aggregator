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
import './tasks/game_tasks';
import './tasks/vault_tasks';
import './tasks/xprovider_tasks';

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
    deployer: '0x1Ca7b496Ac4E609cf400793Db67916AC91773927',
    dao: '0x1Ca7b496Ac4E609cf400793Db67916AC91773927',
    guardian: '0x1Ca7b496Ac4E609cf400793Db67916AC91773927',
    user: {
      default: 3,
    },
    user1: {
      default: 4,
    },
    user2: {
      default: 5,
    },
    vault: {
      default: 6,
    },
    gameUser0: {
      default: 7,
    },
    gameUser1: {
      default: 8,
    },
  },
  typechain: {},
  networks: {
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ['local'],
    },
    goerli: {
      url: process.env.GOERLI_URL ?? '',
      accounts: pkeys,
    },
    bsc: {
      url: process.env.BSC_TESTNET_URL ?? '',
      accounts: pkeys,
    },
    mumbai: {
      url: process.env.MUMBAI_URL ?? '',
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
