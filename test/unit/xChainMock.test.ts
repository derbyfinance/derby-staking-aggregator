/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, getUSDCSigner, parseUSDC } from '../helpers/helpers';
import type { XSendMock, XReceiveMock, ConnextXProviderMock, ConnextExecutorMock, ConnextHandlerMock, LZEndpointMock, LZXProviderMock } from '../../typechain-types';
import { deployXSendMock, deployXReceiveMock, deployConnextXProviderMock, deployConnextExecutorMock, deployConnextHandlerMock, deployLZEndpointMock, deployLZXProviderMock } from '../helpers/deploy';
import { usdc } from "../helpers/addresses";
import { ethers } from "hardhat";

describe.only("Testing XProviderMocks, unit test", async () => {
  let dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, xSend: XSendMock, xReceive: XReceiveMock, ConnextXProviderSend: ConnextXProviderMock, ConnextXProviderReceive: ConnextXProviderMock, ConnextExecutor: ConnextExecutorMock, ConnextHandler: ConnextHandlerMock, LZEndpointSend: LZEndpointMock, LZEndpointReceive: LZEndpointMock, LZXProviderSend: LZXProviderMock, LZXProviderReceive: LZXProviderMock;

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);
  });

  it("Should send integer from XSendMock to XReceiveMock using Connext", async function() {
    ConnextHandler = await deployConnextHandlerMock(dao, daoAddr);
    ConnextExecutor = await deployConnextExecutorMock(dao, ConnextHandler.address);
    ConnextXProviderSend = await deployConnextXProviderMock(dao, ConnextExecutor.address, daoAddr, ConnextHandler.address);
    ConnextXProviderReceive = await deployConnextXProviderMock(dao, ConnextExecutor.address, daoAddr, ConnextHandler.address);
    xSend = await deployXSendMock(dao, ConnextXProviderSend.address);
    xReceive = await deployXReceiveMock(dao, ConnextXProviderReceive.address);

    await ConnextHandler.setExecutor(ConnextExecutor.address);
    await ConnextXProviderSend.setXSendMock(xSend.address, '1');
    await ConnextXProviderSend.setxReceiveMock(xReceive.address, '2');
    await ConnextXProviderSend.setReceiveProvider(ConnextXProviderReceive.address);
    await ConnextXProviderReceive.setXSendMock(xSend.address, '1');
    await ConnextXProviderReceive.setxReceiveMock(xReceive.address, '2');

    let sendValue = '12345';
    await xSend.xSendSomeValue(sendValue);
    let receivedValue = await xReceive.value();
    expect(sendValue).to.be.equal(receivedValue);
  });

  it("Should send integer from XSendMock to XReceiveMock using LayerZero", async function() {
    LZEndpointSend = await deployLZEndpointMock(dao, 1);
    LZXProviderSend = await deployLZXProviderMock(dao, LZEndpointSend.address, daoAddr);
    LZEndpointReceive = await deployLZEndpointMock(dao, 2);
    LZXProviderReceive = await deployLZXProviderMock(dao, LZEndpointReceive.address, daoAddr);
    xSend = await deployXSendMock(dao, LZXProviderSend.address);
    xReceive = await deployXReceiveMock(dao, LZXProviderReceive.address);

    await LZEndpointSend.setDestLzEndpoint(LZXProviderReceive.address, LZEndpointReceive.address);
    await LZXProviderSend.setxReceiveMock(xReceive.address, 2);
    await LZXProviderReceive.setxReceiveMock(xReceive.address, 2);
    await LZXProviderSend.setTrustedRemote(2, LZXProviderReceive.address);
    await LZXProviderReceive.setTrustedRemote(1, LZXProviderSend.address);

    
    let sendValue = '12345';
    await xSend.xSendSomeValue(sendValue);
    let receivedValue = await xReceive.value();
    expect(sendValue).to.be.equal(receivedValue);
  });
});