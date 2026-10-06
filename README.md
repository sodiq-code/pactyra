# PACTYRA

[![CI](https://github.com/sodiq-code/pactyra/actions/workflows/ci.yml/badge.svg)](https://github.com/sodiq-code/pactyra/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF.svg?logo=solana&logoColor=white)](https://solana.com)
[![Pyth](https://img.shields.io/badge/Pyth-Network-00D2FF.svg)](https://pyth.network)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Live-000000.svg?logo=vercel&logoColor=white)](https://pactyra-ui.vercel.app)
[![Anchor](https://img.shields.io/badge/Anchor-1.2.0-2D2D2D.svg)](https://www.anchor-lang.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.89-CE422B.svg?logo=rust&logoColor=white)](https://www.rust-lang.org)

**Evidence-bound economic authority for autonomous agents.**

AI agents already have keys. PACTYRA makes them earn the right to use them.

**Live Demo:** [https://pactyra-ui.vercel.app](https://pactyra-ui.vercel.app) · **GitHub:** [https://github.com/sodiq-code/pactyra](https://github.com/sodiq-code/pactyra)

## Overview

PACTYRA is a protocol that converts verified execution history into machine-enforceable economic authority. It sits between autonomous agents and the economic programs they want to control — ensuring that authority is earned through verifiable outcomes, exercised within deterministic limits, and automatically revoked when verified performance fails.

### Core mechanic

```
$5 → $50 → $500 → $5
```

An agent starts at Tier 1 ($5 authority), earns Tier 2 ($50) after 5 verified successes, earns Tier 3 ($500) after 20+ successes at ≥95% success rate with a 5 USDC bond, and on a critical verified failure its bond is slashed, authority collapses back to $5, the epoch increments, and all outstanding capabilities become stale.

## Programs

All four programs are deployed to Solana devnet and verified executable.

| Program | Program ID | Instructions | Size |
|---|---|---|---|
| `pactyra-core` | `EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC` | 21 | 582 KB |
| `pactyra-verifier` | `5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN` | 3 | 299 KB |
| `reference-treasury` | `6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9` | 4 | 378 KB |
| `threshold-multisig` | `FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc` | 7 | 221 KB |

### Devnet configuration

```
RPC: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
Wallet: A55wG1G5nLVxn9Ns91ogrqZ6cHVi2yPd7WRi8GCyc3PE
USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (6 decimals)
Pyth Pull Oracle: pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT
Multisig PDA: 7vPjrrEEeszXDNiigpczbzNH376ak5EDfsxvT4UGSpkv (3-of-5 threshold)
```

### Devnet transaction evidence

| Instruction | Transaction |
|---|---|
| Initialize protocol | [`XajnkaaFzz...GQv`](https://solana.fm/tx/XajnkaaFzzLgaCSo6jh2RV2sBgs2Ge4uESVbTG7gdZKTkbaQePEs1yWYjyEuVVdbFndzVJmp3swtrEMsmVX2GQv?cluster=devnet) |
| Register verifier | [`5LUx5i9FKh...aWo`](https://solana.fm/tx/5LUx5i9FKhoZGDtxV7tHbfStmzjpifejDjGLBYM6o7zQi89sjQYz5xbVVXWpMbc1TgYYswMrKAeuqEMBC6gZHaWo?cluster=devnet) |
| Register agent | [`c6kQt5E2oR...LFW`](https://solana.fm/tx/c6kQt5E2oR96SNebNp5KrREJp4wqMQjCjHCMnnJmZfZQa5K6HfnvNTisxCFo4RaeRspGCCBk3GLgwCA5qkzrLFW?cluster=devnet) |
| Create policy | [`3dZrGaxyXh...5JM`](https://solana.fm/tx/3dZrGaxyXhz43fdjArfwU4cLGUNQYeqTqxuZ1ya2r9qsJaXc5BCCpKVCwQqyWrmUVYJgSp6YRLcZ5yrgsTDp55JM?cluster=devnet) |
| Lock bond | [`5MqTqxj3ac...7GkE`](https://solana.fm/tx/5MqTqxj3aczMkcJh7aKsm5zNjrGxmhMM7vEVGacuBHG3PXKMBrTbhbhh5cnk9RKH6yzja21wuE5hnCGVekhY7GkE?cluster=devnet) |
| Create multisig | [`2DirBGA2WG...Myo2`](https://solana.fm/tx/2DirBGA2WGtNXPQxu32wxzbF6C679Q2zeg5srBLZMadSdSAZHL5wH2veQNNTvLYM6MUQ9KaafuvqzgiEu79sMyo2?cluster=devnet) |
| Transfer authority to multisig | [`4tTr8y31WH...uXNQK`](https://solana.fm/tx/4tTr8y31WHfrXRhamTZ7q4Fiq3qLQfyPwJXdGNqP3TtNvVq6pfsM6KGwFrFzbqzkuBBeyKL9MimrDoVgqB8uXNQK?cluster=devnet) |
| Upgrade pactyra-core (Execution PDA) | [`2GcKadnGSn...k96D`](https://solana.fm/tx/2GcKadnGSnAUh1hGq9VPdeJaDKraLhaHnizvMKQWeCk46X3ewhp9YsThx4WZLes6fx76x3PqXa7HozLZoqX5k96D?cluster=devnet) |
| Upgrade pactyra-verifier | [`29KVUGLhN8...NcoEW`](https://solana.fm/tx/29KVUGLhN8s8QdjPhVsw87o1id2XHgU7Ad8wSHDX3WAKCjEmzgfgXDPgB9VGXJjUhb572Vpx9xEpoXStf5wNcoEW?cluster=devnet) |
| Upgrade reference-treasury | [`t9GA9JJdgA...PQT`](https://solana.fm/tx/t9GA9JJdgAL2yTx8csXNfQh3p28sWVVRcAY2TtsrxhTxZ25Jz4aoVnvwS29rSUeyWwGeaUtYCZ1gHPUtsBFcPQT?cluster=devnet) |

## pactyra-core

### Instructions (21)

#### Core protocol (10)

| Instruction | Description |
|---|---|
| `initialize_protocol` | Creates the VerifierRegistry PDA with the protocol authority |
| `register_agent` | Registers a new agent with the signer as authority root (Tier 1 / Probation) |
| `register_verifier` | Registers a verifier operator in the VerifierRegistry (protocol authority only) |
| `create_policy` | Creates an immutable policy defining capability requirements |
| `lock_bond` | Locks a bond by transferring real USDC to a PDA-owned vault (re-lockable after slash) |
| `request_capability` | Issues an evidence-bound capability with TTL, amount limit, target scope, and authority epoch binding |
| `assert_capability` | The core enforcement instruction — validates 14 security checks and creates an Execution PDA |
| `mark_executed` | Called by the target program via CPI to prove an action was performed (Asserted → Executed) |
| `record_outcome` | Records a verified outcome — requires Execution PDA in Executed status, triggers authority transitions |
| `revoke_capability` | Revokes a capability (agent authority root only) |

#### Governance layer (11)

| Instruction | Description |
|---|---|
| `delegate_authority` | Grant a session key with bounded scope (max amount, expiry) |
| `revoke_delegate` | Revoke a session key by setting expiry to now |
| `freeze_agent` | Set agent status to Frozen — blocks all capability assertions |
| `unfreeze_agent` | Restore agent to Active status |
| `supersede_policy` | Mark old policy as Superseded and point to new policy |
| `deprecate_verifier` | Mark a verifier as inactive in the VerifierRegistry |
| `replace_protocol_authority` | Transfer VerifierRegistry authority to a new key |
| `propose_operation` | Create a timelocked operation with 24h delay |
| `execute_operation` | Execute after timelock expires |
| `cancel_operation` | Cancel a proposed operation (proposer only) |
| `close_receipt` | Close an old receipt account and reclaim rent |

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

### assert_capability security checks (13)

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
13. Delegate scope (if a delegate signs: verify delegate pubkey, scope expiry, per-action amount limit)

Replay protection is enforced via a `ConsumedNonce` PDA that is created on each successful assertion, making the same (agent, nonce) pair unusable twice.

### Account types (9)

`Agent`, `Policy`, `Capability`, `Bond`, `Receipt`, `VerifierRegistry`, `VerifierEntry`, `ConsumedNonce`, `DelegateScope`, `TimelockedOperation`

### Error codes (33)

All error codes cover security check failures, governance operations, and evidence verification.

### Events (23)

All state changes emit onchain events for independent verification: `ProtocolInitialized`, `AgentRegistered`, `PolicyCreated`, `BondLocked`, `CapabilityIssued`, `CapabilityAsserted`, `VerifierRegistered`, `OutcomeRecorded`, `AuthorityUpgraded`, `AuthorityDowngraded`, `BondSlashed`, `CapabilityRevoked`, `DelegateGranted`, `DelegateRevoked`, `AgentFrozen`, `AgentUnfrozen`, `PolicySuperseded`, `VerifierDeprecated`, `ProtocolAuthorityReplaced`, `OperationProposed`, `OperationExecuted`, `OperationCancelled`, `ReceiptClosed`.

## threshold-multisig

A 3-of-5 threshold multisig program backing the protocol authority. Since Squads is not deployed on Solana devnet, this custom program provides the same security property: multiple key holders must approve before trust-root operations execute.

### Instructions (7)

| Instruction | Description |
|---|---|
| `create_multisig` | Initialize with members and threshold |
| `propose` | Create a proposal (proposer auto-approves) |
| `approve` | Member approves a proposal |
| `execute_proposal` | Execute after threshold reached (invoke_signed with multisig PDA) |
| `cancel_proposal` | Cancel a pending proposal |
| `add_member` | Add a new member (config authority only) |
| `remove_member` | Remove a member (config authority only) |

### Devnet multisig state

```
Multisig PDA: 7vPjrrEEeszXDNiigpczbzNH376ak5EDfsxvT4UGSpkv
Members: 5
Threshold: 3
VerifierRegistry authority: transferred to multisig PDA ✓
```

All trust-root operations (`register_verifier`, `deprecate_verifier`, `replace_protocol_authority`) now require multisig proposal + 3-of-5 approval.

## pactyra-verifier

The objective verifier reads Pyth `PriceUpdateV2` accounts and checks price freshness against a configurable threshold.

### Instructions (3)

| Instruction | Description |
|---|---|
| `initialize_config` | Creates a `FreshnessConfig` PDA with feed ID, max age, and critical threshold |
| `verify_freshness` | Reads a Pyth `PriceUpdateV2` account, verifies owner, feed ID, and freshness |
| `verify_and_record` | Verifies freshness then CPIs into `pactyra_core::record_outcome` with appropriate result and severity |

### Pyth integration

- **Owner check**: Verifies the account is owned by the Pyth Pull Oracle program (`pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`)
- **Feed ID check**: Reads the `feed_id` field from the account data and compares to the config
- **Freshness check**: Reads the `publish_time` field, computes age, compares to `max_age_seconds`
- **Evidence hash**: Computes `keccak256` of the Pyth account data and passes it to `record_outcome`

### Severity classification

| Age | Result | Severity |
|---|---|---|
| ≤ `max_age_seconds` (30s) | Pass | None |
| > `max_age_seconds` but ≤ `critical_threshold` (60s) | Fail | Ordinary |
| > `critical_threshold` (60s) | Fail | Critical (triggers authority downgrade) |

## reference-treasury

The reference downstream program enforces PACTYRA capabilities before executing USDC transfers.

### Instructions (4)

| Instruction | Description |
|---|---|
| `initialize_treasury` | Creates a treasury PDA with a vault token account |
| `deposit` | Deposits USDC into the vault; tracks user balance |
| `authorized_transfer` | CPIs into `pactyra_core::assert_capability` before transferring USDC |
| `set_paused` | Emergency pause toggle (treasury authority only) |

### CPI enforcement

The `authorized_transfer` instruction calls `assert_capability` **before** executing the token transfer. If any security check fails, the transaction reverts and no USDC is moved. This is the architectural security boundary: **the treasury cannot move funds without a valid PACTYRA capability.**

## Timelock

Trust-root operations (`register_verifier`, `deprecate_verifier`, `replace_protocol_authority`) are gated by a 24-hour timelock:

1. `propose_operation` — creates a `TimelockedOperation` with `execute_after = now + 86400`
2. Wait 24 hours — any observer can detect and respond
3. `execute_operation` — executes after delay expires
4. `cancel_operation` — proposer can cancel before execution

## SDK

The TypeScript SDK provides a typed interface to all programs. Published to GitHub Packages as `@sodiq-code/pactyra-client@0.1.0`.

### Installation

```bash
# From GitHub Packages registry
echo "@sodiq-code:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm install @sodiq-code/pactyra-client

# Or from source (for development)
cd sdk && npm install
```

### Usage

```typescript
import { PactyraClient } from '@pactyra/client';

const client = await PactyraClient.connect(wallet, connection);

await client.registerAgent(agentId);
await client.lockBond(agentId, 5_000_000);
await client.assertCapability(agentId, action);
await client.recordOutcome(agentId, actionId, capabilityId, 'pass', 'none', evidenceHash);
```

### SDK tests (21 passing)

## Web UI

Deployed to Vercel at [https://pactyra-ui.vercel.app](https://pactyra-ui.vercel.app). Source in [`ui/`](ui/).

### Features

- Dark mode with system preference detection
- Interactive authority loop simulator
- Live devnet data fetching (agent state, program deployment status)
- Register Agent, Lock Bond, Record Outcome, Request Capability forms
- Transaction history panel
- Authority loop visualization chart
- Protocol health gauge
- Security check tooltips
- Copy-to-clipboard on all addresses

### API Routes (7)

| Route | Method | Description |
|---|---|---|
| `/api/agent?id=<hex>` | GET | Fetch live agent state from devnet |
| `/api/deployment` | GET | Check all 4 program deployment status |
| `/api/register-agent` | POST | Register a new agent on devnet |
| `/api/lock-bond` | POST | Lock a bond for an agent |
| `/api/record-outcome` | POST | Record a verified outcome |
| `/api/request-capability` | POST | Request a capability |
| `/api/transaction-history?id=<hex>` | GET | Fetch recent transactions for an agent |

## Demo orchestration

Scripts in `scripts/` produce the complete `$5 → $50 → $500 → $5` authority loop.

| Script | Purpose |
|---|---|
| `bootstrap.ts` | Initialize protocol, register verifier + agent, create policy, lock bond |
| `earn-tier2.ts` | 5 verified successes → Tier 1 → Tier 2 |
| `earn-tier3.ts` | 27/28 successes (96.4%) → Tier 2 → Tier 3 |
| `unauthorized-transfer.ts` | $400 rejected (AmountExceedsCapability) |
| `critical-failure.ts` | Bond slash + downgrade + epoch++ |
| `stale-capability.ts` | Old-epoch capability rejected (StaleEpoch) |
| `demo-runner.ts` | Master script chaining all steps |
| `devnet-verify.ts` | Devnet deployment verification |
| `setup-multisig.ts` | Create multisig and transfer protocol authority |
| `x402-demo.ts` | x402 V2 real integration demo |

## x402 V2 Integration

The SDK includes a real x402 V2 adapter that performs actual on-chain USDC transfers. No simulated signatures — every payment is a real Solana transaction verified on-chain.

### Flow

```
Agent → HTTP request to x402 resource
       ← 402 Payment Required + WWW-Authenticate: x402
Adapter → assert_capability(agent, action, amount)
         → 14 security checks
         → PASS: continue to payment
         → FAIL: reject, no payment made
Adapter → REAL SPL token transfer (USDC) via sendAndConfirmTransaction
       ← REAL transaction signature
Agent → HTTP request + X-PAYMENT: <real-signature>
Facilitator → Verify signature on-chain (check token balance changes)
       ← 200 OK + X-PAYMENT-RESPONSE + resource
```

### Live Proof

The x402 demo endpoint performs the complete flow with a real 0.01 USDC payment on devnet:

```
GET https://pactyra-ui.vercel.app/api/x402/demo
```

Verified transaction: [`4EBajkWPGnkPpRnBE4s1SUGS8Q38sdck9A68SL9Xdx2EwUKEFPwjNU2SLna4tfmcvuXaKKMJ53B9zws9LsJx6Q9d`](https://solana.fm/tx/4EBajkWPGnkPpRnBE4s1SUGS8Q38sdck9A68SL9Xdx2EwUKEFPwjNU2SLna4tfmcvuXaKKMJ53B9zws9LsJx6Q9d?cluster=devnet)

On-chain verification:
- Payer (A55wG1...): −10,000 base units (−0.01 USDC)
- Payee (4ZokQY...): +10,000 base units (+0.01 USDC)
- Mint: 4zMMC9srt5Ri... (USDC)
- Slot: 508241626

### Usage

```typescript
import { PactyraX402Adapter } from '@pactyra/client';

const adapter = new PactyraX402Adapter({
  pactyraClient: client,
  agentId,
  capabilityPda,
  rpcUrl: 'https://api.devnet.solana.com',
  usdcMint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  payerTokenAccount,
});

// Make a paid request — capability is checked before payment
const response = await adapter.fetch('https://service.example.com/api', {
  maxAmount: 5_000_000, // $5 USDC
  actionNonce: 1,
});
```

### Key insight

Without PACTYRA: any agent with a wallet can pay for any service.
With PACTYRA: the agent must earn the authority to pay through verified performance. A new agent starts at $5 and must prove itself before spending more.

## Test results

```
  32 formal tests passing (44s)
  21 SDK tests passing (84ms) — includes Execution PDA derivation and action_id computation
  7 demo runner tests passing (16s)
  ─────────────────────────────
  60 total tests
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for:
- Protocol flow diagram
- Program relationships (CPI between all 4 programs)
- Authority transition state machine (T1 → T2 → T3 → T1)
- Security boundary flow (14 checks in assert_capability)

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | Protocol flow, program relationships, authority state machine, security boundary |
| [GTM Strategy](docs/gtm-strategy.md) | Market analysis, business model, competitive positioning, 4-phase go-to-market |
| [Pitch Script](docs/pitch-script.md) | 2-3 minute pitch video script with timestamps and key points |
| [Demo Storyboard](docs/demo-storyboard.md) | ≤3 minute demo video storyboard with recording checklist |

## Security model

- **Exact-action binding**: Every capability commits to agent, action type, target program, target account, amount limit, expiry, and authority epoch. The `action_id` is a cryptographic hash (`keccak256`) of all action parameters, recorded in the Execution PDA.
- **Authority epochs**: Incrementing the epoch silently invalidates all outstanding capabilities.
- **Short-lived capabilities**: Configurable TTL (default 30 minutes), bounded target scope, single-use nonces.
- **Frequency limit enforcement**: Capabilities have a `frequency_limit` field that caps the maximum number of uses. Each `assert_capability` call increments `use_count`; when `use_count >= frequency_limit`, the capability is rejected with `FrequencyLimitExceeded`.
- **Replay protection**: `ConsumedNonce` PDA prevents nonce reuse.
- **Execution PDA**: Every `assert_capability` call initializes an `Execution` PDA that cryptographically binds the capability assertion to the actual on-chain action. The target program must call `mark_executed` via CPI (signing with its own program ID) to advance the Execution from `Asserted` → `Executed`. The `record_outcome` instruction requires the Execution to be in `Executed` status and verifies that the `action_id` matches — preventing the verifier from fabricating outcomes for actions that never happened. The deterministic `action_id` is `keccak256(agent_id || capability_id || action_type || target_program || target_account || amount || action_nonce)`.
- **Real USDC bond escrow**: The `lock_bond` instruction transfers real USDC from the agent's token account to a PDA-owned bond vault. On critical failure, the slashed USDC is transferred to a slash destination account. This is not accounting — real tokens move.
- **Verifier-only outcomes**: Only registered verifier operators can submit receipts. Evidence hash must be non-zero.
- **Tier-based limits**: $5 / $50 / $500 per capability based on agent tier.
- **Delegate scope**: Session keys have bounded amount and expiry, enforced in `assert_capability`.
- **Agent freeze**: Frozen agents cannot assert capabilities.
- **Timelock**: 24-hour delay on all trust-root operations.
- **Multisig**: 3-of-5 threshold for protocol authority operations.
- **Immutable policies**: Policies can only be created or superseded, never mutated.
- **Rent reclamation**: Old receipts from prior epochs can be closed.

### Execution PDA lifecycle

```
assert_capability                mark_executed (CPI)              record_outcome
      │                                │                               │
      ▼                                ▼                               ▼
┌──────────┐                   ┌──────────┐                   ┌──────────┐
│ Asserted │ ───────────────►  │ Executed │ ───────────────►  │ Recorded │
└──────────┘                   └──────────┘                   └──────────┘
  Created by                      Target program                  Verifier records
  assert_capability               signs via CPI                   outcome; action_id
                                  to prove action                 must match
                                  was performed

  Seeds: [b"execution", agent_id, action_nonce]
  action_id = keccak256(agent_id, capability_id, action_type, target_program,
                        target_account, amount, action_nonce)
```

The Execution PDA closes the trust gap between the verifier and the on-chain action. Without it, a compromised verifier operator could fabricate a PASS outcome for an action that was never executed. With it, the verifier can only record outcomes for actions that were:
1. Authorized via `assert_capability` (creates Execution PDA)
2. Actually performed by the target program (mark_executed via CPI)
3. Match the exact action parameters (action_id verification)

## Build

### Prerequisites

- Rust 1.89+
- Solana CLI 4.x (Agave)
- Anchor 1.2+
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

## License

MIT — see [LICENSE](LICENSE)

## Links

- **GitHub:** [https://github.com/sodiq-code/pactyra](https://github.com/sodiq-code/pactyra)
- **Live Demo:** [https://pactyra-ui.vercel.app](https://pactyra-ui.vercel.app)
- **SDK:** `npm install @sodiq-code/pactyra-client` (GitHub Packages)
- **Programs:** [pactyra-core](https://solana.fm/address/EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC?cluster=devnet) · [pactyra-verifier](https://solana.fm/address/5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN?cluster=devnet) · [reference-treasury](https://solana.fm/address/6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9?cluster=devnet) · [threshold-multisig](https://solana.fm/address/FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc?cluster=devnet)
