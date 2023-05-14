import { arrayify, keccak256, parseEther, hexDataSlice, id } from 'ethers/lib/utils';
import { BigNumber, BigNumberish, Contract, ContractReceipt, Wallet, TypedDataField } from 'ethers';
import {
  EntryPoint,
  EntryPoint__factory,
  Sodium__factory, Sodium as SodiumSingleton,
  IEntryPoint,
  IERC20,
  CompatibilityFallbackHandler,
  CompatibilityFallbackHandler__factory,
  SodiumAuthWeighted__factory,
  SodiumAuthWeighted,
  Factory,
  Factory__factory,
  MockUserOperationValidator,
  MockUserOperationValidator__factory,
  ERC20Paymaster,
  ERC20Paymaster__factory,
  VerifyingSingletonPaymaster,
  VerifyingSingletonPaymaster__factory
} from '../gen/typechain';
import { SecurityManager } from '../gen/typechain/contracts/base/SecurityManager';
import { expect } from 'chai';
import { debugTransaction } from './debugTx';
import { UserOperation } from './UserOperation';
import CompatibilityFallbackHandlerABI from '../artifacts/contracts/handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json';
import { ethers, providers, ContractFactory, Signer, } from 'ethers';
import { ContractJSON, isStandard } from './contract';
import { TransactionResponse } from '@ethersproject/providers';

export const AddressZero = ethers.constants.AddressZero
export const HashZero = ethers.constants.HashZero
export const ONE_ETH = parseEther('1')
export const TWO_ETH = parseEther('2')
export const FIVE_ETH = parseEther('5')

export const tostr = (x: any): string => x != null ? x.toString() : 'null'

export function tonumber(x: any): number {
  try {
    return parseFloat(x.toString())
  } catch (e: any) {
    console.log('=== failed to parseFloat:', x, (e).message)
    return NaN
  }
}

type Newable<T> = { new(...args: any): T };

type ContractFactoryOrJSON = Newable<ContractFactory> | ContractJSON;

type ContractTypeOf<T> = T extends Newable<infer U>
  ? (U extends ContractFactory ? ReturnType<U['deploy']> : never)
  : Contract;
type DeployArgumentsOf<T> = T extends Newable<infer U>
  ? (U extends ContractFactory ? Parameters<U['deploy']> : never)
  : any[];

const isFactory = (contract: ContractFactoryOrJSON): contract is Newable<ContractFactory> =>
  'call' in contract;

export async function deployContract<T extends ContractFactoryOrJSON>(
  wallet: Wallet | Signer,
  factoryOrContractJson: T,
  args: DeployArgumentsOf<T> = [] as any,
  overrideOptions: providers.TransactionRequest = {}
): Promise<ContractTypeOf<T>> {
  if (isFactory(factoryOrContractJson)) {
    const Factory = factoryOrContractJson;
    const contractFactory = new Factory(wallet);
    const contract = await contractFactory.deploy(...args, overrideOptions);
    await contract.deployed();
    return contract as any;
  } else {
    const contract = await deployFromJson(wallet, factoryOrContractJson, args, overrideOptions);
    return contract as any;
  }
}

async function deployFromJson(
  wallet: Signer,
  contractJson: ContractJSON,
  args: any[],
  overrideOptions: providers.TransactionRequest) {
  const bytecode = isStandard(contractJson) ? contractJson.evm.bytecode : contractJson.bytecode;
  const factory = new ContractFactory(
    contractJson.abi,
    bytecode,
    wallet
  );
  const contract = await factory.deploy(...args, {
    ...overrideOptions
  });
  await contract.deployed();
  return contract;
}

// just throw 1eth from account[0] to the given address (or contract instance)
export async function fund(provider: ethers.providers.JsonRpcProvider, contractOrAddress: string | Contract, amountEth = '1'): Promise<TransactionResponse> {
  let address: string
  if (typeof contractOrAddress === 'string') {
    address = contractOrAddress
  } else {
    address = contractOrAddress.address
  }
  return provider.getSigner().sendTransaction({ to: address, value: parseEther(amountEth) })
}

export async function getBalance(provider: ethers.providers.JsonRpcProvider, address: string): Promise<number> {
  const balance = await provider.getBalance(address)
  return parseInt(balance.toString())
}

export async function getTokenBalance(token: IERC20, address: string): Promise<number> {
  const balance = await token.balanceOf(address)
  return parseInt(balance.toString())
}

let counter = 0

// create non-random account, so gas calculations are deterministic
export function createWalletOwner(provider: ethers.providers.Provider): Wallet {
  const privateKey = keccak256(Buffer.from(arrayify(BigNumber.from(++counter))))
  return new ethers.Wallet(privateKey, provider);
}

export function createAddress(provider: ethers.providers.Provider): string {
  return createWalletOwner(provider).address
}

export function callDataCost(data: string): number {
  return ethers.utils.arrayify(data)
    .map(x => x === 0 ? 4 : 16)
    .reduce((sum, x) => sum + x)
}

export async function calcGasUsage(provider: ethers.providers.JsonRpcProvider, rcpt: ContractReceipt, entryPoint: EntryPoint, beneficiaryAddress?: string): Promise<{ actualGasCost: BigNumberish }> {
  const actualGas = await rcpt.gasUsed
  const logs = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent(), rcpt.blockHash)
  const { actualGasCost, actualGasUsed } = logs[0].args
  console.log('\t== actual gasUsed (from tx receipt)=', actualGas.toString())
  const calculatedGasUsed = actualGasCost.toNumber() / actualGasUsed.toNumber()
  console.log('\t== calculated gasUsed (paid to beneficiary)=', calculatedGasUsed)
  const tx = await provider.getTransaction(rcpt.transactionHash)
  console.log('\t== gasDiff', actualGas.toNumber() - calculatedGasUsed - callDataCost(tx.data))
  if (beneficiaryAddress != null) {
    expect(await getBalance(provider, beneficiaryAddress)).to.eq(actualGasCost.toNumber())
  }
  return { actualGasCost }
}

// // given the parameters as WalletDeployer, return the resulting "counterfactual address" that it would create.
// export function getWalletAddress(entryPoint: string, owner: string): string {
//   const walletCtr = new SimpleWallet__factory(ethers.provider.getSigner()).getDeployTransaction(entryPoint, owner).data!
//   return getCreate2Address(Create2Factory.contractAddress, HashZero, keccak256(hexValue(walletCtr)))
// }

const panicCodes: { [key: number]: string } = {
  // from https://docs.soliditylang.org/en/v0.8.0/control-structures.html
  0x01: 'assert(false)',
  0x11: 'arithmetic overflow/underflow',
  0x12: 'divide by zero',
  0x21: 'invalid enum value',
  0x22: 'storage byte array that is incorrectly encoded',
  0x31: '.pop() on an empty array.',
  0x32: 'array sout-of-bounds or negative index',
  0x41: 'memory overflow',
  0x51: 'zero-initialized variable of internal function type'
}

// rethrow "cleaned up" exception.
// - stack trace goes back to method (or catch) line, not inner provider
// - attempt to parse revert data (needed for geth)
// use with ".catch(rethrow())", so that current source file/line is meaningful.
export function rethrow(debug: boolean = false): (e: Error) => void {
  const callerStack = new Error().stack!.replace(/Error.*\n.*at.*\n/, '').replace(/.*at.* \(internal[\s\S]*/, '')
  return function (e: Error) {
    const solstack = e.stack!.match(/((?:.* at .*\.sol.*\n)+)/)
    const stack = (solstack != null ? solstack[1] : '') + callerStack
    // const regex = new RegExp('error=.*"data":"(.*?)"').compile()
    let found = /error=.*?"data":"(.*?)"/.exec(e.message)

    if (found == null) {
      found = /data="(.*?)"/.exec(e.message)
    }

    let message: string
    let data = "0x"
    if (found != null) {
      data = found[1]
      message = decodeRevertReason(data) ?? e.message + ' - ' + data.slice(0, 100)
    } else {
      message = e.message
    }

    if (debug) {
    }

    const err = new Error(message)
    // @ts-ignore
    err.data = data;
    err.stack = 'Error: ' + message + '\n' + stack
    throw err
  }
}

export function decodeRevertReason(data: string, nullIfNoMatch = true): string | null {
  const methodSig = data.slice(0, 10)
  const dataParams = '0x' + data.slice(10)

  if (methodSig === '0x08c379a0') {
    const [err] = ethers.utils.defaultAbiCoder.decode(['string'], dataParams)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Error(${err})`
  } else if (methodSig === '0x00fa072b') {
    const [opindex, paymaster, msg] = ethers.utils.defaultAbiCoder.decode(['uint256', 'address', 'string'], dataParams)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `FailedOp(${opindex}, ${paymaster !== AddressZero ? paymaster : 'none'}, ${msg})`
  } else if (methodSig === '0x4e487b71') {
    const [code] = ethers.utils.defaultAbiCoder.decode(['uint256'], dataParams)
    return `Panic(${panicCodes[code] ?? code} + ')`
  } else if (methodSig === "0x9adb6dea") {
    // struct PaymasterInfo {
    //  uint256 paymasterStake;
    //  uint256 paymasterUnstakeDelay;
    // }
    // error SimulationResult(uint256 preOpGas, uint256 prefund, uint256 deadline, PaymasterInfo paymasterInfo);
    const [preOpGas, prefund, deadline, paymasterInfo] = ethers.utils.defaultAbiCoder.decode(['uint256', 'uint256', 'uint256', '(uint256,uint256)'], dataParams)
    return `SimulationResult(${preOpGas}, ${prefund}, ${deadline})`;
  }
  if (!nullIfNoMatch) {
    return data
  }
  return null
}

let currentNode: string = ''

// remove "array" members, convert values to strings.
// so Result obj like
// { '0': "a", '1': 20, first: "a", second: 20 }
// becomes:
// { first: "a", second: "20" }
export function objdump(obj: { [key: string]: any }): any {
  return Object.keys(obj)
    .filter(key => key.match(/^[\d_]/) == null)
    .reduce((set, key) => ({
      ...set,
      [key]: decodeRevertReason(obj[key].toString(), false)
    }), {})
}

export async function checkForBannedOps(txHash: string, checkPaymaster: boolean): Promise<void> {
  const tx = await debugTransaction(txHash)
  const logs = tx.structLogs
  const blockHash = logs.map((op, index) => ({ op: op.op, index })).filter(op => op.op === 'NUMBER')
  expect(blockHash.length).to.equal(2, 'expected exactly 2 call to NUMBER (Just before and after validatePaymasterUserOp)')
  const validateWalletOps = logs.slice(0, blockHash[0].index - 1)
  const validatePaymasterOps = logs.slice(blockHash[0].index + 1, blockHash[1].index - 1)
  const ops = validateWalletOps.filter(log => log.depth > 1).map(log => log.op)
  const paymasterOps = validatePaymasterOps.filter(log => log.depth > 1).map(log => log.op)

  expect(ops).to.include('POP', 'not a valid ops list: ' + JSON.stringify(ops)) // sanity
  const bannedOpCodes = new Set(['GAS', 'BASEFEE', 'GASPRICE', 'NUMBER'])
  expect(ops.filter((op, index) => {
    // don't ban "GAS" op followed by "*CALL"
    if (op === 'GAS' && (ops[index + 1].match(/CALL/) != null)) {
      return false
    }
    return bannedOpCodes.has(op)
  })).to.eql([])
  if (checkPaymaster) {
    expect(paymasterOps).to.include('POP', 'not a valid ops list: ' + JSON.stringify(paymasterOps)) // sanity
    expect(paymasterOps).to.not.include('BASEFEE')
    expect(paymasterOps).to.not.include('GASPRICE')
    expect(paymasterOps).to.not.include('NUMBER')
  }
}

export async function deployEntryPoint(
  provider: ethers.providers.JsonRpcProvider
): Promise<[EntryPoint]> {
  const i = await deployContract(provider.getSigner(), EntryPoint__factory, [

  ]);
  return [
    i
  ];
}

export async function deploySingleton(
  provider: ethers.providers.JsonRpcProvider,
  entryPoint: EntryPoint,
): Promise<SodiumSingleton> {
  return await deployContract(provider.getSigner(), Sodium__factory, [
    entryPoint.address
  ]);
}

export async function deployFallbackHandler(provider: ethers.providers.JsonRpcProvider): Promise<CompatibilityFallbackHandler> {
  const i = await deployContract(provider.getSigner(), CompatibilityFallbackHandlerABI, [
  ]);
  return CompatibilityFallbackHandler__factory.connect(i.address, provider.getSigner())
}

export type SodiumAuthTssWeighted = {
  threshold: number,
  weights: number[],
  operators: Wallet[]
}
// recentOperators
// address[] memory newOperators, uint256[] memory newWeights, uint256 newThreshold
export async function deploySodiumAuthWeighted(
  provider: ethers.providers.JsonRpcProvider,
  // multisig tss params
  recentOperators: SodiumAuthTssWeighted[],
): Promise<SodiumAuthWeighted> {
  let params = [];
  for (const { threshold, weights, operators } of recentOperators) {
    const operatorsAddress = operators.map(w => w.address);
    // abi encode address[] memory newOperators, uint256[] memory newWeights, uint256 newThreshold
    const param = ethers.utils.defaultAbiCoder.encode(['address[]', 'uint256[]', 'uint256'], [operatorsAddress, weights, threshold]);
    params.push(param);
  }

  const sodiumAuth = await deployContract(provider.getSigner(), SodiumAuthWeighted__factory, [
    params,
    provider.getSigner().getAddress(),
  ]);

  const owner = await sodiumAuth.owner();

  if (owner !== await provider.getSigner().getAddress()) {
    throw new Error("sodium auth no owner");
  }

  return sodiumAuth;
}

export async function deployFactory(
  provider: ethers.providers.JsonRpcProvider,
  initSingleton: string
): Promise<Factory> {
  const c = await deployContract(provider.getSigner(), Factory__factory, [
    provider.getSigner().getAddress(),
  ]);

  await c.addAllowSingleton(initSingleton)

  return c;
}

export async function deployMockUserOperationValidator(provider: ethers.providers.JsonRpcProvider): Promise<MockUserOperationValidator> {
  return deployContract(provider.getSigner(), MockUserOperationValidator__factory);
}

// new recentOperators
export function mockSodiumAuthTssWeighted(): SodiumAuthTssWeighted {
  const threshold = 100;
  const weights = [100];
  const operators = [Wallet.createRandom()];
  return { threshold, weights, operators };
}

function computeWalletSlat(userId: string): string {
  return id(userId);
}

// address singleton = address(bytes20(initCode[0:20]));
// bytes32 salt = bytes32(initCode[20:52]);
// bytes memory initCallData = initCode[52:];
export async function getWalletInitCode(
  factory: Factory,
  sodiumAuthWeighted: SodiumAuthWeighted,
  singleton: SodiumSingleton,
  sessionOwner: string,
  fallbackHandler: string,
  opValidator: string
): Promise<string> {
  const userId = sessionOwner;
  const sodiumSetup = singleton.interface.encodeFunctionData("setup", [
    sodiumAuthWeighted.address,
    fallbackHandler,
    opValidator
  ]);
  const deployCode = factory.interface.encodeFunctionData("deployProxy", [
    singleton.address,
    sodiumSetup,
    computeWalletSlat(userId)
  ]);
  return `${factory.address}${deployCode.slice(2)}`;
}

export async function getWalletAddress(factory: Factory, userId: string): Promise<string> {
  const slat = computeWalletSlat(userId);
  return ethers.utils.getCreate2Address(
    factory.address,
    slat,
    ethers.utils.keccak256("0x608060405234801561001057600080fd5b50610180806100206000396000f3fe60806040526004361061001e5760003560e01c8063691bd2ae14610046575b30543660008037600080366000845af43d6000803e80801561003f573d6000f35b3d6000fd5b005b34801561005257600080fd5b5061004461006136600461011a565b6001600160a01b0381166100bc5760405162461bcd60e51b815260206004820152601e60248201527f496e76616c696420696d706c656d656e746174696f6e2061646472657373000060448201526064015b60405180910390fd5b30546001600160a01b038116156101155760405162461bcd60e51b815260206004820152601a60248201527f496d706c656d656e746174696f6e20616c72656164792073657400000000000060448201526064016100b3565b503055565b60006020828403121561012c57600080fd5b81356001600160a01b038116811461014357600080fd5b939250505056fea26469706673582212207efdfc2f5463e8adb0681461b14417ea7c7651a6359421a66c154326fef5e45d64736f6c63430008110033")
  );
}

export async function isDeployed(provider: ethers.providers.JsonRpcProvider, addr: string): Promise<boolean> {
  const code = await provider.getCode(addr)
  return code.length > 2
}

// internal helper function: create a UserOpsPerAggregator structure, with no aggregator or signature
export function userOpsWithoutAgg(userOps: UserOperation[]): IEntryPoint.UserOpsPerAggregatorStruct[] {
  return [{
    userOps,
    aggregator: AddressZero,
    signature: '0x'
  }]
}

// types: Record<string, Array<TypedDataField>>, value: Record<string, any>
// bytes32 public constant _RECOVER_TYPEHASH =
// keccak256(
//     "Recover(address safeSessionKey,uint256 recoverNonce,uint64 recoverExpires,address zkVerifierAddr,uint256 zkRoot)"
// );
function getRecoverTypedDataTypesAndValue(recover: SecurityManager.RecoverStruct): { types: Record<string, Array<TypedDataField>>, value: Record<string, any> } {
  const types = {
    Recover: [
      { name: 'safeSessionKey', type: 'address' },
      { name: 'recoverNonce', type: 'uint256' },
    ]
  }
  const value = {
    safeSessionKey: recover.safeSessionKey,
    recoverNonce: recover.recoverNonce,
  }
  return { types, value };
}

// AddSession(address sessionKey,uint256 addSessionNonce,uint64 sessionExpires,uint64 sessionSafeExpires,uint64 addSessionExpires,address zkVerifierAddr,uint256 zkRoot)
function getAddSessionTypedDataTypesAndValue(addSession: SecurityManager.AddSessionStruct): { types: Record<string, Array<TypedDataField>>, value: Record<string, any> } {
  const types = {
    AddSession: [
      { name: 'sessionKey', type: 'address' },
      { name: 'sessionUniqueId', type: 'bytes4' },
      { name: 'sessionExpires', type: 'uint64' },
    ]
  };
  const value = {
    sessionKey: addSession.sessionKey,
    sessionUniqueId: addSession.sessionUniqueId,
    sessionExpires: addSession.sessionExpires,
  };
  return { types, value };
}

export async function signSodiumAuthRecover(
  sodiumAuthTssWeighted: SodiumAuthTssWeighted,
  recover: SecurityManager.RecoverStruct,
  walletAddress: string,
): Promise<string> {
  const typeData = getRecoverTypedDataTypesAndValue(recover);
  const signatures = [];
  for (const w of sodiumAuthTssWeighted.operators) {
    const sig = await w._signTypedData({
      verifyingContract: walletAddress
    }, typeData.types, typeData.value);
    signatures.push(sig);
  }
  const authProof = ethers.utils.defaultAbiCoder.encode(['address[]', 'uint256[]', 'uint256', 'bytes[]'], [
    sodiumAuthTssWeighted.operators.map(w => w.address),
    sodiumAuthTssWeighted.weights,
    sodiumAuthTssWeighted.threshold,
    signatures
  ]);
  return authProof;
}

export async function signSodiumAuthSession(
  sodiumAuthTssWeighted: SodiumAuthTssWeighted,
  addSession: SecurityManager.AddSessionStruct,
  walletAddress: string,
): Promise<string> {
  const typeData = getAddSessionTypedDataTypesAndValue(addSession);
  const signatures = [];
  for (const w of sodiumAuthTssWeighted.operators) {
    const sig = await w._signTypedData({
      verifyingContract: walletAddress
    }, typeData.types, typeData.value);
    signatures.push(sig);
  }
  const authProof = ethers.utils.defaultAbiCoder.encode(['address[]', 'uint256[]', 'uint256', 'bytes[]'], [
    sodiumAuthTssWeighted.operators.map(w => w.address),
    sodiumAuthTssWeighted.weights,
    sodiumAuthTssWeighted.threshold,
    signatures
  ]);
  return authProof;
}

export async function deployERC20Paymaster(
  provider: ethers.providers.JsonRpcProvider,
  entryPoint: EntryPoint,
  owner: Wallet
): Promise<ERC20Paymaster> {
  const i = await deployContract(provider.getSigner(), ERC20Paymaster__factory, [
    entryPoint.address,
    owner.address
  ]);

  return ERC20Paymaster__factory.connect(i.address, owner);
}

export async function deployVerifyingPaymaster(
  provider: ethers.providers.JsonRpcProvider,
  entryPoint: EntryPoint,
  owner: Wallet,
  offchainPaymasterSigner: Wallet
): Promise<VerifyingSingletonPaymaster> {
  return deployContract(provider.getSigner(), VerifyingSingletonPaymaster__factory, [
    entryPoint.address,
    owner.address,
    offchainPaymasterSigner.address
  ]);
}