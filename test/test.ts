import { ethers, waffle } from "hardhat";
import { Signer, Wallet, BigNumber } from "ethers";
import { deployIGoverned, deployXaverToken, deployETFGame, deployBasketToken } from "@testhelp/deploy";

import { IGoverned } from "@typechain/IGoverned";
import { XaverToken } from "@typechain/XaverToken";
import { ETFGame } from "@typechain/ETFGame";
import { BasketToken } from '@typechain/BasketToken';

describe("testing", async () => {
    let owner : Signer, addr1 : Signer, addr2 : Signer;
    [owner, addr1, addr2] = await ethers.getSigners();

    const IGov = await deployIGoverned(owner, (await owner.getAddress()).toString(), (await owner.getAddress()).toString());
    const xaverToken = await deployXaverToken(owner, 'Xaver Token', 'XAVER');
    const etfGame = await deployETFGame(owner, xaverToken.address, IGov.address);
    const basketToken = await deployBasketToken(owner, etfGame.address, 'Basket Token NFT address', 'DRBB');
});