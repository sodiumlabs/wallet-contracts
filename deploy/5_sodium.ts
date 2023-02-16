import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const entryPoint = await deployments.get("EntryPoint");
    await deploy("Sodium", {
        deterministicDeployment: true,
        from: deployer,
        args: [
            entryPoint.address
        ],
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_sodium";
func.tags = [
    "Sodium"
]
func.dependencies = ["EntryPoint"]