import './aa.init'
import { BigNumber, Wallet } from 'ethers'
import { expect } from 'chai'
import {
  EntryPoint,
  Sodium,
  CompatibilityFallbackHandler,
  CompatibilityFallbackHandler__factory,
  Sodium__factory,
  SodiumAuthWeighted,
  Factory,
  VerifyingSingletonPaymaster,
  MockUserOperationValidator,
  TestCounter__factory,
  TestERC20Token,
  TestERC20Token__factory,
  StableCoinOracle,
  StableCoinOracle__factory,
  TestModule,
  TestModule__factory,
  StableCoinPaymaster,
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
  deployFactory,
  deployMockUserOperationValidator,
  deployContract,
  callDataCost,
  deployVerifyingPaymaster,
  deployERC20Paymaster,
  AddressZero,
} from './testutils';
import { fillAndSign, fillUserOp, getUserOpHash, signUserOp } from './UserOp';
import '@nomicfoundation/hardhat-chai-matchers';
import { ethers } from "hardhat";
import { keccak256, parseEther, parseUnits } from 'ethers/lib/utils';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { UserOperation } from './UserOperation';
import { signType1 } from './sodium-signature';

describe('SodiumWithWarpEOA', function () {
  let entryPoint: EntryPoint
  const provider = ethers.provider;

  // mock mobile driver
  let walletSafeOwner: Wallet

  // mock browser iframe driver
  let walletInitCode: string;
  let walletAddress: string;
  let walletSingleton: Sodium;
  let fallbackHandler: CompatibilityFallbackHandler;
  let walletFactory: Factory;
  let opValidator: MockUserOperationValidator;
  const sodiumAuthTssWeighted: SodiumAuthTssWeighted = mockSodiumAuthTssWeighted();
  let sodiumAuthWeighted: SodiumAuthWeighted
  before(async function () {
    [entryPoint,] = await deployEntryPoint(provider);
    sodiumAuthWeighted = await deploySodiumAuthWeighted(provider, [
      sodiumAuthTssWeighted
    ]);
    walletSingleton = await deploySingleton(provider, entryPoint);
    walletFactory = await deployFactory(provider, walletSingleton.address);
    walletSafeOwner = createWalletOwner(provider);

    fallbackHandler = await deployFallbackHandler(provider);
    opValidator = await deployMockUserOperationValidator(provider);
    walletInitCode = await getWalletInitCode(
      walletFactory,
      sodiumAuthWeighted,
      walletSingleton,
      walletSafeOwner.address,
      fallbackHandler.address,
      opValidator.address
    );
    walletAddress = await getWalletAddress(walletFactory, walletSafeOwner.address);
    await fund(provider, walletAddress);

    // sanity: validate helper functions
    const chainId = await provider.getNetwork().then((n) => {
      return n;
    }).then(n => n.chainId);

    const callData = Sodium__factory.createInterface().encodeFunctionData("execute", [
      [],
    ]);

    const sampleOp = await fillAndSign({
      sender: walletAddress,
      initCode: walletInitCode,
      callData: callData,
      callGasLimit: 1e7,
    }, walletSafeOwner, entryPoint);

    expect(getUserOpHash(sampleOp, entryPoint.address, chainId)).to.eql(await entryPoint.getUserOpHash(sampleOp))

    const tx = entryPoint.handleOps([
      sampleOp,
    ], walletAddress, {
      gasLimit: 2e7
    })
    await expect(tx).to.be.emit(entryPoint, "AccountDeployed");

    // 对于safe环境应该都能执行
    await expect(opValidator.setValidationData(2))
      .to.be.emit(opValidator, "SetValidationData").withArgs(2);
  });

  describe('EIP1271', () => {
    it('sign message', async () => {
      const cfh = CompatibilityFallbackHandler__factory.connect(walletAddress, provider);
      const signMessage = keccak256("0xabcd");
      const signHash = await cfh.getMessageHash(signMessage);
      const signed = signType1(walletSafeOwner, ethers.utils.arrayify(signHash));
      const result = await cfh['isValidSignature(bytes32,bytes)'](signMessage, signed);
      expect(result).to.equal("0x1626ba7e");
    });
  })

  describe('eth received', () => {
    it('allow receive native token', async () => {
      const singleton = Sodium__factory.connect(walletAddress, provider);
      await expect(fund(provider, walletAddress)).emit(singleton, "NativeTokenReceived");
    })
  })

  describe('execute', () => {
    it('should test count with wallet', async () => {
      const testCount = await deployContract(provider.getSigner(), TestCounter__factory);
      const countABI = testCount.interface.encodeFunctionData("count");
      const gasLimit = await testCount.estimateGas.count();

      const execData = walletSingleton.connect(walletAddress).interface.encodeFunctionData("execute", [
        [
          {
            op: 0,
            revertOnError: true,
            gasLimit: gasLimit,
            target: testCount.address,
            value: 0,
            data: countABI
          }
        ]
      ]);

      let op = await fillUserOp({
        sender: walletAddress,
        callData: execData,
      }, entryPoint);

      op.callGasLimit = gasLimit.add(callDataCost(execData)).add(gasLimit);
      const opGasLimit = op.callGasLimit.add(2e7);
      op = signUserOp(op, walletSafeOwner, entryPoint.address, await provider.getNetwork().then(n => n.chainId))

      await expect(entryPoint.handleOps([
        op,
      ], walletAddress, {
        gasLimit: opGasLimit
      })).to.be.emit(entryPoint, "UserOperationEvent")
        .withArgs(
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          true,
          anyValue,
          anyValue
        );

      const result = await testCount.callStatic.counters(walletAddress);
      expect(
        result
      ).to.equal(1);
    });
  });

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

      const sampleOp = await fillAndSign({ sender: walletAddress, callData: execData, callGasLimit: 1e7 }, walletSafeOwner, entryPoint)
      await expect(entryPoint.handleOps([
        sampleOp,
      ], walletAddress, {
        gasLimit: 2e7
      })).to.be.emit(entryPoint, "UserOperationEvent")
        .withArgs(
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          true,
          anyValue,
          anyValue
        );
      const va = await so.getSingleton();
      expect(va.toLocaleLowerCase()).to.be.eq(newwalletSingleton.address.toLocaleLowerCase());
    })
  });


  describe('test module', () => {
    let testModule: TestModule;

    before(async () => {
      testModule = await deployContract(provider.getSigner(), TestModule__factory);
    });

    it('test enable module', async () => {
      // enable module
      const enableModuleCall = Sodium__factory.createInterface().encodeFunctionData("enableModule", [
        testModule.address
      ]);
      const execData = walletSingleton.connect(walletAddress).interface.encodeFunctionData("execute", [
        [
          {
            op: 0,
            revertOnError: false,
            gasLimit: 0,
            value: 0,
            target: walletAddress,
            data: enableModuleCall
          }
        ]
      ]);
      const sampleOp = await fillAndSign({ sender: walletAddress, callData: execData, callGasLimit: 1e7 }, walletSafeOwner, entryPoint)
      await expect(entryPoint.handleOps([
        sampleOp,
      ], walletAddress, {
        gasLimit: 2e7
      })).to.be.emit(entryPoint, "UserOperationEvent")
        .withArgs(
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          true,
          anyValue,
          anyValue
        ).emit(Sodium__factory.connect(walletAddress, provider), "EnabledModule")
        .withArgs(testModule.address);
    });


    it('call module', async () => {
      const testCount = await deployContract(provider.getSigner(), TestCounter__factory);
      const countABI = testCount.interface.encodeFunctionData("count");
      const moduleCall = testModule.interface.encodeFunctionData("call", [
        testCount.address,
        countABI
      ]);
      const execData = walletSingleton.connect(walletAddress).interface.encodeFunctionData("executeWithModule", [
        testModule.address,
        BigNumber.from("100"),
        moduleCall
      ]);
      let op = await fillAndSign({
        sender: walletAddress,
        callData: execData,
      }, provider.getSigner(), entryPoint);

      expect(
        await testCount.callStatic.counters(walletAddress)
      ).to.equal(0);

      await expect(entryPoint.handleOps([
        op,
      ], provider.getSigner().getAddress(), {
      })).to.be.emit(entryPoint, "UserOperationEvent")
        .withArgs(
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          true,
          anyValue,
          anyValue
        );

      expect(
        await testCount.callStatic.counters(walletAddress)
      ).to.equal(1);
    })

  });


  describe('paymaster', () => {
    let paymasterOwner: Wallet;
    let offchainPaymasterSigner: Wallet;
    let paymaster: Wallet;
    let verifyingPaymaster: VerifyingSingletonPaymaster;
    let erc20Paymaster: StableCoinPaymaster;
    let usdcToken: TestERC20Token;
    let usdcOracle: StableCoinOracle;
    const payTokenDecimals = 6;
    before(async () => {
      paymasterOwner = createWalletOwner(provider);

      await fund(provider, paymasterOwner.address, "10")

      paymaster = createWalletOwner(provider);
      offchainPaymasterSigner = createWalletOwner(provider);
      verifyingPaymaster = await deployVerifyingPaymaster(provider, entryPoint, paymasterOwner, offchainPaymasterSigner);
      erc20Paymaster = await deployERC20Paymaster(provider, entryPoint, paymasterOwner);
      usdcToken = await deployContract(provider.getSigner(), TestERC20Token__factory, [
        payTokenDecimals
      ]);
      usdcOracle = await deployContract(provider.getSigner(), StableCoinOracle__factory, [
        payTokenDecimals,
        provider.getSigner().getAddress()
      ])

      // init usdc gas cost
      await expect(erc20Paymaster.updateLatestCost("2000"))
        .to.be.emit(erc20Paymaster, "UpdateLatestCost")
        .withArgs(parseUnits("2000", 18));

      // init erc20 paymaster
      await expect(erc20Paymaster.addToken(usdcToken.address))
        .to.not.reverted;

      // mint usdc to wallet
      await expect(usdcToken.mint(walletAddress, parseUnits("100", payTokenDecimals)))
        .to.be.emit(usdcToken, "Transfer")
        .withArgs(
          AddressZero,
          walletAddress,
          parseUnits("100", payTokenDecimals)
        )

      // erc20 paymaster deposit gas to entrypoint
      await expect(erc20Paymaster.deposit({
        value: parseEther("2"),
      }))
        .to.be.changeEtherBalance(entryPoint, parseEther("2"))

      // verifyingPaymaster deposit gas to entrypoint
      await expect(verifyingPaymaster.depositFor(paymaster.address, {
        value: parseEther("2"),
      }))
        .to.be.emit(verifyingPaymaster, "GasDeposited")
        .withArgs(paymaster.address, parseEther("2"))
    });

    it("use verifying paymaster", async () => {
      const execBeforeWalletEthBalance = await provider.getBalance(walletAddress);
      // exec with paymaster
      const testCount = await deployContract(provider.getSigner(), TestCounter__factory);
      const countABI = testCount.interface.encodeFunctionData("count");
      const execData = walletSingleton.connect(walletAddress).interface.encodeFunctionData("execute", [
        [
          {
            op: 0,
            revertOnError: true,
            gasLimit: 0,
            target: testCount.address,
            value: 0,
            data: countABI
          }
        ]
      ]);

      let op = await fillUserOp({
        sender: walletAddress,
        callData: execData,
      }, entryPoint);

      op = await getUserOpWithVerifyingPaymasterData(
        verifyingPaymaster,
        op,
        offchainPaymasterSigner,
        paymaster.address,
        walletSafeOwner,
        entryPoint
      );

      expect(
        await testCount.callStatic.counters(walletAddress)
      ).to.equal(0);

      await expect(entryPoint.handleOps([
        op,
      ], provider.getSigner().getAddress(), {
        // gasLimit: BigNumber.from(op.callGasLimit)
        //   .add(op.preVerificationGas)
        //   .add(op.verificationGasLimit)
        //   .add(5000)
      })).to.be.emit(entryPoint, "UserOperationEvent")
        .withArgs(
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          true,
          anyValue,
          anyValue
        );

      expect(
        await testCount.callStatic.counters(walletAddress)
      ).to.equal(1);

      // The user's gas should not be consumed here, so the user's balance should be unchanged
      expect(execBeforeWalletEthBalance).to.equal(await provider.getBalance(walletAddress))
    })

    it("use usdc erc20 paymaster", async () => {
      const execBeforeWalletEthBalance = await provider.getBalance(walletAddress);
      const execBeforeWalletUSDCBalance = await usdcToken.balanceOf(walletAddress);
      // exec with paymaster
      const testCount = await deployContract(provider.getSigner(), TestCounter__factory);
      const countABI = testCount.interface.encodeFunctionData("count");
      const execData = walletSingleton.connect(walletAddress).interface.encodeFunctionData("execute", [
        [
          {
            op: 0,
            revertOnError: true,
            gasLimit: 0,
            target: testCount.address,
            value: 0,
            data: countABI
          }
        ]
      ]);

      let op = await fillUserOp({
        sender: walletAddress,
        callData: execData,
      }, entryPoint);

      op = await getUserOpWithERC20PaymasterData(
        erc20Paymaster.address,
        op,
        usdcToken.address,
        walletSafeOwner,
        entryPoint
      );

      expect(
        await testCount.callStatic.counters(walletAddress)
      ).to.equal(0);

      await expect(entryPoint.simulateValidation(op))
        .to.be.revertedWithCustomError(entryPoint, "ValidationResult")
        .withArgs(function (result: any) {
          console.debug(result);
          return true;
        }, anyValue, anyValue, anyValue);

      const simulateHandleOp = { ...op };
      // simulateHandleOp.signature = "0x";
      // simulateHandleOp.verificationGasLimit = 50851;


      // await entryPoint.callStatic.simulateHandleOp(simulateHandleOp, ethers.constants.AddressZero, "0x").catch(rethrow());
      await expect(entryPoint.simulateHandleOp(op, ethers.constants.AddressZero, "0x"))
        .to.be.revertedWithCustomError(entryPoint, "ExecutionResult")
        .withArgs(anyValue, anyValue, anyValue, anyValue, anyValue, anyValue);

      await expect(entryPoint.handleOps([
        op,
      ], provider.getSigner().getAddress(), {
        // gasLimit: BigNumber.from(op.callGasLimit)
        //   .add(op.preVerificationGas)
        //   .add(op.verificationGasLimit)
        //   .add(5000)
      })).to.be.emit(entryPoint, "UserOperationEvent")
        .withArgs(
          anyValue,
          anyValue,
          erc20Paymaster.address,
          anyValue,
          true,
          anyValue,
          anyValue
        );

      expect(
        await testCount.callStatic.counters(walletAddress)
      ).to.equal(1);

      // The user's gas should not be consumed here, so the user's balance should be unchanged
      expect(execBeforeWalletEthBalance).to.equal(await provider.getBalance(walletAddress));

      const execAfterWalletUSDCBalance = await usdcToken.balanceOf(walletAddress);

      const use = execBeforeWalletUSDCBalance.sub(execAfterWalletUSDCBalance);
      expect(use).to.be.gt(BigNumber.from(0));
      console.info(use.toString(), "use usdc for gas")
    });
  });
})


async function getUserOpWithVerifyingPaymasterData(
  paymaster: VerifyingSingletonPaymaster,
  userOp: UserOperation,
  offchainPaymasterSigner: Wallet,
  paymasterId: string,
  walletOwner: Wallet,
  entryPoint: EntryPoint
) {
  const hash = await paymaster.getHash(userOp, paymasterId);
  const sig = await offchainPaymasterSigner.signMessage(ethers.utils.arrayify(hash));
  const userOpWithPaymasterData = await fillAndSign(
    {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...userOp,
      paymasterAndData: ethers.utils.hexConcat([
        paymaster.address,
        ethers.utils.defaultAbiCoder.encode(
          ["address", "bytes"],
          [paymasterId, sig]
        ),
      ]),
    },
    walletOwner,
    entryPoint
  );
  return userOpWithPaymasterData;
}

async function getUserOpWithERC20PaymasterData(
  paymasterAddress: string,
  userOp: UserOperation,
  payTokenAddress: string,
  walletOwner: Wallet,
  entryPoint: EntryPoint
) {
  const userOpWithPaymasterData = await fillAndSign(
    {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...userOp,
      paymasterAndData: ethers.utils.hexConcat([
        paymasterAddress,
        "0x095ea7b3",
        payTokenAddress
      ]),
    },
    walletOwner,
    entryPoint
  );

  return userOpWithPaymasterData;
}