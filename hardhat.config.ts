import { HardhatUserConfig } from "hardhat/config";
import "tsconfig-paths/register";
import 'hardhat-deploy';
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";

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

  networks: {
    hardhat: {
    },
    mumbai: {
      url: "https://polygon-mumbai.g.alchemy.com/v2/fIbA8DRSTQXPAhcHKiPFo19SPqhHNHam"
    }
  }
};

export default config;