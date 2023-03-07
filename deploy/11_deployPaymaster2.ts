import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy("DeployPaymaster", {
        deterministicDeployment: keccak256(toUtf8Bytes("Sodium002")),
        from: deployer,
        args: [
            "0x0aE1B76389397Dc81c16eB8e2dEb0C592D3C873c",
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