import fs from 'fs';
import { web3 } from "@project-serum/anchor"
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes"
import { Percent } from "@raydium-io/raydium-sdk"
import { AddressLookupTableProgram, ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { Metaplex, amount } from "@metaplex-foundation/js";
import { TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";

import axios from "axios";
export const METAPLEX = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

import { DEV_RPC, MAIN_RPC } from "./constant"

export const connection = new Connection(DEV_RPC);
export const solanaConnection = new Connection(DEV_RPC); //txHandler
export const devConnection = new Connection(DEV_RPC); //txHandler
const log = console.log;

export const sendMultiTx = async (ixs: TransactionInstruction[], wallet: Keypair): Promise<string> => {
    try {
        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
            ...ixs
        );
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], { skipPreflight: true });
        console.log('Transaction successful with signature:', signature);
        return signature;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
};

export const sendSingleTx = async (ixs: TransactionInstruction[], wallet: Keypair): Promise<string> => {
    try {
        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
            ...ixs
        );
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], { skipPreflight: true });
        console.log('Transaction successful with signature:', signature);
        return signature;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
};

export const saveDataToFile = (newData: string[], filePath: string) => {
    try {
        let existingData: string[] = [];

        // Check if the file exists
        if (fs.existsSync(filePath)) {
            // If the file exists, read its content
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
        }

        // Add the new data to the existing array
        existingData.push(...newData);

        // Write the updated data back to the file
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    } catch (error) {
        console.log('Error saving data to JSON file:', error);
    }
};

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function calcDecimalValue(value: number, decimals: number): number {
    return value / (Math.pow(10, decimals))
}

export async function sendAndConfirmTX(tx: web3.VersionedTransaction | web3.Transaction, connection: web3.Connection) {
    const rawTx = tx.serialize()
    const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed', maxRetries: 4 })
        .catch(async () => {
            await sleep(500)
            return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
                .catch((txError) => {
                    log({ txError })
                    return null
                })
        }))
    return txSignature
}

export async function getTokenMetadata(mintToken: string) {
    const metaplex = Metaplex.make(solanaConnection);

    const mintAddress = new PublicKey(mintToken);

    let tokenName;
    let tokenSymbol;
    let tokenLogo;

    const metadataAccount = metaplex
        .nfts()
        .pdas()
        .metadata({ mint: mintAddress });

    const metadataAccountInfo = await solanaConnection.getAccountInfo(metadataAccount);

    if (metadataAccountInfo) {
        const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
        tokenName = token.name;
        tokenSymbol = token.symbol;
        tokenLogo = token.json?.image;
    }
    return {
        tokenName,
        tokenSymbol,
        tokenLogo
    }
}

/** Get metaplex mint metadata account address */
export const getMetadata = async (mint: PublicKey): Promise<PublicKey> => {
    return (
        await PublicKey.findProgramAddress([Buffer.from('metadata'), METAPLEX.toBuffer(), mint.toBuffer()], METAPLEX)
    )[0];
};

export async function getTokenList(address: PublicKey) {

    const tokenList = await solanaConnection.getTokenAccountsByOwner(address, {
        programId: TOKEN_PROGRAM_ID
    });
    let data: any = [];

    if (tokenList.value.length > 0) {
        for (const item of tokenList.value) {
            const tokenAccountInfo = await solanaConnection.getParsedAccountInfo(item.pubkey);

            // @ts-ignore
            const meta = await getMetadata(new PublicKey(tokenAccountInfo.value?.data.parsed?.info.mint));

            try {
                const metdadataContent = await Metadata.fromAccountAddress(solanaConnection, meta);

                const detail = await axios.get(metdadataContent.pretty().data.uri);

                // @ts-ignore
                data.push({ ...metdadataContent.pretty(), ...detail.data, amount: tokenAccountInfo.value?.data.parsed?.info.tokenAmount.uiAmount });
            } catch (error) {
                console.log(error);
            }

        };
    }
    // console.log("data===>>>", data)

    return data;
}

export const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...' + text.substring(text.length - maxLength, text.length);
    }
    return text;
}

export const createLAT = async (wallet: any, inst: any, ) => {

    // const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    //     authority: wallet.publicKey,
    //     payer: wallet.publicKey,
    //     recentSlot: await solanaConnection.getSlot(),
    // });

    // const addAddressesInstruction = AddressLookupTableProgram.extendLookupTable({
    //     payer: wallet.publicKey,
    //     authority: wallet.publicKey,
    //     lookupTable: lookupTableAddress,
    //     // addresses: ,

    // });
    
    // const messageV0 = new TransactionMessage({
    //     payerKey: wallet.publicKey,
    //     instructions: [lookupTableInst],
    //     recentBlockhash: (await solanaConnection.getLatestBlockhash()).blockhash
    // }).compileToV0Message();

    // const fullTX = new VersionedTransaction(messageV0);
    // return fullTX;
}
