import './aa.init';
import { BigNumber, Wallet } from 'ethers';
import { expect } from 'chai';
import {
  EntryPoint,
  Sodium,
  CompatibilityFallbackHandler,
  CompatibilityFallbackHandler__factory,
  Sodium__factory,
  SodiumAuthWeighted,
  TestCounter__factory,
  TestCounter,
  Factory,
  MockUserOperationValidator,
} from '../gen/typechain';
import {
  createWalletOwner,
  fund,
  deployEntryPoint,
  SodiumAuthTssWeighted,
  getWalletInitCode,
  deploySingleton,
  deployFallbackHandler,
  getWalletAddress,
  mockSodiumAuthTssWeighted,
  deploySodiumAuthWeighted,
  signSodiumAuthSession,
  AddressZero,
  deployContract,
  deployFactory,
  deployMockUserOperationValidator,
  signSodiumAuthRecover,
  decodeRevertReason,
} from './testutils';
import { SecurityManager } from '../gen/typechain/contracts/base/SecurityManager';
import { fillAndSign, getUserOpHash } from './UserOp';
import '@nomicfoundation/hardhat-chai-matchers';
import { anyUint, anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ethers } from "hardhat";
import { keccak256 } from 'ethers/lib/utils';
import { joinSignature } from 'ethers/lib/utils';
import { zeroAddress } from 'ethereumjs-util';

describe('SodiumWithSession', function () {
  let entryPoint: EntryPoint
  const provider = ethers.provider;
  let walletSessionOwner: Wallet
  let walletSafeExpiredOwner: Wallet
  let walletInitCode: string;
  let walletAddress: string;
  let walletSingleton: Sodium;
  let fallbackHandler: CompatibilityFallbackHandler;
  let factory: Factory;
  let opValidator: MockUserOperationValidator;
  const sodiumAuthTssWeighted: SodiumAuthTssWeighted = mockSodiumAuthTssWeighted();
  let sodiumAuthWeighted: SodiumAuthWeighted
  before(async function () {
    [entryPoint,] = await deployEntryPoint(provider);
    sodiumAuthWeighted = await deploySodiumAuthWeighted(provider, [
      sodiumAuthTssWeighted
    ]);
    walletSingleton = await deploySingleton(provider, entryPoint);
    factory = await deployFactory(provider, walletSingleton.address);
    walletSessionOwner = createWalletOwner(provider);
    walletSafeExpiredOwner = createWalletOwner(provider);
    fallbackHandler = await deployFallbackHandler(provider);
    opValidator = await deployMockUserOperationValidator(provider);
    
    walletInitCode = await getWalletInitCode(
      factory,
      sodiumAuthWeighted,
      walletSingleton,
      walletSessionOwner.address,
      fallbackHandler.address,
      opValidator.address
    );
    walletAddress = await getWalletAddress(factory, walletSessionOwner.address);
    await fund(provider, walletAddress);

    // sanity: validate helper functions
    const chainId = await provider.getNetwork().then((n) => {
      return n;
    }).then(n => n.chainId);

    // calldata with mpc
    const now = BigNumber.from(Math.floor(Date.now() / 1000));
    const session: SecurityManager.AddSessionStruct = {
      sessionKey: walletSessionOwner.address,
      sessionUniqueId: "0x01010102",
      sessionExpires: BigNumber.from(now).add(86400),
    };
    const sodiumNetworkAuthProof = await signSodiumAuthSession(sodiumAuthTssWeighted, session, walletAddress);
    const callData = Sodium__factory.createInterface().encodeFunctionData("executeWithSodiumAuthSession", [
      session,
      sodiumNetworkAuthProof,
      [],
    ]);

    const sampleOp = await fillAndSign({
      sender: walletAddress,
      initCode: walletInitCode,
      callData: callData,
      callGasLimit: 1e7,
    }, walletSessionOwner, entryPoint);

    expect(getUserOpHash(sampleOp, entryPoint.address, chainId)).to.eql(await entryPoint.getUserOpHash(sampleOp))

    await expect(entryPoint.handleOps([
      sampleOp,
    ], walletAddress, {
      gasLimit: 2e7
    })).to.be.emit(entryPoint, "AccountDeployed");
  })

  describe('EIP1271', () => {
    it('sign message', async () => {
      const cfh = CompatibilityFallbackHandler__factory.connect(walletAddress, provider);
      const signMessage = keccak256("0xabcd");
      const signHash = await cfh.getMessageHash(signMessage);
      const signed = joinSignature(walletSessionOwner._signingKey().signDigest(signHash));
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

      const sampleOp = await fillAndSign({ sender: walletAddress, callData: execData, callGasLimit: 1e7 }, walletSessionOwner, entryPoint)
      const tx = await entryPoint.handleOps([
        sampleOp,
      ], walletAddress, {
        gasLimit: 2e7
      }).then(t => t.wait());
      const va = await so.getSingleton();
      expect(va.toLocaleLowerCase()).to.be.eq(newwalletSingleton.address.toLocaleLowerCase());
    })
  })

  describe("opValidator", async () => {
    before(async () => {
      const validationData = 2;
      await expect(opValidator.setValidationData(validationData))
        .to.be.emit(opValidator, "SetValidationData").withArgs(validationData);
    });

    after(async () => {
      const validationData = 0;
      await expect(opValidator.setValidationData(validationData))
        .to.be.emit(opValidator, "SetValidationData").withArgs(validationData);
    })

    it("no safe session", async () => {
      const callData = Sodium__factory.createInterface().encodeFunctionData("execute", [
        [],
      ]);
      const sampleOp = await fillAndSign({
        sender: walletAddress,
        callData: callData,
        callGasLimit: 1e7,
      }, walletSessionOwner, entryPoint);
      await expect(entryPoint.callStatic.simulateValidation(sampleOp))
        .to.be.revertedWithCustomError(entryPoint, "ValidationResult")
        .withArgs(function (result: any) {
          return result[2] == false;
        }, anyValue, anyValue, anyValue);
    });

    it("safe session", async () => {
      // calldata with mpc
      const walletSafeOwner = createWalletOwner(provider);
      const now = BigNumber.from(Math.floor(Date.now() / 1000));
      const recover = {
        safeSessionKey: walletSafeOwner.address,
        recoverNonce: BigNumber.from(0),
        recoverExpires: now.add(60 * 60 * 24 * 365),
      };
      const sodiumNetworkAuthProof = await signSodiumAuthRecover(sodiumAuthTssWeighted, recover, walletAddress);
      // console.debug("sodiumNetworkAuthProof", sodiumNetworkAuthProof);
      const callData = Sodium__factory.createInterface().encodeFunctionData("executeWithSodiumAuthRecover", [
        recover,
        sodiumNetworkAuthProof,
        [],
      ]);

      const sampleOp = await fillAndSign({
        sender: walletAddress,
        callData: callData,
        callGasLimit: 1e7,
        // paymasterAndData: deployPaymaster.address
      }, walletSafeOwner, entryPoint);

      // sanity: validate helper functions
      const chainId = await provider.getNetwork().then((n) => {
        return n;
      }).then(n => n.chainId);
      expect(getUserOpHash(sampleOp, entryPoint.address, chainId)).to.eql(await entryPoint.getUserOpHash(sampleOp))
      const userOp = getUserOpHash(sampleOp, entryPoint.address, chainId);

      await expect(entryPoint.handleOps([
        sampleOp,
      ], walletAddress, {
        gasLimit: 2e7
      })).to.be.emit(entryPoint, "UserOperationEvent").withArgs(
        userOp,
        anyValue,
        anyValue,
        anyValue,
        anyValue,
        anyValue,
        anyValue,
      );

      const executeSampleOp = await fillAndSign({
        sender: walletAddress,
        callData: Sodium__factory.createInterface().encodeFunctionData("execute", [
          [],
        ]),
        callGasLimit: 1e7,
      }, walletSessionOwner, entryPoint);

      await expect(entryPoint.callStatic.simulateValidation(executeSampleOp))
        .to.be.revertedWithCustomError(entryPoint, "ValidationResult")
        .withArgs(function (result: any) {
          console.log(result);
          // sig failed
          return result[2] == true;
        }, anyValue, anyValue, anyValue);
        // .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        // .withArgs(0, "");
    });

  });
})
