# PACTYRA — Pitch Video Script (2-3 minutes)

## Production Notes
- Speak directly to camera for intro/outro
- Screen-record for demo segments
- Keep total under 3 minutes
- Energy: confident, technical, visionary
- Background: dark, clean, no distractions

---

## [0:00–0:15] HOOK

**[Camera on]**

> "AI agents already have keys. They haven't earned the right to use them."

**[Pause 2 seconds]**

> "I'm building PACTYRA — the economic authority layer for autonomous agents on Solana."

---

## [0:15–0:45] PROBLEM

**[Camera on]**

> "Autonomous software is becoming an economic actor. AI agents manage treasuries, execute trades, make payments. But the dominant authorization abstraction is still a private key."

> "A key proves control. It doesn't prove earned competence. Spending limits set ceilings. Reputation describes history. Nothing connects verified performance to enforceable authority."

> "The missing layer is: why did this agent earn the authority it currently has?"

---

## [0:45–1:15] SOLUTION

**[Screen recording: Agent Passport UI showing $5]**

> "PACTYRA converts verified execution history into machine-enforceable economic authority. An agent starts at Tier 1 with $5. It earns Tier 2 at $50 after 5 verified successes. It earns Tier 3 at $500 after 20 successes at 95% rate with a 5 USDC bond."

**[Show the authority loop: $5 → $50 → $500]**

> "Every capability is bound to the agent, the action, the target, the amount, the expiry, and the authority epoch. A downstream program calls assert_capability before moving any funds."

---

## [1:15–2:00] DEMO HIGHLIGHTS

**[Screen recording: Live devnet operations]**

> "Here's the full loop, live on Solana devnet."

**[Show: Record Success × 5]**
> "Five verified successes — authority upgrades from $5 to $50."

**[Show: Record Success × 22 + 1 ordinary fail]**
> "Twenty-seven out of twenty-eight — 96.4% success rate — authority upgrades to $500."

**[Show: Record Critical Failure]**
> "Critical failure — bond slashed, authority collapses to $5, epoch increments, all outstanding capabilities invalidated."

**[Show: $5 → $50 → $500 → $5 on screen]**

> "Five dollars. Fifty. Five hundred. Back to five. That's the entire protocol in one loop."

---

## [2:00–2:30] TECHNICAL DEPTH

**[Screen recording: GitHub repo, architecture diagram]**

> "Four Solana programs deployed on devnet. Twenty instructions in the core protocol. Thirteen security checks in assert_capability. A 3-of-5 threshold multisig backing the protocol authority. A 24-hour timelock on all trust-root operations. Real Pyth price feeds for objective verification."

> "Fifty-eight tests passing. Zero unsafe blocks. Zero unwrap calls. Clean Anchor code."

---

## [2:30–2:50] MARKET

**[Camera on]**

> "The market is every autonomous system capable of causing an economic side effect. Treasury agents. Payment agents. DeFi automation. Machine-to-machine commerce."

> "PACTYRA is open-source infrastructure. The business is hosted evidence indexing, enterprise controls, and managed verifier services. No token. No DAO. Pure infrastructure."

---

## [2:50–3:00] CLOSE

**[Camera on, direct]**

> "The agent didn't lose its key."

**[Pause 2 seconds]**

> "It lost its authority."

**[Text on screen: PACTYRA — Economic Authority for Autonomous Agents]**

**[Text: $5 → $50 → $500 → $5]**

> "PACTYRA. Verified performance becomes executable economic authority."

**[End]**

---

## Key Points to Emphasize
1. The thesis: keys prove control, not earned competence
2. The hero mechanic: $5 → $50 → $500 → $5
3. It's real: live on devnet, not a mockup
4. The kill line: "The agent didn't lose its key. It lost its authority."
5. No token, no DAO — serious infrastructure
