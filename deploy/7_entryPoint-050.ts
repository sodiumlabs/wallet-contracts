import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const senderCreator = await deployments.get("SenderCreator");

    await deploy("EntryPoint050", {
        contract: "EntryPoint",
        deterministicDeployment: keccak256(toUtf8Bytes("EntryPoint050")),
        from: deployer,
        args: [
            senderCreator.address
        ],
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_entryPoint050";
func.tags = [
    "EntryPoint050"
]
func.dependencies = ["SenderCreator"]