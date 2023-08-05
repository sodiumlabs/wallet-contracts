import { Bytes, Signer, ethers, utils, TypedDataField, VoidSigner } from 'ethers';
import { TypedDataSigner as EthersTypedDataSigner } from '@ethersproject/abstract-signer';

interface ITypedDataSigner extends EthersTypedDataSigner {
    getAddress(): Promise<string>;
}

// {0x01}{signer}{signature}
export const signType1 = async (signer: Signer, data: Bytes): Promise<string> => {
    const signature = await signer.signMessage(data);
    const address = await signer.getAddress();
    return utils.hexlify(utils.concat([
        "0x01",
        address,
        signature
    ]));
}

export type DelegateProof = {
    walletAddress: string,
    trustee: string,
    delegater: string,
    delegateExpires: number,
    proof: string
}

// keccak256("Delegate(address trustee,uint64 delegateExpires)");
function getDelegateTypedDataTypesAndValue(trustee: string, delegateExpires: number): { types: Record<string, Array<TypedDataField>>, value: Record<string, any> } {
    const types = {
        Delegate: [
            { name: 'trustee', type: 'address' },
            { name: 'delegateExpires', type: 'uint64' },
        ]
    }
    const value = {
        trustee: trustee,
        delegateExpires: delegateExpires,
    }
    return { types, value };
}

export const genDelegateProof = async (
    walletAddress: string, 
    trustee: string, 
    delegater: ITypedDataSigner,
    delegateExpires: number
): Promise<DelegateProof> => {
    const typeData = getDelegateTypedDataTypesAndValue(trustee, delegateExpires);
    const proof = await delegater._signTypedData({
        verifyingContract: walletAddress
    }, typeData.types, typeData.value);
    return {
        walletAddress,
        trustee,
        delegater: await delegater.getAddress(),
        delegateExpires,
        proof
    };
}

// {0x02}{trustee}{delegater}{delegateExpires}{signature}{delegateproof}
export const signType2 = async (signer: Signer, data: Bytes, delegateproof: DelegateProof): Promise<string> => {
    const signature = await signer.signMessage(data);
    const sig = ethers.utils.defaultAbiCoder.encode([
        "address",
        "address",
        "uint256",
        "bytes",
        "bytes"
    ], [
        delegateproof.trustee,
        delegateproof.delegater,
        delegateproof.delegateExpires,
        signature,
        delegateproof.proof,
    ]);
    return utils.hexlify(utils.concat([
        "0x02",
        sig
    ]));
}