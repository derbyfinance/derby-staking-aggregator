export const derbyTokenSettings = {
  name: 'Derby Finance',
  symbol: 'DRB',
  totalSupply: 100_000,
};

export const gameDeploySettings = {
  nftName: 'DerbyNFT',
  nftSymbol: 'DRBNFT',
  negativeRewardFactor: 50,
  negativeRewardThreshold: -50_000,
};

export const gameInitSettings = {
  chainids: [10, 100, 1000],
  latestprotocolid: 5,
};

export const xChainControllerDeploySettings = {
  homeChainId: 100,
};

export const xChainControllerInitSettings = {
  chainIds: [10, 100, 1000],
};

export const xProviderDeploySettings = {
  layerZeroEndpoint: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // dummy
  connextHandler: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // dummy
  mainnet: 10, // dummy
  arbitrum: 100, // dummy
  optimism: 1000, // dummy
  bnb: 10_000, // dummy
};
