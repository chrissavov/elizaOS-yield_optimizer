chrissavov@LAPTOP-2AH66DSF:~/Learning/jobs/2025-05-Decentra/elizaOS_yield-generator/eliza$ pnpm start --debug
 WARN  Unsupported engine: wanted: {"node":"23.3.0"} (current: {"node":"v24.0.2","pnpm":"9.7.1"})

> eliza@ start /home/chrissavov/Learning/jobs/2025-05-Decentra/elizaOS_yield-generator/eliza
> pnpm --filter "@elizaos/agent" start --isRoot "--debug"

.                                        |  WARN  Unsupported engine: wanted: {"node":"23.3.0"} (current: {"node":"v24.0.2","pnpm":"9.15.7"})
docs                                     |  WARN  Unsupported engine: wanted: {"node":"23.3.0"} (current: {"node":"v24.0.2","pnpm":"9.15.7"})

> @elizaos/agent@0.25.9 start /home/chrissavov/Learning/jobs/2025-05-Decentra/elizaOS_yield-generator/eliza/agent
> node --loader ts-node/esm src/index.ts --isRoot --debug

(node:3020859) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`:
--import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));'
(Use `node --trace-warnings ...` to show where the warning was created)
(node:3020859) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
(Use `node --trace-deprecation ...` to show where the warning was created)
[2025-06-05 13:03:34] INFO: Loading embedding settings:
    USE_OPENAI_EMBEDDING: ""
    USE_OLLAMA_EMBEDDING: ""
    OLLAMA_EMBEDDING_MODEL: "mxbai-embed-large"
[2025-06-05 13:03:34] INFO: Parsed settings:
    USE_OPENAI_EMBEDDING: ""
    USE_OPENAI_EMBEDDING_TYPE: "string"
    USE_OLLAMA_EMBEDDING: ""
    USE_OLLAMA_EMBEDDING_TYPE: "string"
    OLLAMA_EMBEDDING_MODEL: "mxbai-embed-large"
[2025-06-05 13:03:35] INFO: Solana Raydium Trader(06d1a38f-b141-0992-8f2c-b8ecc6e6d953) - Initializing AgentRuntime with options:
    character: "Solana Raydium Trader"
    modelProvider: "openai"
    characterModelProvider: "openai"
[2025-06-05 13:03:35] INFO: Solana Raydium Trader(06d1a38f-b141-0992-8f2c-b8ecc6e6d953) - Setting Model Provider:
    characterModelProvider: "openai"
    optsModelProvider: "openai"
    finalSelection: "openai"
[2025-06-05 13:03:35] INFO: Solana Raydium Trader(06d1a38f-b141-0992-8f2c-b8ecc6e6d953) - Selected model provider: openai
[2025-06-05 13:03:35] INFO: Solana Raydium Trader(06d1a38f-b141-0992-8f2c-b8ecc6e6d953) - Selected image model provider: openai
[2025-06-05 13:03:35] INFO: Solana Raydium Trader(06d1a38f-b141-0992-8f2c-b8ecc6e6d953) - Selected image vision model provider: openai
[2025-06-05 13:03:35] INFO: Initializing SQLite database at /home/chrissavov/Learning/jobs/2025-05-Decentra/elizaOS_yield-generator/eliza/agent/data/db.sqlite...
[2025-06-05 13:03:35] INFO: Using Database Cache...
[2025-06-05 13:03:35] WARN: *** MAINNET MODE: REAL FUNDS AT RISK! ***
[2025-06-05 13:03:35] INFO: Using public key for Raydium positions: GLgh7ZNBp3ykUeMtMpDKz3hqrSUvXUBuxHBX8zPs3YWv
[2025-06-05 13:03:35] INFO: Run `pnpm start:client` to start the client and visit the outputted URL (http://localhost:5173) to chat with your agents. When running multiple agents, use client with different port `SERVER_PORT=3001 pnpm start:client`

/* Step 1 */

[2025-06-05 13:03:36] INFO: DefiLlama action response: The best APY on Solana (Raydium-amm) with SOL/WSOL in symbol is 13.46% from raydium-amm (MEW-WSOL), TVL: $27,900,101, 7d Volume: $14,983,172
Minimum TVL: $25,000,000, Minimum 7d Volume: $1,000,000
JSON: {"poolId":"919f83c6-1a2d-4c67-985f-99e8b8423f62","apy":13.45779,"symbol":"MEW-WSOL","project":"raydium-amm","tvlUsd":27900101,"volumeUsd7d":14983172.35356}
[2025-06-05 13:03:36] INFO: Parsed JSON from DefiLlama:
    poolId: "919f83c6-1a2d-4c67-985f-99e8b8423f62"
    apy: 13.45779
    symbol: "MEW-WSOL"
    project: "raydium-amm"
    tvlUsd: 27900101
    volumeUsd7d: 14983172.35356
[2025-06-05 13:03:36] INFO: Best Raydium-amm pool info: //we don't need this
    bestPoolId: "919f83c6-1a2d-4c67-985f-99e8b8423f62" //we don't need this
    bestApy: 13.46 //we don't need this
    parsed: { //we don't need this
      "poolId": "919f83c6-1a2d-4c67-985f-99e8b8423f62", //we don't need this
      "apy": 13.45779, //we don't need this
      "symbol": "MEW-WSOL", //we don't need this
      "project": "raydium-amm", //we don't need this
      "tvlUsd": 27900101, //we don't need this
      "volumeUsd7d": 14983172.35356 //we don't need this
    } //we don't need this
[2025-06-05 13:03:38] INFO: Mint for MEW: MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5
[2025-06-05 13:03:38] INFO: Mint for WSOL: So11111111111111111111111111111111111111112
[2025-06-05 13:03:39] INFO: Raydium pool info by mints:
    id: "879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce"
    mintA: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5"
    mintB: "So11111111111111111111111111111111111111112"
    lpMint: ""
    version: 0
    programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
    authority: ""
    openOrders: ""
    targetOrders: ""
    mintADecimals: 5
    mintBDecimals: 9
    lpDecimals: 0
[2025-06-05 13:03:40] INFO: Switching from pool null (APY: 0%) to 879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce (APY: 13.46%)
[RaydiumPlugin] All user SPL token accounts: [
  {
    pubkey: '5zoUMuXfKqcCinnY3A8qK54wQbiXjzSqpCfnVUbSchHz',
    mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    amount: '14466594289'
  },
  {
    pubkey: '79n5dGihCrRbFuvc6dpGTBiuUAPHntHj77XML5mXVHa6',
    mint: '3DyT1fDosT42GT7srFmv5m2VuzU9AB68QknwWY6Kpump',
    amount: '0'
  },
  {
    pubkey: '7nVGLKSKJDYFCiDS9wHHUyxmcujv8xQfqVpZLGbyyvTs',
    mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    amount: '536227262'
  },
  {
    pubkey: 'EoUUX54SRYLrAyHFip5hmT2udYEcnN5QRbPGMTKgRZez',
    mint: '83WevmL2JzaEvDmuJUFMxcFNnHqP4xonfvAzKmsPWjwu',
    amount: '348721652'
  }
]
[RaydiumPlugin] Checking for Raydium LP tokens among 4 token accounts
[RaydiumPlugin] Checking token ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82 with balance 14466594289 //we don't need this
[Raydium] Fetching Raydium pools from pairs endpoint...
[Raydium] Processing 693457 pairs
[Raydium] Successfully cached 693443 Raydium pools
[RaydiumPlugin] ❌ Token ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82 is not a Raydium LP token //we don't need this
[RaydiumPlugin] Checking token 3DyT1fDosT42GT7srFmv5m2VuzU9AB68QknwWY6Kpump with balance 0 //we don't need this
[RaydiumPlugin] ❌ Token 3DyT1fDosT42GT7srFmv5m2VuzU9AB68QknwWY6Kpump is not a Raydium LP token //we don't need this
[RaydiumPlugin] Checking token MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5 with balance 536227262 //we don't need this
[RaydiumPlugin] ❌ Token MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5 is not a Raydium LP token //we don't need this
[RaydiumPlugin] Checking token 83WevmL2JzaEvDmuJUFMxcFNnHqP4xonfvAzKmsPWjwu with balance 348721652 //we don't need this
[RaydiumPlugin] ✅ Found unstaked LP position: Pool DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt, Balance: 348721652
[RaydiumPlugin] Found 1 total LP tokens, 1 with non-zero balance
[RaydiumPlugin] Total unstaked LP positions found: 1
[2025-06-05 13:04:45] INFO: Found 1 Raydium LP positions with balance (checked 1 total)
[2025-06-05 13:04:45] INFO: === POSITION SUMMARY ===
[2025-06-05 13:04:45] INFO: 📊 LP Position: Pool DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt
[2025-06-05 13:04:45] INFO:    LP Token: 83WevmL2JzaEvDmuJUFMxcFNnHqP4xonfvAzKmsPWjwu
[2025-06-05 13:04:45] INFO:    Balance: 348.721652 tokens (raw: 348721652)
[2025-06-05 13:04:45] INFO:    Decimals: 6
[2025-06-05 13:04:45] INFO: 📈 Total Raydium Positions with balance: 1
[2025-06-05 13:04:45] INFO: ========================
[2025-06-05 13:04:45] INFO: Using wallet: GLgh7ZNBp3ykUeMtMpDKz3hqrSUvXUBuxHBX8zPs3YWv
[2025-06-05 13:04:45] INFO: 🚀 Starting Step 4: Remove liquidity from all positions...
[2025-06-05 13:04:45] INFO: ✅ Connection test successful. Wallet balance: 0.110184085 SOL
[2025-06-05 13:04:45] INFO: 💧 Removing liquidity from 1 LP positions...
[2025-06-05 13:04:45] INFO: 💰 LP balance in pool DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt: 348.721652 tokens (raw: 348721652)
[2025-06-05 13:04:45] INFO: 🚀 Removing 348.721652 LP tokens from pool DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt...
[2025-06-05 13:04:46] INFO: 📊 SOL balance before: 0.110184 SOL
[Raydium] Removing liquidity from pool DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt
[Raydium] Amount: 348721652, Slippage: 1%
[Raydium] Raydium instance created successfully
[Raydium] Fetching pool info from API...
[Raydium] Pool info retrieved: {
  id: 'DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt',
  programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  baseMint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
  quoteMint: 'So11111111111111111111111111111111111111112',
  lpMint: '83WevmL2JzaEvDmuJUFMxcFNnHqP4xonfvAzKmsPWjwu'
}
[Raydium] Building remove liquidity transaction...
[Raydium] Executing remove liquidity transaction...
[Raydium] 🔗 Pool: DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt
[Raydium] 💧 LP Amount: 348721652
[Raydium] 📊 Slippage: 1%
[Raydium] 👤 Wallet: GLgh7ZNBp3ykUeMtMpDKz3hqrSUvXUBuxHBX8zPs3YWv
[Raydium] ⏳ Waiting 10 seconds to avoid rate limiting...
[Raydium] 🚀 Executing remove liquidity transaction...
[Raydium] Fetching fresh blockhash...
[Raydium] 📤 Sending transaction (attempt 1/3)...
[Raydium] 📋 Transaction sent with signature: 474xff543me6Hx2QxVicE4VXHNbs2czicbiLZDhHx293H4EH5ip93UaVqDQUSEHbF6r86p8DXxg3sJ6MacjHS97k
[Raydium] ⏳ Waiting for confirmation...
[Raydium] ⏳ Confirming transaction...
[Raydium] ✅ Remove liquidity transaction successful!
[Raydium] 🔗 Transaction ID: 474xff543me6Hx2QxVicE4VXHNbs2czicbiLZDhHx293H4EH5ip93UaVqDQUSEHbF6r86p8DXxg3sJ6MacjHS97k
[Raydium] 🌐 View on Solana Explorer: https://explorer.solana.com/tx/474xff543me6Hx2QxVicE4VXHNbs2czicbiLZDhHx293H4EH5ip93UaVqDQUSEHbF6r86p8DXxg3sJ6MacjHS97k
[Raydium] 🌐 View on Solscan: https://solscan.io/tx/474xff543me6Hx2QxVicE4VXHNbs2czicbiLZDhHx293H4EH5ip93UaVqDQUSEHbF6r86p8DXxg3sJ6MacjHS97k
[2025-06-05 13:05:00] INFO: ✅ Successfully removed liquidity!
[2025-06-05 13:05:00] INFO: 🔗 Transaction: 474xff543me6Hx2QxVicE4VXHNbs2czicbiLZDhHx293H4EH5ip93UaVqDQUSEHbF6r86p8DXxg3sJ6MacjHS97k
[2025-06-05 13:05:00] INFO: 🌐 Explorer: https://solscan.io/tx/474xff543me6Hx2QxVicE4VXHNbs2czicbiLZDhHx293H4EH5ip93UaVqDQUSEHbF6r86p8DXxg3sJ6MacjHS97k
[2025-06-05 13:05:00] INFO: 📋 Pool: DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt
[2025-06-05 13:05:00] INFO: 💧 LP tokens removed: 348.721652
[2025-06-05 13:05:06] INFO: 📊 SOL balance after: 0.158844 SOL
[2025-06-05 13:05:06] INFO: 💰 SOL gained: 0.048660 SOL
[2025-06-05 13:05:10] INFO: ✅ Step 4 completed: All positions liquidated
[2025-06-05 13:05:10] INFO: 🚀 Starting Step 5: Consolidate all tokens to SOL...
[2025-06-05 13:05:10] INFO: Found 4 token accounts
[2025-06-05 13:05:10] INFO: Found 2 non-SOL tokens to swap
[2025-06-05 13:05:10] INFO: 💱 Swapping 18463.243181 of token ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82 to SOL...
[2025-06-05 13:05:12] INFO: ✅ Swap successful!
[2025-06-05 13:05:12] INFO: 🔗 Transaction: 2zjrNHoqWX88ndvG8f6H6ME87YxgjZ7d1u4BMDB3KwvQKUJ2Q1THD67gPrYPkHg6jzYNxV9nguPxHQSoTrKvCrtH
[2025-06-05 13:05:12] INFO: 💰 Received: 0.224258 SOL
[2025-06-05 13:05:12] INFO: 📊 SOL balance: 0.158844 → 0.382097
[2025-06-05 13:05:15] INFO: 💱 Swapping 5362.27262 of token MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5 to SOL...
[2025-06-05 13:05:17] INFO: ✅ Swap successful!
[2025-06-05 13:05:17] INFO: 🔗 Transaction: 3aqjNU89hQNBsiADNrc3d9H2M3wF56ywYyaVLxvWf9JNBYSGKtMDgmCEegFFzm4egDE8WJE8DGdNqewZyThRHdoC
[2025-06-05 13:05:17] INFO: 💰 Received: 0.112053 SOL
[2025-06-05 13:05:17] INFO: 📊 SOL balance: 0.382097 → 0.493140
[2025-06-05 13:05:20] INFO: ✅ Step 5 completed: All tokens consolidated to SOL
[2025-06-05 13:05:20] INFO: 💰 Final SOL balance: 0.493140 SOL
[2025-06-05 13:05:20] INFO: 🚀 Starting Step 6: Swap half SOL for pool token...
[2025-06-05 13:05:20] INFO: Pool tokens: MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5 and So11111111111111111111111111111111111111112
[2025-06-05 13:05:20] INFO: Other token mint: MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5
[2025-06-05 13:05:20] INFO: Current SOL balance: 0.493140 SOL
[2025-06-05 13:05:20] INFO: 💱 Swapping 0.221570 SOL to MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5...
[2025-06-05 13:05:20] INFO:    Keeping 0.05 SOL for fees
[2025-06-05 13:05:20] INFO:    Remaining SOL after swap: ~0.271570 SOL
[2025-06-05 13:05:20] INFO: Expected output: 10594.615380 tokens
[2025-06-05 13:05:22] INFO: ✅ Swap successful!
[2025-06-05 13:05:22] INFO: 🔗 Transaction: 2eF7EU4VGzpnvNGgMHjSA63KWX5cW4w32JrXT3K6M9rjmtMcZSYMn6R7N8HeKsGAaeS5Ssh36P3DgzL2ztScCf9H
[2025-06-05 13:05:22] INFO: 🌐 Explorer: https://solscan.io/tx/2eF7EU4VGzpnvNGgMHjSA63KWX5cW4w32JrXT3K6M9rjmtMcZSYMn6R7N8HeKsGAaeS5Ssh36P3DgzL2ztScCf9H
[2025-06-05 13:05:26] INFO: 📊 Final SOL balance: 0.270565 SOL
[2025-06-05 13:05:26] INFO: ✅ Step 6 completed: Swapped half SOL for pool token
[2025-06-05 13:05:26] INFO: 🚀 Starting Step 7: Add liquidity to the new pool...
[2025-06-05 13:05:26] INFO: 💰 Current SOL balance: 0.270565 SOL
[2025-06-05 13:05:26] INFO: 💰 Other token balance: 10594.37818 (1059437818 raw)
[2025-06-05 13:05:26] INFO: 📊 Fetching current pool reserves...
[2025-06-05 13:05:28] INFO: 📊 Pool reserves - Base: 442511215732139, Quote: 92410366167336
[Raydium] Adding liquidity to pool 879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce
[Raydium] Base amount: 1059437818, Quote amount: 223235952
[Raydium] Slippage: 10%, Fixed side: base
[2025-06-05 13:05:28] INFO: 📊 Pool price: 0 (quote per base, normalized)
[2025-06-05 13:05:28] INFO: 📊 mintA: MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5, mintB: So11111111111111111111111111111111111111112, SOL_MINT: So11111111111111111111111111111111111111112
[2025-06-05 13:05:28] INFO: 📊 Using 10594.37818 MEW as base (fixed)
[2025-06-05 13:05:28] INFO: 📊 Calculated required WSOL: 0.221244192 SOL
[2025-06-05 13:05:28] INFO: 📊 Max WSOL to provide (with buffer): 0.223235952 SOL
[2025-06-05 13:05:28] INFO: 📊 Available SOL (minus 0.05 reserve): 0.22056501100000003 SOL
[2025-06-05 13:05:28] INFO: 📊 Available SOL (minus 0.02 reserve): 0.250565011 SOL
[2025-06-05 13:05:28] INFO: 📊 Total SOL balance: 0.270565011 SOL
[2025-06-05 13:05:28] INFO: 💧 Adding liquidity to pool 879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce
[2025-06-05 13:05:28] INFO:    Base amount: 1059437818
[2025-06-05 13:05:28] INFO:    Quote amount: 223235952
[2025-06-05 13:05:28] INFO:    Fixed side: base
[2025-06-05 13:05:28] INFO:    Pool symbol: MEW-WSOL
[2025-06-05 13:05:28] INFO: 📊 Using 10% slippage to handle price movements
[Raydium] Raydium instance created successfully
[Raydium] Fetching pool info from API...
[Raydium] Pool info from API: {
  id: '879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce',
  programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  type: 'Standard',
  mintA: {
    chainId: 101,
    address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    logoURI: 'https://img-v1.raydium.io/icon/MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5.png',
    symbol: 'MEW',
    name: 'cat in a dogs world',
    decimals: 5,
    tags: [],
    extensions: {}
  },
  mintB: {
    chainId: 101,
    address: 'So11111111111111111111111111111111111111112',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    logoURI: 'https://img-v1.raydium.io/icon/So11111111111111111111111111111111111111112.png',
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    decimals: 9,
    tags: [],
    extensions: {}
  },
  lpMint: {
    chainId: 101,
    address: 'FP3mSbGdvnVvGM9zV8KxamKDq9JMQP7LvacmLarx2rU7',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    logoURI: '',
    symbol: '',
    name: '',
    decimals: 5,
    tags: [],
    extensions: {}
  }
}
[Raydium] Pool info retrieved: {
  id: '879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce',
  programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  baseMint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  quoteMint: 'So11111111111111111111111111111111111111112',
  lpMint: 'FP3mSbGdvnVvGM9zV8KxamKDq9JMQP7LvacmLarx2rU7'
}
[Raydium] ⚠️  Pool uses WSOL (Wrapped SOL). Note: The SDK should handle SOL wrapping automatically.
[Raydium] Building add liquidity transaction...
[Raydium] Base Amount (A): 1059437818, Quote Amount (B): 223235952
[Raydium] Minimum other amount: 200912356
[Raydium] Fixed side: a
[Raydium] Creating add liquidity transaction...
[Raydium] Pool info structure: {
  hasMintA: true,
  mintAType: 'object',
  hasMintB: true,
  mintBType: 'object',
  hasLpMint: true,
  lpMintType: 'object'
}
[Raydium] Token amounts created: {
  amountInA: '10594.37818',
  amountInB: '0.223235952',
  otherAmountMin: '0.200912356'
}
[Raydium] Executing add liquidity transaction...
[Raydium] 🔗 Pool: 879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce
[Raydium] 💰 Base Amount: 1059437818
[Raydium] 💰 Quote Amount: 223235952
[Raydium] 📊 Slippage: 10%
[Raydium] 👤 Wallet: GLgh7ZNBp3ykUeMtMpDKz3hqrSUvXUBuxHBX8zPs3YWv
[Raydium] ⏳ Waiting 10 seconds to avoid rate limiting...
[Raydium] 🚀 Executing add liquidity transaction via SDK...
[Raydium Warning] ⚠️  SDK execution failed: please provide owner in keypair format or signAllTransactions function
[Raydium] 🔄 Falling back to manual transaction sending...
[Raydium] Fetching fresh blockhash...
[Raydium] 📤 Sending transaction (attempt 1/3)...
[Raydium] 🔍 Simulating transaction first...
[Raydium Warning] ⚠️  Simulation failed: Invalid arguments
[Raydium] 📋 Transaction sent with signature: 4NsSQVvcmFUCnHjXdc8VEUfP1jdfYgCC1VsAxeZuiBsnBWFwv9VoJSc58MzP6X3YCNup3ev6a98gwFyeEibFf8vu
[Raydium] ⏳ Waiting for confirmation...
[Raydium] ⏳ Confirming transaction...
[Raydium] ✅ Add liquidity transaction successful!
[Raydium] 🔗 Transaction ID: 4NsSQVvcmFUCnHjXdc8VEUfP1jdfYgCC1VsAxeZuiBsnBWFwv9VoJSc58MzP6X3YCNup3ev6a98gwFyeEibFf8vu
[Raydium] 🌐 View on Solana Explorer: https://explorer.solana.com/tx/4NsSQVvcmFUCnHjXdc8VEUfP1jdfYgCC1VsAxeZuiBsnBWFwv9VoJSc58MzP6X3YCNup3ev6a98gwFyeEibFf8vu
[Raydium] 🌐 View on Solscan: https://solscan.io/tx/4NsSQVvcmFUCnHjXdc8VEUfP1jdfYgCC1VsAxeZuiBsnBWFwv9VoJSc58MzP6X3YCNup3ev6a98gwFyeEibFf8vu
[2025-06-05 13:05:42] INFO: ✅ Successfully added liquidity!
[2025-06-05 13:05:42] INFO: 🔗 Transaction: 4NsSQVvcmFUCnHjXdc8VEUfP1jdfYgCC1VsAxeZuiBsnBWFwv9VoJSc58MzP6X3YCNup3ev6a98gwFyeEibFf8vu
[2025-06-05 13:05:42] INFO: 🌐 Explorer: https://solscan.io/tx/4NsSQVvcmFUCnHjXdc8VEUfP1jdfYgCC1VsAxeZuiBsnBWFwv9VoJSc58MzP6X3YCNup3ev6a98gwFyeEibFf8vu
[2025-06-05 13:05:50] INFO: 💎 New LP token balance: 3640.200570 LP tokens
[2025-06-05 13:05:50] INFO: ✅ Step 7 completed: Liquidity addition attempted
[2025-06-05 13:05:50] INFO: 🏁 Yield optimizer completed: Full cycle executed!
[2025-06-05 13:05:50] INFO: 💡 Ready for next yield optimization cycle