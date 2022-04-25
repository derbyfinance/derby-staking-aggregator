# Adding provider for an underlying protocol

## Find and add vault addresses and Gov token address to helpers/addresses.ts file.
## Add deployment script from the scripts.ts file to helpers/deploy.ts.
## Find contract ABI on etherscan or Github.
## Change the deposit, withdraw and pricePerShare function names in the Interface file to match the function names of the protocol. Check return values.
## Update all the protocolname and token mentions in the BeforeEach in test.ts.
## Create Deposit function plus test with the example file.
## Create Withdraw function plus test with the example file.