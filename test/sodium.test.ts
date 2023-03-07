import './aa.init'
import { BigNumber, Wallet } from 'ethers'
import { expect } from 'chai'
import {
  EntryPoint,
  Sodium,
  CompatibilityFallbackHandler,
  CompatibilityFallbackHandler__factory,
  Sodium__factory
} from '../gen/typechain'
import {
  createWalletOwner,
  fund,
  deployEntryPoint,
  getWalletInitCode, deploySingleton, deployFallbackHandler, getWalletAddress, deployDeployPaymaster
} from './testutils';
import { fillAndSign, getUserOpHash } from './UserOp';
import '@nomicfoundation/hardhat-chai-matchers';
import { ethers } from "hardhat";
import { keccak256 } from 'ethers/lib/utils';
import { joinSignature } from 'ethers/lib/utils';

describe('Sodium', function () {
  let entryPoint: EntryPoint
  const provider = ethers.provider;
  let walletOwner: Wallet
  let walletInitCode: string;
  let walletAddress: string;
  let walletSingleton: Sodium;
  let fallbackHandler: CompatibilityFallbackHandler;

  before(async function () {
    [entryPoint,] = await deployEntryPoint(provider);
    const ow = createWalletOwner(provider);
    const deployPaymaster = await deployDeployPaymaster(provider, entryPoint, ow.address);
    await fund(provider, deployPaymaster.address);
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
    // sanity: validate helper functions
    const chainId = await provider.getNetwork().then((n) => {
      return n;
    }).then(n => n.chainId);

    const sampleOp = await fillAndSign({ 
      sender: walletAddress, 
      initCode: walletInitCode,
      paymasterAndData: deployPaymaster.address
    }, walletOwner, entryPoint)

    console.debug("sampleOp", sampleOp);

    expect(getUserOpHash(sampleOp, entryPoint.address, chainId)).to.eql(await entryPoint.getUserOpHash(sampleOp))

    const tx = await entryPoint.handleOps([
      sampleOp,
    ], walletAddress, {
      gasLimit: 2e7
    }).then(t => t.wait());
  })

  describe('EIP1271', () => {
    it('sign message', async () => {
      const cfh = CompatibilityFallbackHandler__factory.connect(walletAddress, provider);
      const signMessage = keccak256("0xabcd");
      const signHash = await cfh.getMessageHash(signMessage);
      const signed = joinSignature(walletOwner._signingKey().signDigest(signHash));
      const result = await cfh['isValidSignature(bytes32,bytes)'](signMessage, signed);
      expect(result).to.equal("0x1626ba7e");
    });
  })

  describe('eth received', () => {
    it('allow receive native token', async () => {
      await fund(provider, walletSingleton.address);
    })
  })

  describe('upgradeTo', () => {
    it("dg call", async () => {
      await fund(provider, walletAddress);
      const newwalletSingleton = await deploySingleton(provider, entryPoint);
      const so = Sodium__factory.connect(walletAddress, provider);
      const abi = so.interface.encodeFunctionData("upgradeTo", [newwalletSingleton.address]);
  
      expect(newwalletSingleton.address.toLocaleLowerCase()).to.not.eq(walletSingleton.address.toLocaleLowerCase());
  
      const execData = walletSingleton.connect(walletAddress).interface.encodeFunctionData("execute", [
        [
          {
            op: 0,
            revertOnError: false,
            gasLimit: 0,
            value: 0,
            target: walletAddress,
            data: abi
          }
        ]
      ]);
  
      const sampleOp = await fillAndSign({ sender: walletAddress, callData: execData, callGasLimit: 1e7 }, walletOwner, entryPoint)
      const tx = await entryPoint.handleOps([
        sampleOp,
      ], walletAddress, {
        gasLimit: 2e7
      }).then(t => t.wait());
      const va = await so.getSingleton();
      expect(va.toLocaleLowerCase()).to.be.eq(newwalletSingleton.address.toLocaleLowerCase());
    })
  })
})
