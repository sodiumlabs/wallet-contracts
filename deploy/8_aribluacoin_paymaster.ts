import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";
import { is4337DeployerNetwork } from '../helper';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    // https://github.com/eth-infinitism/account-abstraction/releases/tag/v0.6.0
    let entryPointAddressOf4337 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    const { deployer } = await getNamedAccounts();

    if (!is4337DeployerNetwork(network.config.chainId)) {
        const entryPoint = await deployments.get("EntryPoint");
        entryPointAddressOf4337 = entryPoint.address;
    }

    if (network.name != "arbitrum") {
        return;
    }

    await deploy("AribLUAPaymaster", {
        deterministicDeployment: keccak256(toUtf8Bytes("AribLUAPaymaster")),
        from: deployer,
        args: [
            entryPointAddressOf4337
        ],
        autoMine: true,
        log: true
    });
};
export default func;
func.id = "deploy_aribstablecoinpay";
func.tags = [
    "aribstablecoinpay"
]