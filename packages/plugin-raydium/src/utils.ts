import { Connection, PublicKey } from '@solana/web3.js';
import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { elizaLogger } from './logger';

// Try multiple endpoints for pool data
const POOL_LIST_URLS = [
  'https://api.raydium.io/v2/main/pairs',
  'https://api.raydium.io/v2/ammV3/ammPools',
  'https://api.raydium.io/v2/sdk/liquidity/mainnet.json'
];

export interface RaydiumPoolData {
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  withdrawQueue?: string;
  lpVault?: string;
  marketVersion: number;
  marketProgramId: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  lookupTableAccount?: string;
}

// Cache for pool data
let cachedPoolData: Map<string, RaydiumPoolData> | null = null;
let lastPoolFetch = 0;
const POOL_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export async function fetchAllRaydiumPools(): Promise<Map<string, RaydiumPoolData>> {
  const now = Date.now();
  
  if (cachedPoolData && now - lastPoolFetch < POOL_CACHE_TIME) {
    return cachedPoolData;
  }

  const poolMap = new Map<string, RaydiumPoolData>();

  // Use the smaller, more reliable endpoint
  try {
    elizaLogger.info('Fetching Raydium pools from pairs endpoint...');
    const response = await fetch('https://api.raydium.io/v2/main/pairs');
    const data = await response.json();
    
    if (data && Array.isArray(data)) {
      elizaLogger.info(`Processing ${data.length} pairs`);
      for (const pair of data) {
        if (pair.lpMint) {
          // Ensure we have the right structure
          const poolData = {
            id: pair.id || pair.ammId || pair.poolId,
            baseMint: pair.baseMint,
            quoteMint: pair.quoteMint,
            lpMint: pair.lpMint,
            baseDecimals: pair.baseDecimals,
            quoteDecimals: pair.quoteDecimals,
            lpDecimals: pair.lpDecimals,
            version: pair.version,
            programId: pair.programId,
            authority: pair.authority,
            openOrders: pair.openOrders,
            targetOrders: pair.targetOrders,
            baseVault: pair.baseVault,
            quoteVault: pair.quoteVault,
            marketVersion: pair.marketVersion,
            marketProgramId: pair.marketProgramId,
            marketId: pair.marketId,
            marketAuthority: pair.marketAuthority,
            marketBaseVault: pair.marketBaseVault,
            marketQuoteVault: pair.marketQuoteVault,
            marketBids: pair.marketBids,
            marketAsks: pair.marketAsks,
            marketEventQueue: pair.marketEventQueue,
            ...pair // Include any other fields
          };
          poolMap.set(pair.lpMint, poolData);
        }
      }
      elizaLogger.info(`Successfully cached ${poolMap.size} Raydium pools`);
      cachedPoolData = poolMap;
      lastPoolFetch = now;
    } else {
      elizaLogger.error('Invalid response structure from pairs endpoint');
    }
    
    return poolMap;
  } catch (error) {
    elizaLogger.error('Error fetching Raydium pools:', error);
    return cachedPoolData || new Map();
  }
}

export async function isRaydiumLpToken(mintAddress: string): Promise<RaydiumPoolData | null> {
  const poolMap = await fetchAllRaydiumPools();
  return poolMap.get(mintAddress) || null;
}

// Enhanced function to get all user positions
export async function getAllUserPositions(
  userPublicKey: string | PublicKey,
  rpcUrl: string
): Promise<{
  unstakedPositions: any[];
  totalPositions: number;
}> {
  const { getUserRaydiumPositions } = await import('./index');
  
  elizaLogger.info('Fetching all user positions (unstaked)...');
  
  // Get unstaked LP positions
  const unstakedPositions = await getUserRaydiumPositions(userPublicKey, rpcUrl);
  elizaLogger.info(`Found ${unstakedPositions.length} unstaked LP positions`);
  
  return {
    unstakedPositions,
    totalPositions: unstakedPositions.length
  };
}

// Simple logger for the utils module
const logger = {
  info: (...args: any[]) => console.log('[Raydium Utils]', ...args),
  error: (...args: any[]) => console.error('[Raydium Utils Error]', ...args),
  warn: (...args: any[]) => console.warn('[Raydium Utils Warning]', ...args)
};

// Use simple logger if elizaLogger is not available
if (!elizaLogger) {
  Object.assign(elizaLogger, logger);
}

// Function to clear the pool cache
export function clearPoolCache() {
  if (cachedPoolData) {
    cachedPoolData.clear();
    cachedPoolData = null;
    lastPoolFetch = 0;
    elizaLogger.info('Cleared Raydium pool cache');
  }
}