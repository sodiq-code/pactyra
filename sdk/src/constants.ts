import { PublicKey } from "@solana/web3.js";

export const PACTYRA_CORE_PROGRAM_ID = new PublicKey(
  "EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC"
);

export const PACTYRA_VERIFIER_PROGRAM_ID = new PublicKey(
  "5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN"
);

export const REFERENCE_TREASURY_PROGRAM_ID = new PublicKey(
  "6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9"
);

/** Devnet USDC mint address (6 decimals). */
export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

/** Tier 1 maximum capability amount (5 USDC in base units). */
export const TIER_1_MAX_AMOUNT = 5_000_000;

/** Tier 2 maximum capability amount (50 USDC in base units). */
export const TIER_2_MAX_AMOUNT = 50_000_000;

/** Tier 3 maximum capability amount (500 USDC in base units). */
export const TIER_3_MAX_AMOUNT = 500_000_000;

/** Number of verified successes required for T1 → T2 upgrade. */
export const T1_TO_T2_THRESHOLD = 5;
