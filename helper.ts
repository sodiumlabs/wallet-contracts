export function is4337DeployerNetwork(chainId?: number): boolean {
    const undeployNetworks = [

        // hardhat local network
        31337,

        // sodium test network
        777,
    ];

    if (!chainId) {
        throw new Error("require chainId config");
    }

    return !undeployNetworks.includes(chainId);
}