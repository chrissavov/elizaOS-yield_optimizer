import { Raydium } from '@raydium-io/raydium-sdk-v2';
import type {
  RaydiumPoolInfo, 
  RaydiumApiPoolData
} from './types';
import { getRaydiumInstance } from './raydium-instance';

export async function getRaydiumPoolInfo(poolId: string, rpcUrl?: string): Promise<RaydiumPoolInfo | null> {
  try {
    const raydium = await getRaydiumInstance(rpcUrl);
    // Use the liquidity module for robust info
    const poolInfo = await raydium.liquidity.getRpcPoolInfo(poolId);
    if (!poolInfo) throw new Error('Pool not found or could not fetch info');
    // Normalize output
    // Convert relevant fields to strings for consistent API
    const result: RaydiumPoolInfo = {
      poolId,
      baseVault: poolInfo.baseVault?.toString(),
      quoteVault: poolInfo.quoteVault?.toString(),
      baseReserve: poolInfo.baseReserve?.toString(),
      quoteReserve: poolInfo.quoteReserve?.toString(),
      mintAAmount: poolInfo.mintAAmount?.toString(),
      mintBAmount: poolInfo.mintBAmount?.toString(),
      poolPrice: poolInfo.poolPrice?.toString(),
    };
    // Add other properties from poolInfo
    Object.keys(poolInfo).forEach(key => {
      if (!(key in result)) {
        result[key] = poolInfo[key];
      }
    });
    return result;
  } catch (err) {
    console.error('[RaydiumPlugin] Error fetching pool info:', err);
    return null;
  }
}

export async function findRaydiumPoolAddressBySymbol(symbol: string, rpcUrl?: string): Promise<string | null> {
  const raydium = await getRaydiumInstance(rpcUrl);
  const poolList = await raydium.api.getPoolList({ pageSize: 1000 });
  console.log('[RaydiumPlugin] Total pools fetched:', poolList.data.length);

  // Parse the symbol (e.g., "BOME-WSOL")
  const [symbolA, symbolB] = symbol.split('-');
  
  // Import getMintForSymbol from token-utils
  const { getMintForSymbol } = await import('./token-utils');
  
  const mintA = await getMintForSymbol(symbolA, raydium);
  const mintB = await getMintForSymbol(symbolB, raydium);
  if (!mintA || !mintB) {
    console.error(`[RaydiumPlugin] Could not find mint for symbol(s): ${symbolA}, ${symbolB}`);
    return null;
  }
  // Find pool where mintA/mintB match (in either order)
  const match = poolList.data.find((pool: any) =>
    (pool.mintA === mintA && pool.mintB === mintB) ||
    (pool.mintA === mintB && pool.mintB === mintA)
  );
  if (!match) {
    console.error(`[RaydiumPlugin] Could not find Raydium pool for mints: ${mintA}, ${mintB}`);
    return null;
  }
  return match.id;
}

export async function findRaydiumPoolByMints(mintA: string, mintB: string, rpcUrl?: string): Promise<RaydiumApiPoolData | null> {
  const raydium = await getRaydiumInstance(rpcUrl);
  // Only call once, SDK sorts mints internally
  const result = await raydium.api.fetchPoolByMints({ mint1: mintA, mint2: mintB });
  if (result && Array.isArray(result.data) && result.data.length > 0) {
    const pool = result.data[0];
    // The API v3 has different structure, handle both cases
    const poolData: RaydiumApiPoolData = {
      id: pool.id,
      mintA: typeof pool.mintA === 'string' ? pool.mintA : pool.mintA?.address || mintA,
      mintB: typeof pool.mintB === 'string' ? pool.mintB : pool.mintB?.address || mintB,
      lpMint: '',  // Not available in v3 API
      version: 0,  // Not available in v3 API
      programId: pool.programId || '',
      authority: '',  // Not available in v3 API
      openOrders: '',  // Not available in v3 API
      targetOrders: '',  // Not available in v3 API
      mintADecimals: pool.mintA?.decimals || 0,
      mintBDecimals: pool.mintB?.decimals || 0,
      lpDecimals: 0,  // Not available in v3 API
    };
    
    // If it's a standard AMM pool (has these fields)
    if ('lpMint' in pool && typeof pool.lpMint === 'string') {
      poolData.lpMint = pool.lpMint;
    }
    if ('version' in pool && typeof pool.version === 'number') {
      poolData.version = pool.version;
    }
    if ('authority' in pool && typeof pool.authority === 'string') {
      poolData.authority = pool.authority;
    }
    if ('openOrders' in pool && typeof pool.openOrders === 'string') {
      poolData.openOrders = pool.openOrders;
    }
    if ('targetOrders' in pool && typeof pool.targetOrders === 'string') {
      poolData.targetOrders = pool.targetOrders;
    }
    if ('lpDecimals' in pool && typeof pool.lpDecimals === 'number') {
      poolData.lpDecimals = pool.lpDecimals;
    }
    
    return poolData;
  }
  return null;
}