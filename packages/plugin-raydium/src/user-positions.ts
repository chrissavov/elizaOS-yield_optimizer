import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import type { UserRaydiumPosition } from './types';

/**
 * Get all Raydium LP positions for a user (i.e., pools where user has a nonzero LP token balance)
 * @param userPublicKey - The user's Solana public key (string or PublicKey)
 * @param rpcUrl - Optional RPC URL
 * @param minBalance - Optional: minimum LP token balance to consider (default: 1)
 * @returns Array of { poolId, lpMint, balance, poolInfo }
 */
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';

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
  
  const nonZeroLpTokens = positions.length; // Count only positions with balance
  console.log(`[RaydiumPlugin] Found ${allLpTokens.size} total LP tokens, ${nonZeroLpTokens} with non-zero balance`);
  
  return positions;
}