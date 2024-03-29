import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy("CompatibilityFallbackHandler", {
        from: deployer,
        autoMine: true,
        log: true,
        deterministicDeployment: true,
    });
};
export default func;
func.id = "deploy_compatibilityFallbackHandler";
func.tags = [
    "CompatibilityFallbackHandler"
]