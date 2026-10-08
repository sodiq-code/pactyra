import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const PERMANENT_AGENT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
const SOLANA_FM_BASE = 'https://solana.fm/address'
const SOLANA_FM_TX = 'https://solana.fm/tx'

/**
 * 8-Scene Demo Narrative
 *
 * PACTYRA's full lifecycle told as a single narrative arc.
 * Each scene is a real on-chain action a judge can verify.
 *
 * GET /api/demo-narrative
 *
 * Returns the 8 scenes with:
 *   - Scene number + title
 *   - What happens (narrative)
 *   - On-chain instruction invoked
 *   - State transition (tier / authority / epoch)
 *   - Live agent state (fetched from devnet)
 *   - Evidence links to Solana.fm
 */
const SCENES = [
  {
    id: 1,
    key: 't3_start',
    title: 'T3 Start',
    subtitle: 'Agent is at peak earned authority',
    narrative:
      'An agent has earned Tier 3 — Trusted. Its verified outcomes ' +
      'satisfied the policy: 20+ successes, ≥95% success rate, 0 ' +
      'critical failures, and a 5 USDC bond locked. Maximum capability ' +
      'authority is now $500 per action.',
    instruction: 'register_agent + lock_bond + 27 verified successes',
    on_chain_action: 'read agent PDA',
    state_before: { tier: '—', authority: '—', epoch: '—' },
    state_after: { tier: 'T3', authority: '$500', epoch: '1' },
    evidence_label: 'Agent PDA on Solana.fm',
    api_action: 'GET /api/agent',
    runnable: false,
    color: 'emerald',
  },
  {
    id: 2,
    key: 'real_authorization',
    title: 'Real Authorization',
    subtitle: 'Capability issued, scoped and time-bounded',
    narrative:
      'The agent requests a capability bound to a specific target ' +
      'program, target account, action type, amount limit, TTL, and ' +
      'authority epoch. A capability is not a permission — it is an ' +
      'exact-action contract.',
    instruction: 'pactyra_core::request_capability',
    on_chain_action: 'creates Capability PDA',
    state_before: { tier: 'T3', authority: '$500', epoch: '1' },
    state_after: { tier: 'T3', authority: '$500', epoch: '1' },
    evidence_label: 'Capability PDA on Solana.fm',
    api_action: 'POST /api/request-capability',
    runnable: true,
    color: 'sky',
  },
  {
    id: 3,
    key: 'real_execution',
    title: 'Real Execution',
    subtitle: 'Capability asserted, USDC actually moves',
    narrative:
      'The downstream program (reference-treasury) calls ' +
      'assert_capability via CPI before transferring USDC. 14 security ' +
      'checks pass. An Execution PDA is created with a deterministic ' +
      'action_id. Real USDC is moved — no simulated signatures.',
    instruction: 'reference_treasury::authorized_transfer → CPI assert_capability',
    on_chain_action: 'creates Execution PDA + transfers USDC',
    state_before: { tier: 'T3', authority: '$500', epoch: '1' },
    state_after: { tier: 'T3', authority: '$500', epoch: '1' },
    evidence_label: 'x402 demo endpoint (real USDC payment)',
    api_action: 'GET /api/x402/demo',
    runnable: true,
    color: 'amber',
  },
  {
    id: 4,
    key: 'real_verifier',
    title: 'Real Verifier',
    subtitle: 'Objective verifier records the outcome',
    narrative:
      'A registered verifier (Pyth price freshness OR Service Outcome) ' +
      'checks the action against an objective success condition, ' +
      'computes a keccak256 evidence hash, and CPIs into ' +
      'pactyra_core::record_outcome. The verifier is independent — ' +
      'PACTYRA core has no opinion on what "success" means.',
    instruction: 'verifier → CPI pactyra_core::record_outcome',
    on_chain_action: 'creates Receipt PDA with evidence_hash',
    state_before: { tier: 'T3', authority: '$500', epoch: '1' },
    state_after: { tier: 'T3', authority: '$500', epoch: '1' },
    evidence_label: 'Verifier-agnostic demo endpoint',
    api_action: 'GET /api/verifier/demo',
    runnable: true,
    color: 'teal',
  },
  {
    id: 5,
    key: 'authority_increase',
    title: 'Authority Increase',
    subtitle: 'Verified outcome → higher authority',
    narrative:
      'Each verified pass increments success_count. At threshold ' +
      '(5 for T1→T2, 20+ at 95% for T2→T3) the protocol automatically ' +
      'upgrades the tier and unlocks a higher maximum capability. This ' +
      'is the "up" half of the $5 → $50 → $500 loop.',
    instruction: 'pactyra_core::record_outcome (Pass)',
    on_chain_action: 'success_count++ → tier upgrade',
    state_before: { tier: 'T1', authority: '$5', epoch: '1' },
    state_after: { tier: 'T2', authority: '$50', epoch: '1' },
    evidence_label: 'Record Outcome API',
    api_action: 'POST /api/record-outcome (result=pass)',
    runnable: true,
    color: 'emerald',
  },
  {
    id: 6,
    key: 'critical_failure',
    title: 'Critical Failure',
    subtitle: 'Verifier reports a critical failure',
    narrative:
      'A registered verifier reports a critical failure — for example, ' +
      'a Pyth price feed went stale beyond the critical threshold, and ' +
      'the agent acted on it anyway. The verifier CPIs into ' +
      'record_outcome with severity=Critical.',
    instruction: 'verifier → CPI pactyra_core::record_outcome (Critical)',
    on_chain_action: 'critical_failures++ → slash triggered',
    state_before: { tier: 'T3', authority: '$500', epoch: '1' },
    state_after: { tier: 'T3→T1', authority: '$500→$5', epoch: '1→2' },
    evidence_label: 'Record Outcome API (critical)',
    api_action: 'POST /api/record-outcome (result=fail, severity=critical)',
    runnable: true,
    color: 'rose',
  },
  {
    id: 7,
    key: 'authority_collapse',
    title: 'Authority Collapse',
    subtitle: 'Bond slashed, tier dropped, epoch incremented',
    narrative:
      'The protocol automatically slashes the 5 USDC bond (real USDC ' +
      'transferred out), drops the agent from T3 to T1 ($500 → $5), ' +
      'and increments the authority epoch. The agent still has its ' +
      'key — but it no longer has the authority it had earned.',
    instruction: 'pactyra_core::record_outcome (auto-transitions)',
    on_chain_action: 'bond slashed + tier→T1 + epoch++',
    state_before: { tier: 'T3', authority: '$500', epoch: '1' },
    state_after: { tier: 'T1', authority: '$5', epoch: '2' },
    evidence_label: 'Bond PDA (slashed=true) on Solana.fm',
    api_action: 'GET /api/agent',
    runnable: false,
    color: 'rose',
  },
  {
    id: 8,
    key: 'stale_capability_rejected',
    title: 'Stale Capability Rejected',
    subtitle: 'Old-epoch capability fails the epoch check',
    narrative:
      'The agent tries to assert a capability issued at epoch 1. The ' +
      'current epoch is now 2. assert_capability fails check #4 ' +
      '(Authority epoch is current). The transaction reverts. No ' +
      'USDC is moved. The agent must earn its authority again from ' +
      'scratch.',
    instruction: 'pactyra_core::assert_capability → StaleEpoch error',
    on_chain_action: 'transaction reverts (no USDC moved)',
    state_before: { tier: 'T1', authority: '$5', epoch: '2' },
    state_after: { tier: 'T1', authority: '$5', epoch: '2' },
    evidence_label: 'Failed transaction (StaleEpoch)',
    api_action: 'POST /api/request-capability (then assert)',
    runnable: false,
    color: 'amber',
  },
]

export async function GET() {
  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const idl: Idl = require('@/lib/idl/pactyra_core.json')
    const provider = new AnchorProvider(
      connection,
      { publicKey: PublicKey.default } as any,
      { commitment: 'confirmed' }
    )
    const program = new Program(idl, provider)

    const agentId = Buffer.from(PERMANENT_AGENT, 'hex')
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentId], program.programId
    )
    const [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond'), agentId], program.programId
    )

    // Fetch live agent state
    let liveState: any = null
    try {
      const agent = await program.account.agent.fetch(agentPda)
      const tierName = agent.tier.probation ? 'T1'
        : agent.tier.proven ? 'T2'
        : agent.tier.trusted ? 'T3' : 'Unknown'
      const maxAmount = agent.tier.probation ? 5
        : agent.tier.proven ? 50
        : agent.tier.trusted ? 500 : 0
      liveState = {
        tier: tierName,
        tier_name: agent.tier.probation ? 'Probation'
          : agent.tier.proven ? 'Proven'
          : agent.tier.trusted ? 'Trusted' : 'Unknown',
        authority: `$${maxAmount}`,
        epoch: agent.currentEpoch.toNumber(),
        success_count: agent.successCount.toNumber(),
        total_count: agent.totalCount.toNumber(),
        critical_failures: agent.criticalFailures.toNumber(),
        bond_amount: agent.bondAmount.toNumber() / 1_000_000,
        status: agent.status.active ? 'Active' : 'Frozen',
        agent_pda: agentPda.toString(),
        agent_pda_url: `${SOLANA_FM_BASE}/${agentPda.toString()}?cluster=devnet`,
        bond_pda: bondPda.toString(),
        bond_pda_url: `${SOLANA_FM_BASE}/${bondPda.toString()}?cluster=devnet`,
      }
    } catch {
      // Agent not found
    }

    // Determine the "current scene" based on live state
    let currentScene = 1
    if (liveState) {
      if (liveState.critical_failures > 0) {
        currentScene = 8 // Stale capability rejected (post-collapse)
      } else if (liveState.tier === 'T3') {
        currentScene = 5 // Authority increase (at peak)
      } else if (liveState.tier === 'T2') {
        currentScene = 5
      } else if (liveState.success_count > 0) {
        currentScene = 5
      } else {
        currentScene = 1
      }
    }

    return NextResponse.json({
      title: 'PACTYRA — 8-Scene Demo Narrative',
      subtitle: 'Verified outcomes become enforceable economic authority. The full lifecycle as one story.',
      current_scene: currentScene,
      live_state: liveState,
      scenes: SCENES.map((s) => ({
        ...s,
        is_current: s.id === currentScene,
        evidence_url: s.evidence_label.includes('Agent PDA')
          ? (liveState?.agent_pda_url || '')
          : s.evidence_label.includes('Bond PDA')
          ? (liveState?.bond_pda_url || '')
          : s.evidence_label.includes('x402')
          ? 'https://pactyra-ui.vercel.app/api/x402/demo'
          : s.evidence_label.includes('Verifier-agnostic')
          ? 'https://pactyra-ui.vercel.app/api/verifier/demo'
          : '',
      })),
      narrative_arc:
        '$5 → $50 → $500 → $5 — earned through verified outcomes, ' +
        'revoked the moment verification fails.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
