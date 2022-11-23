const DefaultCallbackHandler = artifacts.require("DefaultCallbackHandler");
const CompatibilityFallbackHandler = artifacts.require("CompatibilityFallbackHandler");
const Migrations = artifacts.require("Migrations");
const { deployOnlyOnce } = require("../deploy-tools");

module.exports = async function (deployer, network, accounts) {
    const MigrationsI = await Migrations.deployed();

    await deployOnlyOnce(MigrationsI, DefaultCallbackHandler, []);
    await deployOnlyOnce(MigrationsI, CompatibilityFallbackHandler, []);
}