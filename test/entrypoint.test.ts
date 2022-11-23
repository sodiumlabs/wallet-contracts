import './aa.init'
import { BigNumber, Wallet } from 'ethers'
import { expect, use } from 'chai'
import {
  EntryPoint,
  Sodium,
  CompatibilityFallbackHandler,
  EntryPoint__factory,
  TestCounter,
  TestCounter__factory
} from '../typechain'
import {
  AddressZero,
  createWalletOwner,
  fund,
  checkForGeth,
  rethrow,
  ONE_ETH,
  TWO_ETH,
  deployEntryPoint,
  FIVE_ETH, createAddress, getWalletInitCode, deploySingleton, deployFallbackHandler, getWalletAddress
} from './testutils';
import { fillAndSign, getRequestId } from './UserOp';
import { UserOperation } from './UserOperation';
import { PopulatedTransaction } from 'ethers/lib/ethers';
import { defaultAbiCoder, hexConcat, hexZeroPad, parseEther } from 'ethers/lib/utils';
import { debugTransaction } from './debugTx';
import { BytesLike } from '@ethersproject/bytes';
import { MockProvider, solidity } from 'ethereum-waffle';
import { ethers } from 'ethers';

use(solidity);

describe('EntryPoint', function () {
  let entryPoint: EntryPoint
  let entryPointView: EntryPoint
  const provider = new MockProvider();
  let walletOwner: Wallet
  let walletInitCode: string;
  let walletSingleton: Sodium;
  let fallbackHandler: CompatibilityFallbackHandler;
  const ethersSigner = provider.getSigner()
  let signer: string

  const globalUnstakeDelaySec = 2
  const paymasterStake = ethers.utils.parseEther('2')

  before(async function () {
    signer = await ethersSigner.getAddress()
    await checkForGeth()
    entryPoint = await deployEntryPoint(paymasterStake, globalUnstakeDelaySec, provider)
    // static call must come from address zero, to validate it can only be called off-chain.
    entryPointView = entryPoint;
    walletOwner = createWalletOwner(provider);
    walletSingleton = await deploySingleton(provider);
    fallbackHandler = await deployFallbackHandler(provider);
    walletInitCode = await getWalletInitCode(
      provider,
      entryPoint,
      walletSingleton,
      walletOwner.address,
      "web",
      fallbackHandler.address
    );

    const walletAddress = await getWalletAddress(entryPoint, walletInitCode);
    await fund(provider, walletAddress);
    // sanity: validate helper functions
    // const sampleOp = await fillAndSign({ sender: walletAddress }, walletOwner, entryPoint)
    // expect(getRequestId(sampleOp, entryPoint.address, chainId)).to.eql(await entryPoint.getRequestId(sampleOp))
  })

  describe('Stake Management', () => {
    let addr: string
    before(async () => {
      addr = await ethersSigner.getAddress()
    })

    it('#getSenderStorage() should get storage cell', async () => {
      await entryPoint.depositTo(signer, { value: FIVE_ETH })
      const cells = await entryPoint.getSenderStorage(signer)
      const val = await provider.getStorageAt(entryPoint.address, cells[0])
      const mask = BigNumber.from(2).pow(112).sub(1)
      expect(BigNumber.from(val).and(mask)).to.eq(FIVE_ETH)
    })

    it('should deposit for transfer into EntryPoint', async () => {
      const signer2 = provider.getSigner(2)
      await signer2.sendTransaction({ to: entryPoint.address, value: ONE_ETH })
      expect(await entryPoint.balanceOf(await signer2.getAddress())).to.eql(ONE_ETH)
      expect(await entryPoint.getDepositInfo(await signer2.getAddress())).to.eql({
        deposit: ONE_ETH,
        staked: false,
        stake: 0,
        unstakeDelaySec: 0,
        withdrawTime: 0
      })
    })

    describe('without stake', () => {
      it('should fail to stake too little value', async () => {
        await expect(entryPoint.addStake(2, { value: ONE_ETH })).to.revertedWith('stake value too low')
      })
      it('should fail to stake too little delay', async () => {
        await expect(entryPoint.addStake(1)).to.revertedWith('unstake delay too low')
      })
      it('should fail to unlock', async () => {
        await expect(entryPoint.unlockStake()).to.revertedWith('not staked')
      })
    })
    describe('with stake of 2 eth', () => {
      before(async () => {
        await entryPoint.addStake(2, { value: TWO_ETH })
      })
      it('should report "staked" state', async () => {
        const { stake, staked, unstakeDelaySec, withdrawTime } = await entryPoint.getDepositInfo(addr)
        expect({ stake, staked, unstakeDelaySec, withdrawTime }).to.eql({
          stake: parseEther('2'),
          staked: true,
          unstakeDelaySec: 2,
          withdrawTime: 0
        })
      })

      it('should succeed to stake again', async () => {
        const { stake } = await entryPoint.getDepositInfo(addr)
        await entryPoint.addStake(2, { value: ONE_ETH })
        const { stake: stakeAfter } = await entryPoint.getDepositInfo(addr)
        expect(stakeAfter).to.eq(stake.add(ONE_ETH))
      })
      it('should fail to withdraw before unlock', async () => {
        await expect(entryPoint.withdrawStake(AddressZero)).to.revertedWith('must call unlockStake() first')
      })
      describe('with unlocked stake', () => {
        before(async () => {
          await entryPoint.unlockStake()
        })
        it('should report as "not staked"', async () => {
          expect(await entryPoint.getDepositInfo(addr).then(info => info.staked)).to.eq(false)
        })
        it('should report unstake state', async () => {
          const withdrawTime1 = await provider.getBlock('latest').then(block => block.timestamp) + globalUnstakeDelaySec
          const { stake, staked, unstakeDelaySec, withdrawTime } = await entryPoint.getDepositInfo(addr)
          expect({ stake, staked, unstakeDelaySec, withdrawTime }).to.eql({
            stake: parseEther('3'),
            staked: false,
            unstakeDelaySec: 2,
            withdrawTime: withdrawTime1
          })
        })
        it('should fail to withdraw before unlock timeout', async () => {
          await expect(entryPoint.withdrawStake(AddressZero)).to.revertedWith('Stake withdrawal is not due')
        })
        it('should fail to unlock again', async () => {
          await expect(entryPoint.unlockStake()).to.revertedWith('already unstaking')
        })
        describe('after unstake delay', () => {
          before(async () => {
            // dummy transaction and increase time by 2 seconds
            await provider.send('evm_increaseTime', [2])
            await ethersSigner.sendTransaction({ to: addr })
          })
          it('adding stake should reset "unlockStake"', async () => {
            let snap
            try {
              snap = await provider.send('evm_snapshot', [])

              await ethersSigner.sendTransaction({ to: addr })
              await entryPoint.addStake(2, { value: ONE_ETH })
              const { stake, staked, unstakeDelaySec, withdrawTime } = await entryPoint.getDepositInfo(addr)
              expect({ stake, staked, unstakeDelaySec, withdrawTime }).to.eql({
                stake: parseEther('4'),
                staked: true,
                unstakeDelaySec: 2,
                withdrawTime: 0
              })
            } finally {
              await provider.send('evm_revert', [snap])
            }
          })

          it('should fail to unlock again', async () => {
            await expect(entryPoint.unlockStake()).to.revertedWith('already unstaking')
          })
          it('should succeed to withdraw', async () => {
            const { stake } = await entryPoint.getDepositInfo(addr)
            const addr1 = createAddress(provider);
            await entryPoint.withdrawStake(addr1)
            expect(await provider.getBalance(addr1)).to.eq(stake)
            const { stake: stakeAfter, withdrawTime, unstakeDelaySec } = await entryPoint.getDepositInfo(addr)

            expect({ stakeAfter, withdrawTime, unstakeDelaySec }).to.eql({
              stakeAfter: BigNumber.from(0),
              unstakeDelaySec: 0,
              withdrawTime: 0
            })
          })
        })
      })
    })
  })

  describe('#simulateValidation', () => {
    const walletOwner1 = createWalletOwner(provider)
    let walletInitCode: string

    before(async () => {
      walletInitCode = await getWalletInitCode(
        provider,
        entryPoint,
        walletSingleton,
        walletOwner1.address,
        "web",
        fallbackHandler.address
      );

      console.debug("wallet init code", walletInitCode)
    })

    it('should fail if validateUserOp fails', async () => {
      const walletAddress = await getWalletAddress(entryPoint, walletInitCode);
      await fund(provider, walletAddress);
      // using wrong owner for wallet1
      const op = await fillAndSign({
        sender: walletAddress,
        nonce: 0,
        initCode: walletInitCode
      }, walletOwner, entryPoint)
      await expect(entryPointView.callStatic.simulateValidation(op, false).catch(rethrow()))
      // @ts-ignore
      .to.be.revertedWith(/wrong.*signature*/)
    })

    it('should succeed if validateUserOp succeeds', async () => {
      const walletAddress = await getWalletAddress(entryPoint, walletInitCode);
      await fund(provider, walletAddress);
      const op = await fillAndSign({
        sender: walletAddress,
        nonce: 0,
        initCode: walletInitCode,
      }, walletOwner1, entryPoint)
      await fund(provider, walletAddress)
      await entryPointView.callStatic.simulateValidation(op, false).catch(rethrow())
    })
  })
})
