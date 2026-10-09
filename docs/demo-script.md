# PACTYRA — Grand-Prize Demo Video Script (≤3 minutes)

> **The closed-loop economic trust mechanism.** Verified outcomes become enforceable economic authority. PROVE → EARN → ACT → FAIL → LOSE AUTHORITY.
>
> This script integrates the verifier-agnostic architecture (Pyth + Service Outcome),
> the 8-scene narrative, the Authority Proof compression screen, and the Governance
> trust layer into one screen recording under 3 minutes.

---

## Production Notes

- **Screen recording** at 1920×1080 (no on-camera segments — this is the demo video, not the pitch video)
- Use the live app at **https://pactyra-ui.vercel.app**
- Use the best clips already recorded: Video 5 (x402 success), Video 11 (critical failure + kill line), Video 15 (Authority Proof + full tour), Video 17 (Governance)
- **Frame the static gauge honestly:** the agent already collapsed — real on-chain state, not a mock
- **Do NOT show raw JSON endpoints** — stay in the UI
- **Do NOT show Solana.fm "no transaction found" errors** — wait 3 seconds before clicking explorer links
- **On-screen overlay:** `$5 → $50 → $500 → $5` appears during key transitions
- **On-screen overlay:** scene numbers (1–8) as small badges
- Keep total under 3 minutes
- End with the kill line

---

## The Money Line (memorize this)

> **"The agent didn't lose its key. It lost its authority."**

---

## The Pitch Arc (5 words)

```
PROVE → EARN → ACT → FAIL → LOSE AUTHORITY
```

---

## [0:00–0:12] OPEN — The Thesis

**[Screen: PACTYRA hero, dark mode, gauge visible]**

> "PACTYRA is the economic authority layer that turns verified outcomes into enforceable financial power."

**[Show the hero thesis text on screen]**

> "An agent doesn't get authority because we trust its wallet. It gets authority because the protocol verified what it actually did."

**[On-screen: `$5 → $50 → $500 → $5`]**

> "Five dollars. Fifty. Five hundred. Back to five. That's the entire protocol in one loop."

---

## [0:12–0:30] SCENE 1 — T3 START (Peak Earned Authority)

**[Screen: Click Filmstrip frame 1 — "T3 Start"]**

> "Scene one. This agent has earned Tier 3 — Trusted. Twenty-seven verified successes. Ninety-six percent success rate. Zero critical failures. A five USDC bond locked. Maximum economic authority: five hundred dollars per action."

**[Point to the LIVE badge]**

> "This is live data from Solana devnet. Not a mockup."

**[Point to the "VERIFIER: REGISTERED" badge]**

> "And beside it — a registered verifier. PACTYRA does not prescribe one definition of success. Any verifier that produces a deterministic outcome with a cryptographic evidence hash can feed into the protocol."

---

## [0:30–0:45] SCENE 2 — REAL AUTHORIZATION

**[Screen: Click Filmstrip frame 2 — "Real Authorization"]**

> "Scene two. The agent requests a capability — not a permission, but an exact-action contract. Bound to a specific target program, target account, action type, amount limit, time-to-live, and authority epoch."

**[Show the on-chain instruction: `pactyra_core::request_capability`]**

> "PACTYRA checks the capability. Pass."

---

## [0:45–1:05] SCENE 3 — REAL EXECUTION (Live x402 Payment)

**[Screen: Scroll to x402 Payment section, click "Run Real x402 Payment" button]**

> "Scene three. Real economic action. The downstream program calls assert_capability via CPI before transferring USDC. Fourteen security checks pass. An Execution PDA is created. Real USDC is moved — no simulated signatures."

**[Wait for the success toast: "x402 payment verified on-chain"]**

> "That's a real on-chain transaction. You can verify it on Solana.fm."

**[Show the transaction signature in the result card]**

> "Authorization plus execution — proven on-chain."

---

## [1:05–1:25] SCENE 4 — REAL VERIFIER (Verifier-Agnostic Proof)

**[Screen: Scroll to Verifier Abstraction section]**

> "Scene four. The objective verifier. PACTYRA does not decide what success means — the verifier does."

**[Show the architecture diagram: Pyth + Service + Future → VERIFIED OUTCOME → record_outcome → AUTHORITY CHANGE]**

> "Pyth is reference verifier number one — market evidence. The Service Outcome Verifier is reference verifier number two — it checks whether an x402 service was actually delivered after payment."

**[Show both verifier cards]**

> "PACTYRA is verifier-agnostic. Adding a verifier does not require changing core. The verifier computes a keccak256 evidence hash and calls record outcome via CPI. The verifier is independent — PACTYRA core has no opinion on what success means."

---

## [1:25–1:45] SCENE 5 — AUTHORITY INCREASE

**[Screen: Click Filmstrip frame 5 — "Authority Increase"]**

> "Scene five. Each verified pass increments success count. At threshold — five for Tier 1 to Tier 2, twenty-plus at ninety-five percent for Tier 2 to Tier 3 — the protocol automatically upgrades the tier and unlocks a higher maximum capability."

**[Show the before→after state table: T1→T2, $5→$50]**

> "This is the up half of the loop. Earned, not granted."

---

## [1:45–2:05] SCENE 6–7 — CRITICAL FAILURE + AUTHORITY COLLAPSE

**[Screen: Click Filmstrip frame 6 — "Critical Failure"]**

> "Scene six. Now reverse it. A registered verifier reports a critical failure — for example, a Pyth price feed went stale beyond the critical threshold, and the agent acted on it anyway."

**[Show the on-chain instruction: `record_outcome (Critical)`]**

> "The verifier — not the demo script — determines the failure."

**[Screen: Click Filmstrip frame 7 — "Authority Collapse"]**

> "Scene seven. The protocol automatically slashes the five USDC bond — real USDC transferred out. Authority collapses from Tier 3 to Tier 1. Five hundred dollars to five. The authority epoch increments from one to two. Every outstanding capability is now invalid."

**[Scroll to hero — show the red "Authority Degradation Evidence" banner]**

> "The agent still has its key — but it no longer has the authority it had earned."

---

## [2:05–2:20] SCENE 8 — STALE CAPABILITY REJECTED

**[Screen: Click Filmstrip frame 8 — "Stale Capability Rejected"]**

> "Scene eight. The agent tries to assert a capability issued at epoch one. The current epoch is now two. Assert capability fails check number four — authority epoch is current. The transaction reverts. No USDC is moved."

**[Show the StaleEpoch error]**

> "The agent must earn its authority again from scratch."

---

## [2:20–2:40] AUTHORITY PROOF — The Compressed Lifecycle

**[Screen: Scroll to "Authority Proof" section — or click "Proof" in the left nav]**

> "One screen. Every claim verifiable."

**[Show the compressed proof panel]**

> "Agent, tier, authority, epoch, bond, verified outcomes, success rate. Latest evidence — critical fail. Latest transition — Tier 3 to Tier 1, slashed. Registered verifiers — Pyth and Service Outcome."

**[Point to the 3 Proof Transactions]**

> "Three proof transactions — each one clickable to Solana.fm. A judge shouldn't have to understand four Solana programs to understand the consequence. This agent earned this authority because these proofs exist."

---

## [2:40–2:55] GOVERNANCE — The Trust Infrastructure

**[Screen: Click "Governance" in the left nav]**

> "And the authority system is itself governed."

**[Quickly scroll through the governance panels]**

> "Session keys — delegate bounded authority. Freeze — the emergency kill switch. Policy supersede — upgrade rules without breaking agents. Deprecate verifier — revoke a compromised verifier. Replace authority — key rotation."

**[Point to the Timelock and Multisig cards]**

> "Every authority-replacement action has a twenty-four-hour timelock. And it requires a three-of-five multisig. No single party can change the rules."

---

## [2:55–3:00] CLOSE — The Kill Line

**[Screen: Return to hero, show the $5 gauge one final time]**

**[On-screen: `PROVE → EARN → ACT → FAIL → LOSE AUTHORITY`]**

> "PACTYRA. Verified outcomes become enforceable economic authority."

**[Pause 1 second]**

> "The agent didn't lose its key."

**[Pause 1 second]**

> "It lost its authority."

**[On-screen: PACTYRA logo + `pactyra-ui.vercel.app` + `github.com/sodiq-code/pactyra`]**

---

## Recording Checklist

### Before recording
- [ ] Ensure production app at `pactyra-ui.vercel.app` is loading correctly
- [ ] Verify the "Run Real x402 Payment" button works (it generates a real on-chain transaction)
- [ ] Close unnecessary browser tabs
- [ ] Set screen resolution to 1920×1080
- [ ] Test microphone audio levels
- [ ] Have the Filmstrip scenes ready to click (1, 2, 5, 6, 7, 8)

### During recording
- [ ] Speak slowly and clearly
- [ ] Wait for each transaction to confirm before proceeding
- [ ] Wait 3 seconds before clicking any Solana.fm link (avoid "no transaction found" error)
- [ ] Do NOT show raw JSON endpoints — stay in the UI
- [ ] Do NOT click "Record Success" or "Critical Failure" buttons live (they take 10+ seconds and may show loading states) — use the Filmstrip scenes instead
- [ ] End with the kill line: "The agent didn't lose its key. It lost its authority."

### After recording
- [ ] Trim to under 3 minutes
- [ ] Add the PACTYRA logo at start/end
- [ ] Add `$5 → $50 → $500 → $5` text overlay during the loop transitions
- [ ] Add scene numbers (1–8) as small on-screen overlays
- [ ] Add `PROVE → EARN → ACT → FAIL → LOSE AUTHORITY` as a final overlay

---

## Best Video Clips to Combine

Based on the 17 recorded takes, use these clips for the cleanest final cut:

| Segment | Best clip | Duration | Why |
|---------|-----------|----------|-----|
| Open + Hero | Video 1 (00-12-59) | 15s | Hero + degradation banner + timeline |
| Scenes 1–2 (Filmstrip) | Video 3 + Video 4 | 25s | T3 Start + Real Authorization |
| Scene 3 (x402 payment) | **Video 5** (00-30-19) | 25s | **Strongest live proof — real on-chain tx** |
| Scene 4 (Verifier) | Video 8 (clean parts only) | 15s | Verifier abstraction — cut before JSON |
| Scenes 5–8 (Filmstrip) | Video 11 (00-59-05) | 20s | Critical failure + kill line + stale capability |
| Authority Proof | **Video 15** (01-05-42) | 15s | Full tour includes Authority Proof screen |
| Governance | **Video 17** (01-26-04) | 23s | Timelock + multisig + freeze |

**Total: ~2:38** (under 3 minutes)

### Clips to CUT entirely
- Video 2 (dead air — mouse hovering)
- Video 6 (Solana.fm "No transaction found" error)
- Video 7 (raw JSON endpoint)
- Video 8 (raw JSON endpoint — use only the clean UI parts)
- Video 9 (static, gauge doesn't move)
- Video 12 (static, no action)
- Video 13 (red error toast visible)
- Video 16 (Solana.fm "No transaction found" error)

---

## The 5 Key Points to Emphasize

1. **The thesis:** "PACTYRA turns verified outcomes into enforceable economic authority" — not "trustless reputation" or "earned competence"
2. **The hero mechanic:** `$5 → $50 → $500 → $5` — the entire protocol in one loop
3. **It's real:** live on devnet — the x402 payment generates a real on-chain signature
4. **Verifier-agnostic:** Pyth is reference verifier #1, Service Outcome is #2 — adding a verifier doesn't require changing core
5. **The kill line:** "The agent didn't lose its key. It lost its authority."

---

## What Makes This Grand-Winning

This demo transforms PACTYRA from "a sophisticated authorization system" into "a closed-loop economic trust mechanism." The judge sees:

- **PROVE** — the verifier objectively determines success (Scene 4)
- **EARN** — authority increases through verified outcomes (Scene 5)
- **ACT** — real USDC moves with real enforcement (Scene 3)
- **FAIL** — the verifier reports a critical failure (Scene 6)
- **LOSE AUTHORITY** — bond slashed, tier collapsed, epoch incremented, old capabilities invalidated (Scenes 7–8)

Plus the **Authority Proof** screen compresses the entire lifecycle into one view, and the **Governance** section proves the protocol is production-grade infrastructure — not a demo.

**The final question for judges:**

> "What happens when autonomous software controls real money?"

**PACTYRA's answer:**

> "Its authority should be earned, bounded by policy, enforced on-chain, and economically revocable when its verified behavior fails."
