import { 
    Raydium,
    TxVersion,
    ApiV3PoolInfoItem,
    ApiV3PoolInfoStandardItem,
    DEVNET_PROGRAM_ID
} from '@raydium-io/raydium-sdk-v2';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import BN from 'bn.js';

// Simple logger for now - can be replaced with elizaLogger when available
const elizaLogger = {
    info: (...args: any[]) => console.log('[Raydium]', ...args),
    error: (...args: any[]) => console.error('[Raydium Error]', ...args),
    warn: (...args: any[]) => console.warn('[Raydium Warning]', ...args)
};

export interface AddLiquidityParams {
    poolId: string;
    baseAmountIn: string;
    quoteAmountIn: string;
    walletKeypair: Keypair;
    slippage?: number; // percentage, default 1%
    fixedSide?: 'base' | 'quote'; // which token amount is fixed
}

export interface RemoveLiquidityParams {
    poolId: string;
    lpAmountIn: string; // amount of LP tokens to remove
    walletKeypair: Keypair;
    slippage?: number; // percentage, default 1%
}

export interface SwapParams {
    poolId: string;
    amountIn: string;
    inputMint: string;
    outputMint: string;
    walletKeypair: Keypair;
    slippage?: number; // percentage, default 1%
}

async function initializeRaydiumSdk(connection: Connection): Promise<Raydium> {
    const owner = Keypair.generate(); // Temporary, will be replaced with actual wallet
    
    const raydium = await Raydium.load({
        connection: connection as any,
        owner: owner.publicKey,
        disableLoadToken: false
    });

    return raydium;
}

export async function addLiquidity(
    connection: Connection,
    params: AddLiquidityParams
): Promise<string> {
    try {
        elizaLogger.info(`Adding liquidity to pool ${params.poolId}`);
        
        const raydium = await initializeRaydiumSdk(connection);
        
        // Fetch pool info
        const poolInfo = await raydium.api.fetchPoolById({ ids: params.poolId });
        if (!poolInfo || poolInfo.length === 0) {
            throw new Error(`Pool ${params.poolId} not found`);
        }

        const pool = poolInfo[0] as ApiV3PoolInfoStandardItem;
        
        // Check if it's a standard AMM pool
        if (!('baseReserve' in pool)) {
            throw new Error('Pool is not a standard AMM pool');
        }

        // For now, we'll throw an error since the SDK v2 API is different
        // and would require more complex implementation
        throw new Error('Add liquidity not yet implemented for Raydium SDK v2. Please implement using Raydium SDK v2 demo as reference.');

    } catch (error) {
        elizaLogger.error('Error adding liquidity:', error);
        throw error;
    }
}

export async function removeLiquidity(
    connection: Connection,
    params: RemoveLiquidityParams
): Promise<string> {
    try {
        elizaLogger.info(`Removing liquidity from pool ${params.poolId}`);
        
        const raydium = await initializeRaydiumSdk(connection);

        // Fetch pool info
        const poolInfo = await raydium.api.fetchPoolById({ ids: params.poolId });
        if (!poolInfo || poolInfo.length === 0) {
            throw new Error(`Pool ${params.poolId} not found`);
        }

        const pool = poolInfo[0] as ApiV3PoolInfoStandardItem;
        
        // Check if it's a standard AMM pool
        if (!('baseReserve' in pool)) {
            throw new Error('Pool is not a standard AMM pool');
        }

        // For now, we'll throw an error since the SDK v2 API is different
        // and would require more complex implementation
        throw new Error('Remove liquidity not yet implemented for Raydium SDK v2. Please implement using Raydium SDK v2 demo as reference.');

    } catch (error) {
        elizaLogger.error('Error removing liquidity:', error);
        throw error;
    }
}

export async function getUserLpBalance(
    connection: Connection,
    walletPublicKey: PublicKey | string,
    poolId: string
): Promise<{ balance: string; decimals: number }> {
    try {
        const wallet = typeof walletPublicKey === 'string' 
            ? new PublicKey(walletPublicKey) 
            : walletPublicKey;

        const raydium = await initializeRaydiumSdk(connection);
        
        // Fetch pool info to get LP mint
        const poolInfo = await raydium.api.fetchPoolById({ ids: poolId });
        if (!poolInfo || poolInfo.length === 0) {
            throw new Error(`Pool ${poolId} not found`);
        }

        const pool = poolInfo[0] as ApiV3PoolInfoStandardItem;
        
        // Check if it's a standard AMM pool with lpMint
        if (!('lpMint' in pool)) {
            throw new Error('Pool does not have lpMint information');
        }
        
        const lpMint = new PublicKey(pool.lpMint.address);

        // Get user's LP token account
        const lpTokenAccount = await getAssociatedTokenAddress(
            lpMint,
            wallet,
            true
        );

        // Get balance
        const accountInfo = await connection.getTokenAccountBalance(lpTokenAccount);
        
        return {
            balance: accountInfo.value.amount,
            decimals: accountInfo.value.decimals
        };
    } catch (error) {
        elizaLogger.error('Error getting LP balance:', error);
        // Return 0 if account doesn't exist
        return { balance: '0', decimals: 9 };
    }
}

// Helper function to estimate the token amounts that will be received when removing liquidity
export async function estimateRemoveLiquidity(
    connection: Connection,
    poolId: string,
    lpAmount: string
): Promise<{ baseAmount: string; quoteAmount: string }> {
    try {
        const raydium = await initializeRaydiumSdk(connection);
        
        // Fetch pool info
        const poolInfo = await raydium.api.fetchPoolById({ ids: poolId });
        if (!poolInfo || poolInfo.length === 0) {
            throw new Error(`Pool ${poolId} not found`);
        }

        const pool = poolInfo[0] as ApiV3PoolInfoStandardItem;
        
        // Check if it's a standard AMM pool
        if (!('lpAmount' in pool) || !('baseReserve' in pool) || !('quoteReserve' in pool)) {
            throw new Error('Pool does not have required reserve information');
        }
        
        const lpAmountBN = new BN(lpAmount);
        const lpSupply = new BN(pool.lpAmount);
        const baseReserve = new BN(pool.baseReserve);
        const quoteReserve = new BN(pool.quoteReserve);

        // Calculate proportional amounts
        const baseAmount = lpAmountBN.mul(baseReserve).div(lpSupply);
        const quoteAmount = lpAmountBN.mul(quoteReserve).div(lpSupply);

        return {
            baseAmount: baseAmount.toString(),
            quoteAmount: quoteAmount.toString()
        };
    } catch (error) {
        elizaLogger.error('Error estimating remove liquidity:', error);
        throw error;
    }
}

// Helper function to check if a pool contains SOL or WSOL
export async function poolContainsSol(
    connection: Connection,
    poolId: string
): Promise<boolean> {
    try {
        const raydium = await initializeRaydiumSdk(connection);
        const poolInfo = await raydium.api.fetchPoolById({ ids: poolId });
        
        if (!poolInfo || poolInfo.length === 0) {
            return false;
        }

        const pool = poolInfo[0];
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        
        return pool.mintA.address === SOL_MINT || 
               pool.mintB.address === SOL_MINT ||
               pool.mintA.symbol === 'SOL' ||
               pool.mintB.symbol === 'SOL' ||
               pool.mintA.symbol === 'WSOL' ||
               pool.mintB.symbol === 'WSOL';
    } catch (error) {
        elizaLogger.error('Error checking pool for SOL:', error);
        return false;
    }
}