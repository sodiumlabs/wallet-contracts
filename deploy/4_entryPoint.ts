import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getInitializerData } from '../initializer-data';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const senderCreator = await deployments.get("SenderCreator");

    // const entryPointArtifact = await deployments.getArtifact("EntryPoint")
    // const initializerData = getInitializerData(entryPointArtifact, [
    //     senderCreator.address
    // ]);

    await deploy("EntryPoint", {
        from: deployer,
        args: [

        ],
        proxy: {
            proxyArgs: ["{implementation}", "{data}"],
            execute: {
                init: {
                    methodName: "initialize",
                    args: [
                        senderCreator.address
                    ],
                },
            },
            proxyContract: "ERC1967Proxy",
        },
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