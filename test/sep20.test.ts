import { expect } from "chai";
import { ethers } from "hardhat";
import { SEP20, SEP20__factory } from "../gen/typechain";
import { Signer } from 'ethers';

describe("SEP20", function () {
  let sep20: SEP20;
  let owner: Signer;
  let ownerAddress: string;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    ownerAddress = await owner.getAddress();
    const SEP20Factory = await ethers.getContractFactory("SEP20");
    const sep20contract = await SEP20Factory.connect(owner).deploy("MyToken", "MTK", 18, 1, "0x0000000000000000000000000000000000000000");
    sep20 = SEP20__factory.connect(sep20contract.address, owner);
    await sep20.deployed();
  });

  it("should mint tokens with empty data", async function () {
    const amount = 100;
    await sep20.mint(ownerAddress, amount, "0x");
    expect(await sep20.balanceOf(ownerAddress)).to.equal(amount);
  });

  it("should mint tokens with non-empty data", async function () {
    const owner = ownerAddress;
    const recipient = ethers.utils.getAddress("0x1234567890123456789012345678901234567890");
    const amount = 100;

        // // safeTransfer(address,uint256,bytes)
        // const data = ethers.utils.defaultAbiCoder.encode(["address", "uint256", "bytes"], ["0xD09f7c8C4529cB5D387Aa17E33d707C529a6f694", "100000000000000000000", "0x"])
        // // hex to bytes
        // const dataBytes = ethers.utils.arrayify(data);
        // // append sig
        // const dataBytesWithSig = ethers.utils.concat([ethers.utils.id("safeTransfer(address,uint256,bytes)"), dataBytes]);
        // // to hex
        // const dataHex = ethers.utils.hexlify(dataBytesWithSig);
        // const tr = await vault.connect(signer).transferERC20("0x80B42197c23FdC42Afe933C3332FA7888929c209", "100000000000000000000", dataHex);
    // const data = ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [recipient, amount]);
    const data = ethers.utils.defaultAbiCoder.encode(["address", "uint256", "bytes"], [recipient, amount, "0x"]);
    const dataBytes = ethers.utils.arrayify(data);
    const sig = ethers.utils.id("safeTransfer(address,uint256,bytes)").slice(0, 10);
    const dataBytesWithSig = ethers.utils.concat([sig, dataBytes]);
    const dataHex = ethers.utils.hexlify(dataBytesWithSig);

    console.debug(
        "sig: ", sig,
        "dataHex: ", dataHex
    );

    await sep20.mint(owner, amount, dataHex);
    expect(await sep20.balanceOf(owner)).to.equal(0);
    expect(await sep20.balanceOf(recipient)).to.equal(amount);
  });
});