import {
    Test1271External__factory,
    Test1271External
} from '../gen/typechain';
import { TransactionRequest, Provider } from '@ethersproject/providers';
import { TypedDataSigner } from '@ethersproject/abstract-signer';
import {
    Bytes,
    VoidSigner,
    Wallet,
    TypedDataDomain,
    TypedDataField
} from 'ethers';
import { Deferrable, defineReadOnly } from 'ethers/lib/utils';
import { deployContract } from './testutils';

export class MockWallet1271 extends VoidSigner implements TypedDataSigner {
    constructor(
        private owner: Wallet,
        private instance: Test1271External
    ) {
        super(instance.address);
    }

    async getAddress(): Promise<string> {
        return this.instance.address;
    }

    async signMessage(message: string | Bytes): Promise<string> {
        return this.owner.signMessage(message);
    }

    _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string> {
        return this.owner._signTypedData(domain, types, value);
    }

    signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
        throw new Error('Method not implemented.');
    }

    connect(provider: Provider): MockWallet1271 {
        throw new Error('Method not implemented.');
        // return new Wallet1271(this.owner, provider);
    }
}