import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { Connection } from '@solana/web3.js';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';

// Utility to create a Raydium instance per call
export async function getRaydiumInstance(rpcUrl: string = DEFAULT_RPC_URL): Promise<Raydium> {
  const connection = new Connection(rpcUrl);
  return await Raydium.load({ connection: connection as any });
}