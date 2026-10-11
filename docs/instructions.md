# PACTYRA Program Instructions

Reference for every instruction across the four on-chain programs, the authority tiers and transitions, the 14 assert_capability security checks, and the account, error, and event sets.

## pactyra-core

### Instructions (21)

#### Core protocol (10)

| Instruction | Description |
|---|---|
| `initialize_protocol` | Creates the VerifierRegistry PDA with the protocol authority |
| `register_agent` | Registers a new agent with the signer as authority root (Tier 1 / Probation) |
| `register_verifier` | Registers a verifier operator in the VerifierRegistry (protocol authority only) |
| `create_policy` | Creates an immutable policy defining capability requirements |
| `lock_bond` | Locks a bond for an agent (re-lockable after slash) |
| `request_capability` | Issues an evidence-bound capability with TTL, amount limit, target scope, and authority epoch binding |
| `assert_capability` | The core enforcement instruction — validates 14 security checks before authorizing an action |
| `mark_executed` | Transitions an Execution PDA from Asserted to Executed; called by the target program after performing the authorized action |
| `record_outcome` | Records a verified outcome from a registered verifier, triggers authority transitions |
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

### assert_capability security checks (14)

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
13. Frequency limit not exceeded (capability use count versus max)
14. Delegate scope (if a delegate signs: verify delegate pubkey, scope expiry, per-action amount limit)

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
