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

| Program | Description | Program ID |
|---|---|---|
| `pactyra-core` | Core protocol: Agent, Policy, Capability, Bond, Receipt, VerifierRegistry, ConsumedNonce | `EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC` |
| `pactyra-verifier` | Objective Pyth price freshness verifier | `5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN` |
| `reference-treasury` | Reference downstream program enforcing capabilities before USDC transfers | `6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9` |

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

## Test results

```
  pactyra-core authority transitions
    ✔ Initializes the protocol (409ms)
    ✔ Registers a verifier operator (432ms)
    ✔ Registers an agent at Tier 1 (Probation) (424ms)
    ✔ Creates a policy (424ms)
    ✔ Locks a 5 USDC bond (440ms)
    ✔ Rejects $50 capability request at Tier 1 — AmountExceedsTier (42ms)
    ✔ Accepts $5 capability request at Tier 1 (404ms)
    ✔ Records 5 successful outcomes — upgrades to Tier 2 (Proven) (2147ms)
    ✔ Accepts $50 capability request at Tier 2 (422ms)
    ✔ Rejects $500 capability request at Tier 2 — AmountExceedsTier (38ms)
    ✔ Records 22 more successes + 1 ordinary fail (27/28 = 96.4%) — upgrades to Tier 3 (Trusted) (9886ms)
    ✔ Accepts $500 capability request at Tier 3 (437ms)
    ✔ Records a critical failure — downgrades to Tier 1, slashes bond, increments epoch (428ms)
    ✔ Rejects old capability (stale epoch) — StaleEpoch
    ✔ Rejects $50 capability at Tier 1 after downgrade — AmountExceedsTier
    ✔ Re-locks bond after slash (393ms)
    ✔ Accepts $5 capability at Tier 1 after downgrade (428ms)
    ✔ Rejects outcome from unregistered verifier — UnauthorizedVerifier (459ms)
    ✔ Revokes a capability (396ms)
    ✔ Rejects assertion of revoked capability — CapabilityNotActive

  20 passing (19s)
```

The test suite demonstrates the complete authority transition loop:

```
Tier 1 ($5) → 5 successes → Tier 2 ($50) → 27/28 successes → Tier 3 ($500)
    → critical failure → Tier 1 ($5), bond slashed, epoch++
    → old capability rejected (stale epoch)
    → new bond locked, new $5 capability issued at epoch 2
```

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
