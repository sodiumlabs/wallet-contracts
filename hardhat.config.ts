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
    },
    mumbai: {
      ...sharedNetworkConfig,
      url: "https://polygon-mumbai.g.alchemy.com/v2/fIbA8DRSTQXPAhcHKiPFo19SPqhHNHam"
    },
    polygon: {
      ...sharedNetworkConfig,
      url: "https://polygon-mainnet.g.alchemy.com/v2/y48IcelCwZwwppoj-CXBEwmIjBOZ2ZLt"
    }
  }
};

export default config;