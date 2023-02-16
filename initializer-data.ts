import { Interface } from '@ethersproject/abi';
import {
    Artifact,
  } from 'hardhat/types';

export function getInitializerData(
    artifact: Artifact,
    args: unknown[],
    initializer?: string | false,
): string {
    if (initializer === false) {
        return '0x';
    }

    const contractInterface: Interface = new Interface(artifact.abi);
    const allowNoInitialization = initializer === undefined && args.length === 0;
    initializer = initializer ?? 'initialize';

    try {
        const fragment = contractInterface.getFunction(initializer);
        return contractInterface.encodeFunctionData(fragment, args);
    } catch (e: unknown) {
        if (e instanceof Error) {
            if (allowNoInitialization && e.message.includes('no matching function')) {
                return '0x';
            }
        }
        throw e;
    }
}