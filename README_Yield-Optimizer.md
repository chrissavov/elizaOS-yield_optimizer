# Solana Raydium Yield Optimizer Agent

## Overview

The Solana Raydium Yield Optimizer is an autonomous agent built on the Eliza framework that automatically manages liquidity positions on Raydium to maximize yield. The agent continuously monitors Raydium AMM pools using the DefiLlama API, identifies the highest APY opportunities, and automatically rebalances positions to optimize returns.

## Purpose

This agent serves as an automated yield farming tool that:
- Monitors Raydium liquidity pools for the best APY opportunities
- Automatically removes liquidity from underperforming pools
- Rebalances assets into higher-yielding pools
- Manages the entire process without manual intervention
- Focuses on pools containing SOL/WSOL to maintain exposure to Solana

## Prerequisites

- Node.js v23.3.0 or higher (Note: Currently tested with v24.0.2)
- pnpm package manager (v9.15.7 or higher)
- A Solana wallet with:
  - Private key in base58 format
  - Some SOL (minimum 0.1 SOL recommended)
  - Any existing LP positions will be managed by the bot

## Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd elizaOS_yield-generator/eliza
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
Create a `.env` file in the root directory with the following:

```env
# Solana Configuration
SOLANA_PUBLIC_KEY=your_wallet_public_key
SOLANA_PRIVATE_KEY=your_wallet_private_key_base58
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=your_rpc_endpoint

# Model Provider (for AI operations) - Add key to your specific model but must change the model in agent/src/defaultCharacter.ts
OPENAI_API_KEY=your_openai_api_key
```

### RPC Endpoint Notes:
- **Alchemy**: HTTP-only, no WebSocket support
- **Helius**: Full WebSocket support (recommended)
- **Other providers**: Check WebSocket compatibility

## Building the Project

1. Build all packages:
```bash
pnpm build
```

2. For development with hot reload:
```bash
pnpm dev
```

## Running the Yield Optimizer

Start the agent with:
```bash
pnpm start
```

Or with debug logging:
```bash
pnpm start --debug
```

## How the Agent Works

The yield optimizer follows a continuous loop with these steps:

### Step 1: Find Best Pool
- Queries DefiLlama API for Raydium AMM pools
- Filters pools with:
  - Minimum TVL: $25 million
  - Minimum 7-day volume: $1 million
  - Must contain SOL/WSOL
- Identifies the highest APY pool meeting criteria

### Step 2: Evaluate Current Position
- Checks current LP positions
- Compares current pool APY with best available
- Decides if switching is beneficial (threshold: 0.5% APY improvement)

### Step 3: Remove Existing Liquidity
- Gets all current LP positions with balance
- Removes liquidity from each position
- Receives underlying tokens (e.g., MEW and SOL)

### Step 4: Consolidate to SOL
- Identifies all non-SOL tokens in wallet
- Swaps each token to SOL using Jupiter
- Ensures all value is in SOL before proceeding

### Step 5: Prepare for New Pool
- Swaps approximately half of SOL balance to the target token
- Keeps minimum 0.05 SOL for transaction fees
- Prepares balanced amounts for liquidity provision

### Step 6: Add Liquidity
- Adds liquidity to the new highest-APY pool
- Uses 1% slippage tolerance
- Creates LP position in the new pool

### Step 7: Wait and Repeat
- Waits for configured interval (default: 5 minutes)
- Clears memory cache to prevent heap overflow
- Repeats the entire process

## Configuration

Key parameters in `agent/src/index.ts`:

```typescript
const config = {
    scanIntervalMs: 30 * 60 * 1000,      // Check interval (30 minutes)
    APY_IMPROVEMENT_THRESHOLD: 0.5,      // Minimum APY improvement to switch (0.5%)
    MIN_SOL_BALANCE: 0.05,              // Keep for fees
    SOL_MINT: "So11111111111111111111111111111111111111112"
};
```

## Safety Features

1. **Mainnet Warning**: Displays warning on startup about real funds
2. **Minimum Balance**: Always keeps 0.05 SOL for transaction fees
3. **Slippage Protection**: Uses conservative slippage settings
4. **Error Handling**: Continues operation even if individual transactions fail
5. **Memory Management**: Clears cache after each iteration to prevent overflow

## Monitoring

The agent provides detailed logs including:
- Current pool information and APY
- Transaction signatures for all operations
- Balance changes after each step
- Error messages with full context
- Memory cleanup notifications

## Risk Disclaimer

**WARNING**: This agent operates on Solana mainnet with real funds. Risks include:
- Impermanent loss from liquidity provision
- Smart contract risks
- Transaction failures resulting in partial state
- Market volatility affecting position values
- Potential bugs in the automation logic

Always test with small amounts first and monitor the agent's operation closely.

## Development

### Project Structure
```
eliza/
|-- agent/src/index.ts          # Main agent logic and yield optimizer loop
|-- packages/plugin-raydium/    # Raydium integration plugin
|   |-- src/
|   |   |-- index.ts            # Plugin exports
|   |   |-- transactions.ts     # LP operations (add/remove liquidity)
|   |   |-- pools.ts            # Pool discovery and info
|   |   |-- positions.ts        # User position tracking
|   |   |-- utils.ts            # Helper functions and cache
|   |   `-- types.ts            # TypeScript interfaces
`-- packages/plugin-defillama/  # DefiLlama API integration

### Adding Features

To modify the yield optimization strategy:
1. Edit `startYieldOptimizerLoop` in `agent/src/index.ts`
2. Adjust pool selection criteria in `findBestPool`
3. Modify rebalancing logic in `executePoolSwitch`

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Ensure RPC endpoint is working and funded
3. Verify wallet has sufficient SOL for operations
4. Review transaction history on Solscan