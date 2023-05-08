import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy("SodiumUserOperationValidator", {
        deterministicDeployment: keccak256(toUtf8Bytes("SodiumUserOperationValidator")),
        proxy: {
            proxyContract: "ERC1967Proxy",
            proxyArgs: [
                "{implementation}",
                "{data}"
            ],
            execute: {
                methodName: "initialize",
                args: [
                    deployer
                ]
            }
        },
        from: deployer,
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_opValidator";
func.tags = [
    "opValidator"
]