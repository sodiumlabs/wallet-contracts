const EntryPoint = artifacts.require("EntryPoint");
const Migrations = artifacts.require("Migrations");
const { deployOnlyOnce } = require("../deploy-tools");

module.exports = async function (deployer, network, accounts) {
    const MigrationsI = await Migrations.deployed();
    const globalUnstakeDelaySec = 2;
    const paymasterStake = ethers.utils.parseEther('2');

    await deployOnlyOnce(MigrationsI, EntryPoint, []);
}