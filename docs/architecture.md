# PACTYRA Architecture

```
                    VERIFIED PERFORMANCE
                            │
                            ▼
                      ┌───────────┐
                      │  POLICY   │
                      └─────┬─────┘
                            │
                            ▼
                 EVIDENCE-BOUND CAPABILITY
                            │
                            ▼
                    EXACT ACTION REQUEST
                            │
                            ▼
                   assert_capability()
                            │
                      ┌─────┴─────┐
                      │           │
                    ALLOW        REJECT
                      │
                      ▼
                  EXECUTION
                      │
                      ▼
              OBJECTIVE VERIFIER
                      │
                  ┌───┴───┐
                  │       │
                 PASS    FAIL
                  │       │
                  ▼       ▼
             MORE AUTHORITY
                          │
                          ▼
                     BOND SLASH
                          │
                          ▼
                   AUTHORITY DOWN
                          │
                          ▼
                       EPOCH++
                          │
                          ▼
                 OLD CAPABILITIES
                     INVALID
```

## Program relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    PACTYRA CORE PROGRAM                      │
│              EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC   │
│                                                             │
│  Agent │ Policy │ Capability │ Bond │ Receipt │ VerifierRegistry
│  ConsumedNonce                                              │
│                                                             │
│  Instructions:                                              │
│  - initialize_protocol                                      │
│  - register_agent                                           │
│  - register_verifier                                        │
│  - create_policy                                            │
│  - lock_bond                                                │
│  - request_capability                                       │
│  - assert_capability (12 security checks)                   │
│  - record_outcome (authority transitions)                   │
│  - revoke_capability                                        │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          │ CPI (assert_capability)            │ CPI (record_outcome)
          ▼                                    ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  REFERENCE TREASURY       │    │  PACTYRA VERIFIER        │
│  6gAZR4omxMUWy5Fb6kCtd   │    │  5dK7xXDUSHDcP8qFxrLLFo  │
│  maWASFFXr9WRCoWUcAz7UA9  │    │  4Nm2Xzn7rSKgDMmrFFLZsN  │
│                          │    │                          │
│  Instructions:           │    │  Instructions:           │
│  - initialize_treasury   │    │  - initialize_config     │
│  - deposit               │    │  - verify_freshness      │
│  - authorized_transfer   │    │  - verify_and_record     │
│    (CPI → assert_cap)   │    │    (CPI → record_outcome)│
│  - set_paused            │    │                          │
└──────────────────────────┘    └──────────────────────────┘
          │                                    │
          ▼                                    ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  devnet USDC             │    │  Pyth PriceUpdateV2      │
│  4zMMC9srt5Ri5X14GAgXh  │    │  (Pyth Pull Oracle)      │
│  aHii3GnPAEERYPJgZJDncDU │    │  pythWSnswVUd12oZpeFP8   │
│                          │    │  e9CVaEqJg25g1Vtc2biRsT  │
│  Vault PDA holds USDC    │    │                          │
│  for authorized transfers│    │  Verifier reads:        │
│                          │    │  - Account owner (Pyth) │
│                          │    │  - Feed ID              │
│                          │    │  - publish_time freshness│
└──────────────────────────┘    └──────────────────────────┘
```

## Authority transition state machine

```
TIER 1 (Probation)
  max: $5
  trade: OFF
        │
        │ 5 verified successes
        ▼
TIER 2 (Proven)
  max: $50
  trade: $25
        │
        │ 20+ successes, 95% rate, 0 critical, bond
        ▼
TIER 3 (Trusted)
  max: $500
  trade: $250
        │
        │ critical verified failure
        ▼
TIER 1 (Probation)
  max: $5
  trade: OFF
  bond: SLASHED
  epoch: INCREMENTED
  old capabilities: INVALIDATED
```

## Security boundary flow

```
Agent signs transaction
        │
        ▼
┌──────────────────────────┐
│  reference_treasury::     │
│  authorized_transfer()    │
│                          │
│  1. Build ActionParams   │
│  2. CPI into             │
│     pactyra_core::       │
│     assert_capability()  │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│  pactyra_core::assert_capability()           │
│                                              │
│  Security checks:                            │
│  1.  Agent active                            │
│  2.  Capability active                      │
│  3.  Capability belongs to agent            │
│  4.  Authority epoch current                 │
│  5.  Policy match                           │
│  6.  Policy active                          │
│  7.  Not expired                            │
│  8.  Action type permitted                   │
│  9.  Target program match                    │
│  10. Target account in scope                 │
│  11. Amount within limit                     │
│  12. Bond satisfied                         │
│                                              │
│  + Replay protection via ConsumedNonce PDA   │
└──────────┬───────────────────────────────────┘
           │
      ┌────┴────┐
      │         │
    PASS      FAIL
      │         │
      ▼         ▼
  Execute    REVERT
  USDC       (no USDC
  transfer   moved)
```

## Verifier Abstraction

PACTYRA does not prescribe one definition of success. Any verifier that produces a deterministic outcome (pass/fail) with a cryptographic evidence hash can be registered in the VerifierRegistry and feed into `pactyra_core::record_outcome`. Adding a verifier does not require changing core.

```
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

### Single entry point

Every verifier feeds into one instruction. `record_outcome` is the only entry point authority transitions respond to:

- `agent` — Agent PDA whose authority is affected
- `result` — `Pass` or `Fail`
- `severity` — `None`, `Ordinary`, or `Critical`
- `evidence_hash` — `keccak256` of the evidence (32 bytes)

Authority effects:

- `Pass` → increments `success_count` (may trigger T1→T2 or T2→T3 upgrade)
- `Fail` (Ordinary) → increments `failure_count` (no tier change)
- `Fail` (Critical) → slashes bond, downgrades to Tier 1, increments authority epoch

### Live verifiers (deployed on devnet)

- **Verifier A — Pyth (Price Freshness):** Reads Pyth `PriceUpdateV2`, checks owner + feed ID + publish_time freshness. Evidence hash = `keccak256(pyth_account_data)`.
- **Verifier B — Service Outcome (Service Delivery):** Combines on-chain payment verification with HTTP 200 response check. Evidence hash = `keccak256(service_status, payment_sig, timestamp)`.

### Planned verifiers (specification stable)

- **TEE Attestation** — verifies SGX/TDX remote attestation quotes + MRENCLAVE
- **Multi-Sig Committee** — aggregates m-of-n off-chain Ed25519 signatures
- **ZK Proof** — verifies Groth16/Plonk proofs against a registered verification key
- **Oracle Quorum** — cross-checks N independent oracle feeds for consensus

Each planned verifier maps its evidence onto the same severity matrix (`none` / `ordinary` / `critical`) and feeds the same `record_outcome` instruction.

## Protocol Lifecycle (Current Implementation)

```
AGENT
  │
  ▼
REGISTER + LOCK BOND (5 USDC → PDA vault)
  │
  ▼
REQUEST CAPABILITY (target, amount, TTL, frequency_limit)
  │
  ▼
ASSERT CAPABILITY (14 security checks)
  │                    ↓
  │              EXECUTION PDA created (status: Asserted)
  │                    ↓
  │              action_id = keccak256(agent, capability, action, target, amount, nonce)
  │
  ▼
TARGET PROGRAM EXECUTES
  │
  ↓
MARK EXECUTED (CPI from target program → status: Executed)
  │
  ▼
OBJECTIVE VERIFIER (pactyra-verifier)
  │  ↓ Pyth PriceUpdateV2 freshness check
  │  ↓ verifier_program CPI signer required
  │
  ▼
RECORD OUTCOME (status: Recorded)
  │                    ↓
  │              Verifier program provenance enforced
  │              Bond, bond_vault, slash_destination mandatory
  │
  ├── PASS → authority upgrade (T1→T2 after 5✓, T2→T3 after 20+ at 95%)
  │
  └── CRITICAL FAIL → bond slashed (real USDC transfer)
                       → authority downgrade to T1
                       → epoch++ (all capabilities invalidated)

## x402 V2 Integration

```
Agent → HTTP GET /api/x402/resource
       ← 402 + WWW-Authenticate: x402 + x402Version: 2
PACTYRA → capability verification (agent active, bond, tier, amount)
       → PASS: continue to payment
       → FAIL: reject, no payment made
Adapter → REAL SPL token transfer (USDC)
       ← REAL transaction signature
Agent → HTTP GET + X-PAYMENT: base64(JSON({ signature, network, requirement }))
Facilitator → Decode, fetch transaction from Solana, verify token balance changes
       ← 200 OK + X-PAYMENT-RESPONSE: base64(JSON(receipt))
```

## Security Model Summary

- 14 security checks in assert_capability
- Execution PDA lifecycle: Asserted → Executed → Recorded
- Verifier-program provenance (CPI signer required)
- Real USDC bond escrow (mandatory slash transfer)
- Frequency limit enforcement (use_count < frequency_limit)
- x402 V2 standards-compatible payment protocol
