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
| `create_policy` | Creates an immutable policy defining capability requirements (min successes, success rate, bond, max amount) |
| `lock_bond` | Locks a bond for an agent, enabling capability issuance under policies that require a bond |
| `request_capability` | Issues an evidence-bound capability with TTL, amount limit, target scope, and authority epoch binding |
| `assert_capability` | The core enforcement instruction — validates all security conditions before authorizing an action |

### assert_capability security checks

The `assert_capability` instruction performs 12 security checks before authorizing an action:

1. **Agent active** — agent status must be `Active`
2. **Capability active** — capability status must be `Active`
3. **Capability belongs to agent** — `capability.agent_id == agent.agent_id`
4. **Authority epoch current** — `capability.authority_epoch == agent.current_epoch`
5. **Policy match** — capability's policy reference must match the provided policy account
6. **Policy active** — policy status must be `Active` (not superseded)
7. **Not expired** — `clock.timestamp < capability.expiry`
8. **Action type permitted** — `capability.capability_type == action.action_type`
9. **Target program match** — `capability.target_program == action.target_program`
10. **Target account in scope** — `capability.target_account == action.target_account`
11. **Amount within limit** — `action.amount <= capability.amount_limit`
12. **Bond satisfied** — `agent.bond_amount >= policy.min_bond_usdc`

Replay protection is enforced via a `ConsumedNonce` PDA that is created on each successful assertion, making the same (agent, nonce) pair unusable twice.

## Test results

```
  pactyra-core
    ✔ Initializes the protocol (431ms)
    ✔ Registers an agent (410ms)
    ✔ Creates a policy (434ms)
    ✔ Locks a bond of 5 USDC (451ms)
    ✔ Requests a capability with $5 limit (422ms)
    ✔ Asserts capability with $5 — PASSES (426ms)
    ✔ Rejects $6 — AmountExceedsCapability
    ✔ Rejects wrong action type — ActionTypeNotPermitted
    ✔ Rejects wrong target account — TargetNotInScope
    ✔ Rejects wrong target program — TargetProgramMismatch
    ✔ Rejects replay — nonce already consumed (61ms)

  11 passing (5s)
```

All tests run against a local Solana validator using Anchor's test framework.

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
  ├── Bond (economic stake)
  ├── ConsumedNonce (replay protection)
  └── Authority Epoch (stale-credential invalidation)
  │
  ▼
assert_capability()
  │
  ├── PASS → downstream program executes
  └── REJECT → transaction reverts
  │
  ▼
Objective Verifier (Pyth Freshness)
  │
  ├── PASS → authority may upgrade
  └── FAIL → bond slash + authority downgrade + epoch++
```

## Security model

- **Exact-action binding**: Every capability commits to agent, action type, target program, target account, amount limit, expiry, and authority epoch.
- **Authority epochs**: Incrementing the epoch silently invalidates all outstanding capabilities for that agent.
- **Short-lived capabilities**: High-risk capabilities have configurable TTL (default 30 minutes), bounded target scope, and single-use nonces.
- **Replay protection**: Each `assert_capability` call creates a `ConsumedNonce` PDA, preventing the same action nonce from being used twice.
- **Bond requirement**: Capabilities issued under policies with a minimum bond are rejected if the agent's bond is insufficient.

## License

MIT
