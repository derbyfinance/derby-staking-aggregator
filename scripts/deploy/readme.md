# Order

## 1

npx hardhat run scripts/deploy/controller.ts --network localhost

## 2

npx hardhat run scripts/deploy/swapLibrary.ts --network localhost

## 3

set vaultDeploySettings in ./settings.ts
npx hardhat run scripts/deploy/vault.ts --network localhost
