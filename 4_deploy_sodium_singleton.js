const Sodium = artifacts.require("Sodium");
const Migrations = artifacts.require("Migrations");
const { deployOnlyOnce } = require("../deploy-tools");

module.exports = async function (deployer, network, accounts) {
    const MigrationsI = await Migrations.deployed();

    await deployOnlyOnce(MigrationsI, Sodium, []);
}