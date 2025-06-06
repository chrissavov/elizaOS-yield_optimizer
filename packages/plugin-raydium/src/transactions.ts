import { 
    Raydium,
    TxVersion,
    ApiV3PoolInfoItem,
    ApiV3PoolInfoStandardItem,
    DEVNET_PROGRAM_ID,
    TokenAmount,
    Token
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

export interface HarvestFarmParams {
    farmId: string;
    walletKeypair: Keypair;
}

export interface UnstakeFarmParams {
    farmId: string;
    amount: string; // amount of LP tokens to unstake
    walletKeypair: Keypair;
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
        elizaLogger.info(`Base amount: ${params.baseAmountIn}, Quote amount: ${params.quoteAmountIn}`);
        elizaLogger.info(`Slippage: ${params.slippage}%, Fixed side: ${params.fixedSide || 'base'}`);
        
        // Create a Raydium instance with the actual wallet
        const raydium = await Raydium.load({
            connection: connection as any,
            owner: params.walletKeypair.publicKey,
            disableLoadToken: false
        });

        elizaLogger.info('Raydium instance created successfully');

        // Fetch pool info using API to get complete token info including mint objects
        elizaLogger.info('Fetching pool info from API...');
        const poolDataArray = await raydium.api.fetchPoolById({ ids: params.poolId });
        
        if (!poolDataArray || poolDataArray.length === 0) {
            throw new Error(`Pool ${params.poolId} not found via API`);
        }

        const poolData = poolDataArray[0];
        
        // Check if this is a Standard AMM pool (required for liquidity operations)
        if (poolData.type !== 'Standard') {
            throw new Error(`Pool ${params.poolId} is not a Standard AMM pool (type: ${poolData.type}). Liquidity operations are only supported for Standard AMM pools.`);
        }
        
        const poolInfo = poolData as ApiV3PoolInfoStandardItem;
        elizaLogger.info('Pool info from API:', {
            id: poolInfo.id,
            programId: poolInfo.programId,
            type: poolInfo.type,
            mintA: poolInfo.mintA,
            mintB: poolInfo.mintB,
            lpMint: poolInfo.lpMint
        });

        // Get pool keys for efficiency (optional but recommended)
        let poolKeys: any;
        try {
            const poolInfoResult = await raydium.liquidity.getPoolInfoFromRpc({ poolId: params.poolId });
            poolKeys = poolInfoResult?.poolKeys;
        } catch (err) {
            elizaLogger.warn('Could not fetch pool keys, continuing without them:', err.message);
        }
        
        elizaLogger.info(`Pool info retrieved:`, {
            id: poolInfo.id,
            programId: poolInfo.programId,
            baseMint: poolInfo.mintA?.address || poolInfo.mintA,
            quoteMint: poolInfo.mintB?.address || poolInfo.mintB,
            lpMint: poolInfo.lpMint?.address || poolInfo.lpMint
        });
        
        // Check if the pool uses WSOL
        const WSOL_MINT = 'So11111111111111111111111111111111111111112';
        const mintAAddress = poolInfo.mintA?.address || poolInfo.mintA;
        const mintBAddress = poolInfo.mintB?.address || poolInfo.mintB;
        const usesWSOL = mintAAddress === WSOL_MINT || mintBAddress === WSOL_MINT;
        
        if (usesWSOL) {
            elizaLogger.info('⚠️  Pool uses WSOL (Wrapped SOL). Note: The SDK should handle SOL wrapping automatically.');
        }
        
        // Convert string amounts to BN
        const baseAmountBN = new BN(params.baseAmountIn);
        const quoteAmountBN = new BN(params.quoteAmountIn);
        
        // Calculate slippage for the other amount
        const slippageMultiplier = 1 - (params.slippage || 1) / 100;
        const fixedSide = params.fixedSide === 'quote' ? 'b' : 'a'; // Convert to SDK format
        
        let otherAmountMin: BN;
        
        if (fixedSide === 'a') {
            // Base amount (A) is fixed, calculate minimum quote amount (B) with slippage
            otherAmountMin = new BN(Math.floor(quoteAmountBN.toNumber() * slippageMultiplier));
        } else {
            // Quote amount (B) is fixed, calculate minimum base amount (A) with slippage
            otherAmountMin = new BN(Math.floor(baseAmountBN.toNumber() * slippageMultiplier));
        }
        
        elizaLogger.info('Building add liquidity transaction...');
        elizaLogger.info(`Base Amount (A): ${baseAmountBN.toString()}, Quote Amount (B): ${quoteAmountBN.toString()}`);
        elizaLogger.info(`Minimum other amount: ${otherAmountMin.toString()}`);
        elizaLogger.info(`Fixed side: ${fixedSide}`);
        
        elizaLogger.info('Creating add liquidity transaction...');
        
        // Build add liquidity transaction
        // The SDK v2 uses a different format
        // Make sure we have the complete pool info with token mints
        if (!poolInfo.mintA || !poolInfo.mintB) {
            throw new Error('Pool info missing token mint information');
        }
        
        // Log the pool info structure to debug
        elizaLogger.info('Pool info structure:', {
            hasMintA: !!poolInfo.mintA,
            mintAType: typeof poolInfo.mintA,
            hasMintB: !!poolInfo.mintB,
            mintBType: typeof poolInfo.mintB,
            hasLpMint: !!poolInfo.lpMint,
            lpMintType: typeof poolInfo.lpMint
        });
        
        // Create Token instances from the pool info
        const tokenA = new Token({
            mint: new PublicKey(poolInfo.mintA.address),
            decimals: poolInfo.mintA.decimals,
            symbol: poolInfo.mintA.symbol,
            name: poolInfo.mintA.name || poolInfo.mintA.symbol
        });
        
        const tokenB = new Token({
            mint: new PublicKey(poolInfo.mintB.address),
            decimals: poolInfo.mintB.decimals,
            symbol: poolInfo.mintB.symbol,
            name: poolInfo.mintB.name || poolInfo.mintB.symbol
        });
        
        // Create TokenAmount instances
        const amountInA = new TokenAmount(tokenA, baseAmountBN);
        const amountInB = new TokenAmount(tokenB, quoteAmountBN);
        const otherAmountMinToken = fixedSide === 'a' 
            ? new TokenAmount(tokenB, otherAmountMin)
            : new TokenAmount(tokenA, otherAmountMin);
        
        elizaLogger.info('Token amounts created:', {
            amountInA: amountInA.toFixed(),
            amountInB: amountInB.toFixed(),
            otherAmountMin: otherAmountMinToken.toFixed()
        });
        
        // Create the add liquidity input
        // Set config to create associated token accounts if needed
        const addLiqTx = await raydium.liquidity.addLiquidity({
            poolInfo: poolInfo,
            poolKeys: poolKeys, // Optional but helpful for efficiency
            amountInA: amountInA,
            amountInB: amountInB,
            otherAmountMin: otherAmountMinToken,
            fixedSide: fixedSide as 'a' | 'b',
            config: {
                bypassAssociatedCheck: false,
                checkCreateATAOwner: true // Ensure ATA creation for LP tokens
            },
            txVersion: TxVersion.V0 // Use versioned transactions for better compatibility
        });
        
        if (!addLiqTx) {
            throw new Error('Failed to build add liquidity transaction');
        }
        
        elizaLogger.info('Executing add liquidity transaction...');
        elizaLogger.info(`🔗 Pool: ${params.poolId}`);
        elizaLogger.info(`💰 Base Amount: ${params.baseAmountIn}`);
        elizaLogger.info(`💰 Quote Amount: ${params.quoteAmountIn}`);
        elizaLogger.info(`📊 Slippage: ${params.slippage}%`);
        elizaLogger.info(`👤 Wallet: ${params.walletKeypair.publicKey.toString()}`);
        
        // Add delay to avoid rate limiting
        elizaLogger.info('⏳ Waiting 10 seconds to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Execute transaction using manual signing and sending
        elizaLogger.info('🚀 Executing add liquidity transaction...');
        
        if (!addLiqTx.transaction) {
            throw new Error('No transaction created');
        }
        
        // Manual transaction sending
        // Get fresh blockhash
        elizaLogger.info('Fetching fresh blockhash...');
        let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        
        const tx = addLiqTx.transaction;
        
        // Check if this is a VersionedTransaction (has 'message' property)
        if ('message' in tx) {
            // This is a VersionedTransaction
            tx.message.recentBlockhash = blockhash;
            tx.sign([params.walletKeypair]);
        } else {
            // This is a legacy Transaction
            (tx as any).recentBlockhash = blockhash;
            (tx as any).feePayer = params.walletKeypair.publicKey;
            (tx as any).sign(params.walletKeypair);
        }
        
        // Add retry logic for rate limiting and blockhash issues
        let retries = 3;
        while (retries > 0) {
            try {
                elizaLogger.info(`📤 Sending transaction (attempt ${4 - retries}/3)...`);
                
                // Send the transaction directly without simulation
                const signature = await connection.sendRawTransaction(
                    addLiqTx.transaction.serialize(),
                    { 
                        skipPreflight: false, // Don't skip preflight to see errors
                        maxRetries: 3
                    }
                );
                
                elizaLogger.info(`📋 Transaction sent with signature: ${signature}`);
                elizaLogger.info(`⏳ Waiting for confirmation...`);
                
                // Use polling-based confirmation to avoid WebSocket
                elizaLogger.info(`⏳ Confirming transaction...`);
                
                // Poll for transaction status instead of using WebSocket
                let confirmed = false;
                const maxAttempts = 30;
                for (let i = 0; i < maxAttempts; i++) {
                    try {
                        const status = await connection.getSignatureStatus(signature);
                        if (status?.value?.confirmationStatus === 'confirmed' || 
                            status?.value?.confirmationStatus === 'finalized') {
                            confirmed = true;
                            break;
                        }
                    } catch (e) {
                        // Ignore errors during polling
                    }
                    
                    // Wait 1 second between polls
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                if (confirmed) {
                    elizaLogger.info(`✅ Add liquidity transaction successful!`);
                } else {
                    elizaLogger.warn(`⚠️  Transaction confirmation timeout, but transaction may still be successful`);
                }
                
                elizaLogger.info(`🔗 Transaction ID: ${signature}`);
                elizaLogger.info(`🌐 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
                elizaLogger.info(`🌐 View on Solscan: https://solscan.io/tx/${signature}`);
                
                return signature;
                
            } catch (sendError: any) {
                elizaLogger.warn(`⚠️  Transaction send attempt ${4 - retries}/3 failed: ${sendError.message}`);
                
                if (sendError.message?.includes('429') && retries > 1) {
                    elizaLogger.warn(`Rate limited, waiting before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    retries--;
                } else if (sendError.message?.includes('Blockhash not found') && retries > 1) {
                    elizaLogger.warn(`Blockhash expired, getting fresh blockhash and retrying...`);
                    // Get a fresh blockhash for retry
                    const freshBlockhash = await connection.getLatestBlockhash('confirmed');
                    blockhash = freshBlockhash.blockhash;
                    lastValidBlockHeight = freshBlockhash.lastValidBlockHeight;
                    
                    // Update transaction with fresh blockhash
                    if ('message' in tx) {
                        // This is a VersionedTransaction
                        tx.message.recentBlockhash = blockhash;
                        tx.sign([params.walletKeypair]);
                    } else {
                        // This is a legacy Transaction
                        (tx as any).recentBlockhash = blockhash;
                        (tx as any).sign(params.walletKeypair);
                    }
                    
                    retries--;
                } else {
                    throw sendError;
                }
            }
        }
        throw new Error('Failed to send transaction after all retries');

    } catch (error) {
        elizaLogger.error('Error adding liquidity:', error);
        throw error;
    }
}

/**
 * Remove liquidity from a Raydium pool
 * 
 * This function uses direct transaction signing and sending instead of the SDK's execute() method
 * to provide more control over the transaction process and better handle edge cases.
 * 
 * @param connection - Solana connection object
 * @param params - Parameters for removing liquidity
 * @returns Transaction signature
 */
export async function removeLiquidity(
    connection: Connection,
    params: RemoveLiquidityParams
): Promise<string> {
    try {
        elizaLogger.info(`Removing liquidity from pool ${params.poolId}`);
        elizaLogger.info(`Amount: ${params.lpAmountIn}, Slippage: ${params.slippage}%`);
        
        // Create a Raydium instance with the actual wallet
        const raydium = await Raydium.load({
            connection: connection as any,
            owner: params.walletKeypair.publicKey,
            disableLoadToken: false
        });

        elizaLogger.info('Raydium instance created successfully');

        // Fetch pool info using API to get complete token info including mint objects
        elizaLogger.info('Fetching pool info from API...');
        const poolDataArray = await raydium.api.fetchPoolById({ ids: params.poolId });
        
        if (!poolDataArray || poolDataArray.length === 0) {
            throw new Error(`Pool ${params.poolId} not found via API`);
        }

        const poolData = poolDataArray[0];
        
        // Check if this is a Standard AMM pool (required for liquidity operations)
        if (poolData.type !== 'Standard') {
            throw new Error(`Pool ${params.poolId} is not a Standard AMM pool (type: ${poolData.type}). Liquidity operations are only supported for Standard AMM pools.`);
        }
        
        const poolInfo = poolData as ApiV3PoolInfoStandardItem;

        // Get pool keys for efficiency (optional but recommended)
        let poolKeys: any;
        try {
            const poolInfoResult = await raydium.liquidity.getPoolInfoFromRpc({ poolId: params.poolId });
            poolKeys = poolInfoResult?.poolKeys;
        } catch (err) {
            elizaLogger.warn('Could not fetch pool keys, continuing without them:', err.message);
        }
        
        elizaLogger.info(`Pool info retrieved:`, {
            id: poolInfo.id,
            programId: poolInfo.programId,
            baseMint: poolInfo.mintA?.address || poolInfo.mintA,
            quoteMint: poolInfo.mintB?.address || poolInfo.mintB,
            lpMint: poolInfo.lpMint?.address || poolInfo.lpMint
        });
        
        // Calculate slippage - convert from percentage to proper amounts
        // const slippageBps = Math.floor(params.slippage * 100); // Convert percentage to basis points
        
        elizaLogger.info('Building remove liquidity transaction...');
        
        // Build remove liquidity transaction
        // For simplicity, we're using 0 for min amounts, but in production you'd calculate based on slippage
        const removeLiqTx = await raydium.liquidity.removeLiquidity({
            poolInfo: poolInfo,
            poolKeys: poolKeys, // Optional but helpful for efficiency
            lpAmount: new BN(params.lpAmountIn),
            baseAmountMin: new BN(0), // TODO: Calculate based on slippage
            quoteAmountMin: new BN(0), // TODO: Calculate based on slippage
            config: {
                bypassAssociatedCheck: false,
                checkCreateATAOwner: false
            }
        });
        
        if (!removeLiqTx) {
            throw new Error('Failed to build remove liquidity transaction');
        }
        
        elizaLogger.info('Executing remove liquidity transaction...');
        elizaLogger.info(`🔗 Pool: ${params.poolId}`);
        elizaLogger.info(`💧 LP Amount: ${params.lpAmountIn}`);
        elizaLogger.info(`📊 Slippage: ${params.slippage}%`);
        elizaLogger.info(`👤 Wallet: ${params.walletKeypair.publicKey.toString()}`);
        
        // Direct manual transaction sending without SDK execute attempt
        // Add delay to avoid rate limiting
        elizaLogger.info('⏳ Waiting 10 seconds to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        elizaLogger.info('🚀 Executing remove liquidity transaction...');
        
        if (!removeLiqTx.transaction) {
            throw new Error('No transaction object available');
        }
        
        // Get fresh blockhash
        elizaLogger.info('Fetching fresh blockhash...');
        let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        
        const tx = removeLiqTx.transaction as any;
        tx.recentBlockhash = blockhash;
        tx.feePayer = params.walletKeypair.publicKey;
        
        if (tx.version === 'legacy' || !tx.version) {
            tx.sign(params.walletKeypair);
        } else {
            // For versioned transactions
            tx.sign([params.walletKeypair]);
        }
        
        // Add retry logic for rate limiting and blockhash issues
        let retries = 3;
        while (retries > 0) {
            try {
                elizaLogger.info(`📤 Sending transaction (attempt ${4 - retries}/3)...`);
                
                // Try sending with skipPreflight true to avoid simulation issues
                const signature = await connection.sendRawTransaction(
                    removeLiqTx.transaction.serialize(),
                    { 
                        skipPreflight: true, // Skip preflight to avoid blockhash simulation issues
                        maxRetries: 3
                    }
                );
                
                elizaLogger.info(`📋 Transaction sent with signature: ${signature}`);
                elizaLogger.info(`⏳ Waiting for confirmation...`);
                
                // Use polling-based confirmation to avoid WebSocket
                elizaLogger.info(`⏳ Confirming transaction...`);
                
                // Poll for transaction status instead of using WebSocket
                let confirmed = false;
                const maxAttempts = 30;
                for (let i = 0; i < maxAttempts; i++) {
                    try {
                        const status = await connection.getSignatureStatus(signature);
                        if (status?.value?.confirmationStatus === 'confirmed' || 
                            status?.value?.confirmationStatus === 'finalized') {
                            confirmed = true;
                            break;
                        }
                    } catch (e) {
                        // Ignore errors during polling
                    }
                    
                    // Wait 1 second between polls
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                if (confirmed) {
                    elizaLogger.info(`✅ Remove liquidity transaction successful!`);
                } else {
                    elizaLogger.warn(`⚠️  Transaction confirmation timeout, but transaction may still be successful`);
                }
                
                elizaLogger.info(`🔗 Transaction ID: ${signature}`);
                elizaLogger.info(`🌐 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
                elizaLogger.info(`🌐 View on Solscan: https://solscan.io/tx/${signature}`);
                
                return signature;
                
            } catch (sendError: any) {
                elizaLogger.warn(`⚠️  Transaction send attempt ${4 - retries}/3 failed: ${sendError.message}`);
                
                if (sendError.message?.includes('429') && retries > 1) {
                    elizaLogger.warn(`Rate limited, waiting before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    retries--;
                } else if (sendError.message?.includes('Blockhash not found') && retries > 1) {
                    elizaLogger.warn(`Blockhash expired, getting fresh blockhash and retrying...`);
                    // Get a fresh blockhash for retry
                    const freshBlockhash = await connection.getLatestBlockhash('confirmed');
                    blockhash = freshBlockhash.blockhash;
                    lastValidBlockHeight = freshBlockhash.lastValidBlockHeight;
                    
                    // Update transaction with fresh blockhash
                    tx.recentBlockhash = blockhash;
                    if (tx.version === 'legacy' || !tx.version) {
                        tx.sign(params.walletKeypair);
                    } else {
                        tx.sign([params.walletKeypair]);
                    }
                    
                    retries--;
                } else {
                    throw sendError;
                }
            }
        }
        
        throw new Error('Failed to send transaction after all retries');

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

export async function harvestFarmRewards(
    connection: Connection,
    params: HarvestFarmParams
): Promise<string> {
    try {
        elizaLogger.info(`Attempting to harvest rewards from farm ${params.farmId}`);
        elizaLogger.info(`Using wallet: ${params.walletKeypair.publicKey.toString()}`);
        
        // Create a Raydium instance with the actual wallet
        const raydium = await Raydium.load({
            connection: connection as any,
            owner: params.walletKeypair.publicKey,
            disableLoadToken: false
        });

        elizaLogger.info('Raydium instance created successfully');
        
        // Fetch farm info from API
        elizaLogger.info('Fetching farm info...');
        const farmInfos = await raydium.api.fetchFarmInfoById({ ids: params.farmId });
        
        if (!farmInfos || Object.keys(farmInfos).length === 0) {
            throw new Error(`Farm ${params.farmId} not found`);
        }
        
        const farmInfo = Object.values(farmInfos)[0];
        elizaLogger.info('Farm info retrieved:', {
            id: farmInfo.id,
            lpMint: farmInfo.lpMint.address,
            programId: farmInfo.programId,
            rewardCount: farmInfo.rewardInfos?.length || 0
        });
        
        // Harvest rewards by withdrawing 0 LP tokens
        // This will claim rewards without removing any staked LP
        elizaLogger.info('Building harvest transaction (withdraw with amount=0)...');
        
        const harvestTx = await raydium.farm.withdraw({
            farmInfo: farmInfo,
            amount: 0, // Harvest only - don't unstake any LP
            useSOLBalance: true, // Handle SOL rewards properly
            associatedOnly: true, // Use associated token accounts
        });
        
        if (!harvestTx) {
            throw new Error('Failed to build harvest transaction');
        }
        
        elizaLogger.info('Executing harvest transaction...');
        
        // Execute transaction using the SDK's built-in method
        try {
            const result = await harvestTx.execute();
            const txId = typeof result === 'string' ? result : result?.txId;
            elizaLogger.info(`✅ Harvest successful: ${txId}`);
            return txId;
        } catch (execError: any) {
            // If execute fails, try manual signing and sending
            if (execError.message?.includes('429') || execError.message?.includes('Too Many Requests')) {
                elizaLogger.warn('Rate limited, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Try manual transaction sending as fallback
            elizaLogger.info('Trying manual transaction sending...');
            if (harvestTx.transaction) {
                // Get fresh blockhash
                elizaLogger.info('Fetching fresh blockhash...');
                let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
                
                const tx = harvestTx.transaction as any;
                tx.recentBlockhash = blockhash;
                tx.feePayer = params.walletKeypair.publicKey;
                
                if (tx.version === 'legacy' || !tx.version) {
                    tx.sign(params.walletKeypair);
                } else {
                    // For versioned transactions
                    tx.sign([params.walletKeypair]);
                }
                
                // Add retry logic for rate limiting
                let retries = 3;
                while (retries > 0) {
                    try {
                        const signature = await connection.sendRawTransaction(
                            harvestTx.transaction.serialize(),
                            { 
                                skipPreflight: true, // Skip preflight to avoid blockhash simulation issues
                                maxRetries: 3
                            }
                        );
                        
                        // Poll for confirmation instead of using WebSocket
                        let confirmed = false;
                        for (let i = 0; i < 30; i++) {
                            try {
                                const status = await connection.getSignatureStatus(signature);
                                if (status?.value?.confirmationStatus === 'confirmed' || 
                                    status?.value?.confirmationStatus === 'finalized') {
                                    confirmed = true;
                                    break;
                                }
                            } catch (e) {
                                // Ignore errors during polling
                            }
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        
                        if (confirmed) {
                            elizaLogger.info(`✅ Harvest successful (manual): ${signature}`);
                        } else {
                            elizaLogger.warn(`⚠️  Harvest confirmation timeout, but transaction may be successful`);
                        }
                        elizaLogger.info(`🌐 View on Solscan: https://solscan.io/tx/${signature}`);
                        return signature;
                    } catch (sendError: any) {
                        if (sendError.message?.includes('429') && retries > 1) {
                            elizaLogger.warn(`Rate limited, retry ${4 - retries}/3 after delay...`);
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            retries--;
                        } else {
                            throw sendError;
                        }
                    }
                }
            }
            throw execError;
        }

    } catch (error) {
        elizaLogger.error('Error harvesting farm rewards:', error);
        throw error;
    }
}

export async function unstakeFarmLP(
    connection: Connection,
    params: UnstakeFarmParams
): Promise<string> {
    try {
        elizaLogger.info(`Attempting to unstake ${params.amount} LP tokens from farm ${params.farmId}`);
        elizaLogger.info(`Using wallet: ${params.walletKeypair.publicKey.toString()}`);
        
        // Create a Raydium instance with the actual wallet
        const raydium = await Raydium.load({
            connection: connection as any,
            owner: params.walletKeypair.publicKey,
            disableLoadToken: false
        });

        elizaLogger.info('Raydium instance created successfully');
        
        // Fetch farm info from API
        elizaLogger.info('Fetching farm info...');
        const farmInfos = await raydium.api.fetchFarmInfoById({ ids: params.farmId });
        
        if (!farmInfos || Object.keys(farmInfos).length === 0) {
            throw new Error(`Farm ${params.farmId} not found`);
        }
        
        const farmInfo = Object.values(farmInfos)[0];
        elizaLogger.info('Farm info retrieved:', {
            id: farmInfo.id,
            lpMint: farmInfo.lpMint.address,
            programId: farmInfo.programId,
            rewardCount: farmInfo.rewardInfos?.length || 0
        });
        
        // Unstake LP tokens by withdrawing the specified amount
        elizaLogger.info(`Building unstake transaction for ${params.amount} LP tokens...`);
        
        const unstakeTx = await raydium.farm.withdraw({
            farmInfo: farmInfo,
            amount: params.amount, // Amount of LP tokens to unstake
            useSOLBalance: true, // Handle SOL rewards properly
            associatedOnly: true, // Use associated token accounts
        });
        
        if (!unstakeTx) {
            throw new Error('Failed to build unstake transaction');
        }
        
        elizaLogger.info('Executing unstake transaction...');
        
        // Execute transaction using the SDK's built-in method
        try {
            const result = await unstakeTx.execute();
            const txId = typeof result === 'string' ? result : result?.txId;
            elizaLogger.info(`✅ Unstake successful: ${txId}`);
            return txId;
        } catch (execError: any) {
            // If execute fails, try manual signing and sending
            if (execError.message?.includes('429') || execError.message?.includes('Too Many Requests')) {
                elizaLogger.warn('Rate limited, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Try manual transaction sending as fallback
            elizaLogger.info('Trying manual transaction sending...');
            if (unstakeTx.transaction) {
                // Get fresh blockhash
                elizaLogger.info('Fetching fresh blockhash...');
                let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
                
                const tx = unstakeTx.transaction as any;
                tx.recentBlockhash = blockhash;
                tx.feePayer = params.walletKeypair.publicKey;
                
                if (tx.version === 'legacy' || !tx.version) {
                    tx.sign(params.walletKeypair);
                } else {
                    // For versioned transactions
                    tx.sign([params.walletKeypair]);
                }
                
                // Add retry logic for rate limiting
                let retries = 3;
                while (retries > 0) {
                    try {
                        const signature = await connection.sendRawTransaction(
                            unstakeTx.transaction.serialize(),
                            { 
                                skipPreflight: true, // Skip preflight to avoid blockhash simulation issues
                                maxRetries: 3
                            }
                        );
                        
                        // Poll for confirmation instead of using WebSocket
                        let confirmed = false;
                        for (let i = 0; i < 30; i++) {
                            try {
                                const status = await connection.getSignatureStatus(signature);
                                if (status?.value?.confirmationStatus === 'confirmed' || 
                                    status?.value?.confirmationStatus === 'finalized') {
                                    confirmed = true;
                                    break;
                                }
                            } catch (e) {
                                // Ignore errors during polling
                            }
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        
                        if (confirmed) {
                            elizaLogger.info(`✅ Unstake successful (manual): ${signature}`);
                        } else {
                            elizaLogger.warn(`⚠️  Unstake confirmation timeout, but transaction may be successful`);
                        }
                        elizaLogger.info(`🌐 View on Solscan: https://solscan.io/tx/${signature}`);
                        return signature;
                    } catch (sendError: any) {
                        if (sendError.message?.includes('429') && retries > 1) {
                            elizaLogger.warn(`Rate limited, retry ${4 - retries}/3 after delay...`);
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            retries--;
                        } else {
                            throw sendError;
                        }
                    }
                }
            }
            throw execError;
        }

    } catch (error) {
        elizaLogger.error('Error unstaking farm LP tokens:', error);
        throw error;
    }
}