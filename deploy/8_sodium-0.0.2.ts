import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const entryPoint = await deployments.get("EntryPoint050");
    await deploy("Sodium002", {
        contract: "Sodium",
        deterministicDeployment: keccak256(toUtf8Bytes("Sodium002")),
        from: deployer,
        args: [
            entryPoint.address
        ],
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_sodium002";
func.tags = [
    "Sodium002"
]
func.dependencies = ["EntryPoint050"]