# PACTYRA — Demo Video Storyboard (≤3 minutes)

## Production Notes
- Screen recording at 1920×1080
- Use the live app at https://pactyra-ui.vercel.app
- Narrate every action clearly
- Show real transaction confirmations
- Keep under 3 minutes
- The demo is structured as an 8-scene narrative — each scene is a real on-chain action

---

## The 8-Scene Narrative

PACTYRA's full lifecycle told as a single story. Eight scenes walk through the complete authority loop: from peak earned authority, through real authorization, execution, and verification, to authority increase, critical failure, collapse, and stale-capability rejection.

**Narrative arc:** `$5 → $50 → $500 → $5` — earned through verified outcomes, revoked the moment verification fails.

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

---

## [0:00–0:10] INTRO

**[Screen: Vercel app loaded, dark mode]**

> "This is PACTYRA — the consequence layer that turns verified outcomes into enforceable economic authority. I'll walk through the full lifecycle as an 8-scene narrative: five dollars to fifty to five hundred and back to five."

---

## [0:10–0:25] SCENE 1 — T3 START

**[Screen: Hero card showing agent at Tier 3]**

> "Scene one. This agent has earned Tier 3 — Trusted. Twenty-seven verified successes, ninety-six percent success rate, a five USDC bond locked. Maximum authority: five hundred dollars per action. This is peak earned authority."

**[Point to the LIVE badge]**

> "This is live data from Solana devnet, not a mockup."

---

## [0:25–0:40] SCENE 2 — REAL AUTHORIZATION

**[Screen: Scroll to Demo Narrative, click scene 2]**

> "Scene two. The agent requests a capability — an exact-action contract bound to a specific target program, target account, action type, amount limit, time-to-live, and authority epoch. A capability is not a permission. It is a scoped, time-bounded, exact-action authorization."

---

## [0:40–0:55] SCENE 3 — REAL EXECUTION

**[Screen: Click 'Run Real x402 Payment' button]**

> "Scene three. The downstream program calls assert_capability via CPI before transferring USDC. Fourteen security checks pass. An Execution PDA is created. Real USDC is moved — no simulated signatures."

**[Show the on-chain signature]**

---

## [0:55–1:10] SCENE 4 — REAL VERIFIER

**[Screen: Open /api/verifier/demo in a new tab]**

> "Scene four. A registered verifier — Pyth for price freshness, or Service Outcome for x402 delivery — checks the action against an objective success condition, computes a keccak256 evidence hash, and CPIs into record_outcome. The verifier is independent. PACTYRA core has no opinion on what success means."

---

## [1:10–1:30] SCENE 5 — AUTHORITY INCREASE

**[Screen: Click 'Record Success' 5 times in the UI]**

> "Scene five. Each verified pass increments success_count. At threshold, the protocol automatically upgrades the tier and unlocks a higher maximum capability. This is the up half of the five-to-fifty-to-five-hundred loop."

---

## [1:30–1:50] SCENE 6 — CRITICAL FAILURE

**[Screen: Click 'Record Critical Failure']**

> "Scene six. A registered verifier reports a critical failure — for example, a Pyth price feed went stale beyond the critical threshold, and the agent acted on it anyway. The verifier CPIs into record_outcome with severity equals critical."

---

## [1:50–2:10] SCENE 7 — AUTHORITY COLLAPSE

**[Screen: Show tier dropping to Probation, bond slashed to 0, epoch incrementing]**

> "Scene seven. The protocol automatically slashes the five USDC bond — real USDC transferred out. Authority collapses from Tier 3 to Tier 1. The authority epoch increments from one to two. The agent still has its key — but it no longer has the authority it had earned."

---

## [2:10–2:30] SCENE 8 — STALE CAPABILITY REJECTED

**[Screen: Show a failed assert_capability transaction]**

> "Scene eight. The agent tries to assert a capability issued at epoch one. The current epoch is now two. assert_capability fails check number four — authority epoch is current. The transaction reverts. No USDC is moved. The agent must earn its authority again from scratch."

---

## [2:30–2:45] CLOSE

**[Screen: $5 → $50 → $500 → $5]**

> "Five dollars. Fifty. Five hundred. Back to five. That's PACTYRA — verified outcomes become enforceable economic authority."

**[Screen: GitHub URL + Vercel URL]**

> "Open source on GitHub. Live at PACTYRA-ui dot Vercel dot app. Eight scenes, one narrative — the complete authority loop, on-chain, verifiable."

**[End]**

---

## Recording Checklist

Before recording:
- [ ] Ensure devnet agent state is appropriate (Tier 3 with critical failures recorded to show collapse)
- [ ] Verify Vercel app is loading correctly
- [ ] Test all interactive elements work (refresh, judge mode, x402 demo, transaction history, demo narrative stepper)
- [ ] Close unnecessary browser tabs
- [ ] Set screen resolution to 1920×1080
- [ ] Test microphone audio levels

During recording:
- [ ] Speak slowly and clearly
- [ ] Wait for each transaction to confirm before proceeding
- [ ] Show the "LIVE" badge to prove it's real devnet data
- [ ] Pause briefly after tier changes to let the viewer absorb
- [ ] Walk through all 8 scenes in the Demo Narrative section
- [ ] End with the kill line: "The agent didn't lose its key. It lost its authority."

After recording:
- [ ] Trim to under 3 minutes
- [ ] Add the PACTYRA logo at start/end
- [ ] Add the $5 → $50 → $500 → $5 text overlay during the loop
- [ ] Add scene numbers (1-8) as on-screen overlays
- [ ] Upload to YouTube or Vimeo (unlisted is fine)
- [ ] Test the video link works before submitting

## x402 V2 Demo (Live)

The x402 demo button on the live app performs (Scene 3):

1. **PACTYRA assert_capability()** — real on-chain enforcement (creates Execution PDA + ConsumedNonce PDA, verifies 14 security checks)
2. **402 Payment Required** — x402 V2 response with `WWW-Authenticate: x402`
3. **REAL USDC transfer** — 0.01 USDC on Solana devnet
4. **X-PAYMENT header** — base64-encoded JSON with transaction signature
5. **On-chain verification** — facilitator verifies token balance changes
6. **HTTP 200** — resource returned with `X-PAYMENT-RESPONSE` header

The demo generates TWO on-chain signatures per run:
- assert_capability signature (PACTYRA enforcement)
- USDC payment signature (real payment)

## Reference Treasury Enforcement (Strongest Proof)

The reference treasury demonstrates the complete enforcement path (Scene 3):
1. `assert_capability()` CPI — verifies all 14 security checks
2. USDC transfer — real tokens move
3. `mark_executed()` CPI — Execution PDA advances to Executed status

If `assert_capability()` fails, the transaction reverts and no USDC moves.

## Machine-Verifiable APIs

Judges can verify every scene independently:

| Scene | API endpoint | What it proves |
|---|---|---|
| 1 | `GET /api/agent` | Agent is at Tier 3 with verified outcomes |
| 2 | `POST /api/request-capability` | Capability PDA created on-chain |
| 3 | `GET /api/x402/demo` | Real USDC moved with PACTYRA enforcement |
| 4 | `GET /api/verifier/demo` | Verifier CPI into record_outcome |
| 5 | `POST /api/record-outcome (pass)` | success_count++ and tier upgrade |
| 6 | `POST /api/record-outcome (critical)` | Critical failure recorded |
| 7 | `GET /api/agent` | Bond slashed, tier=T1, epoch incremented |
| 8 | Failed assert_capability tx | StaleEpoch revert |

The full 8-scene script is also available as a machine-readable API:

```text
GET https://pactyra-ui.vercel.app/api/demo-narrative
```

Returns: the 8 scenes with narrative, on-chain instruction, state transitions, evidence links, and the live agent state from devnet.
