# Raydium SDK v2 Transaction Examples

## Overview
The Raydium SDK v2 provides comprehensive functionality for interacting with Raydium's liquidity pools, farms, and other DeFi features on Solana.

## Key Modules and Their Functions

### 1. Initialization
```typescript
import { Raydium } from "@raydium-io/raydium-sdk-v2";

const raydium = await Raydium.load({
  connection,
  owner, // KeyPair or PublicKey
  signAllTransactions, // optional - from wallet adapter
  tokenAccounts, // optional
  disableLoadToken: false, // set to true if you don't need token info
});
```

### 2. Liquidity Pool Operations

#### Types for Adding Liquidity
```typescript
interface AddLiquidityParams<T = TxVersion.LEGACY> {
  poolInfo: ApiV3PoolInfoStandardItem;
  poolKeys?: AmmV4Keys | AmmV5Keys;
  payer?: PublicKey;
  amountInA: TokenAmount;
  amountInB: TokenAmount;
  otherAmountMin: TokenAmount;
  fixedSide: LiquiditySide; // "a" | "b"
  config?: {
    bypassAssociatedCheck?: boolean;
    checkCreateATAOwner?: boolean;
  };
  txVersion?: T;
  computeBudgetConfig?: ComputeBudgetConfig;
  txTipConfig?: TxTipConfig;
  feePayer?: PublicKey;
}
```

#### Types for Removing Liquidity
```typescript
interface RemoveParams<T = TxVersion.LEGACY> {
  poolInfo: ApiV3PoolInfoStandardItem;
  poolKeys?: AmmV4Keys | AmmV5Keys;
  payer?: PublicKey;
  lpAmount: BN;
  baseAmountMin: BN;
  quoteAmountMin: BN;
  config?: {
    bypassAssociatedCheck?: boolean;
    checkCreateATAOwner?: boolean;
  };
  txVersion?: T;
  computeBudgetConfig?: ComputeBudgetConfig;
  txTipConfig?: TxTipConfig;
  feePayer?: PublicKey;
}
```

#### Types for Swapping
```typescript
interface SwapParam<T = TxVersion.LEGACY> {
  poolInfo: ApiV3PoolInfoStandardItem;
  poolKeys?: AmmV4Keys | AmmV5Keys;
  amountIn: BN;
  amountOut: BN;
  inputMint: string;
  fixedSide: SwapSide; // "in" | "out"
  config?: {
    associatedOnly?: boolean;
    inputUseSolBalance?: boolean;
    outputUseSolBalance?: boolean;
  };
  computeBudgetConfig?: ComputeBudgetConfig;
  txVersion?: T;
  txTipConfig?: TxTipConfig;
  feePayer?: PublicKey;
}
```

### 3. Farm Operations

#### Farm Deposit/Withdrawal Types
The SDK supports multiple farm versions (V3, V5, V6) with different parameter structures:

```typescript
// Farm deposit parameters are handled internally
// Key types to be aware of:
interface FarmPoolKeys {
  id: PublicKey;
  lpMint: PublicKey;
  rewardInfos: FarmRewardInfo[];
  authority: PublicKey;
  lpVault: PublicKey;
  upcoming: boolean;
}

interface FarmDWParam {
  // Deposit/Withdraw parameters
  amount: BN;
  poolKeys: FarmPoolKeys;
  userKeys: {
    ledger: PublicKey;
    lpTokenAccount: PublicKey;
    rewardTokenAccounts: PublicKey[];
    owner: PublicKey;
  };
}
```

### 4. API Methods

```typescript
// Fetch token list (mainnet only)
const tokenList = await raydium.api.getTokenList();

// Fetch token info
const tokenInfo = await raydium.api.getTokenInfo([
  "So11111111111111111111111111111111111111112", // SOL
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
]);

// Fetch pool list
const pools = await raydium.api.getPoolList({
  // Optional parameters - see API type definitions
});

// Fetch pool by ID
const poolInfo = await raydium.api.fetchPoolById({
  ids: "AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA",
});

// Fetch pools by mints
const poolsByMints = await raydium.api.fetchPoolByMints({
  mint1: "So11111111111111111111111111111111111111112",
  mint2: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
});

// Fetch farm info by ID
const farmInfo = await raydium.api.fetchFarmInfoById({
  ids: "4EwbZo8BZXP5313z5A2H11MRBP15M5n6YxfmkjXESKAW",
});
```

### 5. CPMM (Constant Product Market Maker) Operations

#### Types for CPMM
```typescript
interface AddCpmmLiquidityParams {
  poolInfo: CpmmPoolInfoInterface;
  inputAmount: TokenAmount;
  anotherAmount: TokenAmount;
  baseIn: boolean;
  slippage: number;
}

interface WithdrawCpmmLiquidityParams {
  poolInfo: CpmmPoolInfoInterface;
  lpAmount: BN;
  baseAmountMin: BN;
  quoteAmountMin: BN;
}

interface CpmmSwapParams {
  poolInfo: CpmmPoolInfoInterface;
  swapResult: SwapResult;
  inputAmount: TokenAmount;
  outputToken: Token;
  slippage: number;
}
```

### 6. Transaction Building Pattern

The SDK follows a pattern where operations return transaction instructions that need to be executed:

```typescript
// Example pattern (pseudo-code)
// 1. Create the transaction parameters
const params = {
  poolInfo: poolData,
  amountIn: new BN(1000000),
  // ... other parameters
};

// 2. Build the transaction (specific method depends on operation)
// The SDK handles instruction creation internally

// 3. Execute the transaction
// This would be handled by your transaction execution logic
```

### 7. Important Constants and Utilities

```typescript
// Program IDs
import {
  LIQUIDITY_POOL_PROGRAM_ID_V5_MODEL,
  AMM_V4,
  AMM_STABLE,
  FARM_PROGRAM_ID_V3,
  FARM_PROGRAM_ID_V5,
  FARM_PROGRAM_ID_V6,
  CLMM_PROGRAM_ID,
  CREATE_CPMM_POOL_PROGRAM,
} from "@raydium-io/raydium-sdk-v2";

// Common token mints
import {
  SOLMint,
  WSOLMint,
  USDCMint,
  USDTMint,
  RAYMint,
} from "@raydium-io/raydium-sdk-v2";

// Utility functions
import {
  getATAAddress,
  toTokenAmount,
  parseBigNumberish,
} from "@raydium-io/raydium-sdk-v2";
```

## Key Features

1. **Multiple Pool Types**: Supports AMM V4, V5, Stable pools, CLMM (Concentrated Liquidity), and CPMM
2. **Farm Support**: Multiple farm versions (V3, V5, V6) with different reward structures
3. **Transaction Versions**: Supports both legacy and V0 transactions
4. **Compute Budget**: Built-in support for compute budget configuration
5. **Slippage Protection**: Min amount parameters for liquidity operations
6. **Token Account Management**: Automatic ATA creation and management

## Demo Repository

The Raydium team provides a demo repository with complete examples:
https://github.com/raydium-io/raydium-sdk-V2-demo

This demo repository would contain practical examples of:
- Creating pools
- Adding/removing liquidity
- Swapping tokens
- Staking in farms
- Harvesting rewards

## Notes

1. The SDK is designed to work with Raydium's API for fetching pool and token information
2. Most operations require pool info from the API before executing transactions
3. The SDK handles most of the complex instruction building internally
4. Always use appropriate slippage settings and minimum amounts for protection
5. The mainnet API endpoints have more features than devnet