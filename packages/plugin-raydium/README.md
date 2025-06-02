# @elizaos/plugin-raydium

Raydium AMM plugin for ElizaOS providing liquidity pool and farm position information on Solana.

## Installation

```bash
npm install @elizaos/plugin-raydium
```

## Overview

This plugin provides integration with Raydium AMM on Solana, enabling:
- Pool information retrieval
- Token symbol to mint address resolution
- User LP position tracking
- Farm position monitoring

## Usage

```typescript
import raydiumPlugin from '@elizaos/plugin-raydium';

// Add to your agent's plugins
const agent = new AgentRuntime({
  plugins: [raydiumPlugin],
  // ... other configuration
});
```

## Exported Functions

### Pool Information

#### `getRaydiumPoolInfo(poolId: string, rpcUrl?: string): Promise<RaydiumPoolInfo | null>`
Get detailed information about a Raydium pool by its ID.

```typescript
const poolInfo = await getRaydiumPoolInfo('poolIdHere');
```

#### `findRaydiumPoolAddressBySymbol(symbol: string, rpcUrl?: string): Promise<string | null>`
Find a pool address by token pair symbol (e.g., "SOL-USDC").

```typescript
const poolId = await findRaydiumPoolAddressBySymbol('SOL-USDC');
```

#### `findRaydiumPoolByMints(mintA: string, mintB: string, rpcUrl?: string): Promise<RaydiumApiPoolData | null>`
Find a pool by providing two token mint addresses.

```typescript
const pool = await findRaydiumPoolByMints(mintA, mintB);
```

### Token Resolution

#### `getMintsForSymbol(symbol: string, rpcUrl?: string): Promise<MintAddresses>`
Get mint addresses for a token pair symbol.

```typescript
const { mintA, mintB } = await getMintsForSymbol('SOL-USDC');
```

#### `getMintForSymbol(symbol: string, raydiumInstance: Raydium): Promise<string | null>`
Get mint address for a single token symbol.

### User Positions

#### `getUserRaydiumPositions(userPublicKey: string | PublicKey, rpcUrl?: string, minBalance?: number): Promise<UserRaydiumPosition[]>`
Get all Raydium LP positions for a user.

```typescript
const positions = await getUserRaydiumPositions('userPublicKeyHere');
```

#### `getUserFarmPosition(userPublicKey: string | PublicKey, lpMint: string, rpcUrl?: string): Promise<FarmPosition[]>`
Get farm positions for a specific LP token.

```typescript
const farmPositions = await getUserFarmPosition('userPublicKey', 'lpMintAddress');
```

#### `getAllUserFarmPositions(userPublicKey: string | PublicKey, rpcUrl?: string, targetLpMint?: string): Promise<FarmPosition[]>`
Get all farm positions for a user, optionally filtered by LP mint.

## Types

### RaydiumPoolInfo
```typescript
interface RaydiumPoolInfo {
  poolId: string;
  baseVault?: string;
  quoteVault?: string;
  baseReserve?: string;
  quoteReserve?: string;
  mintAAmount?: string;
  mintBAmount?: string;
  poolPrice?: string;
  lpMint?: string;
  // ... additional fields
}
```

### UserRaydiumPosition
```typescript
interface UserRaydiumPosition {
  poolId: string;
  lpMint: string;
  balance: string;
  tokenAccount: string;
  poolInfo: any;
}
```

### FarmPosition
```typescript
interface FarmPosition {
  farmId: string;
  lpMint: string;
  deposited: string;
  farmInfo: RaydiumFarm;
}
```

## Configuration

The plugin uses the following default RPC URL:
- `https://api.mainnet-beta.solana.com`

You can override this by passing a custom RPC URL to any function.

## Dependencies

- `@raydium-io/raydium-sdk-v2`: Raydium SDK
- `@solana/web3.js`: Solana Web3 SDK
- `@solana/spl-token`: SPL Token program
- `bn.js`: Big number arithmetic

## License

MIT