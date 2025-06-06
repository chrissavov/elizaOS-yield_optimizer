# @elizaos/plugin-raydium

Raydium AMM utility library for ElizaOS providing pool information and liquidity management functions on Solana.

## Installation

```bash
npm install @elizaos/plugin-raydium
```

## Overview

This plugin provides a utility library for interacting with Raydium AMM on Solana. It exports raw functions for:
- Pool information retrieval
- Token symbol to mint address resolution
- User LP position tracking
- Liquidity management operations

**Note:** This plugin currently provides utility functions only and does not include ElizaOS actions or evaluators.

## Usage

```typescript
import raydiumPlugin from '@elizaos/plugin-raydium';

// The plugin exports utility functions directly
const { getRaydiumPoolInfo, getUserRaydiumPositions } = raydiumPlugin;

// Use the functions programmatically
const poolInfo = await getRaydiumPoolInfo('poolIdHere');
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

#### `getMintForSymbol(symbol: string, raydiumInstance: Raydium): Promise<string | null>`
Get mint address for a single token symbol.

#### `getMintsForSymbol(symbol: string, rpcUrl?: string): Promise<MintAddresses>`
Get mint addresses for a token pair symbol.

```typescript
const { mintA, mintB } = await getMintsForSymbol('SOL-USDC');
```

### User Positions

#### `getUserRaydiumPositions(userPublicKey: string | PublicKey, rpcUrl?: string, minBalance?: number): Promise<UserRaydiumPosition[]>`
Get all Raydium LP positions for a user.

```typescript
const positions = await getUserRaydiumPositions('userPublicKeyHere');
```

#### `getAllUserPositions(connection: Connection, userPublicKey: PublicKey): Promise<UserRaydiumPosition[]>`
Get all user positions using a provided connection.

### Liquidity Management

#### `addLiquidity(connection: Connection, params: AddLiquidityParams): Promise<TransactionSignature>`
Add liquidity to a Raydium pool.

```typescript
const txSignature = await addLiquidity(connection, {
  poolId: 'poolIdHere',
  amountA: 1000,
  amountB: 2000,
  slippage: 0.01,
  owner: ownerKeypair
});
```

#### `removeLiquidity(connection: Connection, params: RemoveLiquidityParams): Promise<TransactionSignature>`
Remove liquidity from a Raydium pool.

#### `getUserLpBalance(connection: Connection, poolId: string, userPublicKey: PublicKey): Promise<BN>`
Get user's LP token balance for a specific pool.

#### `estimateRemoveLiquidity(lpAmount: BN, poolInfo: RaydiumPoolInfo): { amountA: BN, amountB: BN }`
Estimate the amounts of tokens that will be received when removing liquidity.

### Utility Functions

#### `getRaydiumInstance(rpcUrl?: string): Promise<Raydium>`
Get or create a Raydium SDK instance.

#### `poolContainsSol(poolInfo: RaydiumPoolInfo): boolean`
Check if a pool contains SOL.

#### `clearPoolCache(): void`
Clear the internal pool cache.

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

### AddLiquidityParams
```typescript
interface AddLiquidityParams {
  poolId: string;
  amountA: number | BN;
  amountB: number | BN;
  slippage: number;
  owner: Keypair;
}
```

### RemoveLiquidityParams
```typescript
interface RemoveLiquidityParams {
  poolId: string;
  lpAmount: number | BN;
  slippage: number;
  owner: Keypair;
}
```

## Plugin Structure

```typescript
const raydiumPlugin = {
  name: "raydium",
  description: "Raydium AMM plugin for Solana yield and pool info",
  actions: [],    // No actions currently implemented
  providers: [],  // No providers currently implemented
  // Direct function exports...
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