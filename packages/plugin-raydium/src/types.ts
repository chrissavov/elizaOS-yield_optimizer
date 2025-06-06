import type { PublicKey } from '@solana/web3.js';

/**
 * Interface representing Raydium pool information
 */
export interface RaydiumPoolInfo {
  poolId: string;
  baseVault?: string;
  quoteVault?: string;
  baseReserve?: string;
  quoteReserve?: string;
  mintAAmount?: string;
  mintBAmount?: string;
  poolPrice?: string;
  lpMint?: string;
  baseDecimals?: number;
  quoteDecimals?: number;
  lpDecimals?: number;
  version?: number;
  programId?: string;
  authority?: string;
  openOrders?: string;
  targetOrders?: string;
  baseDecimal?: number;
  quoteDecimal?: number;
  lpDecimal?: number;
  marketVersion?: number;
  marketProgramId?: string;
  marketId?: string;
  marketAuthority?: string;
  marketBaseVault?: string;
  marketQuoteVault?: string;
  marketBids?: string;
  marketAsks?: string;
  marketEventQueue?: string;
  [key: string]: any; // Allow additional properties from the API
}

/**
 * Interface representing a user's Raydium LP position
 */
export interface UserRaydiumPosition {
  poolId: string;
  lpMint: string;
  balance: string;
  tokenAccount: string;
  poolInfo: any; // Pool info from API
}

/**
 * Interface for mint addresses result
 */
export interface MintAddresses {
  mintA: string | null;
  mintB: string | null;
}

/**
 * Interface for Raydium API pool data
 */
export interface RaydiumApiPoolData {
  id: string;
  mintA: string;
  mintB: string;
  lpMint: string;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  mintADecimals: number;
  mintBDecimals: number;
  lpDecimals: number;
  [key: string]: any;
}

/**
 * Interface for Raydium token info
 */
export interface RaydiumTokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  name?: string;
  logoURI?: string;
  [key: string]: any;
}