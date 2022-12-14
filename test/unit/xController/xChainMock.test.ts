import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract } from 'ethers';
import { erc20, getUSDCSigner, parseUSDC } from '@testhelp/helpers';
import type {
  XSendMock,
  XReceiveMock,
  ConnextXProviderMock,
  ConnextExecutorMock,
  ConnextHandlerMock,
  LZEndpointMock,
  LZXProviderMock,
} from '@typechain';
import {
  deployXSendMock,
  deployXReceiveMock,
  deployConnextXProviderMock,
  deployConnextExecutorMock,
  deployConnextHandlerMock,
  deployLZEndpointMock,
  deployLZXProviderMock,
} from '@testhelp/deploy';
import { usdc } from '@testhelp/addresses';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());

describe.only('Testing XProviderMocks, unit test', async () => {
  let dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    xSend: XSendMock,
    xReceive: XReceiveMock,
    ConnextXProviderSend: ConnextXProviderMock,
    ConnextXProviderReceive: ConnextXProviderMock,
    ConnextExecutor: ConnextExecutorMock,
    ConnextHandler: ConnextHandlerMock,
    LZEndpointSend: LZEndpointMock,
    LZEndpointReceive: LZEndpointMock,
    LZXProviderSend: LZXProviderMock,
    LZXProviderReceive: LZXProviderMock;

  before(async function () {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress(),
    ]);
    ConnextHandler = await deployConnextHandlerMock(dao, daoAddr);
    ConnextExecutor = await deployConnextExecutorMock(dao, ConnextHandler.address);
    ConnextXProviderSend = await deployConnextXProviderMock(
      dao,
      ConnextExecutor.address,
      daoAddr,
      ConnextHandler.address,
    );
    ConnextXProviderReceive = await deployConnextXProviderMock(
      dao,
      ConnextExecutor.address,
      daoAddr,
      ConnextHandler.address,
    );
    await ConnextHandler.setExecutor(ConnextExecutor.address);
    await ConnextXProviderSend.setReceiveProvider(ConnextXProviderReceive.address);

    LZEndpointSend = await deployLZEndpointMock(dao, 1);
    LZXProviderSend = await deployLZXProviderMock(
      dao,
      LZEndpointSend.address,
      daoAddr,
      ConnextHandler.address,
    );
    LZEndpointReceive = await deployLZEndpointMock(dao, 2);
    LZXProviderReceive = await deployLZXProviderMock(
      dao,
      LZEndpointReceive.address,
      daoAddr,
      ConnextHandler.address,
    );
    await LZEndpointSend.setDestLzEndpoint(LZXProviderReceive.address, LZEndpointReceive.address);
    await LZXProviderSend.setTrustedRemote(2, LZXProviderReceive.address);
    await LZXProviderReceive.setTrustedRemote(1, LZXProviderSend.address);

    await IUSDc.connect(USDCSigner).transfer(daoAddr, amountUSDC);
  });

  it('Should send integer from XSendMock to XReceiveMock using Connext', async function () {
    xSend = await deployXSendMock(dao, daoAddr);
    await xSend.setXProvider(ConnextXProviderSend.address);
    xReceive = await deployXReceiveMock(dao, daoAddr);
    await xReceive.setXProvider(ConnextXProviderReceive.address);

    await ConnextXProviderSend.setXSendMock(xSend.address, '1');
    await ConnextXProviderSend.setxReceiveMock(xReceive.address, '2');
    await ConnextXProviderReceive.setXSendMock(xSend.address, '1');
    await ConnextXProviderReceive.setxReceiveMock(xReceive.address, '2');

    let sendValue = '12345';
    await xSend.xSendSomeValue(sendValue);
    let receivedValue = await xReceive.value();
    expect(sendValue).to.be.equal(receivedValue);
  });

  it('Should send integer from XSendMock to XReceiveMock using LayerZero', async function () {
    xSend = await deployXSendMock(dao, daoAddr);
    await xSend.setXProvider(LZXProviderSend.address);
    xReceive = await deployXReceiveMock(dao, daoAddr);
    await xReceive.setXProvider(LZXProviderReceive.address);

    await LZXProviderSend.setxReceiveMock(xReceive.address, 2);
    await LZXProviderReceive.setxReceiveMock(xReceive.address, 2);

    let sendValue = '12345';
    await xSend.xSendSomeValue(sendValue);
    let receivedValue = await xReceive.value();
    expect(sendValue).to.be.equal(receivedValue);
  });

  it('Should transfer funds with LayerZero xProvider using a Connext transfer', async function () {
    xSend = await deployXSendMock(dao, daoAddr);
    await xSend.setXProvider(LZXProviderSend.address);
    xReceive = await deployXReceiveMock(dao, daoAddr);
    await xReceive.setXProvider(LZXProviderReceive.address);

    await LZXProviderSend.setxReceiveMock(xReceive.address, 2);
    await LZXProviderReceive.setxReceiveMock(xReceive.address, 2);

    await IUSDc.connect(dao).transfer(xSend.address, amountUSDC);
    await xSend.xTransferFunds(xReceive.address, usdc, 1, 2, amountUSDC);
    const balanceXSend = await IUSDc.balanceOf(xSend.address);
    const balanceXReceive = await IUSDc.balanceOf(xReceive.address);
    expect(balanceXReceive).to.be.equal(amountUSDC);
    expect(balanceXSend).to.be.equal('0');
  });
});
