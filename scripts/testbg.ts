import { ethers } from "hardhat";

async function main() {
    const signers = await ethers.getSigners();
    const signer = signers[19];
    const vaultAddress = "0x29eF3Aa5FB6525a579C88F12918Aac0BE5634BA8";
    const tokenAddress = "0x3A7a0346AA09B385A776D9c5a1A0976965396898";

    const token = await ethers.getContract("ERC20Token", tokenAddress);
    console.debug(await token.symbol());

    console.debug(await token.balanceOf("0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"), "balanceOf");

    await token.connect(signer).approve(vaultAddress, "100000000000000000000000000");

    console.debug("approve done.")

    const vault = await ethers.getContract("Vault", vaultAddress);

    // safeTransfer(address,uint256,bytes)
    const data = ethers.utils.defaultAbiCoder.encode(["address", "uint256", "bytes"], ["0xD09f7c8C4529cB5D387Aa17E33d707C529a6f694", "100000000000000000000", "0x"])
    // hex to bytes
    const dataBytes = ethers.utils.arrayify(data);
    // append sig
    const sig = ethers.utils.id("safeTransfer(address,uint256,bytes)").slice(0, 10);
    const dataBytesWithSig = ethers.utils.concat([sig, dataBytes]);
    // to hex
    const dataHex = ethers.utils.hexlify(dataBytesWithSig);
    console.debug("sig", sig, "data hex", dataHex);
    const tr = await vault.connect(signer).transferERC20(
        tokenAddress,
        "100000000000000000000", 
        dataHex
    );

    console.debug(await tr.wait(), "erc20 bg done.");

    const tr1 = await signer.sendTransaction({
        to: vaultAddress,
        value: "100000000000000000000"
    });

    console.debug(await tr1.wait());
}

main()