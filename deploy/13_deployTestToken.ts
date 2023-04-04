import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    if (network.config.chainId != 31337) {
        console.log("Skipping deployment not on local network");
        return;
    }

    const { deployer } = await getNamedAccounts();

    await deploy("ERC20Token", {
        deterministicDeployment: keccak256(toUtf8Bytes("TestERC20")),
        from: deployer,
        args: [
            "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
        ],
        autoMine: true,
        log: true
    })
};
export default func;
func.id = "deploy_testerc20token";
func.tags = [
    "TestERC20Token"
]