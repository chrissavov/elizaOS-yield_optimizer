// Import pool-related functions
import { getRaydiumPoolInfo, findRaydiumPoolAddressBySymbol, findRaydiumPoolByMints } from './pool-info';

// Import token-related functions
import { getMintForSymbol, getMintsForSymbol } from './token-utils';

// Import user position functions
import { getUserRaydiumPositions } from './user-positions';

// Import transaction functions
import {
  addLiquidity,
  removeLiquidity,
  getUserLpBalance,
  estimateRemoveLiquidity,
  poolContainsSol
} from './transactions';

// Import utility functions
import { getAllUserPositions, clearPoolCache } from './utils';

// Import raydium instance helper
import { getRaydiumInstance } from './raydium-instance';

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
  getAllUserPositions,
  // Transaction functions
  addLiquidity,
  removeLiquidity,
  getUserLpBalance,
  estimateRemoveLiquidity,
  poolContainsSol,
  // Helper functions
  getRaydiumInstance,
  clearPoolCache,
};

export default raydiumPlugin;

// Re-export all functions
export {
  // Pool info functions
  getRaydiumPoolInfo,
  findRaydiumPoolAddressBySymbol,
  findRaydiumPoolByMints,
  // Token utilities
  getMintForSymbol,
  getMintsForSymbol,
  // User positions
  getUserRaydiumPositions,
  // Transaction functions
  addLiquidity,
  removeLiquidity,
  getUserLpBalance,
  estimateRemoveLiquidity,
  poolContainsSol,
  // Utility functions
  getAllUserPositions,
  getRaydiumInstance,
  clearPoolCache,
};

// Export types
export type {
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
