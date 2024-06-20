import { Wallet, web3 } from "@project-serum/anchor";
import { BaseMpl } from "../base/baseMpl";
import { BaseRay } from "../base/baseRay";
import { BaseSpl } from "../base/baseSpl";
import { Result } from "../base/types";
import base58 from "bs58"
import { AddLiquidityInput, BundleRes, CreateAndBuy, CreateMarketInput, CreatePoolInput, CreatePoolInputAndProvide, CreateTokenInput, CreateTaxTokenInput, UpdateTokenInput, MintTokenInput, RFTokenInput, RemoveLiquidityInput, SwapInput } from "./types";
// import { calcDecimalValue, sendAndConfirmTX, sleep } from "./utils";
import { Metadata, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { AccountLayout, MintLayout, NATIVE_MINT, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createCloseAccountInstruction, getAssociatedTokenAddressSync, createMintToCheckedInstruction, getMint, createInitializePermanentDelegateInstruction } from '@solana/spl-token'
// import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
// import { bundle } from "jito-ts";
import { Liquidity, LiquidityPoolInfo, Percent, Token, TokenAmount } from "@raydium-io/raydium-sdk";
import BN from "bn.js";
import { Keypair, PublicKey, Transaction, Connection, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import type { TokenMetadata } from '@solana/spl-token-metadata';
import {
    ExtensionType,
    createInitializeMintInstruction,
    mintTo,
    createAccount,
    getMintLen,
    getTransferFeeAmount,
    unpackAccount,
    TOKEN_2022_PROGRAM_ID,
    createInitializeTransferFeeConfigInstruction,
    harvestWithheldTokensToMint,
    transferCheckedWithFee,
    withdrawWithheldTokensFromAccounts,
    withdrawWithheldTokensFromMint,
    getOrCreateAssociatedTokenAccount,
    createAssociatedTokenAccountIdempotent,
    createInitializeMetadataPointerInstruction,
    LENGTH_SIZE,
    TYPE_SIZE,
    AccountState,
    createInitializeDefaultAccountStateInstruction,
    createInitializeNonTransferableMintInstruction
} from '@solana/spl-token';

import {
    createInitializeInstruction,
    pack,
    createUpdateFieldInstruction,
    createRemoveKeyInstruction,
} from '@solana/spl-token-metadata';


import { BLOCKENGINE_URL, JITO_AUTH_KEYPAIR } from "./constant";
import { solanaConnection, devConnection, createLAT } from "./utils";
import { VersionedTransaction } from "@solana/web3.js";
const log = console.log;

// const data = JSON.parse(fs.readFileSync("./data.json", `utf8`))
// const PRIVATE_KEY = data.privKey
// const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
const COMPUTE_UNIT_PRICE = 1_800_000 // default: 200_000

export async function createToken(input: CreateTokenInput) {
    try {
        const { decimals, name, symbol, url, initialMintingAmount, metaUri, mintRevokeAuthorities, freezeRevokeAuthorities, mutable, wallet } = input;
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })
        const res = await baseMpl.createToken({
            name,
            uri: metaUri,
            symbol,
            sellerFeeBasisPoints: 0,
            isMutable: !mutable,
            tokenStandard: TokenStandard.Fungible,
            creators: [{ address: wallet.publicKey, share: 100 }]
        }, {
            decimal: decimals,
            mintAmount: initialMintingAmount ?? 0,
            mintRevokeAuthorities,
            freezeRevokeAuthorities,
        })
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function createTaxToken(input: CreateTaxTokenInput) {
    try {
        const { name, symbol, decimals, url, metaUri, initialMintingAmount, feeRate, maxFee, authWallet, withdrawWallet, useExtenstion, permanentWallet, defaultAccountState, bearingRate, transferable, wallet } = input;
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint;

        console.log("input=========>>>", input);

        // Initialize connection to local Solana node
        const connection = new Connection(endpoint, 'confirmed');


        // Generate keys for payer, mint authority, and mint
        const payer = wallet;
        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;

        // Generate keys for transfer fee config authority and withdrawal authority
        const transferFeeConfigAuthority = authWallet;
        const withdrawWithheldAuthority = withdrawWallet;

        // Define the extensions to be used by the mint
        const extensions = [
            ExtensionType.TransferFeeConfig,
            ExtensionType.MetadataPointer
        ];

        if (permanentWallet) {
            extensions.push(ExtensionType.PermanentDelegate)
        }

        if (useExtenstion) {
            extensions.push(ExtensionType.DefaultAccountState)
        }

        if (transferable) {
            extensions.push(ExtensionType.NonTransferable)
        }

        // Calculate the length of the mint
        const mintLen = getMintLen(extensions);
        console.log("mintLen====?>>>", mintLen);

        // Set the decimals, fee basis points, and maximum fee
        const feeBasisPoints = 100 * feeRate; // 1%
        const maxFees = BigInt(maxFee * Math.pow(10, decimals)); // 9 tokens

        // Define the amount to be minted and the amount to be transferred, accounting for decimals
        const mintAmount = BigInt(initialMintingAmount * Math.pow(10, decimals)); // Mint 1,000,000 tokens

        const metadata: TokenMetadata = {
            mint: mint,
            name: name,
            symbol: symbol,
            uri: metaUri,
            additionalMetadata: []
        };

        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

        // Step 2 - Create a New Token
        const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

        const mintTransaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint,
                space: mintLen,
                lamports: mintLamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeMetadataPointerInstruction(
                mint,
                payer.publicKey,
                mint,
                TOKEN_2022_PROGRAM_ID
            ),
            createInitializeTransferFeeConfigInstruction(
                mint,
                transferFeeConfigAuthority,
                withdrawWithheldAuthority,
                feeBasisPoints,
                maxFees,
                TOKEN_2022_PROGRAM_ID
            )
        );

        if (permanentWallet) {
            mintTransaction.add(
                createInitializePermanentDelegateInstruction(
                    mint,
                    permanentWallet,
                    TOKEN_2022_PROGRAM_ID
                )
            )
        }

        if (useExtenstion) {

            const defaultState = AccountState.Initialized;
            mintTransaction.add(
                createInitializeDefaultAccountStateInstruction(mint, defaultState, TOKEN_2022_PROGRAM_ID),
            )

        }

        // if (bearingRate) {
        //     mintTransaction.add(
        //         // add a custom field
        //         createUpdateFieldInstruction({
        //             metadata: mint,
        //             updateAuthority: payer.publicKey,
        //             programId: TOKEN_2022_PROGRAM_ID,
        //             field: 'bearingRate',
        //             value: bearingRate.toString(),
        //         }),
        //     )
        // }

        if (transferable) {
            console.log("sssss");
            mintTransaction.add(
                createInitializeNonTransferableMintInstruction(mint, TOKEN_2022_PROGRAM_ID)
            )
        }

        mintTransaction.add(
            createInitializeMintInstruction(mint, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
            createInitializeInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                mint: mint,
                metadata: mint,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                mintAuthority: payer.publicKey,
                updateAuthority: payer.publicKey
            })
        )

        // const tokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
        // mintTransaction.add(
        //     createAssociatedTokenAccountInstruction(wallet.publicKey, tokenAccount, wallet.publicKey, mint,TOKEN_2022_PROGRAM_ID),
        //     // createMintToCheckedInstruction(
        //     //     mint, // mint
        //     //     tokenAccount, // receiver (should be a token account)
        //     //     wallet.publicKey, // mint authority
        //     //     mintAmount, // amount. if your decimals is 8, you mint 10^8 for 1 token.
        //     //     decimals, // decimals
        //     //     [],
        //     //     TOKEN_2022_PROGRAM_ID
        //     //     // [signer1, signer2 ...], // only multisig account will use
        //     // )
        // )

        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        mintTransaction.recentBlockhash = recentBlockhash;
        mintTransaction.feePayer = wallet.publicKey;
        mintTransaction.sign(mintKeypair);

        const simRes = (await connection.simulateTransaction(mintTransaction)).value
        console.log('mintTransaction l', simRes)

        return {
            mint,
            mintTransaction
        }
            
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function updateToken(input: UpdateTokenInput) {
    try {
        const { mint, name, symbol, url, metaUri, mintRevokeAuthorities, freezeRevokeAuthorities, mutable, wallet } = input;
        // const keyAuthI = Keypair.fromSecretKey(bs58.decode(keyAuth));
        // const wallet = new Wallet(keyAuthI)
        console.log("mutable---->>>>", mutable);
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })
        const res = await baseMpl.getUpdateMetadataIx(
            mint,
            wallet.publicKey,
            {
                name,
                uri: metaUri,
                symbol,
                mintRevokeAuthorities,
                freezeRevokeAuthorities,
                isMutable: !mutable
            })
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function mintToken(input: MintTokenInput) {
    try {
        const { mint, url, mintingAmount, wallet } = input;

        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint;

        const tokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);

        const decimal = (await getMint(solanaConnection, mint)).decimals;
        const amount = mintingAmount * (10 ** decimal);

        let tx = new web3.Transaction().add(
            createMintToCheckedInstruction(
                mint, // mint
                tokenAccount, // receiver (should be a token account)
                wallet.publicKey, // mint authority
                amount, // amount. if your decimals is 8, you mint 10^8 for 1 token.
                decimal // decimals
                // [signer1, signer2 ...], // only multisig account will use
            )
        );

        const blockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = blockhash;
        return tx;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function removeFreezeAuth(input: RFTokenInput) {
    try {
        const { mint, url, wallet } = input;
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })
        const res = await baseMpl.getUpdateAuthorityIx(mint, wallet.publicKey, true, false)
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function removeMintAuth(input: RFTokenInput) {
    try {
        const { mint, url, wallet } = input;
        // const keyAuthI = Keypair.fromSecretKey(bs58.decode(keyAuth));
        // const wallet = new Wallet(keyAuthI)
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })
        const res = await baseMpl.getUpdateAuthorityIx(mint, wallet.publicKey, true, false)
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function makeImmutableToken(input: any) {
    try {
        const { mint, tokenMeta, url, wallet } = input;
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })

        const res = await baseMpl.getUpdateMetadataIx(
            mint,
            wallet.publicKey,
            {
                name: tokenMeta.name,
                uri: tokenMeta.data.uri,
                symbol: tokenMeta.symbol,
                mintRevokeAuthorities: false,
                freezeRevokeAuthorities: false,
                mutable: false
            })
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function getPoolKeyInfo(poolId: PublicKey, url: string) {
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })

    return poolKeys;

}

export async function addLiquidity(input: AddLiquidityInput) {
    const { amount, amountSide, poolId, url, wallet } = input
    const user = wallet;
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })

    if (!poolKeys) return;
    const amountInfo = await baseRay.computeAnotherAmount({ amount, fixedSide: amountSide, poolKeys, isRawAmount: false }).catch(computeAnotherAmountError => { log({ computeAnotherAmount: computeAnotherAmountError }); return null })
    if (!amountInfo) return;
    const { baseMintAmount, liquidity, quoteMintAmount, } = amountInfo
    const txInfo = await baseRay.addLiquidity({ baseMintAmount, fixedSide: amountSide, poolKeys, quoteMintAmount, user: wallet.publicKey }).catch(addLiquidityError => { log({ addLiquidityError }); return null })
    if (!txInfo) return;
    const { ixs } = txInfo

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const tx = new web3.Transaction().add(updateCuIx, ...ixs)
    tx.feePayer = wallet.publicKey
    tx.recentBlockhash = recentBlockhash
    // tx.sign(keypair)

    return tx;
}
// export async function removeLiquidityFaster(input: RemoveLiquidityInput): Promise<Result<{ txSignature: string }, string>> {
//     const { amount, poolId, url, } = input
//     const user = keypair.publicKey
//     const connection = new web3.Connection(input.url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
//     const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
//     const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })
//     if (!poolKeys) return { Err: "Pool not found" }
//     const txInfo = await baseRay.removeLiquidityFaster({ amount, poolKeys, user }).catch(removeLiquidityError => { log({ removeLiquidityError }); return null })
//     if (!txInfo) return { Err: "failed to prepare tx" }
//     if (txInfo.Err) return { Err: txInfo.Err }
//     if (!txInfo.Ok) return { Err: "failed to prepare tx" }
//     const userSplAta = getAssociatedTokenAddressSync(NATIVE_MINT, user)
//     const initSplAta = createAssociatedTokenAccountInstruction(user, userSplAta, user, NATIVE_MINT)
//     const ixs = [initSplAta, ...txInfo.Ok.ixs]
//     const userSolAta = getAssociatedTokenAddressSync(NATIVE_MINT, user)
//     if (input.unwrapSol) ixs.push(createCloseAccountInstruction(userSolAta, user, user))

//     // speedup
//     const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE * 3 })
//     const tx = new web3.Transaction().add(updateCuIx, ...ixs)
//     tx.feePayer = keypair.publicKey
//     const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//     tx.recentBlockhash = recentBlockhash
//     tx.sign(keypair)
//     const handlers: Promise<void>[] = []
//     for (let i = 0; i < 4; ++i) {
//         const handle = connection.sendTransaction(tx, [keypair], { skipPreflight: true }).catch(sendTxError => { return null }).then((res) => {
//             if (res) {
//                 log(`lightning try: ${i + 1} | txSignature: ${res}`)
//             }
//         });
//         handlers.push(handle)
//     }
//     for (let h of handlers) {
//         await h
//     }

//     const rawTx = tx.serialize()
//     const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
//         .catch(async () => {
//             console.log("remove liq tx1 failed")
//             await sleep(500)
//             console.log("sending remove liq tx2")
//             return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
//                 .catch((createPoolAndBuyTxFail) => {
//                     log({ createPoolAndBuyTxFail })
//                     return null
//                 })
//         }))
//     console.log("confirmed remove liq tx")
//     // const res = await connection.sendTransaction(tx, [keypair]).catch(sendTxError => { log({ sendTxError }); return null });
//     if (!txSignature) return { Err: "failed to send the transaction" }
//     return { Ok: { txSignature } }
// }

export async function removeLiquidity(input: RemoveLiquidityInput) {
    const { amount, poolId, url, wallet } = input
    const user = wallet.publicKey
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })
    if (!poolKeys) return;
    const txInfo = await baseRay.removeLiquidity({ amount, poolKeys, user }).catch(removeLiquidityError => { log({ removeLiquidityError }); return null })
    if (!txInfo) return;
    if (txInfo.Err) return;
    if (!txInfo.Ok) return;
    const ixs = txInfo.Ok.ixs
    const userSolAta = getAssociatedTokenAddressSync(NATIVE_MINT, user)
    if (input.unwrapSol) ixs.push(createCloseAccountInstruction(userSolAta, user, user))

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE * 3 })
    const tx = new web3.Transaction().add(updateCuIx, ...ixs)
    tx.feePayer = wallet.publicKey
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.recentBlockhash = recentBlockhash
    // tx.sign(keypair)

    const simRes = (await connection.simulateTransaction(tx)).value
    console.log('remove l', simRes)

    const handlers: Promise<void>[] = []
    // for (let i = 0; i < 4; ++i) {
    //     const handle = connection.sendTransaction(tx, [keypair], { skipPreflight: true }).catch(sendTxError => { return null }).then((res) => {
    //         if (res) {
    //             log(`try: ${i + 1} | txSignature: ${res}`)
    //         }
    //     });
    //     handlers.push(handle)
    // }
    // for (let h of handlers) {
    //     await h
    // }

    // const rawTx = tx.serialize()
    console.log("sending remove liq tx")
    // const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
    //     .catch(async () => {
    //         console.log("remove liq tx1 failed")
    //         await sleep(500)
    //         console.log("sending remove liq tx2")
    //         return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
    //             .catch((createPoolAndBuyTxFail) => {
    //                 log({ createPoolAndBuyTxFail })
    //                 return null
    //             })
    //     }))
    // console.log("confirmed remove liq tx")
    // const res = await connection.sendTransaction(tx, [keypair]).catch(sendTxError => { log({ sendTxError }); return null });
    // if (!txSignature) return { Err: "failed to send the transaction" }
    return tx;
}

export async function createMarket(input: CreateMarketInput) {
    const { baseMint, orderSize, priceTick, quoteMint, url, wallet, eventLength, requestLength, orderBookLength } = input

    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    log('preTxInfo...')
    const preTxInfo = await baseRay.createMarket({ baseMint, quoteMint, eventLength, requestLength, orderBookLength, tickers: { lotSize: orderSize, tickSize: priceTick } }, wallet.publicKey).catch(createMarketError => { return null })
    log('preTxInfo done')
    if (!preTxInfo) {
        return;
        // return { Err: "Failed to prepare market creation transaction" }
    }
    if (preTxInfo.Err) {
        log(preTxInfo.Err)
        // return { Err: preTxInfo.Err }
        return;
    }
    // if (!preTxInfo.Ok) return { Err: "failed to prepare tx" }
    if (!preTxInfo.Ok) return;
    const { marketId } = preTxInfo.Ok
    log('marketId', marketId)
    try {
        console.log("preparing create market")
        const payer = wallet.publicKey
        const info = preTxInfo.Ok
        // speedup
        const updateCuIx1 = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
        const recentBlockhash1 = (await connection.getLatestBlockhash()).blockhash;
        const tx1 = new web3.Transaction().add(updateCuIx1, ...info.vaultInstructions)
        tx1.feePayer = wallet.publicKey
        tx1.recentBlockhash = recentBlockhash1
        tx1.sign(...info.vaultSigners);
        console.log("sending vault instructions tx")

        console.log("tx1=========>>>>", tx1);
        // const txSignature1 = await connection.sendTransaction(tx1, [keypair, ...info.vaultSigners], { skipPreflight: true })
        // console.log("awaiting vault instructions tx")
        // await connection.confirmTransaction(txSignature1)
        // console.log("confirmed vault instructions tx")   

        const updateCuIx2 = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
        const recentBlockhash2 = (await connection.getLatestBlockhash()).blockhash;
        const tx2 = new web3.Transaction().add(updateCuIx2, ...info.marketInstructions)
        tx2.feePayer = wallet.publicKey
        tx2.recentBlockhash = recentBlockhash2
        tx2.sign(...info.marketSigners);

        // const tx2 = new web3.Transaction().add(...info.marketInstructions)
        // console.log("sending create market tx");
        // let { blockhash } = await solanaConnection.getLatestBlockhash();

        // const message = new web3.TransactionMessage({
        //     payerKey: wallet.publicKey, // Public key of the account that will pay for the transaction
        //     recentBlockhash: blockhash, // Latest blockhash
        //     instructions: info.marketInstructions, // Instructions included in transaction
        // }).compileToV0Message();

        // const tx2 = new web3.VersionedTransaction(message);

        // const txSignature = await connection.sendTransaction(tx2, [...info.marketSigners], { skipPreflight: true })
        // console.log("awaiting create market tx")
        // await connection.confirmTransaction(txSignature, 'finalized')
        // console.log("confirmed create market tx")

        // Todo
        // let accountInfo = await connection.getAccountInfo(info.marketId)
        // while (!accountInfo) {
        //     console.log('sleep')
        //     await sleep(2_000)
        //     accountInfo = await connection.getAccountInfo(info.marketId)
        //     // if (!accountInfo) {
        //     //     return {
        //     //         Err: `Failed to verify market creation. marketId: ${marketId.toBase58()}`
        //     //     }
        //     // }
        // }

        const res = {
            marketId: marketId.toBase58(),
            tx1,
            tx2
        }
        return res
    } catch (error) {
        log({ error })
        // return { Err: "failed to send the transaction" }
    }
}

export async function createPool(input: CreatePoolInput) {
    let { baseMintAmount, quoteMintAmount, marketId, url, wallet, launchTime } = input
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint)
    console.log("marketId=======>>>>", marketId.toBase58());
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const marketState = await baseRay.getMarketInfo(marketId).catch((getMarketInfoError) => { log({ getMarketInfoError }); return null })
    // log({marketState})
    if (!marketState) {
        // return { Err: "market not found" }
        return;
    }
    console.log("marketState====>>", marketState);
    const { baseMint, quoteMint } = marketState;
    // log({
    //     baseToken: baseMint.toBase58(),
    //     quoteToken: quoteMint.toBase58(),
    // })
    const txInfo = await baseRay.createPool({ baseMint, quoteMint, marketId, baseMintAmount, quoteMintAmount, launchTime }, wallet.publicKey).catch((innerCreatePoolError) => { log({ innerCreatePoolError }); return null })
    if (!txInfo) {
        // return { Err: "Failed to prepare create pool transaction" }
        return;
    }

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    // const txMsg = new web3.TransactionMessage({
    //     instructions: [updateCuIx, ...txInfo.ixs],
    //     payerKey: wallet.publicKey,
    //     recentBlockhash,
    // }).compileToV0Message()
    const tx = new web3.Transaction().add(updateCuIx, ...txInfo.ixs)
    tx.feePayer = wallet.publicKey
    tx.recentBlockhash = recentBlockhash

    // tx.sign(...txInfo.signers)

    // const tx = new web3.VersionedTransaction(txMsg)
    // tx.sign([...txInfo.signers])
    // const rawTx = tx.serialize()
    console.log("PoolId: ", txInfo.poolId.toBase58())
    console.log("SENDING CREATE POOL TX")
    // const simRes = (await connection.simulateTransaction(tx)).value
    // const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
    //     .catch(async () => {
    //         await sleep(500)
    //         return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
    //             .catch((createPoolAndBuyTxFail) => {
    //                 log({ createPoolAndBuyTxFail })
    //                 return null
    //             })
    //     }))
    // console.log("CONFIRMED CREATE POOL TX")
    // if (!txSignature) log("Tx failed")
    // // const txSignature = await connection.sendTransaction(tx).catch((error) => { log({ createPoolTxError: error }); return null });
    // if (!txSignature) {
    //     return { Err: "Failed to send transaction" }
    // }

    const result = {
        poolId: txInfo.poolId.toBase58(),
        tx,
        baseAmount: txInfo.baseAmount,
        quoteAmount: txInfo.quoteAmount,
        baseDecimals: txInfo.baseDecimals,
        quoteDecimals: txInfo.quoteDecimals,
    }

    log(result)

    return result
}

// // export async function createPoolAndProvide(input: CreatePoolInputAndProvide): Promise<Result<{
// //     bundleId: string;
// //     poolId: string;
// //     createPoolTxSignature: string;
// //     bundleStatus: number;
// // }, {
// //     bundleId: string;
// //     poolId: string;
// // } | string>> {
// export async function createPoolAndProvide(input: CreatePoolInputAndProvide) {
//     let { baseMintAmount, quoteMintAmount, marketId, amount } = input
//     const connection = new web3.Connection(input.url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint)
//     const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
//     console.log('marketId', marketId)
//     const marketState = await baseRay.getMarketInfo(marketId).catch((getMarketInfoError) => { log({ getMarketInfoError }); return null })
//     // log({marketState})
//     if (!marketState) {
//         return { Err: "market not found" }
//     }
//     const { baseMint, quoteMint } = marketState
//     log({
//         baseToken: baseMint.toBase58(),
//         quoteToken: quoteMint.toBase58(),
//     })
//     const txInfo = await baseRay.createPool({ baseMint, quoteMint, marketId, baseMintAmount, quoteMintAmount }, keypair.publicKey).catch((innerCreatePoolError) => { log({ innerCreatePoolError }); return null })
//     if (!txInfo) return { Err: "Failed to prepare create pool transaction" }


//     const createPoolRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
//         await sleep(2_000)
//         return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
//             log({ getLatestBlockhashError })
//             return null
//         })
//     }))?.blockhash;
//     if (!createPoolRecentBlockhash) return { Err: "Failed to prepare transaction" }
//     const createPoolTxMsg = new web3.TransactionMessage({
//         instructions: txInfo.ixs,
//         payerKey: keypair.publicKey,
//         recentBlockhash: createPoolRecentBlockhash
//     }).compileToV0Message()
//     const createPoolTx = new web3.VersionedTransaction(createPoolTxMsg)
//     createPoolTx.sign([keypair, ...txInfo.signers])

//     // bundling
//     {
//         const simRes = (await connection.simulateTransaction(createPoolTx))
//         console.log('create pool sim', simRes)
//         fs.writeFileSync('./cretePoollog.json', JSON.stringify(simRes))
//         const rawTx = createPoolTx.serialize()
//         const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' }))
//         console.log('create txSignature', txSignature)
//     }

//     const buyTxes: VersionedTransaction[] = []

//     buyTxes.push(createPoolTx)

//     for (let i = 0; i < input.wallets.length; i++) {
//         const wallet: Keypair = Keypair.fromSecretKey(new Uint8Array(input.wallets[i].secretkey.split(',').map(Number)))

//         // buy tx
//         console.log('buy tx ---')
//         const { poolId, baseAmount: initialBaseMintAmount, quoteAmount: initialQuoteMintAmount } = txInfo;

//         const poolKeys = await baseRay.getPoolKeys(poolId)
//         let amountIn: TokenAmount
//         let amountOut: TokenAmount
//         let tokenAccountIn: web3.PublicKey
//         let tokenAccountOut: web3.PublicKey
//         const baseR = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals)
//         const quoteR = new Token(TOKEN_PROGRAM_ID, poolKeys.quoteMint, poolKeys.quoteDecimals)
//         const poolInfo: LiquidityPoolInfo = {
//             baseDecimals: poolKeys.baseDecimals,
//             quoteDecimals: poolKeys.quoteDecimals,
//             lpDecimals: poolKeys.lpDecimals,
//             lpSupply: new BN(0),
//             baseReserve: initialBaseMintAmount,
//             quoteReserve: initialQuoteMintAmount,
//             startTime: null as any,
//             status: null as any
//         }
//         console.log('poolInfo', poolInfo)
//         amountIn = new TokenAmount(quoteR, (amount / 2).toString(), false)
//         amountOut = new TokenAmount(baseR, 0, false)
//         // amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: quoteR, poolInfo, poolKeys, slippage: new Percent(1, 100) }).maxAmountIn as TokenAmount
//         tokenAccountOut = getAssociatedTokenAddressSync(poolKeys.baseMint, wallet.publicKey)
//         tokenAccountIn = getAssociatedTokenAddressSync(poolKeys.quoteMint, wallet.publicKey)
//         console.log('token accounts info', tokenAccountIn, tokenAccountOut, wallet.publicKey)

//         console.log('-----------', tokenAccountIn, tokenAccountOut)
//         // const [userAccountInfo, ataInfo] = await connection.getMultipleAccountsInfo([wallet.publicKey, tokenAccountIn]).catch(() => [null, null, null])
//         const buyFromPoolTxInfo = await baseRay.buyFromPool({
//             amountIn, amountOut, fixedSide: 'in', poolKeys, tokenAccountIn, tokenAccountOut, user: wallet.publicKey
//         }).catch((innerBuyTxError) => { log({ innerBuyTxError }); return null })
//         if (!buyFromPoolTxInfo) return { Err: "Failed to create buy transaction" }

//         const buyRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
//             await sleep(2_000)
//             return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
//                 log({ getLatestBlockhashError })
//                 return null
//             })
//         }))?.blockhash;
//         if (!buyRecentBlockhash) return { Err: "Failed to prepare transaction" }
//         const buyTxMsg = new web3.TransactionMessage({
//             instructions: buyFromPoolTxInfo.ixs,
//             payerKey: wallet.publicKey,
//             recentBlockhash: buyRecentBlockhash
//         }).compileToV0Message()
//         const buyTx = new web3.VersionedTransaction(buyTxMsg)
//         buyTx.sign([wallet, ...buyFromPoolTxInfo.signers])
//         console.log('here')
//         {
//             const buysimRes = (await connection.simulateTransaction(buyTx))
//             console.log('buysimRes', buysimRes)

//             const rawBuyTx = buyTx.serialize()
//             const buyTxSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawBuyTx), { commitment: 'confirmed' }))
//             log('buyTxSignature', buyTxSignature)
//         }
//         buyTxes.push(buyTx)
//     }

//     return {
//         Ok: {
//             poolId: txInfo.poolId.toBase58(),
//         }
//     }
//     // const bundleTips = 1_500_000

//     // const bundleTxRes = await sendBundle(buyTxes, keypair, bundleTips, devConnection).catch(async () => {
//     //     return null
//     // }).then(async (res) => {
//     //     if (res === null || typeof res.Err == 'string') {
//     //         await sleep(2_000)
//     //         return await sendBundle(buyTxes, keypair, bundleTips, devConnection).catch((sendBundleError) => {
//     //             log({ sendBundleError })
//     //             return null
//     //         })
//     //     }
//     //     return res
//     // })
//     // if (!bundleTxRes) {
//     //     return { Err: "Failed to send the bundle" }
//     // }
//     // if (bundleTxRes.Ok) {
//     //     const { bundleId, bundleStatus, txsSignature } = bundleTxRes.Ok
//     //     const createPoolTxSignature = txsSignature[0]
//     //     const buyTxSignature = txsSignature[1]
//     //     if (!createPoolTxSignature || !buyTxSignature) return { Err: { bundleId, poolId: txInfo.poolId.toBase58() } }
//     //     return {
//     //         Ok: {
//     //             bundleId,
//     //             poolId: txInfo.poolId.toBase58(),
//     //             createPoolTxSignature,
//     //             buyTxSignature,
//     //             bundleStatus,
//     //         }
//     //     }
//     // } else if (bundleTxRes.Err) {
//     //     console.log({ bundleTxRes })
//     //     const Err = bundleTxRes.Err
//     //     if (typeof Err == 'string') {
//     //         return { Err }
//     //     } else {
//     //         return {
//     //             Err: {
//     //                 bundleId: Err.bundleId,
//     //                 poolId: txInfo.poolId.toBase58(),
//     //             }
//     //         }
//     //     }
//     // }
//     // return { Err: "Failed to send the bundle" }
// }

// export async function swap(input: SwapInput): Promise<Result<{ txSignature: string }, string>> {
//     if (input.sellToken) {
//         if (input.sellToken == 'base') {
//             input.buyToken = "quote"
//         } else {
//             input.buyToken = "base"
//         }
//     }
//     const user = input.keypair.publicKey
//     const connection = new web3.Connection(input.url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
//     const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
//     const slippage = input.slippage
//     const poolKeys = await baseRay.getPoolKeys(input.poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })
//     if (!poolKeys) { return { Err: "Pool info not found" } }
//     log({
//         baseToken: poolKeys.baseMint.toBase58(),
//         quoteToken: poolKeys.quoteMint.toBase58(),
//     })
//     const { amount, amountSide, buyToken, } = input
//     const swapAmountInfo = await baseRay.computeBuyAmount({
//         amount, buyToken, inputAmountType: amountSide, poolKeys, user, slippage
//     }).catch((computeBuyAmountError => log({ computeBuyAmountError })))

//     if (!swapAmountInfo) return { Err: "failed to calculate the amount" }

//     const { amountIn, amountOut, fixedSide, tokenAccountIn, tokenAccountOut, } = swapAmountInfo
//     console.log('swapAmountInfo', { amountIn, amountOut, fixedSide, tokenAccountIn, tokenAccountOut, })

//     const txInfo = await baseRay.buyFromPool({ amountIn, amountOut, fixedSide, poolKeys, tokenAccountIn, tokenAccountOut, user }).catch(buyFromPoolError => { log({ buyFromPoolError }); return null })
//     if (!txInfo) return { Err: "failed to prepare swap transaction" }
//     const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//     const txMsg = new web3.TransactionMessage({
//         instructions: txInfo.ixs,
//         payerKey: keypair.publicKey,
//         recentBlockhash,
//     }).compileToV0Message()
//     const tx = new web3.VersionedTransaction(txMsg)
//     tx.sign([keypair, ...txInfo.signers])
//     const txSignature = await sendAndConfirmTX(tx, connection).catch((sendAndConfirmTransactionError) => {
//         log({ sendAndConfirmTransactionError })
//         return null
//     })
//     // const txSignature = await connection.sendTransaction(tx).catch((error) => { log({ createPoolTxError: error }); return null });
//     if (!txSignature) {
//         return { Err: "Failed to send transaction" }
//     }
//     return {
//         Ok: {
//             txSignature,
//         }
//     }
// }

// export async function unwrapSol(url: 'mainnet' | 'devnet') {
//     const user = keypair.publicKey
//     const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
//     const ata = getAssociatedTokenAddressSync(NATIVE_MINT, user)
//     const ix = createCloseAccountInstruction(ata, user, user)
//     // speedup
//     const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
//     const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//     const tx = new web3.Transaction().add(updateCuIx, ix)
//     tx.feePayer = keypair.publicKey
//     tx.recentBlockhash = recentBlockhash
//     tx.sign(keypair)
//     const rawTx = tx.serialize()
//     const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
//         .catch(async () => {
//             await sleep(500)
//             return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
//                 .catch((createPoolAndBuyTxFail) => {
//                     log({ createPoolAndBuyTxFail })
//                     return null
//                 })
//         }))
//     if (!txSignature) log("Tx failed")
//     log("Transaction successfull\nTx Signature: ", txSignature)
// }

// export async function mintTo(input: { token: web3.PublicKey, amount: number, url: 'mainnet' | 'devnet' }) {
//     const { token, url, amount } = input
//     const user = keypair.publicKey
//     const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
//     const baseSpl = new BaseSpl(connection)
//     const ixs = await baseSpl.getMintToInstructions({ mint: token, mintAuthority: user, amount, init_if_needed: true })
//     const tx = new web3.Transaction().add(...ixs)
//     // const res = await connection.scendTransaction(tx, [keypair]).catch((txError) => { log({ txError }); return null })
//     const res = await sendAndConfirmTX(tx, connection).catch(sendAndConfirmTransactionError => {
//         log({ sendAndConfirmTransactionError })
//         return null
//     })
//     if (!res) log("Tx failed")
//     log("Transaction successfull\nTx Signature: ", res)
// }

// export async function revokeAuthority(input: { token: web3.PublicKey, url: 'mainnet' | 'devnet' }) {
//     const { token, url } = input;
//     const user = keypair.publicKey
//     const wallet = new Wallet(keypair)
//     const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
//     const baseSpl = new BaseSpl(connection)
//     const baseMpl = new BaseMpl(wallet, { endpoint: connection.rpcEndpoint })
//     const [mintAccountInfo, metadataAccountInfo] = await connection.getMultipleAccountsInfo([token, BaseMpl.getMetadataAccount(token)]).catch(error => [null, null])
//     if (!mintAccountInfo) {
//         log("Token not found")
//         return
//     }
//     const ixs: web3.TransactionInstruction[] = []
//     const mintInfo = MintLayout.decode(mintAccountInfo.data);
//     if (mintInfo.mintAuthority.toBase58() == user.toBase58() && mintInfo.mintAuthorityOption == 1) {
//         ixs.push(baseSpl.revokeAuthority({ authorityType: 'MINTING', currentAuthority: user, mint: token }))
//     } else {
//         if (mintInfo.mintAuthorityOption == 0) {
//             log("Minting authority already been revoked")
//         } else {
//             log("You don't have minting authority")
//         }
//     }
//     if (mintInfo.freezeAuthority.toBase58() == user.toBase58() && mintInfo.freezeAuthorityOption == 1) {
//         ixs.push(baseSpl.revokeAuthority({ authorityType: 'FREEZING', currentAuthority: user, mint: token }))
//     } else {
//         if (mintInfo.freezeAuthorityOption == 0) {
//             log("Freezing authority already been revoked")
//         } else {
//             log("You don't have freezing authority")
//         }
//     }

//     if (metadataAccountInfo) {
//         const metadataInfo = Metadata.deserialize(metadataAccountInfo.data)[0]
//         const metadataUpdateAuthStr = metadataInfo.updateAuthority.toBase58();
//         if (metadataUpdateAuthStr == user.toBase58() && metadataInfo.isMutable) {
//             ixs.push(baseMpl.getRevokeMetadataAuthIx(token, user))
//         } else if (!metadataInfo.isMutable) {
//             log('Update authority already been revoked')
//         } else {
//             log("You don't have metadata update authority")
//         }
//     }

//     if (ixs.length == 0) {
//         log("All authority are revoked")
//         return
//     }

//     // speedup
//     const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
//     const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//     const tx = new web3.Transaction().add(updateCuIx, ...ixs)
//     tx.feePayer = keypair.publicKey
//     tx.recentBlockhash = recentBlockhash
//     tx.sign(keypair)

//     console.log("SENDING REVOKE TX")
//     const txSignature = await connection.sendTransaction(tx, [keypair])
//     console.log("AWAITING REVOKE TX")
//     await connection.confirmTransaction(txSignature)
//     console.log("CONFIRMED REVOKE TX")
// }

// export async function createAndBuy(input: CreateAndBuy): Promise<Result<{
//     bundleId: string;
//     poolId: string;
//     createPoolTxSignature: string;
//     buyTxSignature: string;
//     bundleStatus: number;
// }, { bundleId: string, poolId: string } | string>> {
//     let { baseMintAmount, quoteMintAmount, marketId } = input
//     const user = keypair.publicKey
//     const connection = new web3.Connection(input.url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint)
//     const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
//     const marketState = await baseRay.getMarketInfo(marketId).catch((getMarketInfoError) => { log({ getMarketInfoError }); return null })
//     if (!marketState) {
//         return { Err: "market not found" }
//     }
//     const { baseMint, quoteMint } = marketState
//     log({
//         baseToken: baseMint.toBase58(),
//         quoteToken: quoteMint.toBase58(),
//     })
//     const createPoolTxInfo = await baseRay.createPool({ baseMint, quoteMint, marketId, baseMintAmount, quoteMintAmount }, keypair.publicKey).catch((innerCreatePoolError) => { log({ innerCreatePoolError }); return null })
//     if (!createPoolTxInfo) return { Err: "Failed to prepare create pool transaction" }

//     //buy
//     const { poolId, baseAmount: initialBaseMintAmount, quoteAmount: initialQuoteMintAmount } = createPoolTxInfo;
//     const poolKeys = await baseRay.getPoolKeys(poolId)
//     let amountIn: TokenAmount
//     let amountOut: TokenAmount
//     let tokenAccountIn: web3.PublicKey
//     let tokenAccountOut: web3.PublicKey
//     const baseR = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals)
//     const quoteR = new Token(TOKEN_PROGRAM_ID, poolKeys.quoteMint, poolKeys.quoteDecimals)
//     const poolInfo: LiquidityPoolInfo = {
//         baseDecimals: poolKeys.baseDecimals,
//         quoteDecimals: poolKeys.quoteDecimals,
//         lpDecimals: poolKeys.lpDecimals,
//         lpSupply: new BN(0),
//         baseReserve: initialBaseMintAmount,
//         quoteReserve: initialQuoteMintAmount,
//         startTime: null as any,
//         status: null as any
//     }
//     const { buyToken: buyTokenType, buyAmount } = input
//     let poolSolFund = 0;
//     if (baseMint.toBase58() == NATIVE_MINT.toBase58() || quoteMint.toBase58() == NATIVE_MINT.toBase58()) {
//         if (baseMint.toBase58() == NATIVE_MINT.toBase58()) {
//             poolSolFund = input.baseMintAmount
//         } else {
//             poolSolFund = input.quoteMintAmount
//         }
//     }
//     if (buyTokenType == 'base') {
//         amountOut = new TokenAmount(baseR, buyAmount.toString(), false)
//         amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: quoteR, poolInfo, poolKeys, slippage: new Percent(1, 100) }).maxAmountIn as TokenAmount
//         tokenAccountOut = getAssociatedTokenAddressSync(poolKeys.baseMint, user)
//         tokenAccountIn = getAssociatedTokenAddressSync(poolKeys.quoteMint, user)
//         const [userAccountInfo, ataInfo] = await connection.getMultipleAccountsInfo([user, tokenAccountIn]).catch(() => [null, null, null])
//         if (!userAccountInfo) return { Err: "wallet dosen't have enought Sol to create pool" }
//         const balance = calcDecimalValue(userAccountInfo.lamports, 9)
//         if (balance < poolSolFund) return { Err: "wallet dosen't have enought Sol to create pool" }
//         let minRequiredBuyerBalance = poolSolFund
//         if (amountIn.token.mint.toBase58() == NATIVE_MINT.toBase58()) {
//             minRequiredBuyerBalance += calcDecimalValue(amountIn.raw.toNumber(), 9)
//             if (balance < minRequiredBuyerBalance) return { Err: "Second wallet dosen't have enought Sol to buy the tokens" }
//         } else {
//             log("else")
//             if (!ataInfo) return { Err: "Second wallet dosen't have enought fund to buy another token" }
//             const tokenBalance = Number(AccountLayout.decode(ataInfo.data).amount.toString())
//             if (tokenBalance < amountIn.raw.toNumber()) {
//                 return { Err: "Second wallet dosen't have enought fund to buy another token" }
//             }
//         }
//     } else {
//         amountOut = new TokenAmount(quoteR, buyAmount.toString(), false)
//         amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: baseR, poolInfo, poolKeys, slippage: new Percent(1, 100) }).maxAmountIn as TokenAmount
//         tokenAccountOut = getAssociatedTokenAddressSync(poolKeys.quoteMint, user)
//         tokenAccountIn = getAssociatedTokenAddressSync(poolKeys.baseMint, user)
//         const [userAccountInfo, ataInfo] = await connection.getMultipleAccountsInfo([user, tokenAccountIn]).catch(() => [null, null])
//         if (!userAccountInfo) return { Err: "wallet dosen't have enought Sol to create pool" }
//         const balance = calcDecimalValue(userAccountInfo.lamports, 9)
//         if (balance < poolSolFund) return { Err: "wallet dosen't have enought Sol to create pool" }
//         let minRequiredBuyerBalance = poolSolFund
//         if (amountIn.token.mint.toBase58() == NATIVE_MINT.toBase58()) {
//             minRequiredBuyerBalance += calcDecimalValue(amountIn.raw.toNumber(), 9)
//             if (balance < minRequiredBuyerBalance) return { Err: "Second wallet dosen't have enought Sol to buy or distribute the tokens" }
//         } else {
//             log("else")
//             if (!ataInfo) return { Err: "Second wallet dosen't have enought fund to buy another token" }
//             const tokenBalance = Number(AccountLayout.decode(ataInfo.data).amount.toString())
//             if (tokenBalance < amountIn.raw.toNumber()) {
//                 return { Err: "Second wallet dosen't have enought fund to buy another token" }
//             }
//         }
//     }
//     const buyFromPoolTxInfo = await baseRay.buyFromPool({
//         amountIn, amountOut, fixedSide: 'out', poolKeys, tokenAccountIn, tokenAccountOut, user: user
//     }).catch((innerBuyTxError) => { log({ innerBuyTxError }); return null })
//     if (!buyFromPoolTxInfo) return { Err: "Failed to create buy transaction" }

//     const createPoolRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
//         await sleep(2_000)
//         return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
//             log({ getLatestBlockhashError })
//             return null
//         })
//     }))?.blockhash;
//     if (!createPoolRecentBlockhash) return { Err: "Failed to prepare transaction" }
//     const createPoolTxMsg = new web3.TransactionMessage({
//         instructions: createPoolTxInfo.ixs,
//         payerKey: keypair.publicKey,
//         recentBlockhash: createPoolRecentBlockhash
//     }).compileToV0Message()
//     const createPoolTx = new web3.VersionedTransaction(createPoolTxMsg)
//     createPoolTx.sign([keypair, ...createPoolTxInfo.signers])

//     await sleep(1_000)
//     const buyRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
//         await sleep(2_000)
//         return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
//             log({ getLatestBlockhashError })
//             return null
//         })
//     }))?.blockhash;
//     if (!buyRecentBlockhash) return { Err: "Failed to prepare transaction" }
//     const buyTxMsg = new web3.TransactionMessage({
//         instructions: buyFromPoolTxInfo.ixs,
//         payerKey: user,
//         recentBlockhash: buyRecentBlockhash
//     }).compileToV0Message()
//     const buyTx = new web3.VersionedTransaction(buyTxMsg)
//     buyTx.sign([keypair])

//     // {
//     //     const createPoolRes = await connection.sendTransaction(createPoolTx)
//     //     log({ createPoolRes })
//     //     await sleep(4_000)
//     //     const buyTxRes = await connection.sendTransaction(buyTx)
//     //     log({ buyTxRes })
//     // }

//     const bundleTips = 5_000_000
//     const bundleTxRes = await sendBundle([createPoolTx, buyTx], keypair, bundleTips, connection).catch(async () => {
//         return null
//     }).then(async (res) => {
//         if (res === null || typeof res.Err == 'string') {
//             await sleep(2_000)
//             return await sendBundle([createPoolTx, buyTx], keypair, bundleTips, connection).catch((sendBundleError) => {
//                 log({ sendBundleError })
//                 return null
//             })
//         }
//         return res
//     })
//     if (!bundleTxRes) {
//         return { Err: "Failed to send the bundle" }
//     }
//     if (bundleTxRes.Ok) {
//         const { bundleId, bundleStatus, txsSignature } = bundleTxRes.Ok
//         const createPoolTxSignature = txsSignature[0]
//         const buyTxSignature = txsSignature[1]
//         if (!createPoolTxSignature || !buyTxSignature) return { Err: { bundleId, poolId: poolId.toBase58() } }
//         return {
//             Ok: {
//                 bundleId,
//                 poolId: poolId.toBase58(),
//                 createPoolTxSignature,
//                 buyTxSignature,
//                 bundleStatus,
//             }
//         }
//     } else if (bundleTxRes.Err) {
//         console.log({ bundleTxRes })
//         const Err = bundleTxRes.Err
//         if (typeof Err == 'string') {
//             return { Err }
//         } else {
//             return {
//                 Err: {
//                     bundleId: Err.bundleId,
//                     poolId: poolId.toBase58(),
//                 }
//             }
//         }
//     }
//     return { Err: "Failed to send the bundle" }
// }

// export async function sendBundle(txs: web3.VersionedTransaction[], feePayerAuthority: web3.Keypair, bundleTips: number, connection: web3.Connection): Promise<Result<{
//     bundleId: string, txsSignature: string[], bundleStatus: number
// }, { bundleId: string } | string>> {
//     const jito_auth_keypair_array = JITO_AUTH_KEYPAIR.split(',')
//     const keyapair_num = Math.floor(Math.random() * jito_auth_keypair_array.length)
//     const jito_auth_keypair = jito_auth_keypair_array[keyapair_num]
//     const jitoKey = Keypair.fromSecretKey(base58.decode(jito_auth_keypair))

//     const blochengine_url_array = BLOCKENGINE_URL.split(',')
//     const blockengine_num = Math.floor(Math.random() * blochengine_url_array.length)
//     const blochengine_url = blochengine_url_array[blockengine_num]

//     const jitoClient = searcherClient(blochengine_url, jitoKey)
//     const jitoTipAccounts = await jitoClient.getTipAccounts().catch(getTipAccountsError => { log({ getTipAccountsError }); return null });
//     if (!jitoTipAccounts) return { Err: "Unable to prepare the bunde transaction" }
//     const jitoTipAccount = new web3.PublicKey(
//         jitoTipAccounts[Math.floor(Math.random() * jitoTipAccounts.length)]
//     );
//     // log("tip Account: ", jitoTipAccount.toBase58())
//     const jitoLeaderNextSlot = (await jitoClient.getNextScheduledLeader().catch(getNextScheduledLeaderError => { log({ getNextScheduledLeaderError }); return null }))?.nextLeaderSlot;
//     if (!jitoLeaderNextSlot) return { Err: "Unable to prepare the bunde transaction" }
//     // log("jito LedgerNext slot", jitoLeaderNextSlot)
//     const recentBlockhash = (await (connection.getLatestBlockhash())).blockhash
//     let b = new bundle.Bundle(txs, txs.length + 1).addTipTx(
//         feePayerAuthority,
//         bundleTips,
//         jitoTipAccount,
//         recentBlockhash
//     )
//     if (b instanceof Error) {
//         log({ bundleError: b })
//         return { Err: "Failed to prepare the bunde transaction" }
//     }
//     const bundleId = await jitoClient.sendBundle(b).catch(async () => {
//         await sleep(3_000)
//         return await jitoClient.sendBundle(b as any).catch((sendBunderError) => {
//             log({ sendBunderError })
//             return null
//         })
//     })
//     console.log("🚀 ~ sendBundle ~ bundleId:", bundleId)
//     if (!bundleId) {
//         return { Err: "Bundle transaction failed" }
//     }
//     // const bundleId = "6f2145c078bf21e7d060d348ff785a42da3546a69ee2201844c9218211360c0d"
//     await sleep(5_000)
//     const bundleRes = await getBundleInfo(bundleId).catch(async () => {
//         await sleep(5_000)
//         return await getBundleInfo(bundleId).catch((getBundleInfoError) => {
//             log({ getBundleInfoError })
//             return null
//         })
//     })
//     if (bundleRes === undefined) {
//         //TODO: Bundle failed
//         return { Err: { bundleId } }
//     }
//     if (!bundleRes) {
//         return { Err: { bundleId } }
//     }
//     const { transactions, status } = bundleRes;
//     if (!transactions || !status) {
//         return { Err: { bundleId } }
//     }
//     return {
//         Ok: {
//             bundleId,
//             bundleStatus: status,
//             txsSignature: transactions
//         }
//     }
// }

// export async function getBundleInfo(bundleId: string): Promise<BundleRes> {
//     const bundleRes = await fetch("https://explorer.jito.wtf/api/graphqlproxy", {
//         "headers": {
//             "accept": "*/*",
//             "accept-language": "en-GB,en;q=0.5",
//             "content-type": "application/json",
//             "Referer": `https://explorer.jito.wtf/bundle/${bundleId}`
//         },
//         "body": `{\"operationName\":\"getBundleById\",\"variables\":{\"id\":\"${bundleId}\"},\"query\":\"query getBundleById($id: String!) {\\n  getBundle(req: {id: $id}) {\\n    bundle {\\n      uuid\\n      timestamp\\n      validatorIdentity\\n      transactions\\n      slot\\n      status\\n      landedTipLamports\\n      signer\\n      __typename\\n    }\\n    __typename\\n  }\\n}\"}`,
//         "method": "POST"
//     });
//     const bundleResJ = await bundleRes.json()
//     return bundleResJ?.data?.getBundle?.bundle
// }
