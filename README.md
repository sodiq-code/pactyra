# PACTYRA

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF.svg?logo=solana&logoColor=white)](https://solana.com)
[![Pyth](https://img.shields.io/badge/Pyth-Network-00D2FF.svg)](https://pyth.network)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Live-000000.svg?logo=vercel&logoColor=white)](https://pactyra-ui.vercel.app)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-2D2D2D.svg)](https://www.anchor-lang.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.89-CE422B.svg?logo=rust&logoColor=white)](https://www.rust-lang.org)

**PACTYRA turns verified outcomes into enforceable economic authority.**

AI agents already have keys. PACTYRA is the consequence layer that sits after objective verification — converting evidence of execution into authority an agent is allowed to exercise, and revoking that authority the moment verified performance fails.

**Live Demo:** [https://pactyra-ui.vercel.app](https://pactyra-ui.vercel.app) · **GitHub:** [https://github.com/sodiq-code/pactyra](https://github.com/sodiq-code/pactyra)
## Demo Videos

### Pitch Video

> "The agent didn't lose its key. It lost its authority."

[![PACTYRA Pitch Video](https://img.youtube.com/vi/N2GhBWl1TIw/0.jpg)](https://youtu.be/N2GhBWl1TIw)

### Demo Video

Full authority loop live on Solana devnet — `$5 → $50 → $500 → $5`.

[![PACTYRA Demo Video](https://img.youtube.com/vi/1m_YR4vTjho/0.jpg)](https://youtu.be/1m_YR4vTjho)

## Overview

A private key proves control. It does not prove earned authority. Spending limits set ceilings. Reputation systems describe history. None of them connect verified performance to enforceable economic power.

PACTYRA closes that gap. It is a protocol that turns verified outcomes into enforceable economic authority on Solana. It sits between autonomous agents and the economic programs they want to control — ensuring that authority is earned through verifiable outcomes, exercised within deterministic limits, and automatically revoked when verified performance fails.

### Core mechanic

```
$5 → $50 → $500 → $5
```

An agent starts at Tier 1 ($5 authority), earns Tier 2 ($50) after 5 verified successes, earns Tier 3 ($500) after 20+ successes at ≥95% success rate with a 5 USDC bond, and on a critical verified failure its bond is slashed, authority collapses back to $5, the epoch increments, and all outstanding capabilities become stale.

## Programs

All four programs are deployed to Solana devnet and verified executable.

| Program | Program ID | Deployed | Size |
|---|---|---|---|
| `pactyra-core` | `FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf` | ✅ Devnet | 582 KB |
| `pactyra-verifier` | `4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu` | ✅ Devnet | 299 KB |
| `reference-treasury` | `6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9` | ✅ Devnet | 288 KB |
| `threshold-multisig` | `FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc` | ✅ Devnet | 221 KB |

### Devnet configuration

```
RPC: set via SOLANA_RPC_URL (e.g. https://devnet.helius-rpc.com/?api-key=<your-key>)
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

## Program instructions

The four programs expose 35 instructions in total: 21 in `pactyra-core`, 7 in `threshold-multisig`, 3 in `pactyra-verifier`, and 4 in `reference-treasury`. The full instruction reference — including the authority tiers and transitions, the 14 `assert_capability` security checks, and the account, error, and event sets — lives in [`docs/instructions.md`](docs/instructions.md).

## Timelock

Trust-root operations (`register_verifier`, `deprecate_verifier`, `replace_protocol_authority`) are gated by a 24-hour timelock:

1. `propose_operation` — creates a `TimelockedOperation` with `execute_after = now + 86400`
2. Wait 24 hours — any observer can detect and respond
3. `execute_operation` — executes after delay expires
4. `cancel_operation` — proposer can cancel before execution

## SDK

The TypeScript SDK provides a typed interface to all programs. Published to GitHub Packages as `@pactyra/client@0.1.0`.

### Installation

```bash
# From GitHub Packages registry
echo "@sodiq-code:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm install @pactyra/client

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

### SDK tests (19 passing)

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
- Authority Proof screen — compressed lifecycle view (tier, authority, epoch, bond, verified outcomes, latest evidence, registered verifiers, 3 proof transactions with explorer links)

### API routes

The web UI exposes 15 HTTP routes covering agent state, capability lifecycle, verifier demos, proof trails, and the business model. The full route catalog lives in [`docs/api-routes.md`](docs/api-routes.md).
## Demo orchestration

The full lifecycle is told as an 8-scene narrative (`$5 → $50 → $500 → $5`), each scene a real on-chain action. The test-harness scripts in `scripts/` exercise the state machine directly; the judge-facing proof path is the live x402 demo. The scene-by-scene table, the script catalog, and the proof-path distinction live in [`docs/demo-narrative.md`](docs/demo-narrative.md).
## x402 Adapter

The SDK includes an x402 adapter that gates agentic HTTP payments with PACTYRA capabilities. This proves PACTYRA can control how much an autonomous agent is allowed to pay for services.

### Flow

```
Agent → HTTP request to x402 service
       ← 402 Payment Required
Adapter → assert_capability(agent, action, amount)
         → 14 security checks
         → PASS: continue to payment
         → FAIL: reject, no payment made
Adapter → SPL token transfer (USDC)
       ← Transaction signature
Agent → HTTP request + X-PAYMENT header
       ← 200 OK + resource
```

### Usage

```typescript
import { PactyraX402Adapter } from '@pactyra/client';

const adapter = new PactyraX402Adapter({
  pactyraClient: client,
  agentId,
  capabilityPda,
  rpcUrl: 'https://devnet.helius-rpc.com/?api-key=...',
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

## Verifier-Agnostic Architecture

PACTYRA does not prescribe one definition of success. Any verifier that produces a deterministic outcome (pass/fail) with a cryptographic evidence hash can be registered in the VerifierRegistry and feed verified outcomes into `pactyra_core::record_outcome`. Adding a new verifier does not require changing core.

```text
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Pyth        │  │ Service     │  │ Future...   │
│ Verifier    │  │ Verifier    │  │ (TEE/Sig/ZK)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              VERIFIED OUTCOME (pass/fail + evidence_hash)
                        │
                        ▼
              pactyra_core::record_outcome
                        │
                        ▼
              AUTHORITY CHANGE (upgrade / downgrade / slash)
```

### The single entry point

Every verifier feeds into one instruction. `record_outcome` is the only entry point authority transitions respond to:

| Parameter | Type | Description |
|---|---|---|
| `agent` | Agent PDA | Agent whose authority is affected |
| `result` | `enum { Pass, Fail }` | Outcome of the verification |
| `severity` | `enum { None, Ordinary, Critical }` | Failure severity |
| `evidence_hash` | `[u8; 32]` | keccak256 of the evidence |

**Authority effects:**

| Outcome | Effect |
|---|---|
| `Pass` | Increments `success_count` — may trigger authority upgrade (T1→T2 after 5✓, T2→T3 after 20+ at 95%) |
| `Fail` (Ordinary) | Increments `failure_count` — no tier change |
| `Fail` (Critical) | Slashes bond, downgrades to Tier 1, increments authority epoch (invalidates all outstanding capabilities) |

### Live verifiers (deployed on devnet)

#### Verifier A — Pyth (Price Freshness)

Checks whether a Pyth price feed is fresh or stale. Deployed as `pactyra-verifier` on devnet.

```text
Pyth PriceUpdateV2
  ↓
Freshness check (≤30s = pass, 30-60s = ordinary fail, >60s = critical)
  ↓
record_outcome() via CPI
  ↓
Authority transition
```

- **Evidence source:** Pyth Pull Oracle account data
- **Evidence hash:** `keccak256(pyth_account_data)`
- **Program:** [`4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu`](https://solana.fm/address/4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu?cluster=devnet)

#### Verifier B — Service Outcome (Service Delivery)

Checks whether an x402 service was actually delivered after payment. Live at `/api/verifier/service`.

This is an off-chain evidence check. It verifies the payment transaction and the service response, computes an evidence hash, and returns the result as JSON. It does not itself invoke `pactyra_core::record_outcome`; an operator submits the recorded outcome separately using the evidence hash.

```text
Agent pays for service via x402
  ↓
Service returns 200 (delivered) or non-200 (failed)
  ↓
Service Outcome Verifier checks delivery + payment on-chain
  ↓
Evidence hash computed
  ↓
Returns JSON { result, severity, evidence_hash }
  ↓
Operator submits record_outcome separately with the evidence hash
  ↓
Authority transition
```

- **Evidence source:** HTTP response status + payment tx signature
- **Evidence hash:** `keccak256(service_status, payment_sig, timestamp)`
- **Endpoint:** [`/api/verifier/service`](https://pactyra-ui.vercel.app/api/verifier/service)

### Planned verifiers (specification stable, not yet deployed)

The verifier interface is intentionally minimal. Each planned verifier below implements the same `record_outcome` contract with a different evidence source.

| Verifier | Evidence source | Use case |
|---|---|---|
| **TEE Attestation** | Remote attestation report (SGX/TDX quote) | Prove an agent executed within a confidential enclave |
| **Multi-Sig Committee** | Aggregated Ed25519 signatures from m-of-n observers | Off-chain committee attestation for actions that cannot run on-chain |
| **ZK Proof** | Zero-knowledge proof (Groth16/Plonk) | Prove correct execution without revealing inputs |
| **Oracle Quorum** | Multiple oracle feed observations | Cross-check Pyth/Switchboard/Chainlink feeds for consensus |

Each planned verifier maps its evidence onto the same severity matrix (`none` / `ordinary` / `critical`) and feeds the same `record_outcome` instruction. No core change is required to add a verifier — only a new program (or off-chain verifier) plus a `register_verifier` call.

### Run the verifier-agnostic demo

```text
https://pactyra-ui.vercel.app/api/verifier/demo
```

This endpoint chains: `assert_capability()` → real USDC payment → service delivery → Service Outcome Verifier → evidence hash. The Pyth verifier feeds `record_outcome` via on-chain CPI; the Service Outcome Verifier produces an off-chain evidence hash that an operator submits separately.

### Verifier catalog API

The full verifier catalog — live + planned verifiers, the shared `record_outcome` contract, and the on-chain VerifierRegistry state — is exposed as a machine-readable API:

```text
GET https://pactyra-ui.vercel.app/api/verifiers
```

Returns: thesis, architecture flow diagram, live verifiers (with severity matrices), planned verifiers, the single entry-point contract, and the on-chain VerifierRegistry contents.

## Test results

```
  38 integration tests defined (tests/)        require a localnet cluster
  21 SDK tests passing in CI                     (sdk/tests/sdk.test.ts)
   7 demo-runner steps defined                   (scripts/demo-runner.ts)
  ─────────────────────────────
  66 total test cases defined
  21 verified passing in CI
```

## Continuous Integration

Every push to `main` and every pull request triggers the workflow in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). It runs three jobs:

| Job | Command | Purpose |
|---|---|---|
| Build Solana Programs | `cargo build-sbf -- --all` | Compile every program and upload the `.so` binaries as artifacts. |
| Lint | `cargo fmt --all -- --check` then `cargo clippy --all-targets -- --deny warnings` | Reject unformatted code and any clippy warning. |
| Test TypeScript SDK | `npx ts-mocha -p ./tsconfig.json -t 1000000 sdk/tests/**/*.ts` | Run the SDK test suite against the built programs. |

### Verification

The workflow is green on `main`. Recent commits verified by GitHub Actions:

| Commit | Subject | Build | Lint | Test SDK |
|---|---|:---:|:---:|:---:|
| `3763b15` | Ignore TypeScript incremental build info cache | pass | pass | pass |
| `35688cc` | Apply rustfmt to pactyra-core to satisfy CI lint check | pass | pass | pass |

The `35688cc` commit repaired the Lint job. It had been failing on every push
since `262a07e` because a `require!` macro call in
`programs/pactyra-core/src/lib.rs` was formatted across multiple lines while
`rustfmt` collapses it onto a single line. Both lint checks now pass locally
with the toolchain pinned by [`rust-toolchain.toml`](rust-toolchain.toml)
(Rust 1.89.0, `rustfmt` and `clippy` components, minimal profile):

```bash
cargo fmt --all -- --check                      # exits 0
cargo clippy --all-targets -- --deny warnings   # exits 0
```

### Workspace hygiene

The repository ignores machine-local build caches via `.gitignore`:
`target/`, `node_modules/`, `.next/`, `*.so` (except committed program
binaries under `target/deploy/`), and `*.tsbuildinfo` (the TypeScript
incremental compilation cache).

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

## Business Model

### Who buys this

The first customers are not individual AI users. They are **protocols that need to safely let autonomous software control economic value**.

**Target customers:**
- autonomous agent platforms (agent orchestration frameworks that need bounded economic authority)
- AI treasury systems (autonomous treasury managers controlling protocol funds)
- agent payment infrastructure (x402 service networks, payment rails for agents)
- DeFi execution systems (autonomous trading/liquidity systems with controlled financial permissions)
- enterprise AI systems (organizations deploying autonomous software with financial guardrails)

### How it monetizes

The protocol is open-source infrastructure (free forever). The business is the operated layer around it.

#### Tier 1 — Open-Source Core (free, forever, MIT-licensed)

| Included | Detail |
|---|---|
| All 4 Solana programs | pactyra-core, pactyra-verifier, reference-treasury, threshold-multisig |
| TypeScript SDK | Client, IDLs, x402 adapter |
| Verifier interface specification | The contract any verifier must implement |
| Self-hosted VerifierRegistry | Run your own registry on Solana |
| Reference treasury integration | Pattern for any downstream program |
| Community GitHub support | Issues + discussions |

**Limits:** unlimited agents, unlimited self-hosted verifiers, unlimited API calls.

#### Tier 2 — Hosted Infrastructure ($99–$999/month per organization)

| Included | Detail |
|---|---|
| Everything in Open-Source Core | — |
| Hosted VerifierRegistry | Operated by PACTYRA, no self-hosting |
| Hosted Pyth freshness verifier | Operated verifier instances |
| Hosted Service Outcome verifier | Operated x402 delivery verifier |
| Monitoring dashboards | Agent authority, success rates, slashes |
| Policy management UI | Create, version, supersede policies |
| Authority analytics | Per-agent timelines, risk metrics |
| Email + Slack alerts | Critical failure notifications |
| Receipt indexing | Historical authority queries |

**Limits:** up to 1,000 agents, up to 10 hosted verifiers, 1M API calls/month, email support with 48h response.

#### Tier 3 — Enterprise (custom, annual contract)

| Included | Detail |
|---|---|
| Everything in Hosted Infrastructure | — |
| Custom verifier integrations | TEE Attestation, ZK Proof, Multi-Sig Committee |
| Custom policy / governance modules | Domain-specific policy engines |
| Compliance evidence export | SOC2-style audit trail |
| Dedicated verifier infrastructure | Single-tenant deployment |
| Multi-agent fleet governance | Organization-wide controls |
| On-premise / VPC deployment | For regulated environments |
| SLA backing | 99.9% uptime, 1h critical response |
| Named solutions engineer | Dedicated support |
| Security review + audit support | Pre-deployment review |

**Limits:** unlimited agents, unlimited dedicated verifiers, unlimited API calls, 24/7 SLA-backed support.

### Revenue streams

| Stream | Model | Role |
|---|---|---|
| SaaS subscriptions | Monthly / annual recurring | Primary (Hosted + Enterprise tiers) |
| Verifier operation fees | Usage-based | Secondary (per-verifier operational fee) |
| Enterprise integrations | Project + retainer | Secondary (one-time + ongoing support) |
| Compliance reporting | Per-report or annual | Secondary (audit-trail export) |

### Open-source commitment

The following are MIT-licensed and guaranteed free forever:

- `pactyra-core` program
- `pactyra-verifier` program
- `reference-treasury` program
- `threshold-multisig` program
- TypeScript SDK + x402 adapter
- VerifierRegistry interface specification

The enforcement primitive is open-source forever. Paid tiers only add operated infrastructure and integrations around it. No token. No DAO. Pure infrastructure.

### Business model API

The full tier matrix, revenue streams, and target customers are exposed as a machine-readable API:

```text
GET https://pactyra-ui.vercel.app/api/business-model
```

Returns: thesis, three tiers with explicit feature lists + pricing, revenue streams, target customers, and the open-source commitment.

### The long-term opportunity

The long-term opportunity is not simply safer payments. It is a **standardized authority layer for autonomous economic actors** — the primitive that turns verified outcomes into enforceable economic authority, records why that authority was earned, and automatically revokes it the moment verified performance fails.

## Distribution

### Entry point

SDK + x402 adapter. Developers integrate PACTYRA into their agent infrastructure via the TypeScript SDK. The x402 adapter provides an immediate use case: gating HTTP payments with earned authority.

### First integrations

- payment services (x402-compatible endpoints that require PACTYRA authority before accepting payment)
- autonomous treasuries (protocol treasuries that use PACTYRA to bound agent spending)
- agent frameworks (orchestration platforms that need deterministic economic guardrails)
- DeFi execution systems (autonomous trading systems with bounded capital control)

### Expansion

```text
one agent
   ↓
one application
   ↓
multiple applications
   ↓
shared authority infrastructure
```

Because the enforcement primitive lives at the program boundary, downstream applications can adopt PACTYRA without rebuilding their entire wallet or payment stack.

## Security model

- **Exact-action binding**: Every capability commits to agent, action type, target program, target account, amount limit, expiry, and authority epoch.
- **Authority epochs**: Incrementing the epoch silently invalidates all outstanding capabilities.
- **Short-lived capabilities**: Configurable TTL (default 30 minutes), bounded target scope, single-use nonces.
- **Replay protection**: `ConsumedNonce` PDA prevents nonce reuse.
- **Bond requirement**: Capabilities rejected if agent's bond is insufficient.
- **Verifier-only outcomes**: Only registered verifier operators can submit receipts. Evidence hash must be non-zero.
- **Tier-based limits**: $5 / $50 / $500 per capability based on agent tier.
- **Delegate scope**: Session keys have bounded amount and expiry, enforced in `assert_capability`.
- **Agent freeze**: Frozen agents cannot assert capabilities.
- **Timelock**: 24-hour delay on all trust-root operations.
- **Multisig**: 3-of-5 threshold for protocol authority operations.
- **Immutable policies**: Policies can only be created or superseded, never mutated.
- **Rent reclamation**: Old receipts from prior epochs can be closed.

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
- **SDK:** `npm install @pactyra/client` (GitHub Packages)
- **Programs:** [pactyra-core](https://solana.fm/address/FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf?cluster=devnet) · [pactyra-verifier](https://solana.fm/address/4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu?cluster=devnet) · [reference-treasury](https://solana.fm/address/6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9?cluster=devnet) · [threshold-multisig](https://solana.fm/address/FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc?cluster=devnet)
