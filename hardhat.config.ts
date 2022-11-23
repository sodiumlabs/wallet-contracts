import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import waffleConfig from './waffle.json';

const config: HardhatUserConfig = {
  solidity: waffleConfig.compilerVersion,
};

export default config;