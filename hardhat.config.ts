import { HardhatUserConfig } from "hardhat/config";
import "tsconfig-paths/register";
import 'hardhat-deploy';
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import { getSingletonFactoryInfo } from "@gnosis.pm/safe-singleton-factory";
import { BigNumber } from "ethers";
import * as fs from 'fs';
import { HttpNetworkUserConfig } from "hardhat/types";
const PK = fs.readFileSync(".secret").toString().trim();

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK.length) {
  sharedNetworkConfig.accounts = [PK];
} else {
  const MNEMONIC = fs.readFileSync(".MNEMONIC").toString().trim();
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC
  };
}

const deterministicDeployment = (network: string) => {
  if (parseInt(network) == 1337) {
    return undefined;
  }
  if (parseInt(network) == 31337) {
    return undefined;
  }
  if (parseInt(network) == 777) {
    return {
      factory: "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7",
      deployer: "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37",
      signedTx: "0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820135a085f489c94262e70d9568f4d99427fe4c8aa38bfc1db00284ba8335c577a83f73a0519952b3403cbddd02532b7a9747ff1612d1889b42a53c63e6b63c20026532a8",
      funding: BigNumber.from(100000).mul(BigNumber.from(100000000000)).toString()
    };
  }
  const info = getSingletonFactoryInfo(parseInt(network));
  if (!info) {
    throw new Error(`
      Safe factory not found for network ${network}. You can request a new deployment at https://github.com/safe-global/safe-singleton-factory.
      For more information, see https://github.com/safe-global/safe-contracts#replay-protection-eip-155
    `);
  }
  return {
    factory: info.address,
    deployer: info.signerAddress,
    funding: BigNumber.from(info.gasLimit).mul(BigNumber.from(info.gasPrice)).toString(),
    signedTx: info.transaction,
  };
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  typechain: {
    outDir: "gen/typechain"
  },

  namedAccounts: {
    deployer: 0,
  },
  deterministicDeployment,
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mumbai: {
      ...sharedNetworkConfig,
      chainId: 80001,
      url: "https://polygon-mumbai.g.alchemy.com/v2/fIbA8DRSTQXPAhcHKiPFo19SPqhHNHam"
    },
    goerliarbitrum: {
      ...sharedNetworkConfig,
      chainId: 421613,
      url: "https://goerli-rollup.arbitrum.io/rpc",
    },
    sodiumLocal: {
      ...sharedNetworkConfig,
      chainId: 777,
      url: "http://localhost:26651"
    },
    sodiumt: {
      ...sharedNetworkConfig,
      chainId: 777,
      url: "http://18.141.11.82:26651"
    },
    polygon: {
      ...sharedNetworkConfig,
      chainId: 137,
      url: "https://polygon-mainnet.g.alchemy.com/v2/y48IcelCwZwwppoj-CXBEwmIjBOZ2ZLt"
    }
  }
};

export default config;