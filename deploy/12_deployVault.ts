import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    if (network.config.chainId == 777) {
        console.log("Skipping deployment on sodium network");
        return;
    }

    const { deployer } = await getNamedAccounts();

    await deploy("Vault", {
        deterministicDeployment: keccak256(toUtf8Bytes("Vault")),
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
func.id = "deploy_vault";
func.tags = [
    "Vault"
]