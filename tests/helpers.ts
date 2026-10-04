/**
 * Shared test helpers for the PACTYRA test suite.
 *
 * Provides common setup (airdrop, SPL token creation, PDA derivation)
 * and assertion utilities used across all test files.
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Connection,
  Signer,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { expect } from "chai";

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export const PYTH_PULL_ORACLE_ID = new PublicKey(
  "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT"
);

export const TIER_1_MAX = new BN(5_000_000);
export const TIER_2_MAX = new BN(50_000_000);
export const TIER_3_MAX = new BN(500_000_000);
export const BOND_AMOUNT = new BN(5_000_000);

export async function airdrop(
  connection: Connection,
  pubkey: PublicKey,
  amount: number
) {
  const sig = await connection.requestAirdrop(pubkey, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

export function makeId(): Uint8Array {
  return Keypair.generate().publicKey.toBytes();
}

// ============================================================
// Raw SPL Token instruction builders
// ============================================================

export function createInitializeMintInstruction(
  mint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(67);
  data.writeUInt8(0, 0);
  data.writeUInt8(decimals, 1);
  mintAuthority.toBuffer().copy(data, 2);
  data.writeUInt8(0, 34);
  return new TransactionInstruction({
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

export function createInitializeAccountInstruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(49);
  data.writeUInt8(1, 0);
  mint.toBuffer().copy(data, 1);
  owner.toBuffer().copy(data, 33);
  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

export function createMintToInstruction(
  mint: PublicKey,
  dest: PublicKey,
  authority: PublicKey,
  amount: number
): TransactionInstruction {
  const data = Buffer.alloc(49);
  data.writeUInt8(7, 0);
  data.writeBigUInt64LE(BigInt(amount), 1);
  return new TransactionInstruction({
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

export async function createMint(
  connection: Connection,
  payer: Signer,
  mintAuthority: PublicKey,
  decimals: number
): Promise<PublicKey> {
  const mint = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(82);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: 82,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, decimals, mintAuthority)
  );
  await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  return mint.publicKey;
}

export async function createTokenAccount(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const account = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(165);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: account.publicKey,
      space: 165,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeAccountInstruction(account.publicKey, mint, owner)
  );
  await sendAndConfirmTransaction(connection, tx, [payer, account]);
  return account.publicKey;
}

export async function mintToAccount(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  dest: PublicKey,
  authority: PublicKey,
  amount: number
): Promise<void> {
  const tx = new Transaction().add(
    createMintToInstruction(mint, dest, authority, amount)
  );
  await sendAndConfirmTransaction(connection, tx, [payer]);
}

export async function getTokenBalance(
  connection: Connection,
  account: PublicKey
): Promise<number> {
  const info = await connection.getTokenAccountBalance(account);
  return parseInt(info.value.amount);
}

// ============================================================
// Assertion helpers
// ============================================================

export function expectError(err: any, errorCode: string) {
  expect(err.toString()).to.include(errorCode);
}
