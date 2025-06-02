import { Connection, PublicKey } from '@solana/web3.js';
import { elizaLogger } from './logger';

// Fast farm position check - only check specific LP tokens
export async function checkFarmPositionsForLpTokens(
  userPublicKey: string | PublicKey,
  lpTokenMints: string[],
  rpcUrl: string
): Promise<any[]> {
  if (lpTokenMints.length === 0) {
    elizaLogger.info("No LP tokens provided for farm checking");
    return [];
  }

  elizaLogger.info(`Fast farm check for ${lpTokenMints.length} specific LP tokens`);
  
  const { getUserFarmPosition } = await import('./index');
  const farmPositions = [];

  for (const lpMint of lpTokenMints) {
    elizaLogger.info(`Checking farms for LP token: ${lpMint}`);
    try {
      const positions = await getUserFarmPosition(userPublicKey, lpMint, rpcUrl);
      farmPositions.push(...positions);
      
      if (positions.length > 0) {
        elizaLogger.info(`✅ Found ${positions.length} farm positions for LP ${lpMint}`);
      } else {
        elizaLogger.info(`❌ No farm positions found for LP ${lpMint}`);
      }
    } catch (error) {
      elizaLogger.error(`Error checking farms for LP ${lpMint}:`, error.message);
    }
  }

  elizaLogger.info(`Total farm positions found: ${farmPositions.length}`);
  return farmPositions;
}

// Helper to extract LP token mints from positions
export function extractLpTokenMints(positions: any[]): string[] {
  return positions.map(pos => pos.lpMint).filter(mint => mint);
}