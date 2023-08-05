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
  deployFactory,
  deployMockUserOperationValidator,
  signSodiumAuthRecover,
} from './testutils';
import { SecurityManager } from '../gen/typechain/contracts/base/SecurityManager';
import { fillAndSign, fillAndSignWithDelegateProof, getUserOpHash } from './UserOp';
import '@nomicfoundation/hardhat-chai-matchers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ethers } from "hardhat";
import { keccak256 } from 'ethers/lib/utils';
import { DelegateProof, genDelegateProof, signType1, signType2 } from './sodium-signature';

describe('SodiumWithDelegateSession', function () {
  let entryPoint: EntryPoint
  const provider = ethers.provider;
  let walletSessionOwner: Wallet
  let walletInitCode: string;
  let walletAddress: string;
  let walletSingleton: Sodium;
  let fallbackHandler: CompatibilityFallbackHandler;
  let factory: Factory;
  let opValidator: MockUserOperationValidator;
  const sodiumAuthTssWeighted: SodiumAuthTssWeighted = mockSodiumAuthTssWeighted();
  let sodiumAuthWeighted: SodiumAuthWeighted;

  let trustee: Wallet;
  let delegateProof: DelegateProof;

  before(async function () {
    [entryPoint,] = await deployEntryPoint(provider);
    sodiumAuthWeighted = await deploySodiumAuthWeighted(provider, [
      sodiumAuthTssWeighted
    ]);
    walletSingleton = await deploySingleton(provider, entryPoint);
    factory = await deployFactory(provider, walletSingleton.address);
    walletSessionOwner = createWalletOwner(provider);
    trustee = createWalletOwner(provider);
    fallbackHandler = await deployFallbackHandler(provider);
    opValidator = await deployMockUserOperationValidator(provider);

    walletInitCode = await getWalletInitCode(
      factory,
      sodiumAuthWeighted,
      walletSingleton,

      // 这里不能使用sessionOwner，防止跟warp的测试用例冲突
      opValidator.address,
      fallbackHandler.address,
      opValidator.address
    );

    walletAddress = await getWalletAddress(factory, opValidator.address);
    await fund(provider, walletAddress);

    delegateProof = await genDelegateProof(
      walletAddress,
      trustee.address,
      walletSessionOwner,
      parseInt(`${Date.now() / 1000}`) + 86400,
    );

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

    const sampleOp = await fillAndSignWithDelegateProof({
      sender: walletAddress,
      initCode: walletInitCode,
      callData: callData,
      callGasLimit: 1e7,
    }, trustee, delegateProof, entryPoint);

    expect(getUserOpHash(sampleOp, entryPoint.address, chainId)).to.eql(await entryPoint.getUserOpHash(sampleOp))

    await expect(entryPoint.handleOps([
      sampleOp,
    ], walletAddress, {
      gasLimit: 2e7
    })).to.be.emit(entryPoint, "AccountDeployed");
  })

  describe('EIP1271', () => {
    it('delegate sign message', async () => {
      const cfh = CompatibilityFallbackHandler__factory.connect(walletAddress, provider);
      const signMessage = keccak256("0xabcd");
      const signHash = await cfh.getMessageHash(signMessage);
      const signed = signType2(trustee, ethers.utils.arrayify(signHash), delegateProof);
      const result = await cfh['isValidSignature(bytes32,bytes)'](signMessage, signed);
      expect(result).to.equal("0x1626ba7e");
    });

    it('delegate expired sign message ', async () => {
      const expiredDelegateProof = await genDelegateProof(
        walletAddress,
        trustee.address,
        walletSessionOwner,
        parseInt(`${Date.now() / 1000}`) - 86400,
      );
      const cfh = CompatibilityFallbackHandler__factory.connect(walletAddress, provider);
      const signMessage = keccak256("0xabcd");
      const signHash = await cfh.getMessageHash(signMessage);
      const signed = signType2(trustee, ethers.utils.arrayify(signHash), expiredDelegateProof);
      const result = await cfh['isValidSignature(bytes32,bytes)'](signMessage, signed);
      expect(result).to.equal("0x00000000");
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

      const sampleOp = await fillAndSignWithDelegateProof(
        { sender: walletAddress, callData: execData, callGasLimit: 1e7 },
        trustee,
        delegateProof,
        entryPoint
      );

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
      const sampleOp = await fillAndSignWithDelegateProof({
        sender: walletAddress,
        callData: callData,
        callGasLimit: 1e7,
      },
        trustee,
        delegateProof,
        entryPoint
      );
      await expect(entryPoint.callStatic.simulateValidation(sampleOp))
        .to.be.revertedWithCustomError(entryPoint, "ValidationResult")
        .withArgs(function (result: any) {
          return result[2] == false;
        }, anyValue, anyValue, anyValue);
    });

    it("delegate expire", async () => {
      const expiredDelegateProof = await genDelegateProof(
        walletAddress,
        trustee.address,
        walletSessionOwner,
        parseInt(`${Date.now() / 1000}`) - 86400,
      );
      const callData = Sodium__factory.createInterface().encodeFunctionData("execute", [
        [],
      ]);
      const sampleOp = await fillAndSignWithDelegateProof({
        sender: walletAddress,
        callData: callData,
        callGasLimit: 1e7,
      },
        trustee,
        expiredDelegateProof,
        entryPoint
      );
      await expect(entryPoint.callStatic.simulateValidation(sampleOp))
        .to.be.revertedWithCustomError(entryPoint, "ValidationResult")
        .withArgs(function (result: any) {
          return result[2] == true;
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
      const callData = Sodium__factory.createInterface().encodeFunctionData("executeWithSodiumAuthRecover", [
        recover,
        sodiumNetworkAuthProof,
        [],
      ]);
      const safeDelegateProof = await genDelegateProof(
        walletAddress, trustee.address, walletSafeOwner, parseInt(`${Date.now() / 1000}`) + 86400);

      const sampleOp = await fillAndSignWithDelegateProof({
        sender: walletAddress,
        callData: callData,
        callGasLimit: 1e7,
      },
        trustee,
        safeDelegateProof,
        entryPoint
      );

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

      const executeSampleOp = await fillAndSignWithDelegateProof({
        sender: walletAddress,
        callData: Sodium__factory.createInterface().encodeFunctionData("execute", [
          [],
        ]),
        callGasLimit: 1e7,
      },
        trustee,
        delegateProof,
        entryPoint
      );

      await expect(entryPoint.callStatic.simulateValidation(executeSampleOp))
        .to.be.revertedWithCustomError(entryPoint, "ValidationResult")
        .withArgs(function (result: any) {
          // sig failed
          return result[2] == true;
        }, anyValue, anyValue, anyValue);
    });
  });
})
