# Before

Update DAO and Guardian addresses in ./helpers/deployedAddresses for all chains that will be used
Deploy derbyToken

## Deploy Derby Token

npx hardhat run scripts/deploy/derbyToken.ts --network localhost

# Deploy Order

## 1 deploy controller

npx hardhat run scripts/deploy/controller.ts --network localhost

## 2 deploy swap library

npx hardhat run scripts/deploy/swapLibrary.ts --network localhost

## 3 deploy game / derbyToken should be deployed

npx hardhat run scripts/deploy/game.ts --network localhost

## 4 deploy vault / adjust vault settings if needed

set vaultDeploySettings in ./helpers/settings.ts
npx hardhat run scripts/deploy/vault.ts --network localhost

## 5 deploy xChainController

npx hardhat run scripts/deploy/xChainController.ts --network localhost

## 6 deploy xProvider / add layerzero and connextHandler

add layerzero and connextHandler endpoint addresses in deployedAddresses
npx hardhat run scripts/deploy/xProvider.ts --network localhost
