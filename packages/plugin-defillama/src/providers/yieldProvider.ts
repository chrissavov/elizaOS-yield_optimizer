import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";

interface YieldProviderOptions {
  stablecoinOnly?: boolean;
  limit?: number;
  minTvl?: number;
  chain?: string;
}

export class YieldProvider implements Provider {
  private filterPools(pools: any[], options: YieldProviderOptions): any[] {
    let filtered = pools;
    if (options.stablecoinOnly) {
      filtered = filtered.filter(pool => pool.stablecoin);
    }
    if (options.chain) {
      filtered = filtered.filter(pool =>
        pool.chain && pool.chain.toLowerCase() === options.chain!.toLowerCase()
      );
    }
    const minTvl = options.minTvl ?? 1_000_000;
    filtered = filtered.filter(pool => pool.tvlUsd >= minTvl);
    filtered = filtered.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));
    return filtered;
  }

  async get(runtime: IAgentRuntime, message: Memory, state?: State, options: YieldProviderOptions = {}): Promise<string> {
    const response = await fetch("https://yields.llama.fi/pools");
    const data = await response.json();
    const filtered = this.filterPools(data.data, options);
    const limit = options.limit ?? 5;
    const formatted = filtered.slice(0, limit).map((pool: any, i: number) => {
      return `${i + 1}. ${pool.project} on ${pool.chain} (${pool.symbol}): ${pool.apy?.toFixed(2) ?? "?"}% APY, TVL: $${Math.round(pool.tvlUsd).toLocaleString()}`;
    }).join("\n");
    return formatted || "No yield opportunities found at this time.";
  }

  async getRaw(runtime: IAgentRuntime, message: Memory, state?: State, options: YieldProviderOptions = {}): Promise<any[]> {
    const response = await fetch("https://yields.llama.fi/pools");
    const data = await response.json();
    return this.filterPools(data.data, options);
  }
}
