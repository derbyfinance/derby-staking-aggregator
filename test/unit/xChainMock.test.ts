/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, getUSDCSigner, parseUSDC } from '../helpers/helpers';
import type { XSendMock, XReceiveMock, ConnextXProviderMock, ConnextExecutorMock, ConnextHandlerMock } from '../../typechain-types';
import { deployXSendMock, deployXReceiveMock, deployConnextXProviderMock, deployConnextExecutorMock, deployConnextHandlerMock } from '../helpers/deploy';
import { usdc } from "../helpers/addresses";
import { ethers } from "hardhat";

describe.only("Testing ConnextXProviderMock, unit test", async () => {
  let dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, xSend: XSendMock, XReceive: XReceiveMock, ConnextXProviderSend: ConnextXProviderMock, ConnextXProviderReceive: ConnextXProviderMock, ConnextExecutor: ConnextExecutorMock, ConnextHandler: ConnextHandlerMock;

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);
    
    ConnextHandler = await deployConnextHandlerMock(dao, daoAddr);
    ConnextExecutor = await deployConnextExecutorMock(dao, ConnextHandler.address);
    ConnextXProviderSend = await deployConnextXProviderMock(dao, ConnextExecutor.address, daoAddr, ConnextHandler.address);
    ConnextXProviderReceive = await deployConnextXProviderMock(dao, ConnextExecutor.address, daoAddr, ConnextHandler.address);
    xSend = await deployXSendMock(dao, ConnextXProviderSend.address);
    XReceive = await deployXReceiveMock(dao, ConnextXProviderReceive.address);

    await ConnextHandler.setExecutor(ConnextExecutor.address);
    await ConnextXProviderSend.setXSendMock(xSend.address, '1');
    await ConnextXProviderSend.setxReceiveMock(XReceive.address, '2');
    await ConnextXProviderSend.setReceiveProvider(ConnextXProviderReceive.address);
    await ConnextXProviderReceive.setXSendMock(xSend.address, '1');
    await ConnextXProviderReceive.setxReceiveMock(XReceive.address, '2');
  });

  it("Should send integer from XSendMock to XReceiveMock", async function() {
    let sendValue = '12345';
    await xSend.xSendSomeValue(sendValue);
    let receivedValue = await XReceive.value();
    expect(sendValue).to.be.equal(receivedValue);
  });
});