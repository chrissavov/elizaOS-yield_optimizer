import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { YieldProvider } from "../providers/yieldProvider";

function extractMinTvl(content: string, defaultTvl?: number): number | undefined {
  // Match patterns like 'tvl over 10 million', 'tvl > 5m', 'tvl above $5,000,000', etc.
  // Also handle 'ignore tvl', 'no tvl filter', 'any tvl'
  if (/ignore tvl|no tvl filter|any tvl/i.test(content)) {
    return 0;
  }
  // Regex to match TVL expressions
  const tvlMatch = content.match(/tvl\s*(over|above|greater than|>|minimum)?\s*\$?([\d,.]+)\s*(k|m|b|thousand|million|billion)?/i);
  if (tvlMatch) {
    let value = parseFloat(tvlMatch[2].replace(/,/g, ""));
    let multiplier = 1;
    if (tvlMatch[3]) {
      const unit = tvlMatch[3].toLowerCase();
      if (unit === 'k' || unit === 'thousand') multiplier = 1_000;
      else if (unit === 'm' || unit === 'million') multiplier = 1_000_000;
      else if (unit === 'b' || unit === 'billion') multiplier = 1_000_000_000;
    }
    return value * multiplier;
  }
  // Also match things like '5 million TVL', 'minimum TVL 10m', etc.
  const altMatch = content.match(/(\$?[\d,.]+)\s*(k|m|b|thousand|million|billion)?\s*(tvl)/i);
  if (altMatch) {
    let value = parseFloat(altMatch[1].replace(/,/g, ""));
    let multiplier = 1;
    if (altMatch[2]) {
      const unit = altMatch[2].toLowerCase();
      if (unit === 'k' || unit === 'thousand') multiplier = 1_000;
      else if (unit === 'm' || unit === 'million') multiplier = 1_000_000;
      else if (unit === 'b' || unit === 'billion') multiplier = 1_000_000_000;
    }
    return value * multiplier;
  }
  // Only return defaultTvl if it is defined
  if (typeof defaultTvl === "number") return defaultTvl;
  return undefined;
}

const stablecoinRegex = /(stablecoin|usdc|usdt|dai|tusd|usdp|usde|usd0|frax|lusd|susd)/i;

export class GetStablecoinYieldOpportunitiesAction implements Action {
  name = "GET_STABLECOIN_YIELD_OPPORTUNITIES";
  similes = ["FETCH_STABLECOIN_YIELD", "CHECK_STABLECOIN_YIELD", "STABLECOIN_YIELD_OPPORTUNITIES"];
  description = "Fetches and returns the top 10 stablecoin yield opportunities from DefiLlama";
  suppressInitialMessage = true;
  template = "Determine if this is a stablecoin yield request and fetch the top 10 stablecoin yield opportunities.";

  examples = [
    [
      {
        user: "{{user}}",
        content: { text: "Show me the best stablecoin APY" }
      },
      {
        user: "{{system}}",
        content: { text: "Here are the top 10 stablecoin yield opportunities: ...", action: "GET_STABLECOIN_YIELD_OPPORTUNITIES" }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "List the highest DeFi yields for stablecoins" }
      },
      {
        user: "{{system}}",
        content: { text: "Listing the highest DeFi yields for stablecoins: ...", action: "GET_STABLECOIN_YIELD_OPPORTUNITIES" }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "Can you get the yield opportunities for stablecoins only?" }
      },
      {
        user: "{{system}}",
        content: { text: "Here are the top 10 stablecoin yield opportunities: ...", action: "GET_STABLECOIN_YIELD_OPPORTUNITIES" }
      }
    ]
  ];

  async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    // Only match if the message is specifically about stablecoins
    const result = stablecoinRegex.test(content);
    return result;
  }

  async handler(runtime: IAgentRuntime, message: Memory, state?: State, _options = {}, callback?: HandlerCallback): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    const minTvl = extractMinTvl(content, 1_000_000);
    const provider = new YieldProvider();
    const result = await provider.get(runtime, message, state, { stablecoinOnly: true, limit: 10, minTvl });
    if (callback) await callback({ text: result, action: this.name });
    if (state) state.responseData = { text: result, action: this.name };
    return true;
  }
}

export class GetYieldOpportunitiesAction implements Action {
  name = "GET_YIELD_OPPORTUNITIES";
  similes = ["FETCH_YIELD", "CHECK_YIELD", "YIELD_OPPORTUNITIES"];
  description = "Fetches and returns the top 10 overall yield opportunities from DefiLlama";
  suppressInitialMessage = true;
  template = "Determine if this is a general yield request and fetch the top 10 overall yield opportunities.";

  examples = [
    [
      {
        user: "{{user}}",
        content: { text: "Show me the best DeFi APY" }
      },
      {
        user: "{{system}}",
        content: { text: "Here are the top 10 overall yield opportunities: ...", action: "GET_YIELD_OPPORTUNITIES" }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "List the highest DeFi yields" }
      },
      {
        user: "{{system}}",
        content: { text: "Listing the highest DeFi yields: ...", action: "GET_YIELD_OPPORTUNITIES" }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "Can you get yield opportunities for all?" }
      },
      {
        user: "{{system}}",
        content: { text: "Here are the top 10 overall yield opportunities: ...", action: "GET_YIELD_OPPORTUNITIES" }
      }
    ]
  ];

  async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    // Only match if NOT specifically about stablecoins
    const result = /apy|yield|interest|staking/i.test(content) && !stablecoinRegex.test(content);
    return result;
  }

  async handler(runtime: IAgentRuntime, message: Memory, state?: State, _options = {}, callback?: HandlerCallback): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    const minTvl = extractMinTvl(content, 1_000_000);
    const provider = new YieldProvider();
    const result = await provider.get(runtime, message, state, { stablecoinOnly: false, limit: 10, minTvl });
    if (callback) await callback({ text: result, action: this.name });
    if (state) state.responseData = { text: result, action: this.name };
    return true;
  }
}

export class GetSolanaStablecoinYieldsAction implements Action {
  name = "GET_SOLANA_STABLECOIN_YIELD_OPPORTUNITIES";
  similes = ["FETCH_SOLANA_STABLECOIN_YIELD", "SOLANA_STABLECOIN_YIELD_OPPORTUNITIES", "SOLANA_STABLECOIN_YIELDS"];
  description = "Fetches and returns the top 25 stablecoin yield opportunities on Solana from DefiLlama";
  suppressInitialMessage = true;
  template = "Determine if this is a Solana stablecoin yield request and fetch the top 25 stablecoin yield opportunities on Solana.";

  examples = [
    [
      {
        user: "{{user}}",
        content: { text: "Show me the best stablecoin APYs on Solana" }
      },
      {
        user: "{{system}}",
        content: { text: "Here are the top 25 stablecoin yield opportunities on Solana: ...", action: "GET_SOLANA_STABLECOIN_YIELD_OPPORTUNITIES" }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "List Solana stablecoin yields" }
      },
      {
        user: "{{system}}",
        content: { text: "Listing the top 25 Solana stablecoin yields: ...", action: "GET_SOLANA_STABLECOIN_YIELD_OPPORTUNITIES" }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "Solana stablecoin pools with the best APY" }
      },
      {
        user: "{{system}}",
        content: { text: "Here are the top 25 Solana stablecoin pools by APY: ...", action: "GET_SOLANA_STABLECOIN_YIELD_OPPORTUNITIES" }
      }
    ]
  ];

  async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    // Match if about Solana and stablecoins
    const isSolana = /solana/i.test(content);
    const isStablecoin = stablecoinRegex.test(content);
    return isSolana && isStablecoin;
  }

  async handler(runtime: IAgentRuntime, message: Memory, state?: State, _options = {}, callback?: HandlerCallback): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    const minTvl = extractMinTvl(content, 1_000_000);
    const provider = new YieldProvider();
    const solanaPools = await provider.getRaw(runtime, message, state, { chain: "Solana" });
    // Robust stablecoin detection
    const STABLECOIN_SYMBOLS = [
      "USDC", "USDT", "DAI", "TUSD", "USDP", "USDE", "USD0", "FRAX", "LUSD", "SUSD"
    ];
    function isStablecoinPool(pool: any): boolean {
      if (pool.stablecoin) return true;
      const symbol = (pool.symbol || "").toUpperCase();
      if (STABLECOIN_SYMBOLS.some(s => symbol.includes(s))) return true;
      if (Array.isArray(pool.underlyingTokens)) {
        return pool.underlyingTokens.some((token: string) =>
          STABLECOIN_SYMBOLS.some(s => token.toUpperCase().includes(s))
        );
      }
      return false;
    }
    const filteredPools = solanaPools.filter(
      (pool: any) =>
        pool.chain && pool.chain.toLowerCase() === 'solana' &&
        isStablecoinPool(pool)
    );
    // Sort by APY descending
    filteredPools.sort((a: any, b: any) => (b.apy ?? 0) - (a.apy ?? 0));
    const formatted = filteredPools.slice(0, 25).map((pool: any, i: number) => {
      return `${i + 1}. ${pool.project} (${pool.symbol}): ${pool.apy?.toFixed(2) ?? "?"}% APY, TVL: $${Math.round(pool.tvlUsd).toLocaleString()}`;
    }).join("\n");
    const result = formatted || "No Solana stablecoin yield opportunities found at this time.";
    if (callback) await callback({ text: result, action: this.name });
    if (state) state.responseData = { text: result, action: this.name };
    return true;
  }
}

export class GetBestSolanaRaydiumPoolApyAction implements Action {
  name = "GET_BEST_SOLANA_RAYDIUM_POOL_APY";
  similes = ["BEST_SOLANA_RAYDIUM_APY", "HIGHEST_SOLANA_RAYDIUM_APY", "TOP_SOLANA_RAYDIUM_APY"];
  description = "Fetches and returns the single Raydium-amm pool with the highest APY on the Solana chain from DefiLlama, with minimum TVL 25M and minimum 7d volume 1M, and SOL or WSOL in the symbol.";
  suppressInitialMessage = true;
  template = "Determine if this is a request for the best APY on Solana Raydium-amm pools and fetch the top Raydium-amm pool by APY on Solana, filtered by minimum TVL and volume, and SOL/WSOL in symbol.";

  examples = [
    [
      {
        user: "{{user}}",
        content: { "text": "What is the best APY on Solana for Raydium-amm?" }
      },
      {
        user: "SolanaBestApyFinder", "content": { "text": "The best APY on Solana (Raydium-amm) is ...\nMinimum TVL: $25,000,000, Minimum 7d Volume: $1,000,000", "action": "GET_BEST_SOLANA_RAYDIUM_POOL_APY" } }
    ]
  ];

  async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = typeof message.content === "string" ? message.content : message.content?.text;
    // Match if about Solana and best/top/highest APY and Raydium
    return /solana/i.test(content) && /raydium/i.test(content) && /(best|top|highest).*(apy|yield)/i.test(content);
  }

  async handler(runtime: IAgentRuntime, message: Memory, state?: State, _options = {}, callback?: HandlerCallback): Promise<boolean> {
    const provider = new YieldProvider();
    // Always use min TVL 25M and min 7d volume 1M
    const minTvl = 25_000_000;
    const minVolume = 1_000_000;
    const allSolanaPools = await provider.getRaw(runtime, message, state, { chain: "Solana", minTvl });
    // Filter for Raydium-amm project, symbol containing SOL or WSOL, and min volume
    const raydiumPools = allSolanaPools.filter(
      (pool: any) =>
        pool.project && pool.project.toLowerCase() === 'raydium-amm' &&
        typeof pool.symbol === 'string' &&
        (/\bSOL\b|\bWSOL\b/i.test(pool.symbol)) &&
        pool.tvlUsd >= minTvl &&
        (pool.volumeUsd7d ?? 0) >= minVolume
    );
    if (!raydiumPools.length) {
      const result = "No Raydium-amm pools on Solana with SOL/WSOL in symbol, TVL >= $25M, and 7d volume >= $1M found at this time.";
      if (callback) await callback({ text: result, action: this.name });
      if (state) state.responseData = { text: result, action: this.name };
      return true;
    }
    // Find the pool with the highest APY
    const best = raydiumPools.reduce((max, pool) => (pool.apy ?? 0) > (max.apy ?? 0) ? pool : max, raydiumPools[0]);
    let result = `The best APY on Solana (Raydium-amm) with SOL/WSOL in symbol is ${best.apy?.toFixed(2) ?? "?"}% from ${best.project} (${best.symbol}), TVL: $${Math.round(best.tvlUsd).toLocaleString()}, 7d Volume: $${Math.round(best.volumeUsd7d).toLocaleString()}`;
    result += `\nMinimum TVL: $25,000,000, Minimum 7d Volume: $1,000,000`;
    // Add machine-readable JSON block
    const resultObj = {
      poolId: best.pool || best.poolId || best.id || null,
      apy: best.apy,
      symbol: best.symbol,
      project: best.project,
      tvlUsd: best.tvlUsd,
      volumeUsd7d: best.volumeUsd7d,
    };
    result += `\nJSON: ${JSON.stringify(resultObj)}`;
    if (callback) await callback({ text: result, action: this.name });
    if (state) state.responseData = { text: result, action: this.name };
    return true;
  }
}
