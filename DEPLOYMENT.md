## for testing run npx hardhat node

### deploy all contracts on given network

npx hardhat --network localhost deploy

### deploy all contracts and resets the deployments from scratch

npx hardhat --network localhost deploy --reset

### deploy contracts excluding Providers

npx hardhat --network localhost deploy --tags Controller,DerbyToken,Game,Swap,MainVault,XChainController,XProvider
