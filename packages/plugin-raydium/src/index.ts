import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getAssociatedLedgerAccount, getFarmLedgerLayout } from '@raydium-io/raydium-sdk-v2/lib/raydium/farm/util';
import { PoolFetchType } from '@raydium-io/raydium-sdk-v2/lib/api/type';
import BN from 'bn.js';
import type { 
  RaydiumFarm, 
  FarmPosition, 
  RaydiumPoolInfo, 
  UserRaydiumPosition, 
  MintAddresses,
  RaydiumApiPoolData,
  RaydiumTokenInfo
} from './types';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const FARM_LIST_URL = 'https://api.raydium.io/v2/sdk/farm-v2/mainnet.json';
const FARM_LIST_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

// Utility to create a Raydium instance per call
async function getRaydiumInstance(rpcUrl: string = DEFAULT_RPC_URL): Promise<Raydium> {
  const connection = new Connection(rpcUrl);
  return await Raydium.load({ connection: connection as any });
}

export async function getRaydiumPoolInfo(poolId: string, rpcUrl: string = DEFAULT_RPC_URL): Promise<RaydiumPoolInfo | null> {
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

// Utility to get mint address for a given symbol from Raydium token list
async function getMintForSymbol(symbol: string, raydiumInstance: Raydium): Promise<string | null> {
  const tokenList = await raydiumInstance.api.getTokenList();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const token = raydiumInstance.token.tokenList.find((t: any) =>
    t.symbol && t.symbol.trim().toUpperCase() === normalizedSymbol
  );
  return token ? token.address : null;
}

export async function getMintsForSymbol(symbol: string, rpcUrl: string = DEFAULT_RPC_URL): Promise<MintAddresses> {
  const raydium = await getRaydiumInstance(rpcUrl);
  const [symbolA, symbolB] = symbol.split('-');
  const mintA = await getMintForSymbol(symbolA, raydium);
  const mintB = await getMintForSymbol(symbolB, raydium);
  return { mintA, mintB };
}

export async function findRaydiumPoolAddressBySymbol(symbol: string, rpcUrl: string = DEFAULT_RPC_URL): Promise<string | null> {
  const raydium = await getRaydiumInstance(rpcUrl);
  const poolList = await raydium.api.getPoolList({ pageSize: 1000 });
  console.log('[RaydiumPlugin] Total pools fetched:', poolList.data.length);

  // Parse the symbol (e.g., "BOME-WSOL")
  const [symbolA, symbolB] = symbol.split('-');
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

export async function findRaydiumPoolByMints(mintA: string, mintB: string, rpcUrl: string = DEFAULT_RPC_URL): Promise<RaydiumApiPoolData | null> {
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

// getMintForSymbol is already exported in the plugin object below

/**
 * Get all Raydium LP positions for a user (i.e., pools where user has a nonzero LP token balance)
 * @param userPublicKey - The user's Solana public key (string or PublicKey)
 * @param rpcUrl - Optional RPC URL
 * @param minBalance - Optional: minimum LP token balance to consider (default: 1)
 * @returns Array of { poolId, lpMint, balance, poolInfo }
 */
export async function getUserRaydiumPositions(userPublicKey: string | PublicKey, rpcUrl: string = DEFAULT_RPC_URL, minBalance: number = 1): Promise<UserRaydiumPosition[]> {
  const connection = new Connection(rpcUrl);
  const userPk = new PublicKey(userPublicKey);

  // Import the enhanced pool fetching utility
  const { isRaydiumLpToken } = await import('./utils');

  // Fetch all user's SPL token accounts
  const tokenAccounts = await connection.getTokenAccountsByOwner(userPk, { programId: TOKEN_PROGRAM_ID });

  // Log all SPL token accounts with their mint and balance
  const allAccounts = tokenAccounts.value.map(acc => {
    const data = acc.account.data;
    const mint = new PublicKey(data.slice(0, 32)).toString();
    const amount = data.readBigUInt64LE(64);
    return {
      pubkey: acc.pubkey.toString(),
      mint,
      amount: amount.toString(),
    };
  });
  console.log('[RaydiumPlugin] All user SPL token accounts:', allAccounts);
  console.log('[RaydiumPlugin] Checking for Raydium LP tokens among', allAccounts.length, 'token accounts');

  const positions = [];
  
  // Also collect all LP tokens (even with 0 balance) for farm checking later
  const allLpTokens = new Set<string>();
  
  for (const acc of tokenAccounts.value) {
    const data = acc.account.data;
    const mint = new PublicKey(data.slice(0, 32)).toString();
    const amount = data.readBigUInt64LE(64);
    
    // Check if this is a Raydium LP token using our enhanced function
    const poolData = await isRaydiumLpToken(mint);
    if (poolData) {
      allLpTokens.add(mint); // Track all LP tokens regardless of balance
      
      // Only add to positions if balance meets minimum (for unstaked positions)
      if (amount >= BigInt(minBalance)) {
        positions.push({
          poolId: poolData.id,
          lpMint: mint,
          balance: amount.toString(),
          tokenAccount: acc.pubkey.toString(),
          poolInfo: poolData,
        });
        console.log(`[RaydiumPlugin] ✅ Found unstaked LP position: Pool ${poolData.id}, Balance: ${amount.toString()}`);
      }
    }
  }
  
  console.log(`[RaydiumPlugin] Found ${allLpTokens.size} total LP tokens, ${positions.length} with non-zero balance`);
  
  return positions;
}

// --- Farm List Fetcher ---
let cachedFarmList: RaydiumFarm[] | null = null;
let lastFarmListFetch = 0;

async function fetchFarmList(force = false): Promise<RaydiumFarm[]> {
  const now = Date.now();
  if (!cachedFarmList || force || now - lastFarmListFetch > FARM_LIST_CACHE_TIME) {
    try {
      console.log(`[RaydiumPlugin] Fetching farms from ${FARM_LIST_URL}`);
      const res = await fetch(FARM_LIST_URL);
      const data = await res.json();
      
      // Parse the farm-v2 mainnet.json structure
      let farms = [];
      
      // Add farms from different categories
      if (data.stake && Array.isArray(data.stake)) {
        console.log(`[RaydiumPlugin] Found ${data.stake.length} stake farms`);
        farms = [...farms, ...data.stake];
      }
      if (data.raydium && Array.isArray(data.raydium)) {
        console.log(`[RaydiumPlugin] Found ${data.raydium.length} raydium farms`);
        farms = [...farms, ...data.raydium];
      }
      if (data.fusion && Array.isArray(data.fusion)) {
        console.log(`[RaydiumPlugin] Found ${data.fusion.length} fusion farms`);
        farms = [...farms, ...data.fusion];
      }
      if (data.ecosystem && Array.isArray(data.ecosystem)) {
        console.log(`[RaydiumPlugin] Found ${data.ecosystem.length} ecosystem farms`);
        farms = [...farms, ...data.ecosystem];
      }
      
      // Fallback: if it's just an array
      if (Array.isArray(data)) {
        farms = data;
      }
      
      cachedFarmList = farms;
      lastFarmListFetch = now;
      console.log(`[RaydiumPlugin] Fetched ${cachedFarmList.length} Raydium farms total`);
    } catch (error) {
      console.error('[RaydiumPlugin] Error fetching farm list:', error);
      if (!cachedFarmList) {
        cachedFarmList = [];
      }
    }
  }
  return cachedFarmList;
}

// --- Farm Functions ---
export async function findFarmByLpMint(lpMint: string): Promise<RaydiumFarm | null> {
  const farmList = await fetchFarmList();
  return farmList.find(f => f.lpMint === lpMint) || null;
}

async function getFarmLedgerInfo(
  connection: Connection,
  farm: RaydiumFarm,
  userPk: PublicKey
): Promise<{ deposited: BN } | null> {
  try {
    const farmId = new PublicKey(farm.id);
    const programId = new PublicKey(farm.programId);
    
    if (![3, 5, 6].includes(farm.version)) {
      return null;
    }

    const ledger = getAssociatedLedgerAccount({
      programId,
      poolId: farmId,
      owner: userPk,
      version: farm.version as 3 | 5 | 6,
    });

    const ledgerData = await connection.getAccountInfo(ledger);
    if (!ledgerData) {
      return null;
    }

    const ledgerLayout = getFarmLedgerLayout(farm.version as 3 | 5 | 6);
    if (!ledgerLayout) {
      return null;
    }

    return ledgerLayout.decode(ledgerData.data);
  } catch (e) {
    console.warn('Error getting farm ledger info:', e);
    return null;
  }
}

// --- User Position Functions ---
export async function getUserFarmPosition(
  userPublicKey: string | PublicKey,
  lpMint: string,
  rpcUrl: string = DEFAULT_RPC_URL
): Promise<FarmPosition[]> {
  const farm = await findFarmByLpMint(lpMint);
  if (!farm) {
    console.log(`[RaydiumPlugin] ℹ️  No Raydium farm found for LP mint: ${lpMint}`);
    console.log(`[RaydiumPlugin] 💡 This LP token may be:`);
    console.log(`[RaydiumPlugin]    - Used in a non-Raydium farming protocol`);
    console.log(`[RaydiumPlugin]    - Part of an expired/ended farm`);
    console.log(`[RaydiumPlugin]    - Only available for unstaked LP positions`);
    return [];
  }

  // Check if the farm rewards have ended
  const now = Math.floor(Date.now() / 1000);
  const hasActiveRewards = farm.rewardInfos?.some(reward => 
    !reward.rewardEndTime || reward.rewardEndTime > now
  );
  
  if (!hasActiveRewards) {
    console.log(`[RaydiumPlugin] ⚠️  Farm found for LP mint ${lpMint}, but rewards have ended`);
    console.log(`[RaydiumPlugin] Farm ID: ${farm.id}`);
    console.log(`[RaydiumPlugin] Symbol: ${farm.symbol}`);
    if (farm.rewardInfos?.[0]?.rewardEndTime) {
      const endDate = new Date(farm.rewardInfos[0].rewardEndTime * 1000).toLocaleDateString();
      console.log(`[RaydiumPlugin] Reward period ended: ${endDate}`);
    }
    console.log(`[RaydiumPlugin] 💡 You may still have staked LP tokens that can be withdrawn`);
    
    // Continue to check for existing positions even if rewards ended
  }

  const connection = new Connection(rpcUrl);
  const userPk = new PublicKey(userPublicKey);
  const ledgerInfo = await getFarmLedgerInfo(connection, farm, userPk);

  if (!ledgerInfo?.deposited || ledgerInfo.deposited.isZero()) {
    return [];
  }

  return [{
    farmId: farm.id,
    lpMint: farm.lpMint,
    deposited: ledgerInfo.deposited.toString(),
    farmInfo: farm,
  }];
}

export async function getAllUserFarmPositions(
  userPublicKey: string | PublicKey,
  rpcUrl: string = DEFAULT_RPC_URL,
  targetLpMint?: string
): Promise<FarmPosition[]> {
  const connection = new Connection(rpcUrl);
  const userPk = new PublicKey(userPublicKey);
  const farmList = await fetchFarmList();
  console.log(`[RaydiumPlugin] Checking ${farmList.length} farms for staked positions`);
  
  const farmsToCheck = targetLpMint 
    ? farmList.filter(f => f.lpMint === targetLpMint)
    : farmList;

  console.log(`[RaydiumPlugin] Filtering to ${farmsToCheck.length} farms to check`);
  
  const positions: FarmPosition[] = [];
  
  // If checking all farms, this is too slow - implement batching with delays
  if (!targetLpMint && farmsToCheck.length > 100) {
    console.log(`[RaydiumPlugin] ⚠️  Warning: Checking ${farmsToCheck.length} farms will be slow due to rate limits`);
    console.log(`[RaydiumPlugin] Consider using specific LP tokens to avoid this`);
    
    // Check in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
    
    for (let i = 0; i < farmsToCheck.length; i += BATCH_SIZE) {
      const batch = farmsToCheck.slice(i, i + BATCH_SIZE);
      console.log(`[RaydiumPlugin] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(farmsToCheck.length/BATCH_SIZE)}`);
      
      const batchPromises = batch.map(async (farm) => {
        try {
          const ledgerInfo = await getFarmLedgerInfo(connection, farm, userPk);
          if (ledgerInfo?.deposited && !ledgerInfo.deposited.isZero()) {
            return {
              farmId: farm.id,
              lpMint: farm.lpMint,
              deposited: ledgerInfo.deposited.toString(),
              farmInfo: farm,
            };
          }
        } catch (error) {
          // Silent fail for batch processing
        }
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null);
      positions.push(...validResults);
      
      if (validResults.length > 0) {
        console.log(`[RaydiumPlugin] ✅ Found ${validResults.length} positions in this batch`);
      }
      
      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < farmsToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
  } else {
    // For targeted checks or small numbers, check individually
    for (const farm of farmsToCheck) {
      try {
        const ledgerInfo = await getFarmLedgerInfo(connection, farm, userPk);
        if (ledgerInfo?.deposited && !ledgerInfo.deposited.isZero()) {
          positions.push({
            farmId: farm.id,
            lpMint: farm.lpMint,
            deposited: ledgerInfo.deposited.toString(),
            farmInfo: farm,
          });
          console.log(`[RaydiumPlugin] ✅ Found farm position: Farm ${farm.id}, LP Mint: ${farm.lpMint}, Deposited: ${ledgerInfo.deposited.toString()}`);
        }
      } catch (error) {
        if (targetLpMint) {
          console.log(`[RaydiumPlugin] Error checking farm ${farm.id} for LP ${farm.lpMint}:`, error.message);
        }
      }
    }
  }

  console.log(`[RaydiumPlugin] Total farm positions found: ${positions.length}`);
  return positions;
}

// Import transaction functions
import {
  addLiquidity,
  removeLiquidity,
  getUserLpBalance,
  estimateRemoveLiquidity,
  poolContainsSol
} from './transactions';

// Import utility functions
import { getAllUserPositions } from './utils';

// --- Plugin Export ---
const raydiumPlugin = {
  name: "raydium",
  description: "Raydium AMM plugin for Solana yield and pool info",
  actions: [],
  providers: [],
  getRaydiumPoolInfo,
  findRaydiumPoolAddressBySymbol,
  getMintForSymbol,
  getMintsForSymbol,
  findRaydiumPoolByMints,
  getUserRaydiumPositions,
  getUserFarmPosition,
  getAllUserFarmPositions,
  findFarmByLpMint,
  getAllUserPositions,
  // Transaction functions
  addLiquidity,
  removeLiquidity,
  getUserLpBalance,
  estimateRemoveLiquidity,
  poolContainsSol,
};

export default raydiumPlugin;

// Re-export transaction functions
export {
  addLiquidity,
  removeLiquidity,
  getUserLpBalance,
  estimateRemoveLiquidity,
  poolContainsSol,
  getAllUserPositions
};

// Export types
export type {
  RaydiumFarm,
  FarmRewardInfo,
  FarmPosition,
  RaydiumPoolInfo,
  UserRaydiumPosition,
  MintAddresses,
  RaydiumApiPoolData,
  RaydiumTokenInfo
} from './types';

export type {
  AddLiquidityParams,
  RemoveLiquidityParams,
  SwapParams
} from './transactions';
