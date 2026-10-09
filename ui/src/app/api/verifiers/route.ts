import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const PACTYRA_CORE_PROGRAM_ID = 'FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf'
const PACTYRA_VERIFIER_PROGRAM_ID = '4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu'

/**
 * Verifier Abstraction Catalog
 *
 * Surfaces PACTYRA's verifier-agnostic architecture as a first-class
 * concept. Any verifier that can produce a deterministic outcome (pass/fail)
 * with a cryptographic evidence hash can be registered in the
 * VerifierRegistry and feed verified outcomes into pactyra-core.
 *
 * The list below contains:
 *   - LIVE verifiers (deployed + registered on devnet)
 *   - PLANNED verifiers (specification stable, not yet deployed)
 *
 * Every verifier feeds into the same single primitive:
 *   pactyra_core::record_outcome(agent, result, severity, evidence_hash)
 *
 * The record_outcome instruction is the only entry point authority transitions
 * respond to. Adding a new verifier does not require changing core.
 */
const SOLANA_FM_BASE = 'https://solana.fm/address'

// Live verifiers (deployed + registered on devnet)
const LIVE_VERIFIERS = [
  {
    id: 'pyth',
    name: 'Pyth Verifier',
    label: 'Verifier A',
    status: 'live',
    category: 'Market evidence',
    description:
      'Reads a Pyth PriceUpdateV2 account, verifies owner + feed ID, ' +
      'and checks publish-time freshness against a configurable threshold.',
    evidence_source: 'Pyth Pull Oracle account data',
    evidence_hash: 'keccak256(pyth_account_data)',
    program_id: PACTYRA_VERIFIER_PROGRAM_ID,
    program_url: `${SOLANA_FM_BASE}/${PACTYRA_VERIFIER_PROGRAM_ID}?cluster=devnet`,
    feed_kind: 'PriceUpdateV2',
    severity_matrix: [
      { condition: 'age ≤ 30s', result: 'pass', severity: 'none' },
      { condition: '30s < age ≤ 60s', result: 'fail', severity: 'ordinary' },
      { condition: 'age > 60s', result: 'fail', severity: 'critical' },
    ],
    cpi_target: 'pactyra_core::record_outcome',
    demo_url: 'https://pactyra-ui.vercel.app/api/verifier/demo',
  },
  {
    id: 'service',
    name: 'Service Outcome Verifier',
    label: 'Verifier B',
    status: 'live',
    category: 'x402 / service delivery',
    description:
      'Checks whether an x402 service was actually delivered after payment. ' +
      'Combines on-chain payment verification with an HTTP 200 response check, ' +
      'then computes a keccak256 evidence hash and records the outcome.',
    evidence_source: 'HTTP response status + payment tx signature',
    evidence_hash: 'keccak256(service_status, payment_sig, timestamp)',
    program_id: null,
    endpoint_url: 'https://pactyra-ui.vercel.app/api/verifier/service',
    feed_kind: 'HTTP 200 + on-chain payment',
    severity_matrix: [
      { condition: 'HTTP 200 + payment verified', result: 'pass', severity: 'none' },
      { condition: 'HTTP non-200 OR payment missing', result: 'fail', severity: 'ordinary' },
      { condition: 'payment reverted / service unreachable > N times', result: 'fail', severity: 'critical' },
    ],
    cpi_target: 'pactyra_core::record_outcome',
    demo_url: 'https://pactyra-ui.vercel.app/api/verifier/service',
  },
]

// Planned verifiers — specifications stable, awaiting implementation
const PLANNED_VERIFIERS = [
  {
    id: 'tee',
    name: 'TEE Attestation Verifier',
    label: 'Future',
    status: 'planned',
    category: 'Confidential compute',
    description:
      'Verifies a remote attestation quote from a Trusted Execution Environment ' +
      '(e.g. SGX/TDX) proving an agent executed within a confidential enclave. ' +
      'Evidence is the attestation report + MRENCLAVE measurement.',
    evidence_source: 'Remote attestation report (SGX/TDX quote)',
    evidence_hash: 'keccak256(attestation_report, mrenclave, report_data)',
    feed_kind: 'Attestation quote',
    severity_matrix: [
      { condition: 'attestation valid + MRENCLAVE matches', result: 'pass', severity: 'none' },
      { condition: 'attestation stale or MRENCLAVE mismatch', result: 'fail', severity: 'ordinary' },
      { condition: 'attestation revoked by attester', result: 'fail', severity: 'critical' },
    ],
    cpi_target: 'pactyra_core::record_outcome',
  },
  {
    id: 'signature',
    name: 'Multi-Sig Verifier',
    label: 'Future',
    status: 'planned',
    category: 'Off-chain committee',
    description:
      'Aggregates signatures from an off-chain committee (e.g. m-of-n observers) ' +
      'attesting to an agent outcome. Useful for verifiers that cannot run on-chain.',
    evidence_source: 'Aggregated Ed25519 signatures from committee',
    evidence_hash: 'keccak256(action_id, merkle_root_of_signatures)',
    feed_kind: 'Aggregated signatures',
    severity_matrix: [
      { condition: '≥ m signatures valid', result: 'pass', severity: 'none' },
      { condition: '< m signatures', result: 'fail', severity: 'ordinary' },
      { condition: 'conflicting signatures / fraud proof', result: 'fail', severity: 'critical' },
    ],
    cpi_target: 'pactyra_core::record_outcome',
  },
  {
    id: 'zk',
    name: 'ZK Proof Verifier',
    label: 'Future',
    status: 'planned',
    category: 'Private execution',
    description:
      'Verifies a zero-knowledge proof that an agent performed an action correctly ' +
      'without revealing inputs. The verifier checks proof validity against a ' +
      'registered verification key.',
    evidence_source: 'ZK proof (Groth16/Plonk) + public inputs',
    evidence_hash: 'keccak256(proof, public_inputs, verification_key_hash)',
    feed_kind: 'ZK proof',
    severity_matrix: [
      { condition: 'proof verifies', result: 'pass', severity: 'none' },
      { condition: 'proof invalid', result: 'fail', severity: 'ordinary' },
      { condition: 'verification key revoked', result: 'fail', severity: 'critical' },
    ],
    cpi_target: 'pactyra_core::record_outcome',
  },
  {
    id: 'oracle_quorum',
    name: 'Oracle Quorum Verifier',
    label: 'Future',
    status: 'planned',
    category: 'Cross-feed consensus',
    description:
      'Cross-checks N independent oracle feeds (Pyth, Switchboard, Chainlink) ' +
      'and requires agreement within a tolerance band before recording an outcome.',
    evidence_source: 'Multiple oracle feed observations',
    evidence_hash: 'keccak256(merkle_root_of_observations)',
    feed_kind: 'Quorum of oracle observations',
    severity_matrix: [
      { condition: '≥ N/2+1 feeds agree within tolerance', result: 'pass', severity: 'none' },
      { condition: 'quorum but high variance', result: 'fail', severity: 'ordinary' },
      { condition: 'no quorum reachable', result: 'fail', severity: 'critical' },
    ],
    cpi_target: 'pactyra_core::record_outcome',
  },
]

// The single record_outcome entry point — every verifier feeds here
const RECORD_OUTCOME_CONTRACT = {
  instruction: 'pactyra_core::record_outcome',
  program_id: PACTYRA_CORE_PROGRAM_ID,
  program_url: `${SOLANA_FM_BASE}/${PACTYRA_CORE_PROGRAM_ID}?cluster=devnet`,
  parameters: [
    { name: 'agent', type: 'Agent PDA', description: 'Agent whose authority is affected' },
    { name: 'result', type: 'enum { Pass, Fail }', description: 'Outcome of the verification' },
    { name: 'severity', type: 'enum { None, Ordinary, Critical }', description: 'Failure severity' },
    { name: 'evidence_hash', type: '[u8; 32]', description: 'keccak256 of the evidence' },
  ],
  authority_effects: {
    Pass: 'increments success_count — may trigger authority upgrade',
    Fail_Ordinary: 'increments failure_count — no tier change',
    Fail_Critical: 'slashes bond, downgrades to Tier 1, increments authority epoch',
  },
}

/**
 * GET /api/verifiers
 *
 * Returns the full verifier catalog: live + planned verifiers, the shared
 * record_outcome contract, and the on-chain VerifierRegistry state.
 */
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

    // Fetch the on-chain VerifierRegistry
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('verifier_registry')],
      program.programId
    )

    let registryOnChain: any = null
    let registeredVerifiers: any[] = []
    try {
      const registry = await program.account.verifierRegistry.fetch(registryPda)
      registryOnChain = {
        pda: registryPda.toString(),
        authority: registry.authority.toString(),
        verifierCount: registry.verifiers.length,
        explorerUrl: `${SOLANA_FM_BASE}/${registryPda.toString()}?cluster=devnet`,
      }
      registeredVerifiers = registry.verifiers.map((v: any, i: number) => ({
        index: i,
        verifierId: Buffer.from(v.verifierId).toString('hex'),
        verifierProgram: v.verifierProgram.toString(),
        operatorKey: v.operatorKey.toString(),
        active: v.active,
        registeredSlot: v.registeredSlot.toNumber(),
        explorerUrl: `${SOLANA_FM_BASE}/${v.verifierProgram.toString()}?cluster=devnet`,
      }))
    } catch {
      // Registry not initialized — still return the catalog
    }

    return NextResponse.json({
      thesis:
        'PACTYRA does not prescribe one definition of success. Any verifier ' +
        'that produces a deterministic outcome with a cryptographic evidence ' +
        'hash can feed into pactyra_core::record_outcome. Adding a verifier ' +
        'does not require changing core.',
      architecture: {
        flow: 'verifier → record_outcome → authority_change',
        diagram: [
          '┌─────────────┐  ┌─────────────┐  ┌─────────────┐',
          '│ Pyth        │  │ Service     │  │ Future...   │',
          '│ Verifier    │  │ Verifier    │  │ (TEE/Sig/ZK)│',
          '└──────┬──────┘  └──────┬──────┘  └──────┬──────┘',
          '       │                │                │',
          '       └────────────────┼────────────────┘',
          '                        ▼',
          '              VERIFIED OUTCOME (pass/fail + evidence_hash)',
          '                        │',
          '                        ▼',
          '              pactyra_core::record_outcome',
          '                        │',
          '                        ▼',
          '              AUTHORITY CHANGE (upgrade / downgrade / slash)',
        ].join('\n'),
      },
      live_verifiers: LIVE_VERIFIERS,
      planned_verifiers: PLANNED_VERIFIERS,
      record_outcome_contract: RECORD_OUTCOME_CONTRACT,
      on_chain_registry: registryOnChain
        ? {
            ...registryOnChain,
            registered_verifiers: registeredVerifiers,
          }
        : null,
      counts: {
        live: LIVE_VERIFIERS.length,
        planned: PLANNED_VERIFIERS.length,
        total: LIVE_VERIFIERS.length + PLANNED_VERIFIERS.length,
        registered_on_chain: registeredVerifiers.length,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
