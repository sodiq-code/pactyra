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

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

function createInitializeMintInstruction(
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

function createInitializeAccountInstruction(
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

function createMintToInstruction(
  mint: PublicKey,
  dest: PublicKey,
  authority: PublicKey,
  amount: number
): TransactionInstruction {
  const data = Buffer.alloc(49);
  data.writeUInt8(7, 0); // MintTo instruction index
  data.writeBigUInt64LE(BigInt(amount), 1); // amount (8 bytes, little-endian)
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
    createInitializeMintInstruction(mint.publicKey, decimals, mintAuthority)
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

async function mintTo(
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

async function getTokenBalance(
  connection: Connection,
  account: PublicKey
): Promise<number> {
  const info = await connection.getTokenAccountBalance(account);
  return parseInt(info.value.amount);
}

describe("reference-treasury enforcement", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.PactyraCore as any;
  const treasuryProgram = anchor.workspace.ReferenceTreasury as any;

  let authority: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let verifierOperator: Keypair;
  let treasuryPda: PublicKey;
  let vault: PublicKey;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let usdcMint: PublicKey;
  let capabilityPda: PublicKey;
  let actionNonce: number;

  const TIER_1_MAX = new BN(5_000_000);
  const BOND_AMOUNT = new BN(5_000_000);

  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  before(async () => {
    authority = Keypair.generate();
    verifierOperator = Keypair.generate();
    await airdrop(authority.publicKey, 50);
    await airdrop(verifierOperator.publicKey, 10);
    await airdrop(provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
    actionNonce = 1000;

    [verifierRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("verifier_registry")],
      coreProgram.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(agentId)],
      coreProgram.programId
    );
    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), Buffer.from("PAY-V1")],
      coreProgram.programId
    );
    [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond"), Buffer.from(agentId)],
      coreProgram.programId
    );

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      6
    );

    // Derive treasury PDA
    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), authority.publicKey.toBuffer()],
      treasuryProgram.programId
    );

    // Derive vault PDA (seeds: [b"vault", treasury_pda])
    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), treasuryPda.toBuffer()],
      treasuryProgram.programId
    );

    // Create token accounts for user (depositor) and recipient
    userTokenAccount = await createTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      authority.publicKey
    );

    recipientTokenAccount = await createTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      authority.publicKey
    );

    // Mint USDC to the user's token account
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      userTokenAccount,
      provider.wallet.publicKey,
      100_000_000 // 100 USDC
    );
  });

  it("Initializes the protocol", async () => {
    try {
      await coreProgram.methods
        .initializeProtocol()
        .accounts({
          verifierRegistry: verifierRegistryPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      // Already initialized
    }

    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 10;
    try {
      await coreProgram.methods
        .registerVerifier(
          Array.from(verifierId),
          coreProgram.programId,
          verifierOperator.publicKey
        )
        .accounts({
          verifierRegistry: verifierRegistryPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      // Already registered
    }
  });

  it("Registers an agent, creates policy, locks bond", async () => {
    try {
      await coreProgram.methods
        .registerAgent(Array.from(agentId))
        .accounts({
          agent: agentPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    } catch (e) {
      // Already registered
    }

    try {
      await coreProgram.methods
        .createPolicy({
          versionTag: "PAY-V1",
          capabilityType: { payService: {} },
          minSuccesses: new BN(20),
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
    } catch (e) {
      // Already created
    }

    try {
      await coreProgram.methods
        .lockBond(BOND_AMOUNT)
        .accounts({
          agent: agentPda,
          bond: bondPda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    } catch (e) {
      // Already locked
    }
  });

  it("Initializes the treasury with a USDC vault", async () => {
    await treasuryProgram.methods
      .initializeTreasury(0)
      .accounts({
        treasury: treasuryPda,
        vault: vault,
        usdcMint: usdcMint,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const treasury = await treasuryProgram.account.treasury.fetch(treasuryPda);
    expect(treasury.usdcMint.toString()).to.equal(usdcMint.toString());
    expect(treasury.vault.toString()).to.equal(vault.toString());
    expect(treasury.paused).to.equal(false);
  });

  it("Deposits 100 USDC into the treasury vault", async () => {
    // Verify the user token account has USDC
    const userBalance = await getTokenBalance(provider.connection, userTokenAccount);
    console.log("    User token balance before deposit:", userBalance);

    const [userBalancePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_balance"), treasuryPda.toBuffer(), authority.publicKey.toBuffer()],
      treasuryProgram.programId
    );

    await treasuryProgram.methods
      .deposit(new BN(100_000_000))
      .accounts({
        treasury: treasuryPda,
        userBalance: userBalancePda,
        userToken: userTokenAccount,
        vault: vault,
        user: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const vaultBalance = await getTokenBalance(provider.connection, vault);
    expect(vaultBalance).to.equal(100_000_000);
  });

  it("Requests a $5 capability targeting the treasury", async () => {
    const agent = await coreProgram.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;

    [capabilityPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("capability"),
        Buffer.from(agentId),
        epoch.toArrayLike(Buffer, "le", 8),
        treasuryPda.toBuffer(),
      ],
      coreProgram.programId
    );

    await coreProgram.methods
      .requestCapability({
        capabilityType: { payService: {} },
        targetProgram: treasuryPda,
        targetAccount: recipientTokenAccount,
        amountLimit: TIER_1_MAX,
        frequencyLimit: new BN(10),
        ttlSeconds: new BN(3600),
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

    const cap = await coreProgram.account.capability.fetch(capabilityPda);
    expect(cap.amountLimit.toNumber()).to.equal(5_000_000);
    expect(cap.targetProgram.toString()).to.equal(treasuryPda.toString());
    expect(cap.targetAccount.toString()).to.equal(recipientTokenAccount.toString());
  });

  it("Executes an authorized $5 transfer — CPI into assert_capability PASSES", async () => {
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      coreProgram.programId
    );

    const vaultBefore = await getTokenBalance(provider.connection, vault);
    const recipientBefore = await getTokenBalance(
      provider.connection,
      recipientTokenAccount
    );

    await treasuryProgram.methods
      .authorizedTransfer(new BN(5_000_000), nonce)
      .accounts({
        treasury: treasuryPda,
        agent: agentPda,
        capability: capabilityPda,
        policy: policyPda,
        consumedNonce: consumedNoncePda,
        pactyraCoreProgram: coreProgram.programId,
        vault: vault,
        recipientToken: recipientTokenAccount,
        authorityRoot: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const vaultAfter = await getTokenBalance(provider.connection, vault);
    const recipientAfter = await getTokenBalance(
      provider.connection,
      recipientTokenAccount
    );

    expect(vaultBefore - vaultAfter).to.equal(5_000_000);
    expect(recipientAfter - recipientBefore).to.equal(5_000_000);
  });

  it("Rejects $6 transfer — AmountExceedsCapability (capability is $5)", async () => {
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      coreProgram.programId
    );

    const vaultBefore = await getTokenBalance(provider.connection, vault);

    try {
      await treasuryProgram.methods
        .authorizedTransfer(new BN(6_000_000), nonce)
        .accounts({
          treasury: treasuryPda,
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          pactyraCoreProgram: coreProgram.programId,
          vault: vault,
          recipientToken: recipientTokenAccount,
          authorityRoot: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have rejected $6 transfer");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsCapability");
    }

    // Verify no USDC was moved
    const vaultAfter = await getTokenBalance(provider.connection, vault);
    expect(vaultAfter).to.equal(vaultBefore);
  });

  it("Rejects replay — same nonce already consumed", async () => {
    const replayNonce = new BN(actionNonce - 2); // reuse the nonce from the passing test
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        replayNonce.toArrayLike(Buffer, "le", 8),
      ],
      coreProgram.programId
    );

    const vaultBefore = await getTokenBalance(provider.connection, vault);

    try {
      await treasuryProgram.methods
        .authorizedTransfer(new BN(1_000_000), replayNonce)
        .accounts({
          treasury: treasuryPda,
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          pactyraCoreProgram: coreProgram.programId,
          vault: vault,
          recipientToken: recipientTokenAccount,
          authorityRoot: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have rejected replay");
    } catch (err: any) {
      expect(err.toString()).to.match(
        /already in use|account already exists|0x1/i
      );
    }

    // Verify no USDC was moved
    const vaultAfter = await getTokenBalance(provider.connection, vault);
    expect(vaultAfter).to.equal(vaultBefore);
  });

  it("Rejects transfer with wrong recipient — TargetNotInScope", async () => {
    // Create a different recipient token account
    const wrongRecipient = await createTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      authority.publicKey
    );

    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      coreProgram.programId
    );

    const vaultBefore = await getTokenBalance(provider.connection, vault);

    try {
      await treasuryProgram.methods
        .authorizedTransfer(new BN(1_000_000), nonce)
        .accounts({
          treasury: treasuryPda,
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          pactyraCoreProgram: coreProgram.programId,
          vault: vault,
          recipientToken: wrongRecipient,
          authorityRoot: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have rejected wrong recipient");
    } catch (err: any) {
      expect(err.toString()).to.include("TargetNotInScope");
    }

    // Verify no USDC was moved
    const vaultAfter = await getTokenBalance(provider.connection, vault);
    expect(vaultAfter).to.equal(vaultBefore);
  });

  it("Pauses and unpauses the treasury", async () => {
    await treasuryProgram.methods
      .setPaused(true)
      .accounts({
        treasury: treasuryPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    let treasury = await treasuryProgram.account.treasury.fetch(treasuryPda);
    expect(treasury.paused).to.equal(true);

    await treasuryProgram.methods
      .setPaused(false)
      .accounts({
        treasury: treasuryPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    treasury = await treasuryProgram.account.treasury.fetch(treasuryPda);
    expect(treasury.paused).to.equal(false);
  });
});
