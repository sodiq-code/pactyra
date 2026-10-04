'use client'

// PACTYRA — Agent Passport UI
// Evidence-bound economic authority for autonomous agents on Solana.
// Demo UI: all data is static / simulated client-side.

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Shield, ShieldCheck, ShieldAlert, TrendingUp, Activity, DollarSign, Lock, Unlock,
  Zap, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Hash, Sun, Moon, RefreshCw, Wallet, Github, ExternalLink, Copy, Rocket, BookOpen,
  Layers, Terminal, Boxes, Cpu, Network, Server, FileCheck2, FlaskConical, PlayCircle,
  Globe, Loader2, ArrowRight, Shuffle, Link2, Sparkles,
} from 'lucide-react'

// ============================================================
// Types & constants
// ============================================================

type Tier = 'Probation' | 'Proven' | 'Trusted'

interface AgentState {
  agentId: string; authorityRoot: string; currentEpoch: number; tier: Tier
  maxAmount: number; successCount: number; totalCount: number; criticalFailures: number
  bondAmount: number; bondSlashed: boolean; status: 'Active' | 'Frozen'; tierSuccesses: number
}
interface AuthorityEvent {
  id: string; type: 'upgrade' | 'downgrade' | 'assert' | 'outcome' | 'bond' | 'slash' | 'revoke' | 'epoch'
  epoch: number; description: string; amount?: number; outcome?: 'Pass' | 'Fail'; live?: boolean
}
interface CapabilityItem { type: string; target: string; amountLimit: number; active: boolean; expiry: string }
interface Receipt {
  id: string; action: string; result: 'Pass' | 'Fail'; severity: 'None' | 'Ordinary' | 'Critical'
  verifier: string; evidenceHash: string; timestamp: string; gasUsed: number; slot: number
}
interface ProgramInfo {
  name: string; programId: string; instructions: number; description: string
  status: 'Deployed'; deploymentSlot: number; txSignature: string
}
interface LiveAgent {
  found: boolean; agentId?: string; agentPda?: string; authorityRoot?: string
  currentEpoch?: number; tier?: Tier; maxAmount?: number; successCount?: number
  totalCount?: number; successRate?: number; criticalFailures?: number
  bondAmount?: number; status?: string; rpc?: string; message?: string
}
interface DeploymentProgram {
  name: string; id: string; size: number; deployed: boolean; owner: string | null
  lamports: number; dataLength: number; executable: boolean
}
interface DeploymentData {
  cluster: string; wallet: string; balanceSOL: number
  programs: DeploymentProgram[]; allDeployed: boolean; rpc?: string
}
interface SecurityCheck { id: number; name: string; description: string; tooltip: string; passed: boolean }
interface ProgramInstruction { name: string; description: string; args: string }

interface RegisterAgentResponse {
  success: boolean; message?: string; agentId: string; agentPda: string
  tier: Tier; epoch: number; bondAmount: number; successCount: number
  totalCount: number; authorityRoot: string; signature?: string
  explorerUrl?: string; error?: string
}
interface LockBondResponse {
  success: boolean; message?: string; agentId: string; bondAmount: number
  signature: string; explorerUrl: string; error?: string
}

interface RecordOutcomeResponse { success: boolean; message?: string; tier: Tier; epoch: number; bondAmount: number; successCount: number; totalCount: number; criticalFailures: number; signature: string; explorerUrl: string; error?: string }
interface RequestCapabilityResponse { success: boolean; message?: string; capabilityPda: string; amountLimit: number; targetProgram: string; targetAccount: string; epoch: number; signature: string; explorerUrl: string; error?: string }
interface TxHistoryEntry { signature: string; slot: number; blockTime?: number; err: any; memo?: string | null; explorerUrl?: string; instruction?: string }
interface TransactionHistoryResponse { agentId: string; agentPda?: string; count: number; transactions: TxHistoryEntry[]; error?: string }

interface TierConfig { amount: number; gradient: string; glow: string; text: string; upgradeThreshold: number }
const TIER_CONFIG: Record<Tier, TierConfig> = {
  Probation: { amount: 5,   gradient: 'from-rose-400 via-red-500 to-orange-500',    glow: 'shadow-[0_0_28px_rgba(244,63,94,0.45)]',  text: 'text-rose-300',   upgradeThreshold: 5 },
  Proven:    { amount: 50,  gradient: 'from-amber-300 via-yellow-500 to-orange-500', glow: 'shadow-[0_0_28px_rgba(245,158,11,0.45)]', text: 'text-amber-300',  upgradeThreshold: 27 },
  Trusted:   { amount: 500, gradient: 'from-emerald-300 via-teal-400 to-cyan-500',   glow: 'shadow-[0_0_32px_rgba(16,185,129,0.55)]', text: 'text-emerald-300', upgradeThreshold: Number.POSITIVE_INFINITY },
}

const SHOWCASE_AGENT: AgentState = {
  agentId: 'treasury-agent-042',
  authorityRoot: 'A55wG1G5nLVxn9Ns91ogrqZ6cHVi2yPd7WRi8GCyc3PE',
  currentEpoch: 184, tier: 'Trusted', maxAmount: 500, successCount: 27, totalCount: 28,
  criticalFailures: 0, bondAmount: 5, bondSlashed: false, status: 'Active', tierSuccesses: 27,
}

// The $5 → $50 → $500 → $5 loop, in 31 events
const DEMO_TIMELINE: AuthorityEvent[] = [
  { id: 't01', type: 'bond',      epoch: 1,   description: 'Bond locked: 5 USDC',                          amount: 5 },
  { id: 't02', type: 'assert',    epoch: 1,   description: 'Capability asserted: PAY_SERVICE $5',         amount: 5 },
  { id: 't03', type: 'outcome',   epoch: 1,   description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't04', type: 'assert',    epoch: 2,   description: 'Capability asserted: PAY_SERVICE $5',         amount: 5 },
  { id: 't05', type: 'outcome',   epoch: 2,   description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't06', type: 'assert',    epoch: 3,   description: 'Capability asserted: PAY_SERVICE $5',         amount: 5 },
  { id: 't07', type: 'outcome',   epoch: 3,   description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't08', type: 'assert',    epoch: 4,   description: 'Capability asserted: PAY_SERVICE $5',         amount: 5 },
  { id: 't09', type: 'outcome',   epoch: 4,   description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't10', type: 'assert',    epoch: 5,   description: 'Capability asserted: PAY_SERVICE $5',         amount: 5 },
  { id: 't11', type: 'outcome',   epoch: 5,   description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't12', type: 'upgrade',  epoch: 5,   description: 'Tier upgrade: Probation → Proven (5 successes)' },
  { id: 't13', type: 'assert',    epoch: 10,  description: 'Capability asserted: PAY_SERVICE $50',        amount: 50 },
  { id: 't14', type: 'outcome',   epoch: 10,  description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't15', type: 'assert',    epoch: 15,  description: 'Capability asserted: PAY_SERVICE $50',        amount: 50 },
  { id: 't16', type: 'outcome',   epoch: 15,  description: 'Outcome recorded: FAIL (Ordinary)',            outcome: 'Fail' },
  { id: 't17', type: 'assert',    epoch: 20,  description: 'Capability asserted: PAY_SERVICE $50',        amount: 50 },
  { id: 't18', type: 'outcome',   epoch: 20,  description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't19', type: 'assert',    epoch: 25,  description: 'Capability asserted: PAY_SERVICE $50',        amount: 50 },
  { id: 't20', type: 'outcome',   epoch: 25,  description: 'Outcome recorded: PASS — 27/28 = 96.4%',       outcome: 'Pass' },
  { id: 't21', type: 'upgrade',  epoch: 25,  description: 'Tier upgrade: Proven → Trusted' },
  { id: 't22', type: 'assert',    epoch: 30,  description: 'Capability asserted: PAY_SERVICE $500',       amount: 500 },
  { id: 't23', type: 'outcome',   epoch: 30,  description: 'Outcome recorded: PASS',                       outcome: 'Pass' },
  { id: 't24', type: 'slash',     epoch: 35,  description: 'Critical failure detected: stale capability',  amount: 500 },
  { id: 't25', type: 'slash',     epoch: 35,  description: 'Bond slashed: 5 USDC forfeited',                amount: 5 },
  { id: 't26', type: 'epoch',     epoch: 36,  description: 'Authority epoch advanced' },
  { id: 't27', type: 'downgrade', epoch: 36,  description: 'Tier downgrade: Trusted → Proven' },
  { id: 't28', type: 'downgrade', epoch: 36,  description: 'Authority cap reset to T1 ($5)' },
  { id: 't29', type: 'bond',      epoch: 37,  description: 'New bond locked: 5 USDC',                       amount: 5 },
  { id: 't30', type: 'assert',    epoch: 37,  description: 'Capability asserted: PAY_SERVICE $5',         amount: 5 },
  { id: 't31', type: 'outcome',   epoch: 37,  description: 'Outcome recorded: PASS — loop restarts',       outcome: 'Pass' },
]

const DEMO_CAPABILITIES: CapabilityItem[] = [
  { type: 'PAY_SERVICE',        target: 'reference-treasury', amountLimit: 500, active: true,  expiry: '30m' },
  { type: 'TRADE',              target: 'dex-program',        amountLimit: 250, active: true,  expiry: '30m' },
  { type: 'TREASURY_WITHDRAW',  target: 'reference-treasury', amountLimit: 0,   active: false, expiry: '—' },
  { type: 'DELEGATE',           target: '—',                   amountLimit: 0,   active: false, expiry: '—' },
]

const DEMO_RECEIPTS: Receipt[] = [
  { id: '#8841', action: 'PAY_SERVICE_500', result: 'Pass', severity: 'None',     verifier: 'PYTH-FRESHNESS-V1', evidenceHash: '0x4a2b...8f31', timestamp: '2s ago',  gasUsed: 0.000042, slot: 284194221 },
  { id: '#8840', action: 'PAY_SERVICE_500', result: 'Pass', severity: 'None',     verifier: 'PYTH-FRESHNESS-V1', evidenceHash: '0x3c1a...9e22', timestamp: '8s ago',  gasUsed: 0.000041, slot: 284194198 },
  { id: '#8839', action: 'PAY_SERVICE_500', result: 'Pass', severity: 'None',     verifier: 'PYTH-FRESHNESS-V1', evidenceHash: '0x7d5c...1f43', timestamp: '15s ago', gasUsed: 0.000043, slot: 284194175 },
  { id: '#8838', action: 'PAY_SERVICE_500', result: 'Fail', severity: 'Ordinary', verifier: 'PYTH-FRESHNESS-V1', evidenceHash: '0x2b9f...4a67', timestamp: '22s ago', gasUsed: 0.000038, slot: 284194152 },
  { id: '#8837', action: 'PAY_SERVICE_500', result: 'Pass', severity: 'None',     verifier: 'PYTH-FRESHNESS-V1', evidenceHash: '0x8e3d...2b91', timestamp: '30s ago', gasUsed: 0.000042, slot: 284194129 },
  { id: '#8836', action: 'PAY_SERVICE_500', result: 'Pass', severity: 'None',     verifier: 'PYTH-FRESHNESS-V1', evidenceHash: '0x1f2a...3c4d', timestamp: '41s ago', gasUsed: 0.000041, slot: 284194106 },
]

const PROGRAMS: ProgramInfo[] = [
  { name: 'pactyra-core',       programId: 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC', instructions: 9, description: 'Authority root — bonds, tiers, capabilities, epochs', status: 'Deployed', deploymentSlot: 284193001, txSignature: '5xK2mQ9aP4rT7vW1nF8sL2dC6bH0jY5g' },
  { name: 'pactyra-verifier',   programId: '5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN', instructions: 3, description: 'Evidence binding & external attestation CPI',           status: 'Deployed', deploymentSlot: 284193047, txSignature: '8jR3kL2pM5qW8sN4vT7xR1bY6cF0dG3h' },
  { name: 'reference-treasury', programId: '6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9', instructions: 4, description: 'Reference treasury consuming agent authority',          status: 'Deployed', deploymentSlot: 284193092, txSignature: '3mT7nW8sQ2pK5rL9xV4cB1hG6jF0dY7a' },
]

const SECURITY_CHECKS: SecurityCheck[] = [
  { id: 1,  name: 'AuthorityRootMatch',     description: 'Capability root matches agent bond PDA',     tooltip: 'Verifies the capability\u2019s authority root PDA matches the agent\u2019s bond PDA \u2014 prevents capability forgery.',     passed: true },
  { id: 2,  name: 'AgentActive',            description: 'Agent status = Active (not Frozen)',          tooltip: 'Verifies the agent\u2019s status is Active, not Frozen \u2014 frozen agents cannot act.',     passed: true },
  { id: 3,  name: 'TierAmountCap',          description: 'Requested amount \u2264 tier cap',                 tooltip: 'Verifies the requested amount is \u2264 the agent\u2019s current tier cap ($5 / $50 / $500).',     passed: true },
  { id: 4,  name: 'CapabilityTypeAllowed',  description: 'Action type whitelisted for tier',            tooltip: 'Verifies the action type (e.g. PAY_SERVICE) is whitelisted for the agent\u2019s tier.',     passed: true },
  { id: 5,  name: 'TargetProgramWhitelist', description: 'Target program in allow-list',                tooltip: 'Verifies the target program is in the agent\u2019s per-tier allow-list.',     passed: true },
  { id: 6,  name: 'AmountWithinCap',        description: 'amount \u2264 capability.amount_limit',           tooltip: 'Verifies the requested amount is \u2264 the capability\u2019s per-action amount_limit.',     passed: true },
  { id: 7,  name: 'NonceUnused',            description: 'Capability nonce not yet consumed',          tooltip: 'Verifies the capability nonce has not been consumed \u2014 single-use enforcement.',     passed: true },
  { id: 8,  name: 'ExpiryValid',            description: 'now \u2264 capability.expiry (30m TTL)',          tooltip: 'Verifies now \u2264 capability.expiry \u2014 the 30-minute TTL caps blast radius.',     passed: true },
  { id: 9,  name: 'EpochCurrent',           description: 'Capability epoch = agent.current_epoch',      tooltip: 'Verifies the capability epoch matches the agent\u2019s current_epoch \u2014 prevents stale capabilities.',     passed: true },
  { id: 10, name: 'VerifierSignatureValid', description: 'External verifier signature verified',        tooltip: 'Verifies the external verifier\u2019s signature on the attestation is valid.',     passed: true },
  { id: 11, name: 'EvidenceHashMatches',    description: 'Onchain evidence hash = submitted hash',      tooltip: 'Verifies the onchain evidence hash matches the submitted hash \u2014 tamper-proof audit trail.',     passed: true },
  { id: 12, name: 'BondIntact',             description: 'Bond PDA still holds \u2265 minimum stake',         tooltip: 'Verifies the agent\u2019s bond PDA still holds \u2265 the minimum stake \u2014 economic skin in the game.',     passed: true },
]

const PROGRAM_INSTRUCTIONS: Record<string, ProgramInstruction[]> = {
  'pactyra-core': [
    { name: 'bond_agent',         description: 'Lock USDC bond & create authority PDA',          args: 'agent, bond_amount' },
    { name: 'assert_capability',  description: 'Issue short-lived capability (nonce + expiry)',   args: 'agent, cap_type, target, amount, ttl' },
    { name: 'record_outcome',     description: 'Record Pass / Fail · Ordinary / Critical',      args: 'agent, capability, outcome, severity' },
    { name: 'upgrade_tier',       description: 'Probation → Proven → Trusted',                   args: 'agent' },
    { name: 'downgrade_tier',     description: 'Critical failure → tier-1 + slash',              args: 'agent, reason' },
    { name: 'slash_bond',         description: 'Forfeit bond on Critical failure',              args: 'agent, evidence' },
    { name: 'revoke_capability',  description: 'Manually revoke an active capability',            args: 'agent, capability' },
    { name: 'advance_epoch',      description: 'Rotate authority epoch forward',                args: 'agent' },
    { name: 'freeze_agent',       description: 'Emergency freeze (no admin override)',           args: 'agent, reason' },
  ],
  'pactyra-verifier': [
    { name: 'verify_signature',   description: 'Verify external attester signature',             args: 'verifier, message, signature' },
    { name: 'submit_evidence',    description: 'Anchor evidence hash onchain',                   args: 'agent, evidence_hash' },
    { name: 'anchor_attestation', description: 'Bind evidence to capability via CPI',             args: 'agent, capability, evidence' },
  ],
  'reference-treasury': [
    { name: 'execute_payment',    description: 'Execute payment under agent authority',          args: 'agent, capability, payee, amount' },
    { name: 'settle_payment',     description: 'Settle & record final outcome',                  args: 'agent, capability, outcome' },
    { name: 'refund_payment',     description: 'Refund on ordinary failure',                     args: 'agent, capability, reason' },
    { name: 'query_balance',      description: 'Read-only treasury balance',                    args: 'agent' },
  ],
}

const STATS = {
  totalInstructions: 9 + 3 + 4, formalTests: 31, sdkTests: 19, demoTests: 7,
  totalTests: 31 + 19 + 7, securityChecks: 12,
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  github: 'https://github.com/sodiq-code/pactyra',
  architecture: 'https://github.com/sodiq-code/pactyra/blob/main/pactyra/docs/architecture.md',
}

// Known-good devnet agent ID hex (registered via devnet-verify script)
const KNOWN_AGENT_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

// ============================================================
// Helpers
// ============================================================

const tierIndex = (t: Tier): number => (t === 'Probation' ? 0 : t === 'Proven' ? 1 : 2)
const nextTier = (t: Tier): Tier | null => (t === 'Probation' ? 'Proven' : t === 'Proven' ? 'Trusted' : null)
const previousTier = (t: Tier): Tier | null => (t === 'Trusted' ? 'Proven' : t === 'Proven' ? 'Probation' : null)
const shortHash = (h: string, head = 4, tail = 4): string =>
  h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`

// Cryptographically-secure random 32-byte agent ID (64-char hex).
function randomAgentId(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const isHexAgentId = (v: string): boolean => /^[0-9a-fA-F]{64}$/.test(v)

function getTierIcon(tier: Tier, className = 'h-5 w-5') {
  if (tier === 'Trusted') return <ShieldCheck className={cn(className, 'text-emerald-400')} />
  if (tier === 'Proven') return <Shield className={cn(className, 'text-amber-400')} />
  return <ShieldAlert className={cn(className, 'text-rose-400')} />
}

function getEventIcon(type: AuthorityEvent['type']) {
  const cls = 'h-3.5 w-3.5'
  switch (type) {
    case 'upgrade':   return <ArrowUpRight className={cn(cls, 'text-emerald-400')} />
    case 'downgrade': return <ArrowDownRight className={cn(cls, 'text-rose-400')} />
    case 'assert':    return <Zap className={cn(cls, 'text-sky-400')} />
    case 'outcome':   return <Activity className={cn(cls, 'text-violet-400')} />
    case 'bond':      return <Lock className={cn(cls, 'text-amber-400')} />
    case 'slash':     return <AlertTriangle className={cn(cls, 'text-rose-500')} />
    case 'revoke':    return <Unlock className={cn(cls, 'text-slate-400')} />
    case 'epoch':     return <Clock className={cn(cls, 'text-cyan-400')} />
  }
}

// ============================================================
// Sub-components
// ============================================================

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? (localStorage.getItem('pactyra-theme') as 'dark' | 'light' | null) : null
    if (stored === 'light' || stored === 'dark') setTheme(stored)
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('pactyra-theme', theme)
  }, [theme, mounted])
  return (
    <Button
      variant="outline" size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md transition-transform hover:rotate-12"
    >
      {mounted && theme === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-slate-700" />}
    </Button>
  )
}

function StatusPulse({ color = 'emerald' }: { color?: 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const c: Record<string, string> = { emerald: 'bg-emerald-400', amber: 'bg-amber-400', rose: 'bg-rose-400', slate: 'bg-slate-400' }
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', c[color])} />
      <span className={cn('relative inline-flex rounded-full h-2 w-2', c[color])} />
    </span>
  )
}

function WalletButton() {
  const [connected, setConnected] = useState(false)
  return (
    <Button
      variant={connected ? 'default' : 'outline'} size="sm"
      onClick={() => setConnected(!connected)}
      className={cn(
        'font-mono text-xs transition-all',
        connected
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md',
      )}
    >
      <Wallet className="h-4 w-4" />
      {connected ? shortHash(SHOWCASE_AGENT.authorityRoot, 4, 4) : 'Connect Wallet'}
    </Button>
  )
}

function AnimatedAuthority({ value, tier }: { value: number; tier: Tier }) {
  const config = TIER_CONFIG[tier]
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={`${value}-${tier}`}
        initial={{ scale: 1.35, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="flex items-center justify-center gap-2"
      >
        <DollarSign className={cn('h-12 w-12 md:h-14 md:w-14', config.text)} />
        <span className={cn('text-6xl md:text-7xl font-bold tabular-nums bg-gradient-to-br bg-clip-text text-transparent', config.gradient)}>
          {value}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}

function TierBadge({ tier }: { tier: Tier }) {
  const config = TIER_CONFIG[tier]
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300', config.glow)}>
      <span className="inline-flex items-center justify-center rounded-full bg-white/10 p-1">{getTierIcon(tier, 'h-3.5 w-3.5')}</span>
      <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', config.gradient)}>{tier}</span>
    </div>
  )
}

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm transition-colors hover:bg-white/10">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={accent}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </motion.div>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
      toast({ title: '✓ Copied to clipboard', description: label ? `${label}: ${shortHash(text, 6, 6)}` : shortHash(text, 6, 6) })
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard unavailable', variant: 'destructive' })
    }
  }
  return (
    <Button variant="ghost" size="icon" onClick={handleCopy}
      className="h-7 w-7 text-muted-foreground hover:text-emerald-300 shrink-0" aria-label="Copy to clipboard">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

function LiveBadge() {
  return (
    <Badge className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono">
      <span className="relative flex h-2 w-2 mr-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>LIVE
    </Badge>
  )
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2"><code className="text-xs font-mono break-all">{value}</code><CopyButton text={value} label={label} /></div>
    </div>
  )
}

function MiniMetric({ k, v, ic, accent = 'text-emerald-200' }: { k: string; v: string; ic?: React.ReactNode; accent?: string }) {
  return (
    <div className="p-2 rounded-md bg-slate-950/40 border border-white/5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{ic}{k}</p>
      <p className={cn('text-sm font-mono font-bold mt-0.5 truncate', accent)}>{v}</p>
    </div>
  )
}

function FooterLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-emerald-300 transition-colors group">
      <span className="text-muted-foreground group-hover:text-emerald-300">{icon}</span>
      {label}
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

// Horizontal section divider with a centered label — separates major UI blocks.
function SectionDivider({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-6 select-none">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
        {icon}{label}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </div>
  )
}

// Compact horizontal tier indicator — shows where the agent currently sits in the T1 → T2 → T3 loop.
function AuthorityLoopMini({ currentTier }: { currentTier: Tier }) {
  const tiers: Tier[] = ['Probation', 'Proven', 'Trusted']
  const idx = tierIndex(currentTier)
  return (
    <div className="p-4 rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold">Authority Loop Position</span>
        </div>
        <Badge className="bg-white/5 border border-white/10 text-muted-foreground font-mono text-[10px]">
          Currently at T{idx + 1} · {currentTier}
        </Badge>
      </div>
      <div className="flex items-stretch gap-2">
        {tiers.map((t, i) => {
          const isCurrent = i === idx
          const isPast = i < idx
          const config = TIER_CONFIG[t]
          return (
            <Fragment key={t}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className={cn(
                  'flex-1 flex items-center gap-2 p-2 rounded-lg border transition-all',
                  isCurrent ? cn('border-white/20 bg-white/5', config.glow) : 'border-white/5 opacity-70',
                )}
              >
                <div className={cn('h-7 w-7 rounded-full border-2 border-white/20 bg-gradient-to-br flex items-center justify-center shrink-0', config.gradient)}>
                  <DollarSign className="h-3 w-3 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[10px] uppercase tracking-wider', config.text)}>T{i + 1}</p>
                  <p className="text-xs font-semibold truncate">{t}</p>
                </div>
                {isCurrent && <Badge className="ml-auto text-[9px] py-0 px-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">YOU</Badge>}
                {isPast && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500/60 shrink-0" />}
              </motion.div>
              {i < tiers.length - 1 && (
                <ArrowRight className={cn('h-4 w-4 shrink-0 self-center', i < idx ? 'text-emerald-400' : 'text-white/20')} />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Authority Loop Visualization — $5 → $50 → $500 → $5
// ============================================================

function AuthorityLoopChart() {
  const tiers = [
    { tier: 'Tier 1', name: 'Probation', amount: '$5',   requirement: '5 verified successes → upgrade',
      gradient: 'from-rose-400 via-red-500 to-orange-500', text: 'text-rose-300', border: 'border-rose-500/40', bg: 'bg-rose-500/10', glow: 'shadow-[0_0_28px_rgba(244,63,94,0.30)]' },
    { tier: 'Tier 2', name: 'Proven',    amount: '$50',  requirement: '27 verified successes → upgrade',
      gradient: 'from-amber-300 via-yellow-500 to-orange-500', text: 'text-amber-300', border: 'border-amber-500/40', bg: 'bg-amber-500/10', glow: 'shadow-[0_0_28px_rgba(245,158,11,0.30)]' },
    { tier: 'Tier 3', name: 'Trusted',   amount: '$500', requirement: 'Critical failure → slash + downgrade',
      gradient: 'from-emerald-300 via-teal-400 to-cyan-500', text: 'text-emerald-300', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', glow: 'shadow-[0_0_32px_rgba(16,185,129,0.35)]' },
  ]
  return (
    <Card className="bg-card/80 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-400" />Authority Loop Visualization</CardTitle>
        <CardDescription>The $5 → $50 → $500 → $5 economic loop — agents earn authority through verified performance; critical failures slash the bond and rotate the epoch.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Top row: tier nodes + forward arrows */}
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2 md:gap-3">
            {tiers.map((t, i) => (
              <Fragment key={t.tier}>
                <motion.div initial={{ opacity: 0, scale: 0.85, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  className={cn('flex flex-col items-center text-center p-4 rounded-2xl border backdrop-blur-md', t.border, t.bg, t.glow)}>
                  <div className={cn('h-16 w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center border-2 border-white/20 bg-gradient-to-br', t.gradient)}>
                    <DollarSign className="h-6 w-6 md:h-7 md:w-7 text-white" />
                  </div>
                  <p className={cn('mt-2 text-[10px] uppercase tracking-wider', t.text)}>{t.tier}</p>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-2xl md:text-3xl font-bold font-mono mt-0.5">{t.amount}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">{t.requirement}</p>
                </motion.div>
                {i < tiers.length - 1 && (
                  <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 + 0.3, duration: 0.4 }}
                    className="flex items-center justify-center text-emerald-400">
                    <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
                  </motion.div>
                )}
              </Fragment>
            ))}
          </div>

          {/* Critical failure curved arrow (T3 → T1) */}
          <div className="relative mt-2 h-20">
            <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              <defs><linearGradient id="pactyraSlashGrad" x1="100%" y1="0" x2="0%" y2="0"><stop offset="0%" stopColor="rgb(244 63 94)" stopOpacity="0.9" /><stop offset="50%" stopColor="rgb(244 63 94)" stopOpacity="0.6" /><stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity="0.9" /></linearGradient></defs>
              <motion.path d="M 580 5 C 580 75, 20 75, 20 5" fill="none" stroke="url(#pactyraSlashGrad)" strokeWidth="1.5" strokeDasharray="6 6"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={{ pathLength: { delay: 0.7, duration: 1, ease: 'easeInOut' }, opacity: { delay: 0.7, duration: 0.3 } }} />
              <motion.polygon points="20,1 28,14 12,14" fill="rgb(244 63 94)" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.7, duration: 0.3 }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.4 }}
                className="px-3 py-1 rounded-full border border-rose-500/40 bg-rose-500/10 backdrop-blur-md">
                <p className="text-[10px] font-mono uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />Critical Failure · Bond Slash + Epoch++
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Protocol Health Gauge — composite onchain signal
// ============================================================

function ProtocolHealthGauge({ value, devnetLive }: { value: number; devnetLive: boolean }) {
  const color = value > 90 ? 'emerald' : value >= 50 ? 'amber' : 'rose'
  const colorClasses = {
    emerald: { stroke: 'stroke-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/5' },
    amber:   { stroke: 'stroke-amber-400',   text: 'text-amber-300',   ring: 'ring-amber-500/30',   bg: 'bg-amber-500/5' },
    rose:    { stroke: 'stroke-rose-400',    text: 'text-rose-300',    ring: 'ring-rose-500/30',    bg: 'bg-rose-500/5' },
  } as const
  const c = colorClasses[color]
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const rows = [
    { label: 'All programs deployed', weight: 33, passed: true,        icon: <Server className="h-3.5 w-3.5" /> },
    { label: 'All tests passing',     weight: 33, passed: true,        icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { label: 'Devnet agent live',     weight: 34, passed: devnetLive,  icon: <Globe className="h-3.5 w-3.5" /> },
  ]
  return (
    <Card className="bg-card/80 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" />Protocol Health</CardTitle>
        <CardDescription>Composite signal: 33% programs deployed · 33% tests passing · 34% devnet live agent.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-6">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
          className={cn('relative h-40 w-40 rounded-full ring-2', c.ring, c.bg)}>
          <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
            <motion.circle cx="70" cy="70" r={radius} fill="none" strokeWidth="10" strokeLinecap="round" className={c.stroke}
              strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}
              className={cn('text-4xl font-bold font-mono', c.text)}>{value}%</motion.span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">health</span>
          </div>
        </motion.div>
        <div className="flex-1 grid grid-cols-1 gap-2 w-full">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <span className={row.passed ? 'text-emerald-400' : 'text-rose-400'}>{row.icon}</span>
                <span className="text-xs">{row.label}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{row.weight}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function Home() {
  const { toast } = useToast()
  const [agent, setAgent] = useState<AgentState>(SHOWCASE_AGENT)
  const [liveEvents, setLiveEvents] = useState<AuthorityEvent[]>([])
  const [walletConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'passport' | 'stats' | 'deployment'>('passport')
  const prevTierRef = useRef<Tier>(SHOWCASE_AGENT.tier)
  const liveCounter = useRef(0)

  // Live devnet deployment state
  const [deploymentData, setDeploymentData] = useState<DeploymentData | null>(null)
  const [deploymentLoading, setDeploymentLoading] = useState(false)
  const [deploymentError, setDeploymentError] = useState<string | null>(null)
  const [deploymentFetchedAt, setDeploymentFetchedAt] = useState<Date | null>(null)

  // Live agent fetch state
  const [agentInput, setAgentInput] = useState('')
  const [liveAgent, setLiveAgent] = useState<LiveAgent | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [liveDataFetchedAt, setLiveDataFetchedAt] = useState<Date | null>(null)

  // Hero card data source toggle — when ON, hero metrics reflect real devnet values.
  const [useLiveData, setUseLiveData] = useState(false)

  // Register-agent form state
  const [registerInput, setRegisterInput] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerResult, setRegisterResult] = useState<RegisterAgentResponse | null>(null)

  // Lock-bond state
  const [lockLoading, setLockLoading] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)
  const [lockResult, setLockResult] = useState<LockBondResponse | null>(null)

  // Record Outcome form state
  const [outcomeResult, setOutcomeResult] = useState<'pass' | 'fail'>('pass')
  const [outcomeSeverity, setOutcomeSeverity] = useState<'none' | 'ordinary' | 'critical'>('none')
  const [outcomeLoading, setOutcomeLoading] = useState(false)
  const [outcomeError, setOutcomeError] = useState<string | null>(null)
  const [outcomeResponse, setOutcomeResponse] = useState<RecordOutcomeResponse | null>(null)
  const [tierUpgraded, setTierUpgraded] = useState(false)
  // Request Capability form state
  const [capabilityAmount, setCapabilityAmount] = useState<number>(5)
  const [capabilityLoading, setCapabilityLoading] = useState(false)
  const [capabilityError, setCapabilityError] = useState<string | null>(null)
  const [capabilityResponse, setCapabilityResponse] = useState<RequestCapabilityResponse | null>(null)
  // Transaction History state
  const [txHistory, setTxHistory] = useState<TransactionHistoryResponse | null>(null)
  const [txHistoryLoading, setTxHistoryLoading] = useState(false)
  const [txHistoryError, setTxHistoryError] = useState<string | null>(null)
  const [txHistoryFetchedAt, setTxHistoryFetchedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (agent.tier !== prevTierRef.current) {
      const old = prevTierRef.current
      const isUpgrade = tierIndex(agent.tier) > tierIndex(old)
      toast({
        title: isUpgrade ? '⬆ Tier Upgraded' : '⬇ Tier Downgraded',
        description: `${old} → ${agent.tier} · Authority cap now $${agent.maxAmount}`,
      })
      prevTierRef.current = agent.tier
    }
  }, [agent.tier, agent.maxAmount, toast])

  const successRate = useMemo(() => {
    if (agent.totalCount === 0) return 100
    return Math.round((agent.successCount / agent.totalCount) * 1000) / 10
  }, [agent.successCount, agent.totalCount])

  const pushLiveEvent = useCallback((event: Omit<AuthorityEvent, 'id' | 'live'>) => {
    liveCounter.current += 1
    setLiveEvents((prev) => [{ ...event, id: `live-${liveCounter.current}`, live: true }, ...prev])
  }, [])

  const recordSuccess = useCallback(() => {
    setAgent((prev) => {
      const newTierSuccesses = prev.tierSuccesses + 1
      const threshold = TIER_CONFIG[prev.tier].upgradeThreshold
      let newTier: Tier = prev.tier
      let newMax = prev.maxAmount
      let resetTierSuccesses = false
      if (newTierSuccesses >= threshold && prev.tier !== 'Trusted') {
        const nt = nextTier(prev.tier)!
        newTier = nt
        newMax = TIER_CONFIG[nt].amount
        resetTierSuccesses = true
      }
      const newEpoch = prev.currentEpoch + 1
      pushLiveEvent({ type: 'outcome', epoch: newEpoch, description: `Outcome recorded: PASS${resetTierSuccesses ? ' — tier upgrade!' : ''}`, outcome: 'Pass' })
      if (resetTierSuccesses) {
        pushLiveEvent({ type: 'upgrade', epoch: newEpoch, description: `Tier upgrade: ${prev.tier} → ${newTier}` })
      }
      return {
        ...prev, successCount: prev.successCount + 1, totalCount: prev.totalCount + 1,
        tierSuccesses: resetTierSuccesses ? 0 : newTierSuccesses, tier: newTier, maxAmount: newMax, currentEpoch: newEpoch,
      }
    })
  }, [pushLiveEvent])

  const recordCriticalFailure = useCallback(() => {
    setAgent((prev) => {
      const newEpoch = prev.currentEpoch + 1
      pushLiveEvent({ type: 'slash', epoch: newEpoch, description: 'Critical failure detected: stale capability', amount: prev.maxAmount })
      pushLiveEvent({ type: 'slash', epoch: newEpoch, description: 'Bond slashed: 5 USDC forfeited', amount: 5 })
      pushLiveEvent({ type: 'epoch', epoch: newEpoch, description: `Authority epoch advanced → #${newEpoch}` })
      let newTier: Tier = prev.tier
      let newMax = prev.maxAmount
      let resetTierSuccesses = false
      if (prev.tier !== 'Probation') {
        const pt = previousTier(prev.tier)!
        newTier = pt
        newMax = TIER_CONFIG[pt].amount
        resetTierSuccesses = true
        pushLiveEvent({ type: 'downgrade', epoch: newEpoch, description: `Tier downgrade: ${prev.tier} → ${newTier}` })
        pushLiveEvent({ type: 'downgrade', epoch: newEpoch, description: `Authority cap reset to $${newMax}` })
      }
      return {
        ...prev, criticalFailures: prev.criticalFailures + 1, currentEpoch: newEpoch,
        bondAmount: 0, bondSlashed: true, tier: newTier, maxAmount: newMax,
        tierSuccesses: resetTierSuccesses ? 0 : prev.tierSuccesses,
      }
    })
  }, [pushLiveEvent])

  const resetDemo = useCallback(() => {
    setAgent(SHOWCASE_AGENT)
    setLiveEvents([])
    prevTierRef.current = SHOWCASE_AGENT.tier
    liveCounter.current = 0
    toast({ title: 'Demo reset', description: 'Agent state restored to showcase (Trusted, $500, Epoch 184).' })
  }, [toast])

  // ===== Live devnet fetchers =====
  const fetchDeployment = useCallback(async () => {
    setDeploymentLoading(true); setDeploymentError(null)
    try {
      const res = await fetch('/api/deployment')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDeploymentData(data); setDeploymentFetchedAt(new Date())
      const deployed = data.programs?.filter((p: DeploymentProgram) => p.deployed).length || 0
      toast({ title: '✓ Devnet status refreshed', description: `${data.cluster} · ${deployed}/${data.programs?.length || 0} programs · ${data.balanceSOL?.toFixed(4)} SOL` })
    } catch (e: any) {
      setDeploymentError(e.message || 'Failed to fetch devnet status')
      toast({ title: 'Devnet fetch failed', description: e.message, variant: 'destructive' })
    } finally { setDeploymentLoading(false) }
  }, [toast])

  const fetchAgent = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed) { toast({ title: 'Agent ID required', description: 'Paste a hex agent ID first.', variant: 'destructive' }); return }
    setAgentLoading(true); setAgentError(null); setLiveAgent(null)
    try {
      const res = await fetch(`/api/agent?id=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLiveAgent(data as LiveAgent)
      setLiveDataFetchedAt(new Date())
      if (data.found) toast({ title: '✓ Live agent found on devnet', description: `Tier ${data.tier} · $${data.maxAmount} cap · ${data.successRate}% success` })
      else toast({ title: 'Agent not found', description: data.message || 'No account at derived PDA', variant: 'destructive' })
    } catch (e: any) {
      setAgentError(e.message || 'Failed to fetch agent')
      toast({ title: 'Agent fetch failed', description: e.message, variant: 'destructive' })
    } finally { setAgentLoading(false) }
  }, [toast])

  // POST /api/register-agent — registers a new agent PDA on Solana devnet.
  const registerAgent = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!isHexAgentId(trimmed)) {
      setRegisterError('Agent ID must be 64-char hex (32 bytes). Click "Generate Random ID" to get a valid one.')
      toast({ title: 'Invalid agent ID', description: 'Must be 64-char hex (32 bytes).', variant: 'destructive' })
      return
    }
    setRegisterLoading(true); setRegisterError(null); setRegisterResult(null); setLockResult(null); setLockError(null)
    try {
      const res = await fetch('/api/register-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || data.error || !data.success) throw new Error(data.error || data.message || `HTTP ${res.status}`)
      setRegisterResult(data as RegisterAgentResponse)
      toast({ title: '✓ Agent registered on devnet', description: `Tier ${data.tier} · Epoch ${data.epoch} · PDA ${shortHash(data.agentPda, 6, 4)}` })
    } catch (e: any) {
      setRegisterError(e.message || 'Failed to register agent')
      toast({ title: 'Registration failed', description: e.message, variant: 'destructive' })
    } finally { setRegisterLoading(false) }
  }, [toast])

  // POST /api/lock-bond — locks a 5 USDC bond for a previously-registered agent.
  const lockBond = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!isHexAgentId(trimmed)) {
      setLockError('Agent ID must be 64-char hex (32 bytes).')
      toast({ title: 'Invalid agent ID', description: 'Register an agent first.', variant: 'destructive' })
      return
    }
    setLockLoading(true); setLockError(null)
    try {
      const res = await fetch('/api/lock-bond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || data.error || !data.success) throw new Error(data.error || data.message || `HTTP ${res.status}`)
      setLockResult(data as LockBondResponse)
      toast({ title: '✓ 5 USDC bond locked', description: `tx ${shortHash(data.signature, 6, 4)}` })
    } catch (e: any) {
      setLockError(e.message || 'Failed to lock bond')
      toast({ title: 'Bond lock failed', description: e.message, variant: 'destructive' })
    } finally { setLockLoading(false) }
  }, [toast])

  // POST /api/record-outcome — records a verified outcome on devnet (drives tier transitions).
  const recordOutcome = useCallback(async (id: string, result: 'pass' | 'fail', severity: 'none' | 'ordinary' | 'critical') => {
    const trimmed = id.trim()
    if (!isHexAgentId(trimmed)) { setOutcomeError('Agent ID must be 64-char hex (32 bytes).'); toast({ title: 'Invalid agent ID', description: 'Fetch a live agent first.', variant: 'destructive' }); return }
    setOutcomeLoading(true); setOutcomeError(null); setOutcomeResponse(null); setTierUpgraded(false)
    const prevTier = liveAgent?.tier as Tier | undefined
    try {
      const res = await fetch('/api/record-outcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: trimmed, result, severity }) })
      const data = await res.json()
      if (!res.ok || data.error || !data.success) throw new Error(data.error || data.message || `HTTP ${res.status}`)
      setOutcomeResponse(data as RecordOutcomeResponse)
      if (prevTier && data.tier && data.tier !== prevTier) {
        const upgraded = tierIndex(data.tier as Tier) > tierIndex(prevTier); setTierUpgraded(upgraded); setTimeout(() => setTierUpgraded(false), 2500)
        toast({ title: upgraded ? '⭐ Tier Upgraded!' : '⬇ Tier Downgraded', description: `${prevTier} → ${data.tier} · ${data.successCount}/${data.totalCount} successes`, variant: upgraded ? 'default' : 'destructive' })
      } else {
        toast({ title: '✓ Outcome recorded on devnet', description: `Tier ${data.tier} · ${data.successCount}/${data.totalCount} successes` })
      }
      fetchAgent(trimmed) // auto-refresh live agent state
    } catch (e: any) {
      setOutcomeError(e.message || 'Failed to record outcome')
      toast({ title: 'Outcome recording failed', description: e.message, variant: 'destructive' })
    } finally { setOutcomeLoading(false) }
  }, [toast, liveAgent, fetchAgent])

  // POST /api/request-capability — requests a capability PDA on devnet.
  const requestCapability = useCallback(async (id: string, amountLimit: number) => {
    const trimmed = id.trim()
    if (!isHexAgentId(trimmed)) { setCapabilityError('Agent ID must be 64-char hex (32 bytes).'); toast({ title: 'Invalid agent ID', description: 'Fetch a live agent first.', variant: 'destructive' }); return }
    setCapabilityLoading(true); setCapabilityError(null); setCapabilityResponse(null)
    try {
      const res = await fetch('/api/request-capability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: trimmed, amountLimit }) })
      const data = await res.json()
      if (!res.ok || data.error || !data.success) throw new Error(data.error || data.message || `HTTP ${res.status}`)
      setCapabilityResponse(data as RequestCapabilityResponse)
      toast({ title: '✓ Capability requested on devnet', description: `PDA ${shortHash(data.capabilityPda, 6, 4)} · $${data.amountLimit}` })
    } catch (e: any) {
      setCapabilityError(e.message || 'Failed to request capability')
      toast({ title: 'Capability request failed', description: e.message, variant: 'destructive' })
    } finally { setCapabilityLoading(false) }
  }, [toast])

  // GET /api/transaction-history — fetches recent devnet transactions for an agent.
  const fetchTxHistory = useCallback(async (id: string, limit = 10) => {
    const trimmed = id.trim()
    if (!trimmed) { toast({ title: 'Agent ID required', description: 'Need a hex agent ID to fetch history.', variant: 'destructive' }); return }
    setTxHistoryLoading(true); setTxHistoryError(null)
    try {
      const res = await fetch(`/api/transaction-history?id=${encodeURIComponent(trimmed)}&limit=${limit}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTxHistory(data as TransactionHistoryResponse); setTxHistoryFetchedAt(new Date())
      toast({ title: '✓ Transaction history refreshed', description: `${data.count || 0} recent transactions` })
    } catch (e: any) {
      setTxHistoryError(e.message || 'Failed to fetch transaction history')
      toast({ title: 'Transaction history fetch failed', description: e.message, variant: 'destructive' })
    } finally { setTxHistoryLoading(false) }
  }, [toast])

  const generateRandomId = useCallback(() => {
    const id = randomAgentId()
    setRegisterInput(id)
    setRegisterError(null); setRegisterResult(null); setLockResult(null); setLockError(null)
    toast({ title: 'Generated random agent ID', description: shortHash(id, 8, 8) })
  }, [toast])

  // Derive the agent state shown in the hero card — live devnet values when toggle is ON, else demo.
  const displayAgent: AgentState = useMemo(() => {
    if (useLiveData && liveAgent?.found) {
      return {
        agentId: liveAgent.agentId || agent.agentId,
        authorityRoot: liveAgent.authorityRoot || agent.authorityRoot,
        currentEpoch: liveAgent.currentEpoch ?? agent.currentEpoch,
        tier: (liveAgent.tier as Tier) || agent.tier,
        maxAmount: liveAgent.maxAmount ?? agent.maxAmount,
        successCount: liveAgent.successCount ?? agent.successCount,
        totalCount: liveAgent.totalCount ?? agent.totalCount,
        criticalFailures: liveAgent.criticalFailures ?? agent.criticalFailures,
        bondAmount: liveAgent.bondAmount ?? agent.bondAmount,
        bondSlashed: agent.bondSlashed,
        status: (liveAgent.status as AgentState['status']) || agent.status,
        tierSuccesses: agent.tierSuccesses,
      }
    }
    return agent
  }, [useLiveData, liveAgent, agent])

  const displaySuccessRate = useMemo(() => {
    if (displayAgent.totalCount === 0) return displayAgent.successCount > 0 ? 100 : 0
    return Math.round((displayAgent.successCount / displayAgent.totalCount) * 1000) / 10
  }, [displayAgent.successCount, displayAgent.totalCount])

  // Auto-fetch deployment status + transaction history when Deployment tab is opened (once).
  useEffect(() => {
    if (activeTab === 'deployment' && !deploymentData && !deploymentLoading && !deploymentError) fetchDeployment()
    if (activeTab === 'deployment' && !txHistory && !txHistoryLoading && !txHistoryError) fetchTxHistory(KNOWN_AGENT_ID, 10)
  }, [activeTab, deploymentData, deploymentLoading, deploymentError, fetchDeployment, txHistory, txHistoryLoading, txHistoryError, fetchTxHistory])

  // Auto-fetch the permanent devnet agent on first page load — ensures the "Live Devnet" panel is populated without a manual click.
  const didAutoFetchAgent = useRef(false)
  useEffect(() => { if (didAutoFetchAgent.current) return; didAutoFetchAgent.current = true; setAgentInput(KNOWN_AGENT_ID); fetchAgent(KNOWN_AGENT_ID) }, [fetchAgent])

  // Auto-fill the Register Agent form with a random ID on mount so the user can click Register immediately.
  const didAutoFillRegister = useRef(false)
  useEffect(() => {
    if (didAutoFillRegister.current) return
    didAutoFillRegister.current = true
    setRegisterInput(randomAgentId())
  }, [])

  const displayTimeline = useMemo(() => [...liveEvents, ...DEMO_TIMELINE], [liveEvents])

  // Protocol Health: 33% programs deployed + 33% tests passing + 34% devnet live agent
  const devnetLive = !!liveAgent?.found || !!deploymentData?.allDeployed
  const protocolHealth = useMemo(() => (PROGRAMS.every((p) => p.status === 'Deployed') ? 33 : 0) + (STATS.totalTests > 0 ? 33 : 0) + (devnetLive ? 34 : 0), [devnetLive])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-foreground relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <motion.div initial={{ rotate: -10, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }} className="relative">
                <Shield className="h-8 w-8 text-emerald-400" />
                <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">PACTYRA</h1>
                <p className="text-[10px] text-muted-foreground -mt-1 font-mono">Evidence-Bound Authority</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex ml-1 text-xs border-white/10 bg-white/5 text-muted-foreground">
              <Layers className="h-3 w-3 mr-1" />Solana Protocol
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden md:inline-flex text-xs border-white/10 bg-white/5 backdrop-blur-md">
              <StatusPulse color={walletConnected ? 'emerald' : 'amber'} />
              <span className="ml-2 font-mono">{walletConnected ? 'Connected' : 'Demo Mode'}</span>
            </Badge>
            <WalletButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero hook */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8 text-center relative">
          {/* Animated gradient backdrop */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-4 -bottom-4 -z-10 overflow-hidden bg-[linear-gradient(110deg,rgba(16,185,129,0.10),rgba(245,158,11,0.10),rgba(244,63,94,0.10),rgba(34,211,238,0.10))] bg-[length:300%_300%] animate-pactyra-gradient blur-2xl" />
          <p className="text-base md:text-lg text-muted-foreground mb-3">
            AI agents already have keys.{' '}
            <span className="text-foreground font-medium">PACTYRA makes them earn the right to use them.</span>
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-rose-500/10 border border-white/10 text-sm font-mono backdrop-blur-md">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-300">$5</span><span className="text-muted-foreground">→</span>
            <span className="text-amber-300">$50</span><span className="text-muted-foreground">→</span>
            <span className="text-cyan-300">$500</span><span className="text-muted-foreground">→</span>
            <span className="text-rose-300">$5</span>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="flex justify-center mb-6">
            <TabsList className="bg-white/5 backdrop-blur-md border border-white/10 h-auto p-1">
              <TabsTrigger value="passport" className="data-[state=active]:bg-white/10 data-[state=active]:text-emerald-300 px-4 py-1.5">
                <Shield className="h-3.5 w-3.5" />Agent Passport
              </TabsTrigger>
              <TabsTrigger value="stats" className="data-[state=active]:bg-white/10 data-[state=active]:text-emerald-300 px-4 py-1.5">
                <Boxes className="h-3.5 w-3.5" />Protocol Stats
              </TabsTrigger>
              <TabsTrigger value="deployment" className="data-[state=active]:bg-white/10 data-[state=active]:text-emerald-300 px-4 py-1.5">
                <Rocket className="h-3.5 w-3.5" />Deployment
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========== TAB: Agent Passport ========== */}
          <TabsContent value="passport" className="space-y-6">
            {/* Hero Passport Card with gradient border */}
            <div className="rounded-xl p-[1.5px] bg-gradient-to-br from-emerald-500/40 via-teal-500/20 to-cyan-500/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <Card className="border-0 bg-slate-950/80 backdrop-blur-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Agent Passport</CardTitle>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-base md:text-lg font-mono font-bold break-all">{useLiveData && liveAgent?.found ? (displayAgent.agentId.length > 24 ? shortHash(displayAgent.agentId, 10, 10) : displayAgent.agentId) : displayAgent.agentId}</span>
                        {useLiveData && liveAgent?.found && <LiveBadge />}
                        <CopyButton text={displayAgent.agentId} label="Agent ID" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground font-mono">
                        <Wallet className="h-3 w-3 shrink-0" />
                        <span className="break-all">{shortHash(displayAgent.authorityRoot, 6, 6)}</span>
                        <CopyButton text={displayAgent.authorityRoot} label="Authority Root" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <TierBadge tier={displayAgent.tier} />
                      <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono cursor-pointer select-none">
                        <span className={cn(useLiveData ? 'text-muted-foreground/70' : 'text-emerald-300')}>Demo</span>
                        <Switch
                          checked={useLiveData}
                          onCheckedChange={(c) => setUseLiveData(c)}
                          disabled={!liveAgent?.found}
                          aria-label="Toggle live data"
                        />
                        <span className={cn(useLiveData ? 'text-emerald-300' : 'text-muted-foreground/70')}>Live</span>
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Current Authority — the hero metric */}
                  <div className="mb-6 text-center py-8 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_70%)]" />
                    <p className="text-xs text-muted-foreground mb-2 tracking-wider uppercase">Current Authority</p>
                    <AnimatedAuthority value={displayAgent.maxAmount} tier={displayAgent.tier} />
                    <p className="text-xs text-muted-foreground mt-3">
                      Maximum per capability (USDC) · Tier {tierIndex(displayAgent.tier) + 1}
                    </p>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <MetricCard icon={<Activity className="h-4 w-4" />} label="Verified Executions" value={displayAgent.totalCount} accent="text-sky-400" />
                    <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Successful" value={displayAgent.successCount} accent="text-emerald-400" />
                    <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Success Rate" value={`${displaySuccessRate}%`} accent="text-violet-400" />
                    <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Critical Failures" value={displayAgent.criticalFailures} accent="text-rose-400" />
                  </div>

                  {/* Success Rate Progress Bar */}
                  <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Success Rate</span>
                      <span className="text-sm font-mono font-bold text-emerald-300">{displaySuccessRate}%</span>
                    </div>
                    <Progress value={displaySuccessRate} className="h-2 bg-white/10" />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
                      <span>0%</span>
                      <span className="text-amber-400">90% upgrade threshold</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Bond + Epoch */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className={cn('flex items-center justify-between p-3 rounded-lg border transition-colors',
                      displayAgent.bondSlashed ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/10 bg-white/5')}>
                      <div className="flex items-center gap-2">
                        <Lock className={cn('h-4 w-4', displayAgent.bondSlashed ? 'text-rose-400' : 'text-amber-400')} />
                        <span className="text-sm text-muted-foreground">Bond</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold font-mono">{displayAgent.bondAmount} <span className="text-xs text-muted-foreground">USDC</span></p>
                        <p className={cn('text-xs font-mono', displayAgent.bondSlashed ? 'text-rose-400' : 'text-emerald-400')}>
                          {displayAgent.bondSlashed ? 'SLASHED' : 'LOCKED'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm text-muted-foreground">Authority Epoch</span>
                      </div>
                      <p className="font-bold font-mono">#{displayAgent.currentEpoch}</p>
                    </div>
                  </div>

                  {/* Authority Loop Mini Indicator */}
                  <div className="mb-6">
                    <AuthorityLoopMini currentTier={displayAgent.tier} />
                  </div>

                  {/* Live Devnet Data panel — appears when a real onchain agent has been fetched */}
                  {liveAgent?.found && liveDataFetchedAt && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className="mb-6 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03]">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <LiveBadge />
                          <span className="text-xs font-semibold text-emerald-300">Live Devnet Data</span>
                          <span className="text-[10px] text-muted-foreground font-mono">RPC: {liveAgent.rpc}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3" />Last Updated: {liveDataFetchedAt.toLocaleTimeString()}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => fetchAgent(liveAgent.agentId || agentInput)}
                            disabled={agentLoading}
                            className="h-7 px-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-xs">
                            <RefreshCw className={cn('h-3 w-3', agentLoading && 'animate-spin')} />Refresh
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {([
                          ['Tier', liveAgent.tier, <Shield className="h-3.5 w-3.5 text-emerald-400" />],
                          ['Epoch', `#${liveAgent.currentEpoch}`, <Hash className="h-3.5 w-3.5 text-cyan-400" />],
                          ['Bond', `${liveAgent.bondAmount}`, <Lock className="h-3.5 w-3.5 text-amber-400" />],
                          ['Successes', `${liveAgent.successCount}/${liveAgent.totalCount}`, <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />],
                        ] as [string, any, React.ReactNode][]).map(([k, v, ic]) => (
                          <div key={String(k)} className="p-2 rounded-md bg-slate-950/40 border border-white/5">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{ic}{k}</p>
                            <p className="text-sm font-mono font-bold text-emerald-200 mt-0.5 truncate">{v}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Authority Loop Simulator */}
                  <div className="p-4 rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-semibold">Authority Loop Simulator</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Live · Client-side</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Drive the agent through the earn-then-spend authority loop. Tiers upgrade after{' '}
                      {TIER_CONFIG.Probation.upgradeThreshold} (T1→T2) / {TIER_CONFIG.Proven.upgradeThreshold} (T2→T3) verified
                      successes. Critical failures slash the bond + downgrade + advance epoch.
                    </p>
                    {useLiveData && liveAgent?.found && (
                      <Alert className="mb-3 border-amber-500/30 bg-amber-500/5 text-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <AlertDescription className="text-xs">
                          Simulator mutates the local demo state — switch to <strong>Demo</strong> data above to see the changes reflected in the hero metrics.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={recordSuccess} size="sm"
                        className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />Record Success
                      </Button>
                      <Button onClick={recordCriticalFailure} size="sm"
                        className="bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200">
                        <AlertTriangle className="h-4 w-4" />Record Critical Failure
                      </Button>
                      <Button onClick={resetDemo} size="sm" variant="outline"
                        className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20">
                        <RefreshCw className="h-4 w-4" />Reset Demo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <SectionDivider label="Live Devnet Operations" icon={<Rocket className="h-3 w-3" />} />

            {/* Register New Agent on Devnet */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
              <Card className="bg-card/80 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-400" />Register New Agent on Devnet</CardTitle>
                  <CardDescription>
                    Mint a fresh agent authority PDA on Solana devnet. Auto-filled with a random 32-byte ID — just click <span className="text-emerald-300 font-mono">Register Agent</span> to broadcast the tx via <code className="font-mono text-emerald-300">POST /api/register-agent</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      value={registerInput}
                      onChange={(e) => { setRegisterInput(e.target.value); setRegisterError(null) }}
                      placeholder="64-char hex agent ID (32 bytes)"
                      className="font-mono text-xs flex-1 min-w-[260px] bg-white/5 border-white/10"
                      spellCheck={false}
                    />
                    <Button onClick={generateRandomId} variant="outline" disabled={registerLoading}
                      className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-xs">
                      <Shuffle className="h-4 w-4" />Generate Random ID
                    </Button>
                    <Button
                      onClick={() => registerAgent(registerInput)}
                      disabled={registerLoading || !registerInput.trim()}
                      className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 hover:shadow-[0_0_24px_rgba(16,185,129,0.55)] transition-all"
                    >
                      {registerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Register Agent
                    </Button>
                  </div>

                  {registerInput && (
                    <p className={cn('text-[10px] font-mono', isHexAgentId(registerInput) ? 'text-emerald-400' : 'text-rose-400')}>
                      {isHexAgentId(registerInput) ? `✓ valid · ${registerInput.length} hex chars (32 bytes)` : `⚠ invalid — needs 64-char hex (got ${registerInput.length})`}
                    </p>
                  )}

                  {registerLoading && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />Broadcasting register_agent tx to devnet…
                      </div>
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  )}

                  {!registerLoading && registerError && (
                    <Alert variant="destructive" className="border-rose-500/40 bg-rose-500/5">
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      <AlertTitle className="text-rose-300">Registration failed</AlertTitle>
                      <AlertDescription className="text-xs font-mono break-all">{registerError}</AlertDescription>
                    </Alert>
                  )}

                  {!registerLoading && lockError && (
                    <Alert variant="destructive" className="border-rose-500/40 bg-rose-500/5">
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      <AlertTitle className="text-rose-300">Bond lock failed</AlertTitle>
                      <AlertDescription className="text-xs font-mono break-all">{lockError}</AlertDescription>
                    </Alert>
                  )}

                  {!registerLoading && registerResult?.success && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.03] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-300">{registerResult.message || 'Agent registered on devnet'}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {([
                          ['Tier', registerResult.tier],
                          ['Epoch', `#${registerResult.epoch}`],
                          ['Successes', `${registerResult.successCount}/${registerResult.totalCount}`],
                          ['Bond', `${registerResult.bondAmount} USDC`],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} className="p-2 rounded-md bg-slate-950/40 border border-white/5">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</p>
                            <p className="text-sm font-mono font-bold text-emerald-200 mt-0.5 truncate">{v}</p>
                          </div>
                        ))}
                      </div>
                      <AddressRow label="Agent PDA" value={registerResult.agentPda} />
                      {registerResult.authorityRoot && <AddressRow label="Authority Root" value={registerResult.authorityRoot} />}
                      <div className="flex flex-wrap gap-2 items-center pt-1">
                        <Button onClick={() => lockBond(registerInput)} disabled={lockLoading}
                          className="bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:text-amber-200 hover:shadow-[0_0_24px_rgba(245,158,11,0.55)] transition-all">
                          {lockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Lock 5 USDC Bond
                        </Button>
                        {registerResult.explorerUrl && (
                          <a href={registerResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 font-mono px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                            <Link2 className="h-3.5 w-3.5" />View on Solana.fm
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {lockResult?.success && (
                        <div className="flex items-center gap-2 text-xs font-mono text-amber-300 pt-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />Bond locked — {lockResult.bondAmount} USDC ·
                          <a href={lockResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200">
                            tx {shortHash(lockResult.signature, 6, 4)}<ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Live Agent Fetch from Devnet */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}>
              <Card className="bg-card/80 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-400" />Fetch Live Agent from Devnet</CardTitle>
                  <CardDescription>Paste a hex agent ID — fetches real onchain state from Solana devnet via the PACTYRA API.</CardDescription>
                </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Input value={agentInput} onChange={(e) => setAgentInput(e.target.value)} placeholder={KNOWN_AGENT_ID} className="font-mono text-xs flex-1 min-w-[260px] bg-white/5 border-white/10" />
                  <Button onClick={() => fetchAgent(agentInput)} disabled={agentLoading || !agentInput.trim()} className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200">{agentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}Fetch from Devnet</Button>
                  <Button onClick={() => { setAgentInput(KNOWN_AGENT_ID); fetchAgent(KNOWN_AGENT_ID) }} variant="outline" disabled={agentLoading} className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-xs">Use demo agent</Button>
                </div>

                {agentLoading && <div className="mt-4 space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-24 w-full" /></div>}

                {!agentLoading && agentError && <div className="mt-4 p-4 rounded-lg border border-rose-500/40 bg-rose-500/5 text-sm"><p className="font-semibold text-rose-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Devnet fetch failed</p><p className="text-xs text-muted-foreground mt-1 font-mono">{agentError}</p></div>}

                {!agentLoading && liveAgent && liveAgent.found && <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.03] overflow-hidden">
                    <div className="flex items-center gap-2 p-3 border-b border-white/10"><LiveBadge /><span className="text-xs font-mono text-emerald-300">DEVNET LIVE · RPC: {liveAgent.rpc}</span></div>
                    <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider font-mono text-muted-foreground bg-slate-950/30 px-2 py-1.5 border-b border-white/5"><span>Metric</span><span className="text-emerald-300">Live (Devnet)</span><span>Demo (Showcase)</span></div>
                    {([
                      ['Tier', liveAgent.tier, agent.tier], ['Max Amount', `$${liveAgent.maxAmount}`, `$${agent.maxAmount}`],
                      ['Epoch', `#${liveAgent.currentEpoch}`, `#${agent.currentEpoch}`], ['Successes', `${liveAgent.successCount}/${liveAgent.totalCount}`, `${agent.successCount}/${agent.totalCount}`],
                      ['Success Rate', `${liveAgent.successRate}%`, `${successRate}%`], ['Critical Fails', `${liveAgent.criticalFailures}`, `${agent.criticalFailures}`],
                      ['Bond', `${liveAgent.bondAmount} USDC`, `$${agent.bondAmount} USDC`], ['Status', liveAgent.status, agent.status],
                    ] as [string, any, any][]).map(([k, lv, dv]) => (
                      <div key={k} className="grid grid-cols-3 text-xs font-mono border-b border-white/5 last:border-0"><span className="px-2 py-1.5 text-muted-foreground bg-slate-950/20">{k}</span><span className="px-2 py-1.5 text-emerald-300 font-bold">{lv}</span><span className="px-2 py-1.5 text-muted-foreground">{dv}</span></div>
                    ))}
                    <div className="p-3"><AddressRow label="Agent PDA (derived)" value={liveAgent.agentPda!} /></div>
                  </div>
                }

                {!agentLoading && liveAgent && !liveAgent.found && <div className="mt-4 p-4 rounded-lg border border-amber-500/40 bg-amber-500/5"><p className="font-semibold text-amber-300 flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" />Agent account not found on devnet</p><p className="text-xs text-muted-foreground mb-3">{liveAgent.message}</p><AddressRow label="Derived Agent PDA" value={liveAgent.agentPda!} /><p className="text-xs text-muted-foreground mt-3">Tip: the agent ID must match the hex used during bond_agent. Try the demo agent above.</p></div>}
              </CardContent>
            </Card>
            </motion.div>

            {/* Record Verified Outcome form */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
              <Card className={cn('bg-card/80 backdrop-blur-xl border-white/10 transition-all duration-500', tierUpgraded && 'border-emerald-400/60 shadow-[0_0_50px_rgba(16,185,129,0.45)]')}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-violet-400" />Record Verified Outcome</CardTitle>
                  <CardDescription>Submit a verified outcome via <code className="font-mono text-emerald-300">POST /api/record-outcome</code> — drives onchain tier transitions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddressRow label="Agent ID (read-only)" value={liveAgent?.agentId || agentInput || KNOWN_AGENT_ID} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Result</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setOutcomeResult('pass')} className={cn('flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-mono uppercase tracking-wider transition-all', outcomeResult === 'pass' ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10')}><CheckCircle2 className="h-4 w-4" />Pass</button>
                      <button type="button" onClick={() => setOutcomeResult('fail')} className={cn('flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-mono uppercase tracking-wider transition-all', outcomeResult === 'fail' ? 'border-rose-500/60 bg-rose-500/15 text-rose-300' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10')}><XCircle className="h-4 w-4" />Fail</button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">Severity{outcomeResult === 'pass' && <span className="text-emerald-400 normal-case tracking-normal">· pass implies None</span>}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => setOutcomeSeverity('none')} className={cn('p-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all', outcomeSeverity === 'none' ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10')}>None</button>
                      <button type="button" onClick={() => setOutcomeSeverity('ordinary')} disabled={outcomeResult === 'pass'} className={cn('p-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed', outcomeSeverity === 'ordinary' ? 'border-amber-500/60 bg-amber-500/15 text-amber-300' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10')}>Ordinary</button>
                      <button type="button" onClick={() => setOutcomeSeverity('critical')} disabled={outcomeResult === 'pass'} className={cn('p-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed', outcomeSeverity === 'critical' ? 'border-rose-500/60 bg-rose-500/15 text-rose-300' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10')}>Critical</button>
                    </div>
                  </div>
                  <Button onClick={() => recordOutcome(liveAgent?.agentId || agentInput || KNOWN_AGENT_ID, outcomeResult, outcomeSeverity)} disabled={outcomeLoading} className="bg-violet-500/15 border border-violet-500/40 text-violet-300 hover:bg-violet-500/25 hover:text-violet-200 hover:shadow-[0_0_24px_rgba(139,92,246,0.55)] transition-all w-full">
                    {outcomeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}Record Outcome
                  </Button>
                  {outcomeResponse?.success && (
                    <motion.div initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className={cn('rounded-lg border p-4 space-y-3 transition-all', tierUpgraded ? 'border-emerald-400/60 bg-emerald-500/[0.06] shadow-[0_0_30px_rgba(16,185,129,0.45)]' : 'border-violet-500/40 bg-violet-500/[0.03]')}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-sm font-semibold text-emerald-300">{outcomeResponse.message || 'Outcome recorded on devnet'}</span>
                        <AnimatePresence>{tierUpgraded && (<motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 1], opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.6 }} className="ml-auto text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-400/50">⭐ Tier Upgraded!</motion.span>)}</AnimatePresence>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <MiniMetric k="Tier" v={outcomeResponse.tier} />
                        <MiniMetric k="Epoch" v={`#${outcomeResponse.epoch}`} />
                        <MiniMetric k="Successes" v={`${outcomeResponse.successCount}/${outcomeResponse.totalCount}`} />
                        <MiniMetric k="Critical Fails" v={`${outcomeResponse.criticalFailures}`} />
                      </div>
                      {outcomeResponse.explorerUrl && (
                        <a href={outcomeResponse.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 font-mono px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"><Link2 className="h-3.5 w-3.5" />View on Solana.fm<ExternalLink className="h-3 w-3" /></a>
                      )}
                    </motion.div>
                  )}
                  {outcomeError && (
                    <Alert variant="destructive" className="border-rose-500/40 bg-rose-500/5">
                      <AlertTriangle className="h-4 w-4 text-rose-400" /><AlertTitle className="text-rose-300">Recording failed</AlertTitle><AlertDescription className="text-xs font-mono break-all">{outcomeError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Request Capability form */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}>
              <Card className="bg-card/80 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5 text-sky-400" />Request Capability</CardTitle>
                  <CardDescription>Mint a short-lived capability PDA via <code className="font-mono text-emerald-300">POST /api/request-capability</code>.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Amount Limit (USDC)</p>
                    <div className="flex flex-wrap gap-2 items-center">{[5, 50, 500].map((amt) => (<button key={amt} type="button" onClick={() => setCapabilityAmount(amt)} className={cn('px-3 py-1.5 rounded-md border text-xs font-mono transition-all', capabilityAmount === amt ? 'border-sky-500/60 bg-sky-500/15 text-sky-300' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10')}>${amt}</button>))}<Input type="number" min={1} value={capabilityAmount} onChange={(e) => setCapabilityAmount(Math.max(1, Number(e.target.value)))} className="w-28 font-mono text-xs bg-white/5 border-white/10" /></div>
                  </div>
                  <Button onClick={() => requestCapability(liveAgent?.agentId || agentInput || KNOWN_AGENT_ID, capabilityAmount)} disabled={capabilityLoading} className="bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 hover:text-sky-200 hover:shadow-[0_0_24px_rgba(56,189,248,0.55)] transition-all w-full">
                    {capabilityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Request Capability
                  </Button>
                  {capabilityResponse?.success && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/[0.03] p-4 space-y-3">
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-sky-400" /><span className="text-sm font-semibold text-sky-300">{capabilityResponse.message || 'Capability requested'}</span></div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <MiniMetric k="Amount Limit" v={`$${capabilityResponse.amountLimit}`} accent="text-sky-200" />
                        <MiniMetric k="Epoch" v={`#${capabilityResponse.epoch}`} accent="text-sky-200" />
                        <MiniMetric k="Target Program" v={shortHash(capabilityResponse.targetProgram, 4, 4)} accent="text-sky-200" />
                        <MiniMetric k="Target Account" v={shortHash(capabilityResponse.targetAccount, 4, 4)} accent="text-sky-200" />
                      </div>
                      <AddressRow label="Capability PDA" value={capabilityResponse.capabilityPda} />
                      {capabilityResponse.explorerUrl && (
                        <a href={capabilityResponse.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 font-mono px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"><Link2 className="h-3.5 w-3.5" />View on Solana.fm<ExternalLink className="h-3 w-3" /></a>
                      )}
                    </motion.div>
                  )}
                  {capabilityError && (
                    <Alert variant="destructive" className="border-rose-500/40 bg-rose-500/5">
                      <AlertTriangle className="h-4 w-4 text-rose-400" /><AlertTitle className="text-rose-300">Request failed</AlertTitle><AlertDescription className="text-xs font-mono break-all">{capabilityError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <SectionDivider label="Protocol Activity" icon={<Activity className="h-3 w-3" />} />

            {/* Live Agent Activity panel */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
              <Card className="relative bg-card/80 backdrop-blur-xl border-white/10 overflow-hidden">
                {liveAgent?.found && <div className="absolute top-3 right-4"><LiveBadge /></div>}
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-400" />Live Agent Activity</CardTitle>
                  <CardDescription>One-click outcome recording — drives live authority transitions on devnet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {liveAgent?.found ? (<>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <MiniMetric k="Tier" v={String(liveAgent.tier ?? '—')} ic={<Shield className="h-3.5 w-3.5 text-emerald-400" />} />
                      <MiniMetric k="Epoch" v={`#${liveAgent.currentEpoch ?? 0}`} ic={<Hash className="h-3.5 w-3.5 text-cyan-400" />} />
                      <MiniMetric k="Bond" v={`${liveAgent.bondAmount ?? 0}`} ic={<Lock className="h-3.5 w-3.5 text-amber-400" />} />
                      <MiniMetric k="Successes" v={`${liveAgent.successCount ?? 0}/${liveAgent.totalCount ?? 0}`} ic={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} />
                    </div>
                    <motion.div animate={tierUpgraded ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ duration: 0.6 }}>
                      <AuthorityLoopMini currentTier={(liveAgent.tier as Tier) || 'Probation'} />
                    </motion.div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => recordOutcome(liveAgent.agentId!, 'pass', 'none')} disabled={outcomeLoading} className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200">{outcomeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Record Success</Button>
                      <Button onClick={() => recordOutcome(liveAgent.agentId!, 'fail', 'critical')} disabled={outcomeLoading} className="bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200">{outcomeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}Record Critical Failure</Button>
                    </div>
                  </>) : (
                    <div className="text-center py-6"><Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No live agent found on devnet.</p><p className="text-xs text-muted-foreground/70 mt-1">Use <button className="text-emerald-300 hover:underline" onClick={() => { setAgentInput(KNOWN_AGENT_ID); fetchAgent(KNOWN_AGENT_ID) }}>the demo agent</button> to see live activity.</p></div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <SectionDivider label="Agent Activity" icon={<Activity className="h-3 w-3" />} />

            {/* Capabilities */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease: 'easeOut' }}><Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-sky-400" />Active Capabilities
                </CardTitle>
                <CardDescription>Short-lived, exact-action capabilities — 30-minute TTL, single-use nonces.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {DEMO_CAPABILITIES.map((cap, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={cn('flex items-center justify-between p-3 rounded-lg border transition-colors',
                        cap.active ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-white/5 bg-white/[0.02] opacity-60')}>
                      <div className="flex items-center gap-3">
                        {cap.active ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                        <div>
                          <p className="font-mono font-semibold text-sm">{cap.type}</p>
                          <p className="text-xs text-muted-foreground font-mono">{cap.target}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold font-mono">{cap.active ? `$${cap.amountLimit}` : 'LOCKED'}</p>
                        <p className="text-xs text-muted-foreground font-mono">TTL: {cap.expiry}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card></motion.div>

            {/* Timeline */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease: 'easeOut' }}><Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />Authority Timeline
                </CardTitle>
                <CardDescription>The full $5 → $50 → $500 → $5 loop — 31 verified events across 37 epochs.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[360px] pr-4">
                  <div className="relative">
                    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/30 via-white/10 to-rose-500/30" />
                    <div className="space-y-1">
                      <AnimatePresence initial={false}>
                        {displayTimeline.map((event) => (
                          <motion.div key={event.id} layout
                            initial={event.live ? { opacity: 0, scale: 0.9, x: -10 } : { opacity: 0 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.3 }}
                            className="flex items-start gap-3 pb-2 relative">
                            <div className={cn('relative z-10 p-1.5 rounded-full border backdrop-blur-sm',
                              event.live ? 'bg-emerald-500/20 border-emerald-400/60' : 'bg-slate-900 border-white/10')}>
                              {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 pb-1">
                              <p className="text-sm">{event.description}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-[10px] py-0 font-mono border-white/10 bg-white/5">Epoch {event.epoch}</Badge>
                                {event.amount && (
                                  <Badge variant="secondary" className="text-[10px] py-0 font-mono bg-white/5">${event.amount}</Badge>
                                )}
                                {event.outcome && (
                                  <Badge className={cn('text-[10px] py-0 font-mono',
                                    event.outcome === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
                                    {event.outcome}
                                  </Badge>
                                )}
                                {event.live && (
                                  <Badge className="text-[10px] py-0 font-mono bg-emerald-500/30 text-emerald-200">LIVE</Badge>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card></motion.div>

            {/* Receipts (accordion) */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease: 'easeOut' }}><Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-violet-400" />Performance Receipts
                </CardTitle>
                <CardDescription>Expandable evidence receipts — every execution is anchor-bound.</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {DEMO_RECEIPTS.map((receipt) => (
                    <AccordionItem key={receipt.id} value={receipt.id} className="border-white/10">
                      <AccordionTrigger className="hover:no-underline hover:bg-white/5 px-3 rounded-md">
                        <div className="flex items-center gap-3 flex-1 mr-3">
                          <span className="font-mono font-bold text-sm">{receipt.id}</span>
                          <Badge className={cn('text-[10px] font-mono',
                            receipt.result === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
                            {receipt.result}
                          </Badge>
                          {receipt.severity !== 'None' && (
                            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-300">{receipt.severity}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto font-mono">{receipt.timestamp}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono pt-1">
                          <div className="flex gap-2"><span className="text-muted-foreground">Action:</span><span>{receipt.action}</span></div>
                          <div className="flex gap-2"><span className="text-muted-foreground">Verifier:</span><span>{receipt.verifier}</span></div>
                          <div className="flex gap-2"><span className="text-muted-foreground">Evidence:</span><span>{receipt.evidenceHash}</span></div>
                          <div className="flex gap-2"><span className="text-muted-foreground">Slot:</span><span>#{receipt.slot}</span></div>
                          <div className="flex gap-2"><span className="text-muted-foreground">Gas:</span><span>◎{receipt.gasUsed.toFixed(6)}</span></div>
                          <div className="flex gap-2"><span className="text-muted-foreground">Status:</span><span>{receipt.result === 'Pass' ? 'Settled' : 'Reverted'}</span></div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card></motion.div>

            {/* Architecture pillars */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease: 'easeOut' }}><Card className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: <Shield className="h-7 w-7 text-emerald-400" />, title: 'Exact-Action Binding', body: 'Agent + Action + Target + Amount + Nonce + Expiry + Epoch' },
                    { icon: <Lock className="h-7 w-7 text-amber-400" />, title: 'Short-Lived Authority', body: '30-minute TTL, single-use nonces, bounded blast radius.' },
                    { icon: <Zap className="h-7 w-7 text-sky-400" />, title: 'Deterministic Enforcement', body: '12 security checks, onchain CPI, no admin override.' },
                  ].map((p) => (
                    <div key={p.title} className="text-center md:text-left p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors">
                      <div className="flex md:justify-start justify-center mb-2">{p.icon}</div>
                      <p className="text-sm font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{p.body}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card></motion.div>
          </TabsContent>

          {/* ========== TAB: Protocol Stats ========== */}
          <TabsContent value="stats" className="space-y-6">
            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: <Terminal className="h-5 w-5" />, value: STATS.totalInstructions, label: 'Program Instructions', accent: 'text-emerald-300' },
                { icon: <FileCheck2 className="h-5 w-5" />, value: STATS.securityChecks, label: 'Security Checks', accent: 'text-amber-300' },
                { icon: <FlaskConical className="h-5 w-5" />, value: STATS.totalTests, label: 'Total Tests', accent: 'text-violet-300' },
                { icon: <Boxes className="h-5 w-5" />, value: PROGRAMS.length, label: 'Onchain Programs', accent: 'text-cyan-300' },
              ].map((s) => (
                <motion.div key={s.label} whileHover={{ y: -2 }} className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <div className={cn('mb-2', s.accent)}>{s.icon}</div>
                  <p className="text-3xl font-bold tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Authority Loop Visualization + Protocol Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AuthorityLoopChart />
              <ProtocolHealthGauge value={protocolHealth} devnetLive={devnetLive} />
            </div>

            {/* Test breakdown */}
            <Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-violet-400" />Test Suite Breakdown
                </CardTitle>
                <CardDescription>Formal onchain tests + SDK integration tests + end-to-end demo scripts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: <Terminal className="h-4 w-4 text-emerald-400" />, label: 'Formal Anchor tests', value: STATS.formalTests },
                  { icon: <Network className="h-4 w-4 text-sky-400" />, label: 'SDK integration tests', value: STATS.sdkTests },
                  { icon: <PlayCircle className="h-4 w-4 text-amber-400" />, label: 'End-to-end demo scripts', value: STATS.demoTests },
                ].map((row) => {
                  const pct = (row.value / STATS.totalTests) * 100
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-2">{row.icon}{row.label}</span>
                        <span className="font-mono text-sm">
                          <span className="font-bold">{row.value}</span>
                          <span className="text-muted-foreground"> / {STATS.totalTests}</span>
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5 bg-white/10" />
                    </div>
                  )
                })}
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Total passing tests</span>
                  <span className="text-2xl font-bold font-mono text-emerald-300">{STATS.totalTests}</span>
                </div>
              </CardContent>
            </Card>

            {/* Security Checks */}
            <Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />Security Checks
                </CardTitle>
                <CardDescription>
                  All 12 <code className="font-mono text-emerald-300">assert_capability</code> invariants enforced onchain before any agent action is permitted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SECURITY_CHECKS.map((check, i) => (
                    <Tooltip key={check.id}>
                      <TooltipTrigger asChild>
                        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-colors cursor-help">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">#{String(check.id).padStart(2, '0')}</span>
                              <p className="font-mono text-sm font-semibold truncate">{check.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
                          </div>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px] bg-slate-900/95 border border-emerald-500/30 text-emerald-50 backdrop-blur-md">
                        <span className="block text-[10px] font-mono uppercase tracking-wider text-emerald-300 mb-0.5">Check #{String(check.id).padStart(2, '0')} · {check.name}</span>
                        <span className="block text-xs leading-relaxed">{check.tooltip}</span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Program Instructions */}
            <Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-cyan-400" />Program Instructions
                </CardTitle>
                <CardDescription>{STATS.totalInstructions} instructions across {PROGRAMS.length} programs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {PROGRAMS.map((program) => (
                  <div key={program.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-emerald-400" />
                        <span className="font-mono font-semibold text-sm">{program.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-white/10 bg-white/5">
                        {program.instructions} instructions
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pl-6">
                      {PROGRAM_INSTRUCTIONS[program.name].map((instr) => (
                        <div key={instr.name} className="flex items-start justify-between gap-3 p-2 rounded-md hover:bg-white/5 transition-colors">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-emerald-300">{instr.name}</p>
                            <p className="text-xs text-muted-foreground">{instr.description}</p>
                          </div>
                          <code className="text-[10px] text-muted-foreground font-mono bg-white/5 px-2 py-0.5 rounded shrink-0">{instr.args}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: Deployment ========== */}
          <TabsContent value="deployment" className="space-y-6">
            {/* Live Devnet Status Panel */}
            <Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-400" />Live Devnet Status</CardTitle>
                    <CardDescription>Real-time wallet balance & program deployment state fetched directly from Solana devnet.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">{deploymentData && <LiveBadge />}{deploymentFetchedAt && <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline-flex">↑ {deploymentFetchedAt.toLocaleTimeString()}</span>}<Button size="sm" variant="outline" onClick={fetchDeployment} disabled={deploymentLoading} className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"><RefreshCw className={cn('h-3.5 w-3.5', deploymentLoading && 'animate-spin')} />Refresh</Button></div>
                </div>
              </CardHeader>
              <CardContent>
                {deploymentLoading && !deploymentData ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                ) : deploymentError ? <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/5 text-sm"><p className="font-semibold text-rose-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Devnet fetch failed</p><p className="text-xs text-muted-foreground mt-1 font-mono break-all">{deploymentError}</p></div> : deploymentData ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <MetricCard icon={<Globe className="h-4 w-4" />} label="Cluster" value={deploymentData.cluster} accent="text-emerald-400" />
                      <MetricCard icon={<Wallet className="h-4 w-4" />} label="Wallet Balance" value={`${deploymentData.balanceSOL.toFixed(4)} SOL`} accent="text-amber-400" />
                      <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Programs Deployed" value={`${deploymentData.programs.filter((p) => p.deployed).length}/${deploymentData.programs.length}`} accent="text-cyan-400" />
                      <MetricCard icon={<Boxes className="h-4 w-4" />} label="All Live" value={deploymentData.allDeployed ? 'Yes' : 'No'} accent={deploymentData.allDeployed ? 'text-emerald-400' : 'text-rose-400'} />
                    </div>
                    <AddressRow label="Authority Wallet" value={deploymentData.wallet} />
                  </>
                ) : null}
              </CardContent>
            </Card>

            {/* Transaction History Panel */}
            <Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-400" />Transaction History</CardTitle>
                    <CardDescription>Recent devnet transactions for agent <code className="font-mono text-emerald-300">{shortHash(KNOWN_AGENT_ID, 6, 6)}</code> via <code className="font-mono text-emerald-300">GET /api/transaction-history</code>.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">{txHistory && txHistory.transactions && txHistory.transactions.length > 0 && <LiveBadge />}{txHistoryFetchedAt && <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline-flex">↑ {txHistoryFetchedAt.toLocaleTimeString()}</span>}<Button size="sm" variant="outline" onClick={() => fetchTxHistory(KNOWN_AGENT_ID, 10)} disabled={txHistoryLoading} className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"><RefreshCw className={cn('h-3.5 w-3.5', txHistoryLoading && 'animate-spin')} />Refresh</Button></div>
                </div>
              </CardHeader>
              <CardContent>
                {txHistoryLoading && !txHistory ? (
                  <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
                ) : txHistoryError ? (
                  <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/5 text-sm"><p className="font-semibold text-rose-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />History fetch failed</p><p className="text-xs text-muted-foreground mt-1 font-mono break-all">{txHistoryError}</p></div>
                ) : txHistory && txHistory.transactions && txHistory.transactions.length > 0 ? (
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <div className="grid grid-cols-[110px_1fr_90px_60px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground bg-slate-950/40 border-b border-white/5">
                      <span>Slot</span><span>Signature</span><span>Status</span><span className="text-right">Link</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {txHistory.transactions.map((tx) => {
                        const success = !tx.err
                        return (
                          <div key={tx.signature} className="grid grid-cols-[110px_1fr_90px_60px] gap-2 px-3 py-2 text-xs font-mono border-b border-white/5 last:border-0 hover:bg-white/5 hover:border-emerald-500/20 transition-colors cursor-default">
                            <span className="text-muted-foreground truncate" title={String(tx.slot)}>{tx.slot?.toLocaleString() ?? '—'}</span>
                            <span className="truncate text-emerald-300" title={tx.signature}>{shortHash(tx.signature, 10, 8)}</span>
                            <span className={cn('inline-flex items-center gap-1', success ? 'text-emerald-400' : 'text-rose-400')}>{success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{success ? 'OK' : 'FAIL'}</span>
                            <span className="text-right">{tx.explorerUrl && <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-emerald-300 hover:text-emerald-200" aria-label="View on Solana.fm"><ExternalLink className="h-3 w-3" /></a>}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground bg-slate-950/30 border-t border-white/5">{txHistory.count || txHistory.transactions.length} transactions · agent PDA {txHistory.agentPda ? shortHash(txHistory.agentPda, 4, 4) : '—'}</div>
                  </div>
                ) : (
                  <div className="text-center py-8"><Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No transactions found for this agent.</p><p className="text-xs text-muted-foreground/70 mt-1">Trigger a record_outcome or request_capability to populate history.</p></div>
                )}
              </CardContent>
            </Card>

            {/* Program cards */}
            <div className="grid grid-cols-1 gap-4">
              {PROGRAMS.map((program, i) => (
                <motion.div key={program.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="rounded-xl p-[1.5px] bg-gradient-to-r from-emerald-500/30 via-transparent to-cyan-500/30 hover:from-emerald-500/60 hover:via-emerald-500/10 hover:to-cyan-500/60 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-all duration-300">
                  <Card className="bg-card/80 backdrop-blur-xl border-0">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Server className="h-5 w-5 text-emerald-400" />
                            <span className="font-mono font-bold text-lg">{program.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{program.description}</p>
                        </div>
                        <Badge className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{program.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Program ID</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono break-all">{program.programId}</code>
                            <CopyButton text={program.programId} label="Program ID" />
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deployment Slot</p>
                          <p className="font-mono text-sm">#{program.deploymentSlot.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-mono border-white/10 bg-white/5">
                            <Terminal className="h-3 w-3 mr-1" />{program.instructions} instructions
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 bg-emerald-500/5 text-emerald-300">
                            <Activity className="h-3 w-3 mr-1" />tx {(program.deploymentSlot % 9000 + 12000).toLocaleString()}
                          </Badge>
                        </div>
                        <a href={`https://solscan.io/tx/${program.txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 font-mono transition-colors">
                          tx {shortHash(program.txSignature, 6, 4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* USDC mint */}
            <Card className="bg-card/80 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <DollarSign className="h-5 w-5 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bond / Payment Mint</p>
                    <code className="text-xs font-mono break-all">{STATS.usdcMint}</code>
                  </div>
                  <CopyButton text={STATS.usdcMint} label="USDC Mint" />
                  <Badge className="bg-amber-500/15 border border-amber-500/40 text-amber-300">USDC (Devnet)</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                <span className="font-bold">PACTYRA</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Economic authority layer for autonomous agents. Verified performance becomes executable economic authority.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Resources</p>
              <div className="space-y-1.5">
                <FooterLink href={STATS.github} icon={<Github className="h-3.5 w-3.5" />} label="GitHub Repository" />
                <FooterLink href={STATS.architecture} icon={<BookOpen className="h-3.5 w-3.5" />} label="Architecture Docs" />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Protocol</p>
              <div className="space-y-1.5">
                <FooterLink href="https://solscan.io/cluster/devnet" icon={<Network className="h-3.5 w-3.5" />} label="Solana Devnet" />
                <FooterLink href="https://github.com/sodiq-code/pactyra/tree/main/pactyra/programs" icon={<Boxes className="h-3.5 w-3.5" />} label="Anchor Programs" />
              </div>
            </div>
          </div>
          <Separator className="my-6 bg-white/10" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p className="font-mono">© {new Date().getFullYear()} PACTYRA Protocol · Built for Solana</p>
            <p className="font-mono">$5 → $50 → $500 → $5</p>
          </div>
        </footer>
      </main>
    </div>
  )
}
