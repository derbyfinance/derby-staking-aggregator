/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { parseEther } from "../helpers/helpers";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers, network } from "hardhat";
import { TokenTimelock, XaverToken } from "typechain-types";
import { deployTokenTimeLock, deployXaverToken } from '../helpers/deploy';

const name = 'Derby Finance';
const symbol = 'DRB';
const totalSupply = 1_000_000;

describe("Testing TokenTimeLock", async () => {
  let admin: Signer, vc: Signer, vcAddr: string, tokenTimelock: TokenTimelock, xaverToken: XaverToken;
 
  beforeEach(async function() {
    [admin, vc] = await ethers.getSigners();
    vcAddr = await vc.getAddress();

    xaverToken = await deployXaverToken(
      admin, 
      name, 
      symbol, 
      parseEther(totalSupply.toString())
    );

    tokenTimelock = await deployTokenTimeLock(
      admin, 
      xaverToken.address,
    );
  }); 

  it("Should revert when trying to initialize twice and !beneficiary is calling", async function() {
    const amount = parseEther('180000'); // 180k
    const numberOfMonths = 18;
    const monthDurationUnix = 10;
    const { timestamp } = await ethers.provider.getBlock("latest");

    await xaverToken.increaseAllowance(tokenTimelock.address, amount)
    await tokenTimelock.init(
      vcAddr, 
      amount, 
      timestamp,
      numberOfMonths, 
      monthDurationUnix,
    );

    await expect(tokenTimelock.release()).to.be.revertedWith("!beneficiary")

    await expect(
      tokenTimelock.init(
        vcAddr, 
        amount, 
        timestamp,
        numberOfMonths, 
        monthDurationUnix,
      )
    ).to.be.revertedWith("already initialized")
  });

  it("Should time lock tokens and release them by schedule", async function() {
    const amount = parseEther('180000'); // 180k
    const tokensPerMonth = parseEther('10000'); // 10k
    const numberOfMonths = 18;
    const monthDurationUnix = 10;
    const { timestamp } = await ethers.provider.getBlock("latest");

    await xaverToken.increaseAllowance(tokenTimelock.address, amount)
    await tokenTimelock.init(
      vcAddr, 
      amount, 
      timestamp,
      numberOfMonths, 
      monthDurationUnix,
    );

    const balance = await xaverToken.balanceOf(tokenTimelock.address);
    const tokensPerMonthContract = await tokenTimelock.tokensPerMonth();
    let claimableTokens = await tokenTimelock.claimableTokens();

    expect(balance).to.be.equal(amount);
    expect(tokensPerMonthContract).to.be.equal(tokensPerMonth);
    expect(claimableTokens).to.be.equal(0);
    
    // skip 5 timeframes of 10 blocks / timestamps == 5 months
    for (let j = 1; j <= 5; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send("evm_mine");
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(j));
    }

    let balanceBefore = await xaverToken.balanceOf(vcAddr);
    await tokenTimelock.connect(vc).release();
    let balanceAfter = await xaverToken.balanceOf(vcAddr);

    expect(balanceBefore).to.be.equal(0);
    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(5));

    // skip 7 timeframes of 10 blocks / timestamps == 7 months => total of 12 months
    for (let j = 1; j <= 7; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send("evm_mine");
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(j));
    }

    await tokenTimelock.connect(vc).release();
    balanceAfter = await xaverToken.balanceOf(vcAddr);

    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(12));

    // skip 5 timeframes of 10 blocks / timestamps == 5 months => total of 17 months
    for (let j = 1; j <= 5; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send("evm_mine");
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(j));
    }

    await tokenTimelock.connect(vc).release();
    balanceAfter = await xaverToken.balanceOf(vcAddr);

    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(17));

    // skip 3 timeframes of 10 blocks / timestamps == 5 months => total of 20 months
    for (let j = 1; j <= 3; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send("evm_mine");
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(1)); // max balance
    }

    await tokenTimelock.connect(vc).release();
    balanceAfter = await xaverToken.balanceOf(vcAddr);

    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(18)); // 18 is max

    const balanceContract = await xaverToken.balanceOf(tokenTimelock.address);
    expect(balanceContract).to.be.equal(0);
  });
});