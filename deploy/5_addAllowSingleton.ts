import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { Factory__factory } from '../gen/typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();
    const sodium = await deployments.get("Sodium");

    const factoryDeployment = await deployments.get("Factory");
    const factory = Factory__factory.connect(factoryDeployment.address, hre.ethers.provider);
    const isAllowSingleton = await factory.allowSingleton(sodium.address);
    if (!isAllowSingleton) {
        await factory.addAllowSingleton(sodium.address);
    }
};
export default func;
func.id = "deploy_factory";
func.tags = [
    "Add"
]
func.dependencies = ["Sodium", "Factory"]