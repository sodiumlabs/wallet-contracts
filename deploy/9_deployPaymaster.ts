import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const entryPoint = await deployments.get("EntryPoint050");
    await deploy("DeployPaymaster", {
        deterministicDeployment: true,
        from: deployer,
        args: [
            entryPoint.address,
            deployer
        ],
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_paymaster";
func.tags = [
    "Paymaster"
]
func.dependencies = ["EntryPoint050"]