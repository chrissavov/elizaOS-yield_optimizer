import { Raydium } from '@raydium-io/raydium-sdk-v2';
import type { MintAddresses } from './types';
import { getRaydiumInstance } from './raydium-instance';

// Utility to get mint address for a given symbol from Raydium token list
export async function getMintForSymbol(symbol: string, raydiumInstance: Raydium): Promise<string | null> {
  const tokenList = await raydiumInstance.api.getTokenList();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const token = raydiumInstance.token.tokenList.find((t: any) =>
    t.symbol && t.symbol.trim().toUpperCase() === normalizedSymbol
  );
  return token ? token.address : null;
}

export async function getMintsForSymbol(symbol: string, rpcUrl?: string): Promise<MintAddresses> {
  const raydium = await getRaydiumInstance(rpcUrl);
  const [symbolA, symbolB] = symbol.split('-');
  const mintA = await getMintForSymbol(symbolA, raydium);
  const mintB = await getMintForSymbol(symbolB, raydium);
  return { mintA, mintB };
}