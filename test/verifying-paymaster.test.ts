import { expect } from "chai";
import { ethers } from "hardhat";
import {
    EntryPoint,
    VerifyingSingletonPaymaster,
    VerifyingSingletonPaymaster__factory,
    EntryPoint__factory,
} from "../gen/typechain";
import { AddressZero } from "./testutils";
import { parseEther } from "ethers/lib/utils";
import { Signer } from "ethers";

export async function deployEntryPoint(
    provider = ethers.provider
): Promise<EntryPoint> {
    const epf = await (await ethers.getContractFactory("EntryPoint")).deploy();
    return EntryPoint__factory.connect(epf.address, provider.getSigner());
}

describe("EntryPoint with VerifyingPaymaster Singleton", function () {
    let entryPoint: EntryPoint;
    let depositorSigner: Signer;
    let walletOwner: Signer;
    let walletAddress: string, paymasterAddress: string;
    let accounts: any;

    let offchainSigner: Signer, deployer: Signer;

    let verifyingSingletonPaymaster: VerifyingSingletonPaymaster;

    before(async function () {
        accounts = await ethers.getSigners();
        entryPoint = await deployEntryPoint();

        deployer = accounts[0];
        offchainSigner = accounts[1];
        depositorSigner = accounts[2];
        walletOwner = deployer; // accounts[3];

        const offchainSignerAddress = await offchainSigner.getAddress();

        verifyingSingletonPaymaster =
            await new VerifyingSingletonPaymaster__factory(deployer).deploy(
                entryPoint.address,
                await deployer.getAddress(),
                offchainSignerAddress
            );

        paymasterAddress = verifyingSingletonPaymaster.address;
        console.log("Paymaster address is ", paymasterAddress);

        await entryPoint.depositTo(paymasterAddress, { value: parseEther("2") });
    });

    describe("getBalance: get the current deposit for paymasterId", () => {
        it("getBalance: return zero if no deposit", async () => {
            const paymasterId = await depositorSigner.getAddress();
            const bal = await verifyingSingletonPaymaster.getBalance(paymasterId);
            expect(bal).to.be.equal(0);
        });

        it("getBalance: returns deposit of paymaster", async () => {
            const paymasterId = await depositorSigner.getAddress();
            await verifyingSingletonPaymaster.depositFor(paymasterId, {
                value: parseEther("1"),
            });
            const bal = await verifyingSingletonPaymaster.getBalance(paymasterId);
            expect(bal).to.be.equal(parseEther("1"));
        });

        it("deposit: should revert this", async () => {
            const tx = verifyingSingletonPaymaster.deposit({
                value: ethers.utils.parseEther("1"),
            });
            await expect(tx).to.be.revertedWith("user DepositFor instead");
        });

        it("withdrawTo: should be able to withdraw to any address", async () => {
            const paymasterId = await depositorSigner.getAddress();
            const paymasterIdDepositBefore =
                await verifyingSingletonPaymaster.getBalance(paymasterId);
            const tx = verifyingSingletonPaymaster
                .connect(deployer)
                .withdrawTo(AddressZero, parseEther("0.5"));
            expect(tx).to.be.revertedWith("CanNotWithdrawToZeroAddress");

            await verifyingSingletonPaymaster
                .connect(depositorSigner)
                .withdrawTo(paymasterId, parseEther("0.5"));

            const paymasterIdDepositAfter =
                await verifyingSingletonPaymaster.getBalance(paymasterId);

            expect(paymasterIdDepositBefore.sub(paymasterIdDepositAfter)).to.be.equal(
                parseEther("0.5")
            );
        });

        it("setSigner: should be able to set signer", async () => {
            const tx1 = verifyingSingletonPaymaster
                .connect(deployer)
                .setSigner(AddressZero);
            expect(tx1).to.be.revertedWith("VerifyingSignerCannotBeZero");

            const newSigner = await accounts[5].address;
            const tx2 = await verifyingSingletonPaymaster
                .connect(deployer)
                .setSigner(newSigner);
            expect(tx2).to.emit(
                verifyingSingletonPaymaster,
                "VerifyingSignerChanged"
            );
        });
    });
});