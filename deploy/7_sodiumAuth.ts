import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { keccak256 } from 'ethers/lib/utils';
import { toUtf8Bytes } from "@ethersproject/strings";
import { SodiumAuthWeighted__factory } from '../gen/typechain';
import { getSodiumNetworkAuthInitOperators } from '../init-operators';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();
    const latestOperator = getSodiumNetworkAuthInitOperators();

    await deploy("SodiumAuthWeighted", {
        deterministicDeployment: keccak256(toUtf8Bytes("SodiumAuthWeighted")),
        from: deployer,
        args: [
            [latestOperator.param],
            deployer
        ],
        autoMine: true,
        log: true
    });

    // check owner
    const d = await deployments.get("SodiumAuthWeighted")
    const opv = SodiumAuthWeighted__factory.connect(d.address, hre.ethers.provider);
    const owner = await opv.owner();
    if (owner.toLocaleLowerCase() != deployer.toLocaleLowerCase()) {
        throw new Error("owner x");
    }

    const currentEpoch = opv.currentEpoch();
    const currentHash = await opv.hashForEpoch(currentEpoch);
    if (currentHash.toLocaleLowerCase() != latestOperator.hash.toLocaleLowerCase()) {
        await opv.transferOperatorship(latestOperator.param);
    }
};
export default func;
func.id = "deploy_sodiumAuth";
func.tags = [
    "sodiumAuth"
]