# PACTYRA

**Evidence-bound economic authority for autonomous agents.**

AI agents already have keys. PACTYRA makes them earn the right to use them.

## Overview

PACTYRA is a protocol that converts verified execution history into machine-enforceable economic authority. It sits between autonomous agents and the economic programs they want to control — ensuring that authority is earned through verifiable outcomes, exercised within deterministic limits, and automatically revoked when verified performance fails.

### Core mechanic

```
$5 → $50 → $500 → $5
```

An agent starts at Tier 1 ($5 authority), earns Tier 2 ($50) after 5 verified successes, earns Tier 3 ($500) after 20+ successes at ≥95% success rate with a 5 USDC bond, and on a critical verified failure its bond is slashed, authority collapses back to $5, the epoch increments, and all outstanding capabilities become stale.

## Programs

All three programs are deployed to Solana devnet and verified executable.

| Program | Program ID | Deployed | Size |
|---|---|---|---|
| `pactyra-core` | `EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC` | ✅ Devnet | 336 KB |
| `pactyra-verifier` | `5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN` | ✅ Devnet | 217 KB |
| `reference-treasury` | `6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9` | ✅ Devnet | 287 KB |

### Devnet transaction evidence

The following transactions were executed on Solana devnet, proving the programs are live and functional:

| Instruction | Transaction Signature |
|---|---|
| Initialize protocol | [`XajnkaaFzz...GQv`](https://solana.fm/tx/XajnkaaFzzLgaCSo6jh2RV2sBgs2Ge4uESVbTG7gdZKTkbaQePEs1yWYjyEuVVdbFndzVJmp3swtrEMsmVX2GQv?cluster=devnet) |
| Register verifier | [`5LUx5i9FKh...aWo`](https://solana.fm/tx/5LUx5i9FKhoZGDtxV7tHbfStmzjpifejDjGLBYM6o7zQi89sjQYz5xbVVXWpMbc1TgYYswMrKAeuqEMBC6gZHaWo?cluster=devnet) |
| Register agent | [`c6kQt5E2oR...LFW`](https://solana.fm/tx/c6kQt5E2oR96SNebNp5KrREJp4wqMQjCjHCMnnJmZfZQa5K6HfnvNTisxCFo4RaeRspGCCBk3GLgwCA5qkzrLFW?cluster=devnet) |
| Create policy | [`3dZrGaxyXh...5JM`](https://solana.fm/tx/3dZrGaxyXhz43fdjArfwU4cLGUNQYeqTqxuZ1ya2r9qsJaXc5BCCpKVCwQqyWrmUVYJgSp6YRLcZ5yrgsTDp55JM?cluster=devnet) |
| Lock bond | [`5MqTqxj3ac...7GkE`](https://solana.fm/tx/5MqTqxj3aczMkcJh7aKsm5zNjrGxmhMM7vEVGacuBHG3PXKMBrTbhbhh5cnk9RKH6yzja21wuE5hnCGVekhY7GkE?cluster=devnet) |

### Verified agent state on devnet

```
Tier: Probation
Epoch: 1
Bond: 5,000,000 base units (5 USDC)
Max capability: $5
```

### Devnet configuration

```
RPC: https://devnet.helius-rpc.com/?api-key=4196f886-5f5f-4fdb-8fae-128076aa8468
Wallet: A55wG1G5nLVxn9Ns91ogrqZ6cHVi2yPd7WRi8GCyc3PE
USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (6 decimals)
Pyth Pull Oracle: pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT
```

## pactyra-core

### Instructions

| Instruction | Description |
|---|---|
| `initialize_protocol` | Creates the VerifierRegistry PDA with the protocol authority |
| `register_agent` | Registers a new agent with the signer as authority root (Tier 1 / Probation) |
| `register_verifier` | Registers a verifier operator in the VerifierRegistry (protocol authority only) |
| `create_policy` | Creates an immutable policy defining capability requirements |
| `lock_bond` | Locks a bond for an agent (re-lockable after slash) |
| `request_capability` | Issues an evidence-bound capability with TTL, amount limit, target scope, and authority epoch binding |
| `assert_capability` | The core enforcement instruction — validates 12 security checks before authorizing an action |
| `record_outcome` | Records a verified outcome from a registered verifier, triggers authority transitions |
| `revoke_capability` | Revokes a capability (agent authority root only) |

### Authority tiers

| Tier | Name | PAY_SERVICE max | Trade max | Upgrade requirement |
|---|---|---|---|---|
| 1 | Probation | $5 | Off | Initial tier |
| 2 | Proven | $50 | $25 | 5 verified successes |
| 3 | Trusted | $500 | $250 | 20+ successes, ≥95% rate, 0 critical failures, bond |

### Authority transitions

**Upgrade (T1→T2):** Automatically triggered by `record_outcome` when `success_count >= 5`.

**Upgrade (T2→T3):** Automatically triggered by `record_outcome` when:
- `success_count >= policy.min_successes` (20)
- `success_rate >= policy.min_success_rate_bps` (9500 = 95%)
- `critical_failures <= policy.critical_failure_limit` (0)
- `bond_amount >= policy.min_bond_usdc` (5 USDC)

**Downgrade (T3→T1):** Automatically triggered by `record_outcome` on critical failure:
- Bond slashed (amount → 0, slashed flag set)
- Agent tier → Probation
- Authority epoch incremented (invalidates all outstanding capabilities)

### assert_capability security checks

The `assert_capability` instruction performs 12 security checks before authorizing an action:

1. Agent active
2. Capability active
3. Capability belongs to agent
4. Authority epoch current
5. Policy match
6. Policy active
7. Not expired
8. Action type permitted
9. Target program match
10. Target account in scope
11. Amount within limit
12. Bond satisfied

Replay protection is enforced via a `ConsumedNonce` PDA that is created on each successful assertion, making the same (agent, nonce) pair unusable twice.

## SDK

The `@pactyra/client` TypeScript SDK provides a typed interface to all three programs.

### Installation

```bash
cd sdk && npm install
```

### Usage

```typescript
import { PactyraClient } from '@pactyra/client';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('http://localhost:8899', 'confirmed');
const wallet = { /* your wallet implementation */ };

const client = await PactyraClient.connect(wallet, connection);

// Register an agent
await client.registerAgent(agentId);

// Lock a 5 USDC bond
await client.lockBond(agentId, 5_000_000);

// Request a $5 capability
const { capabilityPda } = await client.requestCapability(agentId, {
  capabilityType: 'payService',
  targetProgram: treasuryPda.toString(),
  targetAccount: recipientToken.toString(),
  amountLimit: 5_000_000,
  frequencyLimit: 10,
  ttlSeconds: 1800,
});

// Assert a capability (the hero instruction)
await client.assertCapability(agentId, {
  actionType: 'payService',
  targetProgram: treasuryPda.toString(),
  targetAccount: recipientToken.toString(),
  amount: 5_000_000,
  actionNonce: 1,
});

// Record a verified outcome
await client.recordOutcome(agentId, actionId, capabilityId, 'pass', 'none', evidenceHash);

// Read agent state
const agent = await client.getAgent(agentId);
console.log('Tier:', client.getTierName(agent.tier));
console.log('Max amount:', client.getTierMaxAmount(agent.tier));
console.log('Success rate:', client.getSuccessRate(agent.successCount, agent.totalCount));
```

### SDK Tests

```
  @pactyra/client SDK
    ✔ Connects to a cluster
    ✔ Exposes all three programs
    ✔ Exports correct program IDs
    ✔ Exports devnet USDC mint
    ✔ Exports tier amount constants
    ✔ Derives agent PDA correctly
    ✔ Derives bond PDA correctly
    ✔ Derives policy PDA correctly
    ✔ Derives verifier registry PDA correctly
    ✔ Derives consumed nonce PDA correctly
    ✔ Derives capability PDA with target_program seed
    ✔ Derives receipt PDA correctly
    ✔ Derives treasury PDA correctly
    ✔ Derives vault PDA correctly
    ✔ Derives freshness config PDA correctly
    ✔ Returns tier name from tier object
    ✔ Returns tier max from tier object
    ✔ Computes success rate correctly
    ✔ Exports all enums

  19 passing (71ms)
```

## Agent Passport UI

The Agent Passport is a Next.js web application that renders onchain agent state.

### Features

- **Hero card**: Agent ID, current authority tier, max amount, verified execution count, success rate, critical failures, bond status, authority epoch
- **Authority timeline**: Visual history of upgrades, downgrades, assertions, outcomes, bond events
- **Performance receipts**: Evidence viewer with verifier, result, severity, and evidence hash
- **Capability list**: Active/locked capabilities with amount limits and TTL

### Running the UI

The UI is served from the Next.js application:

```bash
bun run dev
```

The page renders at `http://localhost:3000` showing the Agent Passport with:
- Agent `treasury-agent-042` at Tier 3 (Trusted) with $500 authority
- 28 verified executions, 27 successful, 96.4% success rate
- Active capabilities: PAY_SERVICE ($500), TRADE ($250)
- Locked capabilities: TREASURY_WITHDRAW, DELEGATE
- Authority timeline with upgrade events
- Performance receipts with Pyth freshness verifier evidence

## Demo orchestration

The `scripts/` directory contains orchestration scripts that produce the complete authority loop in a single reproducible run.

### Scripts

| Script | Purpose |
|---|---|
| `bootstrap.ts` | Initialize protocol, register verifier + agent, create policy, lock bond |
| `earn-tier2.ts` | Record 5 verified successes → Tier 1 → Tier 2 ($5 → $50) |
| `earn-tier3.ts` | Record 22 successes + 1 ordinary fail (27/28 = 96.4%) → Tier 2 → Tier 3 ($50 → $500) |
| `unauthorized-transfer.ts` | Attempt $400 transfer with $50 capability → rejected (AmountExceedsCapability) |
| `critical-failure.ts` | Record critical failure → bond slashed, tier downgraded, epoch++ ($500 → $5) |
| `stale-capability.ts` | Attempt to use old-epoch capability → rejected (StaleEpoch) |
| `demo-runner.ts` | Master script chaining all steps in one run |

### Demo output

```
  Demo: $5 → $50 → $500 → $5
    Agent tier: Probation | Bond: 5000000 | Max: $5
    ✔ [1/6] Bootstrap: Initialize protocol, register agent, lock bond (2160ms)
    Tier: Proven | Successes: 5 | Max: $50
    ✔ [2/6] Earn Tier 2: 5 verified successes → $5 → $50 (2117ms)
    Tier: Trusted | Total: 28 | Rate: 96.4% | Max: $500
    ✔ [3/6] Earn Tier 3: 27/28 successes (96.4%) → $50 → $500 (9963ms)
    Rejected: AmountExceedsCapability — no USDC moved
    ✔ [4/6] Unauthorized transfer: $400 rejected (AmountExceedsCapability) (458ms)
    Before: Tier Trusted Epoch 1
    After:  Tier Probation Epoch 2 | Bond: 0 (slashed)
    ✔ [5/6] Critical failure: $500 → $5, bond slashed, epoch++ (840ms)
    Capability epoch: 1 | Current epoch: 2
    Rejected: StaleEpoch — old capabilities invalidated
    ✔ [6/6] Stale capability: old epoch capability rejected (StaleEpoch)

    === Demo Complete ===
    Final tier: Probation
    Final epoch: 2
    Total verified: 29
    Total successful: 27
    Critical failures: 1
    Bond: 0 (slashed)

    $5 → $50 → $500 → $5 ✓
    ✔ Summary: Full $5 → $50 → $500 → $5 loop demonstrated

  7 passing (16s)
```

The demo proves the complete mechanism density:
- Authority earned through verified performance
- Authority enforced before USDC transfers
- Critical failure collapses authority deterministically
- Stale credentials invalidated by epoch increment

## Test results

```
  bond
    ✔ Bond lock works (437ms)
    ✔ Bond slash on critical failure (416ms)
    ✔ Bond re-lock after slash works (429ms)
    ✔ Capability request without bond rejected — BondNotSatisfied (439ms)

  capabilities
    ✔ Valid capability assertion passes (862ms)
    ✔ Wrong amount rejected — AmountExceedsCapability (451ms)
    ✔ Wrong target account rejected — TargetNotInScope (434ms)
    ✔ Wrong target program rejected — TargetProgramMismatch (430ms)
    ✔ Wrong action type rejected — ActionTypeNotPermitted (435ms)
    ✔ Revoked capability rejected — CapabilityNotActive (853ms)

  epochs
    ✔ T1 → T2 after 5 verified successes (2153ms)
    ✔ T2 → T3 after 22 more successes + 1 ordinary fail (27/28 = 96.4%) (9951ms)
    ✔ T3 → T1 on critical failure with epoch increment (885ms)
    ✔ Old epoch capability rejected — StaleEpoch

  failure
    ✔ Ordinary failure does not downgrade tier or slash bond (440ms)
    ✔ Critical failure downgrades to Probation and slashes bond (433ms)

  replay
    ✔ First use of nonce passes (852ms)
    ✔ Replay with same nonce rejected — account already exists

  targets
    ✔ Target substitution rejected — TargetNotInScope
    ✔ Amount escalation rejected — AmountExceedsCapability
    ✔ Wrong target program rejected — TargetProgramMismatch
    ✔ Valid target and amount passes (386ms)

  treasury
    ✔ Initializes treasury and deposits USDC (878ms)
    ✔ Authorized $5 transfer executes — CPI passes (875ms)
    ✔ Unauthorized $6 transfer reverts — no USDC moved
    ✔ Wrong recipient rejected — TargetNotInScope, no USDC moved (433ms)

  verifier
    ✔ Initializes freshness config (430ms)
    ✔ Non-Pyth account rejected — WrongOwner
    ✔ Insufficient data rejected — owner or data check
    ✔ Wrong feed ID rejected — owner or feed check
    ✔ Unauthorized verifier rejected — UnauthorizedVerifier (389ms)

  31 passing (44s)
```

### Security properties verified

| Test file | Threats covered |
|---|---|
| `capabilities.ts` | T1, T4, T5, T7, T8 (valid, wrong amount, wrong target, wrong action type, revoked) |
| `epochs.ts` | T2, T18 (T1→T2, T2→T3, T3→T1, stale epoch, authority transitions) |
| `replay.ts` | T3 (nonce reuse rejected) |
| `targets.ts` | T1, T4, T5 (target substitution, amount escalation, wrong program) |
| `failure.ts` | T18 (ordinary fail, critical fail, slash, downgrade) |
| `bond.ts` | bond lock, slash, re-lock, insufficient bond rejection |
| `treasury.ts` | T9, T10, T11 (authorized transfer, unauthorized reverts, wrong recipient) |
| `verifier.ts` | T12, T14, T19, T20 (wrong owner, insufficient data, wrong feed, unauthorized verifier) |

The test suite demonstrates the complete authority transition loop:

```
Tier 1 ($5) → 5 successes → Tier 2 ($50) → 27/28 successes → Tier 3 ($500)
    → critical failure → Tier 1 ($5), bond slashed, epoch++
    → old capability rejected (stale epoch)
    → new bond locked, new $5 capability issued at epoch 2
```

## pactyra-verifier

The objective verifier reads Pyth `PriceUpdateV2` accounts and checks price freshness against a configurable threshold.

### Instructions

| Instruction | Description |
|---|---|
| `initialize_config` | Creates a `FreshnessConfig` PDA with feed ID, max age, and critical threshold |
| `verify_freshness` | Reads a Pyth `PriceUpdateV2` account, verifies owner, feed ID, and freshness |
| `verify_and_record` | Verifies freshness then CPIs into `pactyra_core::record_outcome` with appropriate result and severity |

### Pyth integration

The verifier reads real Pyth `PriceUpdateV2` accounts directly from Solana:

- **Owner check**: Verifies the account is owned by the Pyth Pull Oracle program (`pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`)
- **Feed ID check**: Reads the `feed_id` field from the account data and compares to the config
- **Freshness check**: Reads the `publish_time` field, computes age, compares to `max_age_seconds`

The `PriceUpdateV2` data is read at computed offsets that account for Borsh's variable-length `VerificationLevel` enum (1 byte for `Full`, 2 bytes for `Partial`).

### Severity classification

| Age | Result | Severity |
|---|---|---|
| ≤ `max_age_seconds` (30s) | Pass | None |
| > `max_age_seconds` but ≤ `critical_threshold` (60s) | Fail | Ordinary |
| > `critical_threshold` (60s) | Fail | Critical (triggers authority downgrade) |

## reference-treasury

The reference downstream program enforces PACTYRA capabilities before executing USDC transfers. This proves PACTYRA is an enforcement primitive, not just an analytics dashboard.

### Instructions

| Instruction | Description |
|---|---|
| `initialize_treasury` | Creates a treasury PDA with a vault token account |
| `deposit` | Deposits USDC into the vault; tracks user balance |
| `authorized_transfer` | CPIs into `pactyra_core::assert_capability` before transferring USDC |
| `set_paused` | Emergency pause toggle (treasury authority only) |

### CPI enforcement

The `authorized_transfer` instruction follows this flow:

```
1. Build ActionParams (action_type, target_program=treasury, target_account=recipient, amount, nonce)
2. CPI into pactyra_core::assert_capability
   → 12 security checks (agent active, capability active, epoch current, etc.)
   → If any check fails: transaction REVERTS, no USDC moved
3. If capability assertion PASSES:
   → Execute SPL token transfer from vault to recipient
   → Emit AuthorizedTransferExecuted event
```

This is the architectural security boundary: **the treasury cannot move funds without a valid PACTYRA capability.**

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full architecture diagram including:
- Protocol flow (verified performance → evidence-bound capability → assert_capability → execute/reject → outcome → authority change)
- Program relationships (CPI between pactyra-core, pactyra-verifier, and reference-treasury)
- Authority transition state machine (T1 → T2 → T3 → T1)
- Security boundary flow (12 checks in assert_capability)

## Build

### Prerequisites

- Rust 1.89+
- Solana CLI 4.x (Agave)
- Anchor 0.31+
- Node.js 18+

### Install and build

```bash
npm install
anchor build
```

### Run tests

```bash
anchor test --skip-build
```

## Architecture

```
Agent
  │
  ▼
PACTYRA
  │
  ├── Policy (immutable, defines requirements)
  ├── Capability (short-lived, exact-action bound)
  ├── Bond (economic stake, slashable)
  ├── ConsumedNonce (replay protection)
  ├── Receipt (verified outcome evidence)
  └── Authority Epoch (stale-credential invalidation)
  │
  ▼
assert_capability() — 12 security checks
  │
  ├── PASS → downstream program executes
  └── REJECT → transaction reverts
  │
  ▼
record_outcome() — verifier submits receipt
  │
  ├── PASS + thresholds met → authority upgrade
  └── CRITICAL FAIL → bond slash + downgrade + epoch++
```

## Security model

- **Exact-action binding**: Every capability commits to agent, action type, target program, target account, amount limit, expiry, and authority epoch.
- **Authority epochs**: Incrementing the epoch silently invalidates all outstanding capabilities for that agent.
- **Short-lived capabilities**: High-risk capabilities have configurable TTL (default 30 minutes), bounded target scope, and single-use nonces.
- **Replay protection**: Each `assert_capability` call creates a `ConsumedNonce` PDA, preventing the same action nonce from being used twice.
- **Bond requirement**: Capabilities issued under policies with a minimum bond are rejected if the agent's bond is insufficient.
- **Verifier-only outcomes**: Only registered verifier operators can submit performance receipts. Agents cannot award themselves success.
- **Tier-based limits**: Capability amount limits are bounded by the agent's current authority tier ($5 / $50 / $500).

## License

MIT
