import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { elizaLogger } from './logger';

// Enhanced position check that also looks for 0-balance LP tokens that might be farmed
export async function getCompleteUserPositions(
  userPublicKey: string | PublicKey,
  rpcUrl: string = 'https://api.mainnet-beta.solana.com'
): Promise<{
  unstakedPositions: any[];
  farmedPositions: any[];
  allLpTokens: string[];
  summary: string;
}> {
  const connection = new Connection(rpcUrl);
  const userPk = new PublicKey(userPublicKey);

  // Import functions
  const { isRaydiumLpToken } = await import('./utils');
  const { getUserFarmPosition } = await import('./index');

  elizaLogger.info("🔍 Starting complete position analysis...");

  // Step 1: Get all user token accounts (including 0 balance)
  const tokenAccounts = await connection.getTokenAccountsByOwner(userPk, { programId: TOKEN_PROGRAM_ID });
  elizaLogger.info(`Found ${tokenAccounts.value.length} total token accounts`);

  // Step 2: Check which ones are Raydium LP tokens
  const allLpTokens: string[] = [];
  const unstakedPositions = [];

  for (const acc of tokenAccounts.value) {
    const data = acc.account.data;
    const mint = new PublicKey(data.slice(0, 32)).toString();
    const amount = data.readBigUInt64LE(64);
    
    // Check if this is a Raydium LP token
    const poolData = await isRaydiumLpToken(mint);
    if (poolData) {
      allLpTokens.push(mint);
      
      if (amount > 0) {
        unstakedPositions.push({
          poolId: poolData.id,
          lpMint: mint,
          balance: amount.toString(),
          tokenAccount: acc.pubkey.toString(),
          poolInfo: poolData,
        });
        elizaLogger.info(`✅ Unstaked LP: ${mint.substring(0, 8)}... balance: ${(Number(amount) / 1e9).toFixed(6)}`);
      } else {
        elizaLogger.info(`📋 Zero-balance LP: ${mint.substring(0, 8)}... (checking farms)`);
      }
    }
  }

  elizaLogger.info(`Found ${allLpTokens.length} total LP tokens, ${unstakedPositions.length} with non-zero balance`);

  // Step 3: Check farm positions for ALL LP tokens (including 0-balance ones)
  const farmedPositions = [];
  
  for (const lpMint of allLpTokens) {
    try {
      const farmPos = await getUserFarmPosition(userPublicKey, lpMint, rpcUrl);
      farmedPositions.push(...farmPos);
      
      if (farmPos.length > 0) {
        for (const farm of farmPos) {
          elizaLogger.info(`✅ Farmed LP: ${lpMint.substring(0, 8)}... staked: ${(Number(farm.deposited) / 1e9).toFixed(6)}`);
        }
      }
    } catch (error) {
      // Silent continue
    }
  }

  // Step 4: Create summary
  const totalUnstakedValue = unstakedPositions.reduce((sum, pos) => sum + Number(pos.balance), 0);
  const totalFarmedValue = farmedPositions.reduce((sum, farm) => sum + Number(farm.deposited), 0);
  
  const summary = `${unstakedPositions.length} unstaked positions (${(totalUnstakedValue / 1e9).toFixed(2)} LP tokens), ${farmedPositions.length} farmed positions (${(totalFarmedValue / 1e9).toFixed(2)} LP tokens)`;

  return {
    unstakedPositions,
    farmedPositions,
    allLpTokens,
    summary
  };
}