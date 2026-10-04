import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
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

// SPL Token program ID
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

// ============================================================
// Raw SPL Token instruction builders (avoid spl-token lib ESM issue)
// ============================================================

function createInitializeMintInstruction(
  mint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null
): TransactionInstruction {
  const data = Buffer.alloc(67);
  data.writeUInt8(0, 0); // InitializeMint instruction index
  data.writeUInt8(decimals, 1);
  mintAuthority.toBuffer().copy(data, 2);
  data.writeUInt8(freezeAuthority ? 1 : 0, 34);
  if (freezeAuthority) {
    freezeAuthority.toBuffer().copy(data, 35);
  }
  return new TransactionInstruction({
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

function createInitializeAccountInstruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(49);
  data.writeUInt8(1, 0); // InitializeAccount instruction index
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

function createMintToInstruction(
  mint: PublicKey,
  dest: PublicKey,
  authority: PublicKey,
  amount: number | BN
): TransactionInstruction {
  const data = Buffer.alloc(49);
  data.writeUInt8(7, 0); // MintTo instruction index
  const amountVal = amount instanceof BN ? amount.toBuffer() : new BN(amount).toBuffer();
  amountVal.copy(data, 1, 0, 8);
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

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

async function createMint(
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
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      mintAuthority,
      null
    )
  );
  await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  return mint.publicKey;
}

async function createTokenAccount(
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

async function mintToAccount(
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

// ============================================================
// Tests
// ============================================================

describe("pactyra-core", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PactyraCore as any;

  let authority: Keypair;
  let agentId: Uint8Array;
  let usdcMint: PublicKey;
  let agentTokenAccount: PublicKey;
  let bondVault: PublicKey;
  let policyPda: PublicKey;
  let capabilityPda: PublicKey;
  let bondPda: PublicKey;
  let agentPda: PublicKey;
  let verifierRegistryPda: PublicKey;

  let actionNonce = 0;
  const getNextNonce = () => {
    actionNonce += 1;
    return new BN(actionNonce);
  };

  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  async function deriveConsumedNoncePda(agentId: Uint8Array, nonce: BN) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  before(async () => {
    authority = Keypair.generate();
    await airdrop(authority.publicKey, 50);
    await airdrop(provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();

    [verifierRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("verifier_registry")],
      program.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(agentId)],
      program.programId
    );

    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      6
    );

    agentTokenAccount = await createTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      authority.publicKey
    );

    await mintToAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      agentTokenAccount,
      provider.wallet.publicKey,
      100_000_000
    );

    [bondVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond_vault"), usdcMint.toBuffer()],
      program.programId
    );

    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), Buffer.from("PAY-V1")],
      program.programId
    );

    [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond"), Buffer.from(agentId)],
      program.programId
    );
  });

  it("Initializes the protocol", async () => {
    await program.methods
      .initializeProtocol()
      .accounts({
        verifierRegistry: verifierRegistryPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const registry = await program.account.verifierRegistry.fetch(
      verifierRegistryPda
    );
    expect(registry.authority.toString()).to.equal(
      provider.wallet.publicKey.toString()
    );
    expect(registry.verifiers).to.have.length(0);
  });

  it("Registers an agent", async () => {
    await program.methods
      .registerAgent(Array.from(agentId))
      .accounts({
        agent: agentPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ probation: {} });
    expect(agent.status).to.deep.equal({ active: {} });
    expect(agent.currentEpoch.toNumber()).to.equal(1);
    expect(agent.bondAmount.toNumber()).to.equal(0);
  });

  it("Creates a policy", async () => {
    await program.methods
      .createPolicy({
        versionTag: "PAY-V1",
        capabilityType: { payService: {} },
        minSuccesses: new BN(5),
        minSuccessRateBps: 9500,
        criticalFailureLimit: new BN(0),
        minBondUsdc: new BN(5_000_000),
        maxAmountUsdc: new BN(500_000_000),
      })
      .accounts({
        policy: policyPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.versionTag).to.equal("PAY-V1");
    expect(policy.capabilityType).to.deep.equal({ payService: {} });
    expect(policy.minBondUsdc.toNumber()).to.equal(5_000_000);
    expect(policy.maxAmountUsdc.toNumber()).to.equal(500_000_000);
    expect(policy.status).to.deep.equal({ active: {} });
  });

  it("Locks a bond of 5 USDC", async () => {
    await program.methods
      .lockBond(new BN(5_000_000))
      .accounts({
        agent: agentPda,
        bond: bondPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(5_000_000);

    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.amount.toNumber()).to.equal(5_000_000);
    expect(bond.slashed).to.equal(false);
  });

  it("Requests a capability with $5 limit", async () => {
    [capabilityPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("capability"),
        Buffer.from(agentId),
        new BN(1).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const targetProgram = Keypair.generate().publicKey;
    const targetAccount = Keypair.generate().publicKey;

    await program.methods
      .requestCapability({
        capabilityType: { payService: {} },
        targetProgram: targetProgram,
        targetAccount: targetAccount,
        amountLimit: new BN(5_000_000),
        frequencyLimit: new BN(10),
        ttlSeconds: new BN(1800),
      })
      .accounts({
        agent: agentPda,
        policy: policyPda,
        capability: capabilityPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const cap = await program.account.capability.fetch(capabilityPda);
    expect(cap.amountLimit.toNumber()).to.equal(5_000_000);
    expect(cap.capabilityType).to.deep.equal({ payService: {} });
    expect(cap.status).to.deep.equal({ active: {} });
    expect(cap.authorityEpoch.toNumber()).to.equal(1);
  });

  it("Asserts capability with $5 — PASSES", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = getNextNonce();
    const [consumedNoncePda] = await deriveConsumedNoncePda(agentId, nonce);

    await program.methods
      .assertCapability({
        actionType: { payService: {} },
        targetProgram: cap.targetProgram,
        targetAccount: cap.targetAccount,
        amount: new BN(5_000_000),
        actionNonce: nonce,
      })
      .accounts({
        agent: agentPda,
        capability: capabilityPda,
        policy: policyPda,
        consumedNonce: consumedNoncePda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const nonceAccount = await program.account.consumedNonce.fetch(
      consumedNoncePda
    );
    expect(nonceAccount.nonce.toNumber()).to.equal(nonce.toNumber());
  });

  it("Rejects $6 — AmountExceedsCapability", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = getNextNonce();
    const [consumedNoncePda] = await deriveConsumedNoncePda(agentId, nonce);

    try {
      await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: cap.targetProgram,
          targetAccount: cap.targetAccount,
          amount: new BN(6_000_000),
          actionNonce: nonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have thrown AmountExceedsCapability");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsCapability");
    }
  });

  it("Rejects wrong action type — ActionTypeNotPermitted", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = getNextNonce();
    const [consumedNoncePda] = await deriveConsumedNoncePda(agentId, nonce);

    try {
      await program.methods
        .assertCapability({
          actionType: { trade: {} },
          targetProgram: cap.targetProgram,
          targetAccount: cap.targetAccount,
          amount: new BN(1_000_000),
          actionNonce: nonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have thrown ActionTypeNotPermitted");
    } catch (err: any) {
      expect(err.toString()).to.include("ActionTypeNotPermitted");
    }
  });

  it("Rejects wrong target account — TargetNotInScope", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = getNextNonce();
    const [consumedNoncePda] = await deriveConsumedNoncePda(agentId, nonce);

    try {
      await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: cap.targetProgram,
          targetAccount: Keypair.generate().publicKey,
          amount: new BN(1_000_000),
          actionNonce: nonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have thrown TargetNotInScope");
    } catch (err: any) {
      expect(err.toString()).to.include("TargetNotInScope");
    }
  });

  it("Rejects wrong target program — TargetProgramMismatch", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = getNextNonce();
    const [consumedNoncePda] = await deriveConsumedNoncePda(agentId, nonce);

    try {
      await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: Keypair.generate().publicKey,
          targetAccount: cap.targetAccount,
          amount: new BN(1_000_000),
          actionNonce: nonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have thrown TargetProgramMismatch");
    } catch (err: any) {
      expect(err.toString()).to.include("TargetProgramMismatch");
    }
  });

  it("Rejects replay — nonce already consumed", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const replayNonce = new BN(1); // Reuse nonce=1 from the passing test
    const [consumedNoncePda] = await deriveConsumedNoncePda(
      agentId,
      replayNonce
    );

    try {
      await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: cap.targetProgram,
          targetAccount: cap.targetAccount,
          amount: new BN(1_000_000),
          actionNonce: replayNonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have rejected replay");
    } catch (err: any) {
      // Anchor throws when init fails because account already exists
      expect(err.toString()).to.match(
        /already in use|account already exists|ConstraintSeeds|0x1/i
      );
    }
  });
});
