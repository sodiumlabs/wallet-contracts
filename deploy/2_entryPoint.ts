import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { is4337DeployerNetwork } from '../helper';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    if (is4337DeployerNetwork(network.config.chainId)) {
        return;
    }

    const { deployer } = await getNamedAccounts();
    await deploy("EntryPoint", {
        deterministicDeployment: true,
        from: deployer,
        args: [
        ],
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_entryPoint";
func.tags = [
    "EntryPoint"
]