import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import hre from "hardhat";
import { StableCoinPaymaster__factory } from '../gen/typechain';

const paymaster = "0x7af2021fE52013A83405d585E62a1dEf661217C4";
const cost = "2000";
async function main() {
    const { deployer } = await hre.getNamedAccounts();
    const signer = await hre.ethers.getSigner(deployer);

    await signer.sendTransaction({
        to: paymaster,
        data: StableCoinPaymaster__factory.createInterface().encodeFunctionData("updateLatestCost", [cost]),
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});