# PACTYRA — Demo Video Storyboard (≤3 minutes)

## Production Notes
- Screen recording at 1920×1080
- Use the live app at https://pactyra-ui.vercel.app
- Narrate every action clearly
- Show real transaction confirmations
- Keep under 3 minutes

---

## [0:00–0:10] INTRO

**[Screen: Vercel app loaded, dark mode]**

> "This is PACTYRA — the economic authority layer for autonomous agents. I'll demonstrate the full authority loop: five dollars to fifty to five hundred and back to five."

---

## [0:10–0:30] AGENT STATE — TIER 1

**[Screen: Hero card showing agent state]**

> "This agent is on Solana devnet at Tier 1 — Probation. Maximum capability: five dollars. Bond: five USDC. Zero verified executions."

**[Point to the LIVE badge]**

> "This is live data from Solana devnet, not a mockup."

---

## [0:30–1:00] EARN TIER 2 — $5 → $50

**[Screen: Click "Record Success" 5 times]**

> "I'll record five verified successful outcomes. Each one increments the success counter."

**[After 5th click: show tier change to Proven, max $50]**

> "Five successes — authority upgrades to Tier 2, Proven. Maximum capability is now fifty dollars. The bond is still locked."

---

## [1:00–1:30] EARN TIER 3 — $50 → $500

**[Screen: Continue recording successes up to 27/28]**

> "Now I'll record twenty-two more successes plus one ordinary failure. That gives us twenty-seven out of twenty-eight — a 96.4% success rate."

**[Show: Tier changes to Trusted, max $500]**

> "Authority upgrades to Tier 3, Trusted. Maximum capability: five hundred dollars. This meets the policy threshold of twenty successes, ninety-five percent rate, zero critical failures, and a satisfied bond."

---

## [1:30–2:00] CRITICAL FAILURE — $500 → $5

**[Screen: Click "Record Critical Failure"]**

> "Now the agent fails a critical verification — for example, it submitted a stale Pyth price update."

**[Show: Tier drops to Probation, bond slashed to 0, epoch increments]**

> "Bond slashed to zero. Authority collapses to Tier 1 — five dollars. The authority epoch increments from one to two. Every outstanding capability from epoch one is now invalid."

---

## [2:00–2:20] STALE CAPABILITY REJECTION

**[Screen: Show that old capabilities are rejected]**

> "Any capability issued at epoch one will now fail the StaleEpoch check. The agent cannot use its old authority. It must earn it again from scratch."

---

## [2:20–2:40] GOVERNANCE

**[Screen: Scroll to governance section]**

> "PACTYRA also includes a full governance layer. Session keys with bounded scope. Agent freeze for compromised keys. Policy supersession. Verifier deprecation. A 24-hour timelock on all trust-root operations. And a 3-of-5 threshold multisig backing the protocol authority."

---

## [2:40–3:00] CLOSE

**[Screen: $5 → $50 → $500 → $5]**

> "Five dollars. Fifty. Five hundred. Back to five. That's PACTYRA — verified performance becomes executable economic authority."

**[Screen: GitHub URL + Vercel URL]**

> "Open source on GitHub. Live at PACTYRA-ui dot Vercel dot app."

**[End]**

---

## Recording Checklist

Before recording:
- [ ] Ensure devnet agent has 0 successes (reset if needed)
- [ ] Verify Vercel app is loading correctly
- [ ] Test all buttons work (register, lock bond, record outcome, governance)
- [ ] Close unnecessary browser tabs
- [ ] Set screen resolution to 1920×1080
- [ ] Test microphone audio levels
- [ ] Have the architecture diagram ready for the governance section

During recording:
- [ ] Speak slowly and clearly
- [ ] Wait for each transaction to confirm before proceeding
- [ ] Show the "LIVE" badge to prove it's real devnet data
- [ ] Pause briefly after tier changes to let the viewer absorb
- [ ] End with the kill line: "The agent didn't lose its key. It lost its authority."

After recording:
- [ ] Trim to under 3 minutes
- [ ] Add the PACTYRA logo at start/end
- [ ] Add the $5 → $50 → $500 → $5 text overlay during the loop
- [ ] Upload to YouTube or Vimeo (unlisted is fine)
- [ ] Test the video link works before submitting
