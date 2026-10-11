# PACTYRA Demo Narrative

The full protocol lifecycle as an 8-scene narrative, the test-harness scripts that exercise the state machine, and the distinction between the test harness and the judge-facing proof path.

## Demo orchestration

### 8-Scene Demo Narrative

PACTYRA's full lifecycle is told as a single 8-scene narrative. Each scene is a real on-chain action a judge can independently verify.

| # | Scene | What happens | On-chain instruction |
|---|---|---|---|
| 1 | T3 Start | Agent is at peak earned authority | register_agent + lock_bond + 27 verified successes |
| 2 | Real Authorization | Capability issued, scoped and time-bounded | pactyra_core::request_capability |
| 3 | Real Execution | Capability asserted, USDC actually moves | reference_treasury::authorized_transfer → CPI assert_capability |
| 4 | Real Verifier | Objective verifier records the outcome | verifier → CPI pactyra_core::record_outcome |
| 5 | Authority Increase | Verified outcome → higher authority | pactyra_core::record_outcome (Pass) |
| 6 | Critical Failure | Verifier reports a critical failure | verifier → CPI pactyra_core::record_outcome (Critical) |
| 7 | Authority Collapse | Bond slashed, tier dropped, epoch incremented | pactyra_core::record_outcome (auto-transitions) |
| 8 | Stale Capability Rejected | Old-epoch capability fails the epoch check | pactyra_core::assert_capability → StaleEpoch error |

The narrative arc: `$5 → $50 → $500 → $5` — earned through verified outcomes, revoked the moment verification fails.

The full 8-scene script is exposed as a machine-readable API:

```text
GET https://pactyra-ui.vercel.app/api/demo-narrative
```

Returns: the 8 scenes with narrative, on-chain instruction, state transitions (before/after), evidence links, and the live agent state fetched from devnet.

### Protocol state-machine test harness

Scripts in `scripts/` are **test harness** code that directly calls `record_outcome()` to exercise the protocol state machine. They bypass the verifier path for testing purposes and are not the judge-facing proof path.

The **judge-facing proof path** is the live x402 demo, which calls `assert_capability()` on-chain, creates an Execution PDA, and makes a real USDC payment:

```text
https://pactyra-ui.vercel.app/api/x402/demo
```

| Script | Purpose |
|---|---|
| `bootstrap.ts` | Initialize protocol, register verifier + agent, create policy, lock bond |
| `earn-tier2.ts` | Test harness: 5 verified successes → Tier 1 → Tier 2 |
| `earn-tier3.ts` | Test harness: 27/28 successes (96.4%) → Tier 2 → Tier 3 |
| `unauthorized-transfer.ts` | $400 rejected (AmountExceedsCapability) |
| `critical-failure.ts` | Test harness: Bond slash + downgrade + epoch++ |
| `stale-capability.ts` | Old-epoch capability rejected (StaleEpoch) |
| `demo-runner.ts` | Test harness: Master script chaining all steps |
| `devnet-verify.ts` | Devnet deployment verification |
| `setup-multisig.ts` | Create multisig and transfer protocol authority |
| `x402-demo.ts` | Standalone x402 demo — gates agentic payments with PACTYRA capabilities |
