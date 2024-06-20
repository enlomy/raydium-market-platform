import { web3 } from "@project-serum/anchor"
import { Percent } from "@raydium-io/raydium-sdk"
import { Keypair, PublicKey } from "@solana/web3.js"

export type CreateTokenInput = {
    name: string,
    symbol?: string,
    decimals: number
    url: 'mainnet' | 'devnet',
    metaUri: string,
    initialMintingAmount: number
    mintRevokeAuthorities?: boolean,
    freezeRevokeAuthorities?: boolean,
    mutable: boolean,
    wallet: any
}

export type CreateTaxTokenInput = {
    name: string,
    symbol: string,
    decimals: number
    url: 'mainnet' | 'devnet',
    metaUri: string,
    initialMintingAmount: number,
    feeRate: number,
    maxFee: number,
    authWallet: web3.PublicKey,
    withdrawWallet: web3.PublicKey,
    useExtenstion: boolean,
    permanentWallet?: web3.PublicKey,
    defaultAccountState?: number,
    bearingRate?: number, 
    transferable?: boolean,
    wallet: any
}

export type UpdateTokenInput = {
    mint: web3.PublicKey,
    name?: string,
    symbol?: string,
    url: 'mainnet' | 'devnet',
    metaUri: string,
    mintRevokeAuthorities?: boolean,
    freezeRevokeAuthorities?: boolean,
    mutable?: boolean,
    wallet: any
}

export type MintTokenInput = {
    mint: web3.PublicKey,
    mintingAmount: number,
    url: 'mainnet' | 'devnet',
    wallet: any
}

export type RFTokenInput = {
    mint: web3.PublicKey,
    url: 'mainnet' | 'devnet',
    wallet: any
}

export type CreateMarketInput = {
    baseMint: web3.PublicKey,
    quoteMint: web3.PublicKey,
    orderSize: number,
    priceTick: number,
    eventLength: number,
    requestLength: number,
    orderBookLength: number,
    wallet: any,
    url: 'mainnet' | 'devnet',
}
export type AddLiquidityInput = {
    // slippage: Percent,
    poolId: web3.PublicKey,
    amount: number,
    wallet: any,
    amountSide: 'base' | 'quote',
    url: 'mainnet' | 'devnet',
}
export type RemoveLiquidityInput = {
    poolId: web3.PublicKey,
    amount: number,
    wallet: any,
    url: 'mainnet' | 'devnet',
    unwrapSol?: boolean
}

export type CreatePoolInput = {
    marketId: web3.PublicKey,
    baseMintAmount: number,
    quoteMintAmount: number,
    wallet: any,
    launchTime: any,
    url: 'mainnet' | 'devnet',
}

export type CreatePoolInputAndProvide = {
    marketId: web3.PublicKey
    baseMintAmount: number
    quoteMintAmount: number
    wallets: Array<{ pubkey: string, secretkey: string }>
    amount: number
    url: 'mainnet' | 'devnet'
}

export type SwapInput = {
    keypair: Keypair
    poolId: web3.PublicKey
    buyToken: "base" | 'quote',
    sellToken?: 'base' | 'quote',
    amountSide: "send" | 'receive',
    amount: number,
    slippage: Percent,
    url: 'mainnet' | 'devnet',
}

export type CreateAndBuy = {
    //pool
    marketId: web3.PublicKey,
    baseMintAmount: number,
    quoteMintAmount: number,
    url: 'mainnet' | 'devnet',

    //buy
    buyToken: 'base' | 'quote',
    buyAmount: number
}

export type BundleRes = {
    uuid: string;
    timestamp: string;
    validatorIdentity: string;
    transactions: string[];
    slot: number;
    status: number;
    landedTipLamports: number;
    signer: string;
    __typename: string;
}