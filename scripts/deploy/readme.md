# Before

Update DAO and Guardian addresses in ./helpers/deployedAddresses for all chains that will be used

# Deploy Order

## 1 deploy controller

npx hardhat run scripts/deploy/controller.ts --network localhost

## 2 deploy swap library

npx hardhat run scripts/deploy/swapLibrary.ts --network localhost

## 3 deploy vault / adjust vault settings if needed

set vaultDeploySettings in ./helpers/settings.ts
npx hardhat run scripts/deploy/vault.ts --network localhost
