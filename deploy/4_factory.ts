import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy("Factory", {
        from: deployer,
        autoMine: true,
        log: true,
        args: [
        ],
        deterministicDeployment: true,
    });
};
export default func;
func.id = "deploy_factory";
func.tags = [
    "Factory"
]
func.dependencies = ["Sodium"]