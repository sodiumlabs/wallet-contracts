import './aa.init'
import { BigNumber, Wallet } from 'ethers'
import { expect } from 'chai'
import {
  EntryPoint,
  Sodium,
  CompatibilityFallbackHandler,
  CompatibilityFallbackHandler__factory,
  SenderCreator
} from '../gen/typechain'
import {
  createWalletOwner,
  fund,
  deployEntryPoint,
  getWalletInitCode, deploySingleton, deployFallbackHandler, getWalletAddress } from './testutils';
import { fillAndSign, getUserOpHash } from './UserOp';
import '@nomicfoundation/hardhat-chai-matchers';
import { ethers } from "hardhat";
import { keccak256 } from 'ethers/lib/utils';

describe('SenderCreator', function () {
  let entryPoint: EntryPoint
  let senderCreator: SenderCreator
  const provider = ethers.provider;
  let walletOwner: Wallet
  let walletInitCode: string;
  let walletAddress: string;
  let walletSingleton: Sodium;
  let fallbackHandler: CompatibilityFallbackHandler;

  before(async function () {
    [entryPoint, senderCreator] = await deployEntryPoint(provider);
    walletOwner = createWalletOwner(provider);
    walletSingleton = await deploySingleton(provider, entryPoint);
    fallbackHandler = await deployFallbackHandler(provider);
    walletInitCode = await getWalletInitCode(
      provider,
      entryPoint,
      walletSingleton,
      walletOwner.address,
      "web",
      fallbackHandler.address
    );
    walletAddress = await getWalletAddress(entryPoint, walletInitCode);
    await fund(provider, walletAddress);
    await fund(provider, walletOwner.address);
  })

  describe('create', () => {
    it('createSender', async () => {
      const address = await senderCreator.callStatic.createSender(walletInitCode)
      expect(address).to.equal(walletAddress);
    });
  })
})
