import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getInitializerData } from '../initializer-data';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const senderCreator = await deployments.get("SenderCreator");
    await deploy("EntryPoint", {
        deterministicDeployment: true,
        from: deployer,
        args: [
            senderCreator.address
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
func.dependencies = ["SenderCreator"]