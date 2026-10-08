import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Business Model Catalog
 *
 * Three concrete tiers with explicit feature lists and pricing.
 * The open-source core is free forever; paid infrastructure and
 * enterprise tiers fund ongoing development.
 *
 * GET /api/business-model
 */
const TIERS = [
  {
    id: 'open_source',
    name: 'Open-Source Core',
    tagline: 'Free, forever, MIT-licensed',
    price: '$0',
    price_detail: 'self-hosted, no limits',
    target: 'Developers and small teams integrating PACTYRA into agent infrastructure',
    status: 'available',
    color: 'emerald',
    features: [
      { label: 'All 4 Solana programs (core, verifier, treasury, multisig)', included: true },
      { label: 'TypeScript SDK with x402 adapter', included: true },
      { label: 'Verifier interface specification', included: true },
      { label: 'Reference treasury integration', included: true },
      { label: 'Self-hosted VerifierRegistry', included: true },
      { label: 'Community GitHub support', included: true },
      { label: 'Hosted verifier registry', included: false },
      { label: 'Monitoring dashboards', included: false },
      { label: 'SLA backing', included: false },
      { label: 'Custom verifier integrations', included: false },
    ],
    limits: {
      agents: 'unlimited',
      verifiers: 'unlimited (self-hosted)',
      api_calls: 'unlimited (self-hosted)',
      support: 'community',
    },
  },
  {
    id: 'paid_infrastructure',
    name: 'Hosted Infrastructure',
    tagline: 'Managed verifier registry, monitoring, and policy management',
    price: '$99–$999',
    price_detail: 'per month, per organization',
    target: 'Agent platforms and fintechs that need operated infrastructure without self-hosting',
    status: 'roadmap',
    color: 'sky',
    features: [
      { label: 'Everything in Open-Source Core', included: true },
      { label: 'Hosted VerifierRegistry (operated by PACTYRA)', included: true },
      { label: 'Hosted Pyth freshness verifier instances', included: true },
      { label: 'Hosted Service Outcome verifier', included: true },
      { label: 'Monitoring dashboards (agent authority, success rates, slashes)', included: true },
      { label: 'Policy management UI (create, version, supersede)', included: true },
      { label: 'Authority analytics (per-agent timelines, risk metrics)', included: true },
      { label: 'Email + Slack alerts on critical failures', included: true },
      { label: 'Receipt indexing + historical authority queries', included: true },
      { label: 'Custom verifier integrations', included: false },
    ],
    limits: {
      agents: 'up to 1,000',
      verifiers: 'up to 10 (hosted)',
      api_calls: '1M / month',
      support: 'email, 48h response',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom policy, verifier integrations, and SLA',
    price: 'Custom',
    price_detail: 'annual contract, scoped to deployment',
    target: 'Organizations deploying autonomous software with financial guardrails at scale',
    status: 'roadmap',
    color: 'violet',
    features: [
      { label: 'Everything in Hosted Infrastructure', included: true },
      { label: 'Custom verifier integrations (TEE, ZK, multi-sig committee)', included: true },
      { label: 'Custom policy / governance modules', included: true },
      { label: 'Compliance evidence export (SOC2-style audit trail)', included: true },
      { label: 'Dedicated verifier infrastructure (single-tenant)', included: true },
      { label: 'Multi-agent fleet governance (organization-wide controls)', included: true },
      { label: 'On-premise / VPC deployment option', included: true },
      { label: 'SLA backing (99.9% uptime, 1h critical response)', included: true },
      { label: 'Named solutions engineer', included: true },
      { label: 'Security review + audit support', included: true },
    ],
    limits: {
      agents: 'unlimited',
      verifiers: 'unlimited (dedicated)',
      api_calls: 'unlimited',
      support: '24/7, named engineer, SLA',
    },
  },
]

const REVENUE_STREAMS = [
  {
    name: 'SaaS subscriptions',
    description: 'Hosted infrastructure tiers (Paid + Enterprise)',
    model: 'monthly / annual recurring',
    share: 'primary',
  },
  {
    name: 'Verifier operation fees',
    description: 'Per-verifier operational fee for managed verifier instances',
    model: 'usage-based',
    share: 'secondary',
  },
  {
    name: 'Enterprise integrations',
    description: 'One-time integration + ongoing support contracts',
    model: 'project + retainer',
    share: 'secondary',
  },
  {
    name: 'Compliance reporting',
    description: 'Audit-trail export and compliance evidence packages',
    model: 'per-report or annual',
    share: 'secondary',
  },
]

const TARGET_CUSTOMERS = [
  {
    segment: 'Agent orchestration platforms',
    need: 'Bound economic authority for agents they operate on behalf of users',
    example: 'Platforms that let users deploy autonomous agents to manage capital',
    primary_tier: 'paid_infrastructure',
  },
  {
    segment: 'Autonomous treasury systems',
    need: 'Deterministic guardrails on how protocol funds are spent by agents',
    example: 'Protocol treasuries using agents for yield, payments, rebalancing',
    primary_tier: 'enterprise',
  },
  {
    segment: 'x402 service networks',
    need: 'Verify that an agent earned the authority to pay for a service',
    example: 'HTTP services gated by PACTYRA capabilities before accepting payment',
    primary_tier: 'paid_infrastructure',
  },
  {
    segment: 'DeFi execution systems',
    need: 'Bound capital control for autonomous trading / liquidity agents',
    example: 'Autonomous market makers with tiered trading limits',
    primary_tier: 'enterprise',
  },
  {
    segment: 'Enterprise AI deployments',
    need: 'Financial guardrails on autonomous software controlling real capital',
    example: 'Banks / fintechs deploying AI treasury agents with compliance needs',
    primary_tier: 'enterprise',
  },
]

export async function GET() {
  return NextResponse.json({
    thesis:
      'The protocol is open-source infrastructure (free forever). ' +
      'The business is the operated layer around it: hosted verifier ' +
      'registry, monitoring, policy management, and enterprise integrations. ' +
      'No token. No DAO. Pure infrastructure.',
    tiers: TIERS,
    revenue_streams: REVENUE_STREAMS,
    target_customers: TARGET_CUSTOMERS,
    open_source_commitment: {
      license: 'MIT',
      guaranteed_free: [
        'pactyra-core program',
        'pactyra-verifier program',
        'reference-treasury program',
        'threshold-multisig program',
        'TypeScript SDK',
        'x402 adapter',
        'VerifierRegistry interface specification',
      ],
      note: 'The enforcement primitive is open-source forever. Paid tiers only add operated infrastructure and integrations around it.',
    },
  })
}
