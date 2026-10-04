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
| `pactyra-core` | Core protocol: Agent, Policy, Capability, Bond, Receipt, VerifierRegistry | `EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC` |
| `pactyra-verifier` | Objective Pyth price freshness verifier | `5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN` |
| `reference-treasury` | Reference downstream program enforcing capabilities before USDC transfers | `6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9` |

## Build

### Prerequisites

- Rust 1.99+
- Solana CLI 4.x (Agave)
- Anchor 0.31.0+
- Node.js 18+

### Install

```bash
# Install dependencies
npm install

# Build all programs
anchor build
```

### Test

```bash
# Run tests against local validator
anchor test
```

## Architecture

```
Agent
  │
  ▼
PACTYRA
  │
  ├── Policy
  ├── Evidence
  ├── Capability
  ├── Bond
  └── Authority Epoch
  │
  ▼
assert_capability()
  │
  ▼
Downstream Program (Reference Treasury)
  │
  ├── Execute (on PASS)
  └── Reject (on FAIL)
  │
  ▼
Objective Verifier (Pyth Freshness)
  │
  ├── PASS
  └── FAIL → Bond Slash + Authority Downgrade + Epoch++
```

## Security model

- **Exact-action binding**: Every capability commits to agent, action type, target, amount, nonce, expiry, and authority epoch.
- **Authority epochs**: Incrementing the epoch silently invalidates all outstanding capabilities.
- **Short-lived capabilities**: High-risk capabilities have 30-minute TTL, bounded target scope, and single-use nonces.
- **Objective verification**: Only registered verifiers can submit performance receipts. The MVP uses a Pyth freshness verifier that reads `PriceUpdateV2` accounts directly.
- **Bond consequence**: Critical failures trigger bond slash + authority downgrade + epoch increment in one deterministic transition.

## License

MIT
