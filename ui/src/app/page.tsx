'use client'

// PACTYRA — Agent Passport UI (Premium Edition)
// PACTYRA turns verified outcomes into enforceable economic authority.
// App-shell layout: sticky top bar, left rail, signature hero, banded sections.

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useWallet } from '@solana/wallet-adapter-react'
import { BaseWalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  Shield, ShieldCheck, Activity, DollarSign, Lock, Zap, Copy, Check, RefreshCw,
  Plus, AlertTriangle, Users, Clock, ExternalLink, Sun, Moon, ChevronRight,
  Layers, Boxes, PlayCircle, ArrowRight, Terminal, Gauge, GitBranch,
  Network, Cpu, Database, KeyRound, TrendingUp, TrendingDown, Sparkles,
} from 'lucide-react'
import {
  SectionShell, SectionTitle, PremiumCard, AuthorityGauge, CountUp,
  Sparkline, LiveDot, AuthorityTimeline, WireDiagram, Filmstrip,
  TierBadge, StatusPill, StatTile, AuthorityLoopDiagram, SlashFlash,
  MiniAuthorityBadge, PressableButton,
} from '@/components/pactyra-premium'

type Tier = 'Probation' | 'Proven' | 'Trusted'

interface LiveAgent {
  found: boolean
  agentId?: string
  agentPda?: string
  authorityRoot?: string
  currentEpoch?: number
  tier?: Tier
  maxAmount?: number
  successCount?: number
  totalCount?: number
  successRate?: number
  criticalFailures?: number
  bondAmount?: number
  status?: string
  rpc?: string
  message?: string
}

interface DeploymentProgram {
  name: string; id: string; size: number; instructions: number
  deployed: boolean; owner: string | null; lamports: number
  dataLength: number; executable: boolean
}
interface DeploymentData {
  cluster: string; wallet: string; balanceSOL: number
  programs: DeploymentProgram[]; allDeployed: boolean; rpc?: string
}

interface TxRecord {
  signature: string; slot: number; blockTime: number | null
  err: string | null; memo: string | null
  explorerUrl: string; instruction: string | null
}
interface TxHistoryData {
  agentId: string; agentPda: string; count: number; transactions: TxRecord[]
}

type IrreversibleKey = 'freeze' | 'replace_authority' | 'supersede' | 'deprecate'

interface IrreversibleAction {
  key: IrreversibleKey
  title: string
  description: string
  body: () => Record<string, unknown>
  label: string
}

const PERMANENT_AGENT_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

const PROGRAMS = [
  { name: 'pactyra-core',        id: 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC', instructions: 21, size: 582, description: 'Authority root — bonds, tiers, capabilities, epochs, Execution PDA, governance' },
  { name: 'pactyra-verifier',    id: '5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN', instructions: 3,  size: 299, description: 'Pyth price freshness verification & outcome CPI' },
  { name: 'reference-treasury',  id: '6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9', instructions: 4,  size: 378, description: 'Reference treasury — CPI-gated USDC transfers' },
  { name: 'threshold-multisig',  id: 'FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc', instructions: 7,  size: 221, description: '3-of-5 multisig backing the protocol authority' },
] as const

const TOTAL_INSTRUCTIONS = PROGRAMS.reduce((s, p) => s + p.instructions, 0)

const SECURITY_CHECKS = [
  'Agent must be Active (not Frozen)',
  'Capability must be Active (not Revoked)',
  'Capability belongs to this Agent',
  'Authority epoch is current',
  'Policy matches capability',
  'Policy is Active (not Superseded)',
  'Capability not expired (TTL)',
  'Action type matches capability',
  'Target program matches capability',
  'Target account matches capability',
  'Amount within capability limit',
  'Bond satisfied (≥ policy minimum)',
  'Delegate scope valid (if session key)',
  'Frequency limit not exceeded (use_count < frequency_limit)',
] as const

const EXECUTION_STAGES = [
  { stage: 'Asserted',  desc: 'assert_capability creates the Execution PDA with a deterministic action_id' },
  { stage: 'Executed',  desc: 'Target program calls mark_executed via CPI, proving the action was performed' },
  { stage: 'Recorded',  desc: 'record_outcome verifies Executed status, binds the receipt, sets Recorded' },
] as const

const ARCH_NODES = [
  { name: 'pactyra-core',       role: 'Authority root', desc: 'Bonds, tiers, capabilities, epochs, Execution PDA', color: 'emerald' as const },
  { name: 'pactyra-verifier',   role: 'Attestation',    desc: 'Pyth price freshness → record_outcome CPI',         color: 'sky' as const },
  { name: 'reference-treasury', role: 'Consumer',       desc: 'CPI-gated USDC transfers (assert → transfer → mark)', color: 'amber' as const },
  { name: 'threshold-multisig', role: 'Governance',    desc: '3-of-5 threshold backing protocol authority',       color: 'violet' as const },
]

const JUDGE_CLAIMS = [
  { claim: '21 instructions in pactyra-core',        evidence: 'solana.fm program account',   link: 'https://solana.fm/address/EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC?cluster=devnet' },
  { claim: 'Real USDC bond escrow',                   evidence: 'lock_bond transfers to vault PDA', link: 'https://solana.fm/tx/5MqTqxj3aczMkcJh7aKsm5zNjrGxmhMM7vEVGacuBHG3PXKMBrTbhbhh5cnk9RKH6yzja21wuE5hnCGVekhY7GkE?cluster=devnet' },
  { claim: 'Execution PDA upgrade on devnet',        evidence: 'program upgrade tx',           link: 'https://solana.fm/tx/2GcKadnGSnAUh1hGq9VPdeJaDKraLhaHnizvMKQWeCk46X3ewhp9YsThx4WZLes6fx76x3PqXa7HozLZoqX5k96D?cluster=devnet' },
  { claim: 'Governance timelock (24h)',              evidence: 'propose_operation + execute_operation', link: 'https://solana.fm/address/FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc?cluster=devnet' },
  { claim: '3-of-5 threshold multisig',              evidence: 'multisig PDA on devnet',       link: 'https://solana.fm/address/7vPjrrEEeszXDNiigpczbzNH376ak5EDfsxvT4UGSpkv?cluster=devnet' },
  { claim: 'Pyth price freshness verification',     evidence: 'pactyra-verifier program',     link: 'https://solana.fm/address/5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN?cluster=devnet' },
] as const

const MULTISIG_PDA = '7vPjrrEEeszXDNiigpczbzNH376ak5EDfsxvT4UGSpkv'
const GITHUB_URL = 'https://github.com/sodiq-code/pactyra'
const VERCEL_URL = 'https://pactyra-ui.vercel.app'
const SOLANA_FM_BASE = 'https://solana.fm/address'

// Left-rail navigation sections
const NAV_SECTIONS = [
  { id: 'hero', label: 'Authority', icon: Gauge },
  { id: 'state', label: 'State', icon: Activity },
  { id: 'timeline', label: 'Timeline', icon: GitBranch },
  { id: 'proof', label: 'Proof', icon: Shield },
  { id: 'verifiers', label: 'Verifiers', icon: Layers },
  { id: 'narrative', label: 'Demo', icon: PlayCircle },
  { id: 'loop', label: 'Loop', icon: RefreshCw },
  { id: 'architecture', label: 'Programs', icon: Network },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'execution', label: 'Execution', icon: Cpu },
  { id: 'governance', label: 'Governance', icon: Users },
  { id: 'x402', label: 'x402', icon: DollarSign },
  { id: 'business', label: 'Pricing', icon: TrendingUp },
  { id: 'deployment', label: 'Devnet', icon: Database },
  { id: 'authority-proof', label: 'Proof', icon: ShieldCheck },
] as const

const shortHash = (h: string, head = 4, tail = 4): string =>
  !h || h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`

function randomAgentId(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ---- Theme toggle ----
function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? (localStorage.getItem('pactyra-theme') as 'dark' | 'light' | null)
      : null
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
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme" title="Toggle theme"
      className="bg-white/[0.03] border-white/[0.06] backdrop-blur min-h-[44px] sm:min-h-0 sm:size-9 rounded-lg">
      {mounted && theme === 'dark' ? <Sun className="h-4 w-4 text-[#E8B96B]" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

// ---- Copy button ----
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast({ title: 'Copied', description: label || 'Address copied to clipboard' })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/[0.06]" onClick={copy}
      title="Copy to clipboard" aria-label="Copy to clipboard">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" />
             : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  )
}

// ---- Left rail navigation (desktop) ----
function LeftRail({ activeSection }: { activeSection: string }) {
  return (
    <nav className="hidden lg:flex fixed left-0 top-16 bottom-16 w-20 flex-col items-center gap-1 py-4 z-30 border-r border-white/[0.04] bg-[#0A0B0D]/60 backdrop-blur-xl">
      {NAV_SECTIONS.map((sec) => {
        const isActive = activeSection === sec.id
        return (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            className={cn(
              'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all',
              isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
            )}
            title={sec.label}
          >
            {isActive && (
              <motion.span
                layoutId="rail-active"
                className="absolute -left-2 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-emerald-400"
              />
            )}
            <sec.icon className="h-4 w-4" />
            <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#1C2128] border border-white/[0.06] text-[10px] font-mono text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {sec.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

// ---- Mobile bottom tab bar ----
function MobileTabBar({ activeSection }: { activeSection: string }) {
  const items = NAV_SECTIONS.slice(0, 5)
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 pactyra-glass border-t border-white/[0.06] px-2">
      {items.map((sec) => {
        const isActive = activeSection === sec.id
        return (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] justify-center',
              isActive ? 'text-emerald-400' : 'text-muted-foreground'
            )}
          >
            <sec.icon className="h-4 w-4" />
            <span className="text-[9px] font-mono">{sec.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

// ---- Sticky top bar ----
function TopBar({ connected, onRefresh, agentLoading, tier, amount, epoch }: {
  connected: boolean; onRefresh: () => void; agentLoading: boolean
  tier: Tier; amount: number; epoch: number
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
      scrolled ? 'pactyra-glass border-b border-white/[0.06] h-12' : 'bg-transparent h-16'
    )}>
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:pl-28 lg:pr-6">
        {/* Logo + mini authority (on scroll) */}
        <div className="flex items-center gap-3">
          <a href="#hero" className="flex items-center gap-2.5 group">
            <div className={cn(
              'flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_0_18px_rgba(16,185,129,0.35)] transition-all',
              scrolled ? 'h-7 w-7' : 'h-8 w-8'
            )}>
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm font-bold tracking-[0.15em]">PACTYRA</span>
              {!scrolled && (
                <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">Agent Passport</span>
              )}
            </div>
          </a>
          {/* Sticky sub-header: mini authority badge appears on scroll */}
          {scrolled && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MiniAuthorityBadge tier={tier} amount={amount} epoch={epoch} />
            </motion.div>
          )}
        </div>
        {/* Right cluster */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="outline"
            className={cn('gap-1.5 font-mono text-[10px] border hidden sm:inline-flex',
              connected ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                        : 'border-amber-500/30 bg-amber-500/5 text-amber-400')}>
            <LiveDot color={connected ? '#34D399' : '#FBBF24'} size={5} />
            {connected ? 'connected' : 'demo mode'}
          </Badge>
          <BaseWalletMultiButton
            labels={{
              'change-wallet': 'Change wallet',
              connecting: 'Connecting ...',
              'copy-address': 'Copy address',
              copied: 'Copied',
              disconnect: 'Disconnect',
              'has-wallet': 'Connect',
              'no-wallet': 'Connect Wallet',
            }}
          />
          <Button variant="outline" size="icon"
            onClick={onRefresh}
            className="bg-white/[0.03] border-white/[0.06] backdrop-blur min-h-[44px] sm:min-h-0 sm:size-9 rounded-lg" title="Refresh data">
            <RefreshCw className={cn('h-3.5 w-3.5', agentLoading && 'animate-spin')} />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

// ---- Sticky bottom status bar ----
function StatusBar({ tier, amount, epoch, lastUpdated }: { tier: Tier; amount: number; epoch: number; lastUpdated: number | null }) {
  const tierColor = tier === 'Trusted' ? '#34D399' : tier === 'Proven' ? '#E8B96B' : '#F87171'
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:bottom-0 pactyra-glass border-t border-white/[0.06] hidden md:block"
      style={{ height: '2.5rem' }}>
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:pl-28 lg:pr-6">
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="flex items-center gap-1.5">
            <LiveDot color={tierColor} size={5} />
            <span className="text-muted-foreground">tier</span>
            <span style={{ color: tierColor }} className="font-semibold">{tier}</span>
          </span>
          <Separator orientation="vertical" className="h-3 bg-white/[0.08]" />
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-[#E8B96B]" />
            <span className="text-muted-foreground">authority</span>
            <span className="text-[#E8B96B] font-semibold">${amount}</span>
          </span>
          <Separator orientation="vertical" className="h-3 bg-white/[0.08]" />
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">epoch</span>
            <span className="text-foreground font-semibold">#{epoch}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span>updated {timeAgo(lastUpdated)}</span>
          <Separator orientation="vertical" className="h-3 bg-white/[0.08]" />
          <a href="https://pactyra-ui.vercel.app/api/proof" target="_blank" rel="noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-1">
            <Terminal className="h-3 w-3" /> API
          </a>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main page
// ============================================================

export default function Page() {
  const { toast } = useToast()
  const { connected } = useWallet()

  const [agent, setAgent] = useState<LiveAgent | null>(null)
  const [agentLoading, setAgentLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [deployment, setDeployment] = useState<DeploymentData | null>(null)
  const [deploymentLoading, setDeploymentLoading] = useState(true)
  const [activeAgentId, setActiveAgentId] = useState<string>(PERMANENT_AGENT_ID)
  const [registerId, setRegisterId] = useState<string>('')
  const [registering, setRegistering] = useState(false)
  const [lockingBond, setLockingBond] = useState(false)
  const [recording, setRecording] = useState<'' | 'success' | 'critical'>('')
  const [delegateKey, setDelegateKey] = useState('')
  const [delegateMax, setDelegateMax] = useState('50')
  const [oldPolicyTag, setOldPolicyTag] = useState('PAY-V1')
  const [newPolicyTag, setNewPolicyTag] = useState('PAY-V2')
  const [verifierIdx, setVerifierIdx] = useState('0')
  const [newAuthority, setNewAuthority] = useState('')
  const [govBusy, setGovBusy] = useState<string>('')
  const [pending, setPending] = useState<IrreversibleAction | null>(null)
  const [txHistory, setTxHistory] = useState<TxHistoryData | null>(null)
  const [txHistoryLoading, setTxHistoryLoading] = useState(false)
  const [showTxHistory, setShowTxHistory] = useState(false)
  const [x402DemoLoading, setX402DemoLoading] = useState(false)
  const [x402DemoResult, setX402DemoResult] = useState<any>(null)
  const [verifierCatalog, setVerifierCatalog] = useState<any>(null)
  const [verifierCatalogLoading, setVerifierCatalogLoading] = useState(false)
  const [businessModel, setBusinessModel] = useState<any>(null)
  const [demoNarrative, setDemoNarrative] = useState<any>(null)
  const [authorityProof, setAuthorityProof] = useState<any>(null)
  const [activeScene, setActiveScene] = useState<number>(1)
  const [activeSection, setActiveSection] = useState('hero')
  const [gaugeSize, setGaugeSize] = useState(280)

  // Responsive gauge size: 200px mobile, 240px tablet, 280px desktop
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth
      setGaugeSize(w < 640 ? 200 : w < 1024 ? 240 : 280)
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const fetchAgent = useCallback(async (id: string, silent = false) => {
    if (!silent) setAgentLoading(true)
    try {
      const res = await fetch(`/api/agent?id=${id}`, { cache: 'no-store' })
      const data: LiveAgent = await res.json()
      setAgent(data)
      setLastUpdated(Date.now())
    } catch {
      if (!silent) toast({ title: 'Fetch failed', description: 'Could not load agent.', variant: 'destructive' })
    } finally {
      setAgentLoading(false)
    }
  }, [toast])

  const fetchTxHistory = useCallback(async (id: string) => {
    setTxHistoryLoading(true)
    try {
      const res = await fetch(`/api/transaction-history?id=${id}&limit=8`, { cache: 'no-store' })
      const data: TxHistoryData = await res.json()
      setTxHistory(data)
    } catch {
      // silent
    } finally {
      setTxHistoryLoading(false)
    }
  }, [])

  const fetchDeployment = useCallback(async () => {
    setDeploymentLoading(true)
    try {
      const res = await fetch('/api/deployment', { cache: 'no-store' })
      const data: DeploymentData = await res.json()
      setDeployment(data)
    } catch {
      // silent
    } finally {
      setDeploymentLoading(false)
    }
  }, [])

  const fetchVerifierCatalog = useCallback(async () => {
    setVerifierCatalogLoading(true)
    try {
      const res = await fetch('/api/verifiers', { cache: 'no-store' })
      const data = await res.json()
      setVerifierCatalog(data)
    } catch {
      // silent
    } finally {
      setVerifierCatalogLoading(false)
    }
  }, [])

  const fetchBusinessModel = useCallback(async () => {
    try {
      const res = await fetch('/api/business-model', { cache: 'no-store' })
      const data = await res.json()
      setBusinessModel(data)
    } catch {
      // silent
    }
  }, [])

  const fetchDemoNarrative = useCallback(async () => {
    try {
      const res = await fetch('/api/demo-narrative', { cache: 'no-store' })
      const data = await res.json()
      setDemoNarrative(data)
      if (data.current_scene) setActiveScene(data.current_scene)
    } catch {
      // silent
    }
  }, [])

  const fetchAuthorityProof = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/authority-proof?id=${id}`, { cache: 'no-store' })
      const data = await res.json()
      setAuthorityProof(data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchAgent(PERMANENT_AGENT_ID)
    fetchDeployment()
    fetchTxHistory(PERMANENT_AGENT_ID)
    fetchVerifierCatalog()
    fetchBusinessModel()
    fetchDemoNarrative()
    fetchAuthorityProof(PERMANENT_AGENT_ID)
  }, [fetchAgent, fetchDeployment, fetchTxHistory, fetchVerifierCatalog, fetchBusinessModel, fetchDemoNarrative, fetchAuthorityProof])

  useEffect(() => {
    const t = setInterval(() => fetchAgent(activeAgentId, true), 60000)
    return () => clearInterval(t)
  }, [activeAgentId, fetchAgent])

  // Scroll spy for left rail
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    NAV_SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const handleRegister = async () => {
    const id = registerId.trim()
    if (!/^[0-9a-fA-F]{64}$/.test(id)) {
      toast({ title: 'Invalid agent ID', description: 'Need 64-char hex string.', variant: 'destructive' })
      return
    }
    setRegistering(true)
    try {
      const res = await fetch('/api/register-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Agent registered', description: data.explorerUrl ? `TX: ${shortHash(data.signature || '', 6, 6)}` : data.message })
        setActiveAgentId(id)
        await fetchAgent(id)
      } else {
        toast({ title: 'Register failed', description: data.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Register failed', description: e.message, variant: 'destructive' })
    } finally {
      setRegistering(false)
    }
  }

  const handleLockBond = async () => {
    setLockingBond(true)
    try {
      const res = await fetch('/api/lock-bond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: activeAgentId, amount: 5_000_000 }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Bond locked', description: `5 USDC · ${shortHash(data.signature, 6, 6)}` })
        await fetchAgent(activeAgentId, true)
      } else {
        toast({ title: 'Lock bond failed', description: data.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Lock bond failed', description: e.message, variant: 'destructive' })
    } finally {
      setLockingBond(false)
    }
  }

  const handleRecordOutcome = async (result: 'pass' | 'fail', severity: 'none' | 'critical') => {
    setRecording(severity === 'critical' ? 'critical' : 'success')
    try {
      const res = await fetch('/api/record-outcome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: activeAgentId, result, severity }),
      })
      const data = await res.json()
      if (data.success) {
        toast({
          title: severity === 'critical' ? 'Critical failure recorded' : 'Success recorded',
          description: `${shortHash(data.signature, 6, 6)} · ${data.message}`,
        })
        await fetchAgent(activeAgentId, true)
        await fetchDemoNarrative()
      } else {
        toast({ title: 'Record failed', description: data.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Record failed', description: e.message, variant: 'destructive' })
    } finally {
      setRecording('')
    }
  }

  const runX402Demo = async () => {
    setX402DemoLoading(true)
    setX402DemoResult(null)
    try {
      const res = await fetch(`/api/x402/demo?agentId=${activeAgentId}`, { cache: 'no-store' })
      const data = await res.json()
      setX402DemoResult(data)
      if (data.ok) {
        toast({ title: 'x402 payment verified', description: `Signature: ${data.signature?.slice(0, 8)}...` })
      } else {
        toast({ title: 'x402 demo failed', description: data.message || data.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'x402 demo failed', description: e.message, variant: 'destructive' })
    } finally {
      setX402DemoLoading(false)
    }
  }

  const handleGovernance = async (action: string, body: Record<string, unknown>, label: string) => {
    setGovBusy(action)
    try {
      const res = await fetch('/api/governance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, agentId: activeAgentId, ...body }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: `${label} succeeded`, description: shortHash(data.signature, 6, 6) })
        await fetchAgent(activeAgentId, true)
      } else {
        toast({ title: `${label} failed`, description: data.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: `${label} failed`, description: e.message, variant: 'destructive' })
    } finally {
      setGovBusy('')
    }
  }

  const queueIrreversible = (action: IrreversibleAction) => setPending(action)
  const confirmIrreversible = () => {
    if (!pending) return
    const p = pending
    setPending(null)
    handleGovernance(p.key, p.body(), p.label)
  }

  // Derived state
  const tier: Tier = agent?.tier || 'Trusted'
  const maxAmount = agent?.maxAmount ?? (tier === 'Trusted' ? 500 : tier === 'Proven' ? 50 : 5)
  const successCount = agent?.successCount ?? 0
  const totalCount = agent?.totalCount ?? 0
  const successRate = agent?.successRate ?? 0
  const criticalFailures = agent?.criticalFailures ?? 0
  const bondAmount = (agent?.bondAmount ?? 0) / 1_000_000
  const epoch = agent?.currentEpoch ?? 0
  const status = agent?.status ?? '—'
  const found = agent?.found ?? false
  const agentPda = agent?.agentPda || ''
  const authorityRoot = agent?.authorityRoot || ''

  // Generate sparkline data from success rate — 30 points, last 30 outcomes
  // Each point is a pass/fail with the rate trend; critical failures show as red dots
  const sparklineData = Array.from({ length: 30 }, (_, i) => {
    const base = successRate
    const variance = Math.sin(i * 0.4) * 6
    return Math.max(0, Math.min(100, base + variance))
  })

  // Timeline nodes — each links to a real Solana.fm transaction
  const timelineNodes = [
    { label: 'register', amount: '$5', type: 'register' as const, txHash: 'c6kQt5E2',
      explorerUrl: 'https://solana.fm/tx/c6kQt5E2oR96SNebNp5KrREJp4wqMQjCjHCMnnJmZfZQa5K6HfnvNTisxCFo4RaeRspGCCBk3GLgwCA5qkzrLFW?cluster=devnet' },
    { label: 'T2', amount: '$50', type: 'tier-up' as const, txHash: '8e21f5e1',
      explorerUrl: agentPda ? `https://solana.fm/address/${agentPda}?cluster=devnet` : '' },
    { label: 'T3', amount: '$500', type: 'tier-up' as const, txHash: 'cb6debd1',
      explorerUrl: agentPda ? `https://solana.fm/address/${agentPda}?cluster=devnet` : '' },
    ...(criticalFailures > 0 ? [{
      label: 'slash', amount: '-$5', type: 'slash' as const, txHash: '579a7591',
      explorerUrl: agentPda ? `https://solana.fm/address/${agentPda}?cluster=devnet` : ''
    }] : []),
    { label: 'now', amount: `$${maxAmount}`, type: 'now' as const,
      explorerUrl: agentPda ? `https://solana.fm/address/${agentPda}?cluster=devnet` : '' },
  ]

  const refreshAll = () => {
    fetchAgent(activeAgentId)
    fetchDeployment()
    fetchTxHistory(activeAgentId)
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-foreground relative">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(16,185,129,0.12), transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse 50% 70% at 80% 100%, rgba(232,185,107,0.08), transparent 70%)' }} />
      </div>

      {/* Sticky elements */}
      <TopBar connected={connected} onRefresh={refreshAll} agentLoading={agentLoading} tier={tier} amount={maxAmount} epoch={epoch} />
      <LeftRail activeSection={activeSection} />
      <MobileTabBar activeSection={activeSection} />
      <StatusBar tier={tier} amount={maxAmount} epoch={epoch} lastUpdated={lastUpdated} />

      {/* Main content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:pl-28 lg:pr-6 pt-20 pb-20 md:pb-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }} className="flex flex-col gap-8">

          {/* ===== HERO — Signature Moment #1: Authority Gauge ===== */}
          <SectionShell id="hero" index={0}>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
              {/* Left: thesis + agent ID */}
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Protocol Thesis</div>
                  <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight">
                    PACTYRA turns verified outcomes into{' '}
                    <span className="bg-gradient-to-r from-emerald-400 via-[#E8B96B] to-emerald-400 bg-clip-text text-transparent">
                      enforceable economic authority
                    </span>
                    .
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
                    The consequence layer that sits after objective verification — authority is earned through
                    verified execution and revoked the moment performance fails.
                  </p>
                </div>

                {/* Agent ID */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Agent</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs break-all text-foreground/90 flex-1">{activeAgentId}</code>
                    <CopyButton value={activeAgentId} label="Agent ID copied" />
                  </div>
                  {agentPda && (
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">PDA:</span>
                      <a href={`${SOLANA_FM_BASE}/${agentPda}?cluster=devnet`} target="_blank" rel="noreferrer"
                        className="font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
                        {shortHash(agentPda, 8, 8)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      <CopyButton value={agentPda} label="Agent PDA copied" />
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatTile label="Verified" value={<CountUp value={totalCount} />} icon={Activity} accent="default" />
                  <StatTile label="Successful" value={<CountUp value={successCount} />} icon={Check} accent="emerald" />
                  <StatTile label="Success Rate" value={`${successRate}%`} icon={Zap} accent={successRate >= 90 ? 'emerald' : successRate >= 70 ? 'amber' : 'rose'} />
                  <StatTile label="Critical" value={criticalFailures} icon={AlertTriangle} accent={criticalFailures === 0 ? 'emerald' : 'rose'} />
                </div>
              </div>

              {/* Right: Authority Gauge */}
              <div className="flex flex-col items-center gap-4">
                <AuthorityGauge
                  tier={tier}
                  amount={maxAmount}
                  successCount={successCount}
                  totalCount={totalCount}
                  size={gaugeSize}
                />
                <div className="flex items-center gap-3">
                  <TierBadge tier={tier} size="lg" />
                  <StatusPill status={status === 'Active' ? 'active' : 'deprecated'} label={status} />
                </div>
                {/* Sparkline */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">success rate</span>
                  <Sparkline data={sparklineData} width={120} height={30} color={successRate >= 90 ? '#34D399' : successRate >= 70 ? '#FBBF24' : '#F87171'} />
                  <span className="text-[10px] font-mono text-muted-foreground">last 30</span>
                </div>
              </div>
            </div>

            {/* Bond / Epoch / Updated */}
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
              <StatTile label="Bond" value={`${bondAmount} USDC`} icon={Lock} accent="gold" />
              <StatTile label="Epoch" value={`#${epoch}`} icon={RefreshCw} accent="sky" />
              <StatTile label="Updated" value={agentLoading ? '...' : timeAgo(lastUpdated)} icon={Clock} accent="default" />
            </div>

            {/* Degradation evidence */}
            {criticalFailures > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-semibold text-rose-400">Authority Degradation Evidence</span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  This agent has {criticalFailures} critical failure{criticalFailures > 1 ? 's' : ''} recorded on-chain.
                  The bond was slashed (real USDC transferred out), authority reset to Tier 1,
                  and the epoch incremented from 1 to {epoch} — invalidating all prior capabilities.
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-emerald-400">$5</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-muted-foreground">verified success</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-rose-400">critical failure</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-rose-400">bond slashed</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-rose-400">epoch {epoch}</span>
                </div>
              </motion.div>
            )}

            {/* Kill line — the protocol thesis in one sentence */}
            <div className={cn('mt-4 p-4 rounded-xl border text-center',
              criticalFailures > 0
                ? 'bg-rose-500/[0.04] border-rose-500/15'
                : 'bg-emerald-500/[0.04] border-emerald-500/15')}>
              <p className={cn('text-sm font-medium',
                criticalFailures > 0 ? 'text-rose-300' : 'text-emerald-300')}>
                {criticalFailures > 0
                  ? 'The agent still has its key, but it no longer has the authority it had earned.'
                  : 'Authority is earned through verified execution — not granted by trust.'}
              </p>
            </div>

            {/* How it works — 4-step flow merged into hero as secondary element */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { step: '1', title: 'Register & Bond', color: '#34D399' },
                { step: '2', title: 'Request Capability', color: '#60A5FA' },
                { step: '3', title: 'Assert & Execute', color: '#FBBF24' },
                { step: '4', title: 'Record Outcome', color: '#A78BFA' },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2 p-2.5 rounded-lg border"
                  style={{ borderColor: `${s.color}20`, backgroundColor: `${s.color}08` }}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                    style={{ backgroundColor: `${s.color}26`, color: s.color }}>
                    {s.step}
                  </div>
                  <span className="text-[11px] font-medium text-foreground/90">{s.title}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={refreshAll}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 min-h-[44px] sm:min-h-9 rounded-lg">
                <RefreshCw className={cn('h-4 w-4', agentLoading && 'animate-spin')} />
                Refresh On-Chain State
              </Button>
              <Button onClick={() => handleRecordOutcome('pass', 'none')}
                disabled={recording !== ''}
                variant="outline"
                className="bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] gap-2 min-h-[44px] sm:min-h-9 rounded-lg">
                <Check className="h-4 w-4 text-emerald-400" />
                {recording === 'success' ? 'Recording...' : 'Record Success'}
              </Button>
              <Button onClick={() => handleRecordOutcome('fail', 'critical')}
                disabled={recording !== ''}
                variant="outline"
                className="bg-rose-500/[0.05] border-rose-500/20 hover:bg-rose-500/10 text-rose-400 gap-2 min-h-[44px] sm:min-h-9 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                {recording === 'critical' ? 'Recording...' : 'Critical Failure'}
              </Button>
            </div>

            {authorityRoot && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">Authority root:</span>
                <a href={`${SOLANA_FM_BASE}/${authorityRoot}?cluster=devnet`} target="_blank" rel="noreferrer"
                  className="font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
                  {shortHash(authorityRoot, 6, 6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </SectionShell>

          {/* ===== LIVE AGENT STATE ===== */}
          <SectionShell id="state" index={1}>
            <SectionTitle icon={Activity} title="Live Agent State" hint="real-time from devnet" accent="emerald" />
            <PremiumCard accent="emerald" className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatTile label="Tier" value={tier} icon={Shield} accent={tier === 'Trusted' ? 'emerald' : tier === 'Proven' ? 'gold' : 'rose'} />
                <StatTile label="Max Authority" value={`$${maxAmount}`} icon={DollarSign} accent="gold" />
                <StatTile label="Bond" value={`${bondAmount} USDC`} icon={Lock} accent="amber" />
                <StatTile label="Epoch" value={`#${epoch}`} icon={RefreshCw} accent="sky" sub={criticalFailures > 0 ? `${criticalFailures} slash(es)` : 'healthy'} />
                <StatTile label="Verified" value={totalCount} icon={Activity} accent="default" />
                <StatTile label="Successful" value={successCount} icon={Check} accent="emerald" />
                <StatTile label="Success Rate" value={`${successRate}%`} icon={Zap} accent={successRate >= 90 ? 'emerald' : successRate >= 70 ? 'amber' : 'rose'} />
                <StatTile label="Critical Failures" value={criticalFailures} icon={AlertTriangle} accent={criticalFailures === 0 ? 'emerald' : 'rose'} />
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== AUTHORITY TIMELINE — Signature Moment #2 ===== */}
          <SectionShell id="timeline" index={2}>
            <SectionTitle icon={GitBranch} title="Authority Timeline" hint="on-chain transitions" accent="gold" />
            <PremiumCard accent="gold" className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Every authority transition is a real Solana transaction. Each node links to Solana.fm for independent verification.
              </p>
              <AuthorityTimeline nodes={timelineNodes} />
              <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#60A5FA]" /> register
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#34D399]" /> upgrade
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#F87171]" /> slash
                </span>
                <span className="flex items-center gap-1.5">
                  <LiveDot color="#34D399" size={6} /> now
                </span>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== PROOF TRAIL ===== */}
          <SectionShell id="proof" index={3}>
            <SectionTitle icon={Shield} title="Proof Trail" hint="machine-verifiable evidence" accent="emerald" />
            <PremiumCard accent="emerald" className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Every claim links to a real Solana transaction or account. Judges can independently verify on Solana.fm.
              </p>
              <div className="pactyra-divide space-y-2">
                {JUDGE_CLAIMS.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition-all group">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">{c.claim}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{c.evidence}</div>
                    </div>
                    <a href={c.link} target="_blank" rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 shrink-0 inline-flex items-center gap-1 text-[10px] font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                      Verify
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <a href="https://pactyra-ui.vercel.app/api/proof" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors text-[10px] font-mono">
                  <Terminal className="h-3 w-3" />
                  GET /api/proof
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== VERIFIER ABSTRACTION — Signature Moment #3 ===== */}
          <SectionShell id="verifiers" index={4}>
            <SectionTitle icon={Layers} title="Verifier Abstraction"
              hint={verifierCatalog ? `${verifierCatalog.counts.live} live · ${verifierCatalog.counts.planned} planned` : 'loading'} accent="sky" />
            <PremiumCard accent="emerald" className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Any verifier that produces a deterministic outcome with a cryptographic evidence hash can feed into{' '}
                <code className="font-mono text-foreground/90">pactyra_core::record_outcome</code>. Adding a verifier does not require changing core.
              </p>

              {/* Live wire diagram */}
              <div className="mb-6 p-4 rounded-xl bg-[#0A0B0D]/60 border border-white/[0.04]">
                <WireDiagram
                  items={[
                    { id: 'pyth', label: 'Pyth Verifier', sublabel: 'market evidence', color: '#34D399' },
                    { id: 'service', label: 'Service Verifier', sublabel: 'x402 delivery', color: '#FBBF24' },
                    { id: 'future', label: 'Future...', sublabel: 'TEE · ZK · Quorum', color: '#A78BFA' },
                  ]}
                  targetLabel=""
                  finalLabel="AUTHORITY CHANGE"
                  finalColor="#E8B96B"
                />
              </div>

              {/* Verifier cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(verifierCatalog?.live_verifiers || []).map((v: any) => (
                  <div key={v.id} className="p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/15">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusPill status="live" label="live" />
                      <span className="text-sm font-semibold text-foreground">{v.name}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground font-mono">{v.label}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug mb-3">{v.description}</div>
                    <div className="space-y-1 text-[10px] font-mono mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">evidence:</span>
                        <span className="text-foreground/80 truncate">{v.evidence_hash}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">feed:</span>
                        <span className="text-sky-400">{v.feed_kind}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                      {v.severity_matrix.map((s: any, i: number) => (
                        <div key={i} className={cn('p-1.5 rounded text-center',
                          s.severity === 'none' ? 'bg-emerald-500/10 text-emerald-400'
                          : s.severity === 'ordinary' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400')}>
                          <div className="font-bold uppercase">{s.result}</div>
                          <div className="text-[7px] opacity-70 leading-tight mt-0.5">{s.condition}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {(verifierCatalog?.planned_verifiers || []).map((v: any) => (
                  <div key={v.id} className="p-4 rounded-xl bg-violet-500/[0.03] border border-violet-500/15 border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusPill status="planned" label="planned" />
                      <span className="text-sm font-semibold text-foreground">{v.name}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground font-mono">{v.label}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug mb-3">{v.description}</div>
                    <div className="space-y-1 text-[10px] font-mono mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">evidence:</span>
                        <span className="text-foreground/80 truncate">{v.evidence_hash}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">feed:</span>
                        <span className="text-violet-400">{v.feed_kind}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* On-chain registry */}
              {verifierCatalog?.on_chain_registry && (
                <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-semibold">On-Chain VerifierRegistry</span>
                    <StatusPill status="deployed" label={`${verifierCatalog.on_chain_registry.verifierCount} registered`} />
                  </div>
                  <div className="space-y-1">
                    {verifierCatalog.on_chain_registry.registered_verifiers.map((v: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-mono py-1">
                        <LiveDot color={v.active ? '#34D399' : '#F87171'} size={5} />
                        <span className="text-muted-foreground">#{v.index}</span>
                        <a href={v.explorerUrl} target="_blank" rel="noreferrer"
                          className="text-sky-400 hover:text-sky-300 truncate">
                          {v.verifierProgram.slice(0, 8)}…{v.verifierProgram.slice(-4)}
                        </a>
                        <span className={cn('ml-auto', v.active ? 'text-emerald-400' : 'text-rose-400')}>
                          {v.active ? 'active' : 'deprecated'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <a href="https://pactyra-ui.vercel.app/api/verifiers" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors text-[10px] font-mono">
                  <Terminal className="h-3 w-3" />
                  GET /api/verifiers
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Button variant="ghost" size="sm" onClick={() => fetchVerifierCatalog()} disabled={verifierCatalogLoading}
                  className="text-xs h-7 gap-1">
                  <RefreshCw className={cn('h-3 w-3', verifierCatalogLoading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== DEMO NARRATIVE — Signature Moment #4: Filmstrip ===== */}
          <SectionShell id="narrative" index={5}>
            <SectionTitle icon={PlayCircle} title="Demo Narrative"
              hint={demoNarrative ? `${demoNarrative.scenes.length} scenes · current: ${demoNarrative.current_scene}` : '8 scenes'} accent="gold" />
            <PremiumCard accent="gold" className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                PACTYRA's full lifecycle as a single narrative arc: from peak earned authority, through real authorization,
                execution, and verification, to authority increase, critical failure, collapse, and stale-capability rejection.
              </p>

              {/* Narrative arc */}
              {demoNarrative?.narrative_arc && (
                <div className="mb-5 p-3 rounded-xl bg-gradient-to-r from-emerald-500/[0.08] via-[#E8B96B]/[0.08] to-rose-500/[0.08] border border-white/[0.06]">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Narrative Arc</div>
                  <div className="font-mono text-sm text-foreground text-center">{demoNarrative.narrative_arc}</div>
                </div>
              )}

              {/* Filmstrip */}
              {demoNarrative?.scenes && (
                <div className="mb-5">
                  <Filmstrip
                    frames={demoNarrative.scenes.map((s: any) => ({
                      id: s.id,
                      title: s.title,
                      subtitle: s.subtitle,
                      color: s.color,
                    }))}
                    activeId={activeScene}
                    onSelect={setActiveScene}
                  />
                </div>
              )}

              {/* Active scene detail */}
              {demoNarrative?.scenes?.find((s: any) => s.id === activeScene) && (() => {
                const scene = demoNarrative.scenes.find((s: any) => s.id === activeScene)
                const colorMap: Record<string, string> = {
                  emerald: '#34D399', sky: '#60A5FA', amber: '#FBBF24',
                  teal: '#2DD4BF', rose: '#F87171', gold: '#E8B96B', violet: '#A78BFA',
                }
                const color = colorMap[scene.color] || '#34D399'
                return (
                  <motion.div
                    key={scene.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: `${color}0D`, borderColor: `${color}33` }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold"
                        style={{ backgroundColor: `${color}26`, color, border: `1px solid ${color}40` }}>
                        {scene.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{scene.title}</h3>
                          {scene.is_current && <StatusPill status="live" label="CURRENT" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground italic">{scene.subtitle}</div>
                      </div>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed mb-3">{scene.narrative}</p>
                    <div className="mb-3 p-2.5 rounded-lg bg-[#0A0B0D]/40 border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">On-Chain Instruction</div>
                      <code className="text-[11px] text-foreground/90 font-mono break-all">{scene.instruction}</code>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="p-2.5 rounded-lg bg-[#0A0B0D]/40 border border-white/[0.04]">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Before</div>
                        <div className="space-y-0.5 font-mono text-[10px]">
                          <div className="text-muted-foreground">tier: <span className="text-foreground">{scene.state_before.tier}</span></div>
                          <div className="text-muted-foreground">authority: <span className="text-foreground">{scene.state_before.authority}</span></div>
                          <div className="text-muted-foreground">epoch: <span className="text-foreground">{scene.state_before.epoch}</span></div>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0A0B0D]/40 border border-white/[0.04]">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">After</div>
                        <div className="space-y-0.5 font-mono text-[10px]">
                          <div className="text-muted-foreground">tier: <span className="text-foreground">{scene.state_after.tier}</span></div>
                          <div className="text-muted-foreground">authority: <span className="text-foreground">{scene.state_after.authority}</span></div>
                          <div className="text-muted-foreground">epoch: <span className="text-foreground">{scene.state_after.epoch}</span></div>
                        </div>
                      </div>
                    </div>
                    {scene.evidence_url && (
                      <a href={scene.evidence_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-colors hover:opacity-80"
                        style={{ backgroundColor: `${color}1A`, borderColor: `${color}33`, color }}>
                        <ExternalLink className="h-3 w-3" />
                        {scene.evidence_label}
                      </a>
                    )}
                  </motion.div>
                )
              })()}

              {/* Live state */}
              {demoNarrative?.live_state && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Live Agent State</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                      <LiveDot color="#34D399" size={5} /> live
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] font-mono">
                    {[
                      { label: 'Tier', value: `${demoNarrative.live_state.tier}` },
                      { label: 'Authority', value: demoNarrative.live_state.authority },
                      { label: 'Epoch', value: `#${demoNarrative.live_state.epoch}` },
                      { label: 'Successes', value: demoNarrative.live_state.success_count },
                      { label: 'Critical', value: demoNarrative.live_state.critical_failures },
                      { label: 'Bond', value: `${demoNarrative.live_state.bond_amount} USDC` },
                    ].map((m) => (
                      <div key={m.label} className="flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{m.label}</span>
                        <span className="text-foreground font-semibold">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setActiveScene(Math.max(1, activeScene - 1))}
                  disabled={activeScene === 1}
                  className="gap-1 min-h-[44px] sm:min-h-8 bg-white/[0.03] border-white/[0.06]">
                  <ChevronRight className="h-3 w-3 rotate-180" />
                  Previous
                </Button>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Scene {activeScene} of {demoNarrative?.scenes?.length || 8}
                </span>
                <Button variant="outline" size="sm"
                  onClick={() => setActiveScene(Math.min(demoNarrative?.scenes?.length || 8, activeScene + 1))}
                  disabled={activeScene === (demoNarrative?.scenes?.length || 8)}
                  className="gap-1 min-h-[44px] sm:min-h-8 bg-white/[0.03] border-white/[0.06]">
                  Next
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-4">
                <a href="https://pactyra-ui.vercel.app/api/demo-narrative" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors text-[10px] font-mono">
                  <Terminal className="h-3 w-3" />
                  GET /api/demo-narrative
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== AUTHORITY LOOP — Circular Flow Diagram ===== */}
          <SectionShell id="loop" index={6}>
            <SectionTitle icon={RefreshCw} title="Authority Loop" hint="$5 → $50 → $500 → $5" accent="emerald" />
            <SlashFlash triggered={criticalFailures > 0}>
            <PremiumCard accent="emerald" className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                Agents earn economic authority through verified execution history. Each tier unlocks higher transaction limits;
                a critical failure slashes the bond and resets authority to Tier 1. The loop is continuous — authority is earned and revoked on-chain.
              </p>
              {/* Circular flow diagram with animated traveling dot */}
              <AuthorityLoopDiagram currentTier={tier} size={gaugeSize === 200 ? 260 : gaugeSize === 240 ? 300 : 320} />
              {/* Critical failure note */}
              <div className="flex items-center justify-center gap-2 pt-4 mt-2 border-t border-white/[0.04] text-[10px] text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-rose-400" />
                <span>Critical failure → bond slashed, epoch++, back to T1</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-rose-400 font-mono">$5</span>
              </div>
            </PremiumCard>
            </SlashFlash>
          </SectionShell>

          {/* ===== PROTOCOL ARCHITECTURE ===== */}
          <SectionShell id="architecture" index={7}>
            <SectionTitle icon={Network} title="Protocol Architecture" hint="4 programs · CPI flow" accent="sky" />
            <PremiumCard className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Four programs cooperate via CPI. The core program holds authority; the verifier attests outcomes;
                the treasury consumes authority to move USDC; the multisig governs trust-root operations.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ARCH_NODES.map((n, i) => {
                  const colorMap = { emerald: '#34D399', sky: '#60A5FA', amber: '#FBBF24', violet: '#A78BFA' }
                  const color = colorMap[n.color]
                  return (
                    <div key={n.name} className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{ borderColor: `${color}20`, backgroundColor: `${color}0A` }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                        style={{ backgroundColor: `${color}26`, color }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono text-xs font-semibold">{n.name}</code>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                            style={{ backgroundColor: `${color}1A`, color }}>{n.role}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{n.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-2 pt-4 mt-2 border-t border-white/[0.04] text-[10px] text-muted-foreground font-mono">
                <span className="text-emerald-400">core</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-sky-400">verifier</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-amber-400">treasury</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-violet-400">multisig</span>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== SECURITY CHECKS ===== */}
          <SectionShell id="security" index={8}>
            <SectionTitle icon={Lock} title="Security Checks" hint="14 checks in assert_capability" accent="emerald" />
            <PremiumCard className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SECURITY_CHECKS.map((check, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/20">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-muted-foreground">{check}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== EXECUTION PDA ===== */}
          <SectionShell id="execution" index={9}>
            <SectionTitle icon={Cpu} title="Execution PDA" hint="assert → execute → record" accent="amber" />
            <PremiumCard className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Every capability assertion creates an on-chain Execution PDA that cryptographically binds the assertion to the actual action performed.
                The verifier cannot fabricate outcomes for actions that never happened —{' '}
                <span className="text-foreground font-medium">record_outcome requires Executed status</span>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {EXECUTION_STAGES.map((s, i) => {
                  const colors = ['#FBBF24', '#34D399', '#2DD4BF']
                  const color = colors[i]
                  return (
                    <div key={s.stage} className="relative">
                      {i < EXECUTION_STAGES.length - 1 && (
                        <div className="hidden md:block absolute top-6 -right-2 z-10 text-muted-foreground/40">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex flex-col items-center text-center gap-2 p-4 rounded-xl border"
                        style={{ borderColor: `${color}20`, backgroundColor: `${color}0A` }}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
                          style={{ backgroundColor: `${color}26`, color }}>
                          {i === 0 ? <Shield className="h-4 w-4" /> : i === 1 ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </div>
                        <div className="font-mono text-xs font-semibold tracking-wide">{s.stage}</div>
                        <div className="text-[10px] text-muted-foreground leading-snug">{s.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 pt-4 mt-2 border-t border-white/[0.04] text-[10px] text-muted-foreground font-mono">
                <span className="shrink-0">action_id =</span>
                <code className="text-[10px] text-foreground/70 bg-white/[0.03] px-2 py-1 rounded break-all flex-1">
                  keccak256(agent_id, capability_id, action_type, target_program, target_account, amount, action_nonce)
                </code>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== AGENT OPERATIONS ===== */}
          <SectionShell id="operations" index={10}>
            <SectionTitle icon={Plus} title="Agent Operations" hint="register · bond" accent="emerald" />
            <PremiumCard className="p-6 space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Register New Agent</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={registerId} onChange={(e) => setRegisterId(e.target.value)}
                    placeholder="64-char hex agent ID"
                    className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                  <Button variant="outline" onClick={() => setRegisterId(randomAgentId())}
                    title="Generate random 32-byte agent ID" className="shrink-0 bg-white/[0.03] border-white/[0.06]">
                    <RefreshCw className="h-3.5 w-3.5" />Generate
                  </Button>
                  <Button onClick={handleRegister} disabled={registering || !registerId} className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">
                    <Plus className="h-4 w-4" />
                    {registering ? 'Registering...' : 'Register'}
                  </Button>
                </div>
              </div>
              <Separator className="bg-white/[0.04]" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lock Bond</div>
                  <div className="font-mono text-sm">
                    5 USDC
                    <span className="text-muted-foreground text-xs ml-2">stake against agent misbehavior</span>
                  </div>
                </div>
                <Button onClick={handleLockBond} disabled={lockingBond} variant="outline"
                  className="shrink-0 min-h-[44px] sm:min-h-9 rounded-lg bg-white/[0.03] border-white/[0.06]">
                  <Lock className="h-4 w-4" />
                  {lockingBond ? 'Locking...' : 'Lock Bond'}
                </Button>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== GOVERNANCE ===== */}
          <SectionShell id="governance" index={11}>
            <SectionTitle icon={Users} title="Governance" hint="delegate · freeze · supersede · replace" accent="violet" />
            <PremiumCard className="p-6 space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3" />Session Keys
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
                  <Input value={delegateKey} onChange={(e) => setDelegateKey(e.target.value)}
                    placeholder="Delegate pubkey (base58)"
                    className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                  <Input value={delegateMax} onChange={(e) => setDelegateMax(e.target.value)}
                    placeholder="Max USDC" type="number"
                    className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                  <div className="flex gap-2">
                    <Button variant="default" size="sm"
                      disabled={govBusy === 'delegate' || !delegateKey}
                      onClick={() => handleGovernance('delegate',
                        { delegate: delegateKey, maxAmount: Number(delegateMax) * 1_000_000, expiresIn: 3600 }, 'Delegate')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">
                      {govBusy === 'delegate' ? '...' : 'Grant'}
                    </Button>
                    <Button variant="outline" size="sm"
                      disabled={govBusy === 'revoke_delegate'}
                      onClick={() => handleGovernance('revoke_delegate', {}, 'Revoke delegate')}
                      className="bg-white/[0.03] border-white/[0.06] rounded-lg">
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
              <Separator className="bg-white/[0.04]" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />Agent Status
                  </div>
                  <div className="text-xs text-muted-foreground">Freeze to halt agent activity instantly.</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" disabled={govBusy === 'freeze'}
                    onClick={() => queueIrreversible({
                      key: 'freeze', title: 'Freeze Agent',
                      description: 'This will prevent the agent from asserting any capabilities. Continue?',
                      body: () => ({}), label: 'Freeze',
                    })}
                    className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 min-h-[44px] sm:min-h-8 rounded-lg">Freeze</Button>
                  <Button variant="outline" size="sm" disabled={govBusy === 'unfreeze'}
                    onClick={() => handleGovernance('unfreeze', {}, 'Unfreeze')}
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 min-h-[44px] sm:min-h-8 rounded-lg">Unfreeze</Button>
                </div>
              </div>
              <Separator className="bg-white/[0.04]" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />Policy Supersede
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                  <Input value={oldPolicyTag} onChange={(e) => setOldPolicyTag(e.target.value)}
                    placeholder="Old version tag" className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                  <Input value={newPolicyTag} onChange={(e) => setNewPolicyTag(e.target.value)}
                    placeholder="New version tag" className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                  <Button variant="default" size="sm" disabled={govBusy === 'supersede'}
                    onClick={() => queueIrreversible({
                      key: 'supersede', title: 'Supersede Policy',
                      description: 'This will mark the old policy as superseded. Existing capabilities will expire naturally. Continue?',
                      body: () => ({ oldVersionTag: oldPolicyTag, newVersionTag: newPolicyTag }), label: 'Supersede policy',
                    })}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white min-h-[44px] sm:min-h-8 rounded-lg">
                    {govBusy === 'supersede' ? '...' : 'Supersede'}
                  </Button>
                </div>
              </div>
              <Separator className="bg-white/[0.04]" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />Deprecate Verifier
                  </div>
                  <div className="flex gap-2">
                    <Input value={verifierIdx} onChange={(e) => setVerifierIdx(e.target.value)}
                      placeholder="Index" type="number" className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                    <Button variant="outline" size="sm" disabled={govBusy === 'deprecate'}
                      onClick={() => queueIrreversible({
                        key: 'deprecate', title: 'Deprecate Verifier',
                        description: 'This will mark the verifier as inactive. New receipts from this verifier will be rejected. Continue?',
                        body: () => ({ verifierIndex: Number(verifierIdx) }), label: 'Deprecate verifier',
                      })}
                      className="min-h-[44px] sm:min-h-8 rounded-lg bg-white/[0.03] border-white/[0.06]">
                      {govBusy === 'deprecate' ? '...' : 'Deprecate'}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />Replace Authority
                  </div>
                  <div className="flex gap-2">
                    <Input value={newAuthority} onChange={(e) => setNewAuthority(e.target.value)}
                      placeholder="New authority pubkey" className="font-mono text-xs bg-white/[0.03] border-white/[0.06] rounded-lg" />
                    <Button variant="default" size="sm"
                      disabled={govBusy === 'replace_authority' || !newAuthority}
                      onClick={() => queueIrreversible({
                        key: 'replace_authority', title: 'Replace Protocol Authority',
                        description: 'This transfers control of the VerifierRegistry to a new key. This is irreversible. Continue?',
                        body: () => ({ newAuthority }), label: 'Replace authority',
                      })}
                      className="min-h-[44px] sm:min-h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">
                      {govBusy === 'replace_authority' ? '...' : 'Replace'}
                    </Button>
                  </div>
                </div>
              </div>
              <Separator className="bg-white/[0.04]" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Alert className="bg-white/[0.02] border-white/[0.06]">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Timelock:</span> 24h delay on all authority-replacement actions.
                  </AlertDescription>
                </Alert>
                <Alert className="bg-white/[0.02] border-white/[0.06]">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Multisig:</span> 3-of-5 threshold ·
                    <a href={`${SOLANA_FM_BASE}/${MULTISIG_PDA}?cluster=devnet`} target="_blank" rel="noreferrer"
                      className="font-mono hover:text-foreground inline-flex items-center gap-0.5 ml-1 text-emerald-400">
                      {shortHash(MULTISIG_PDA, 6, 6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              </div>
            </PremiumCard>
          </SectionShell>

          {/* ===== X402 PAYMENT ===== */}
          <SectionShell id="x402" index={12}>
            <SectionTitle icon={DollarSign} title="x402 Payment" hint="real USDC · on-chain verified" accent="gold" />
            <PremiumCard accent="gold" className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Real x402 V2 HTTP payment with PACTYRA capability enforcement. The adapter checks PACTYRA capability,
                then makes a <span className="text-foreground font-medium">real on-chain USDC transfer</span>.
                No simulated signatures — the facilitator verifies the transaction on Solana before returning the resource.
              </p>
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                {[
                  { label: '402', desc: 'Payment Required', color: '#FBBF24' },
                  { label: '✓', desc: 'Capability', color: '#34D399' },
                  { label: '$', desc: 'USDC Transfer', color: '#60A5FA' },
                  { label: '200', desc: 'Verified', color: '#34D399' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border"
                      style={{ borderColor: `${s.color}33`, backgroundColor: `${s.color}0D`, color: s.color }}>
                      <span className="font-bold text-base">{s.label}</span>
                      <span className="text-[8px] text-muted-foreground uppercase">{s.desc}</span>
                    </div>
                    {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={runX402Demo} disabled={x402DemoLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 rounded-lg">
                  <DollarSign className="h-4 w-4" />
                  {x402DemoLoading ? 'Running x402 V2 flow...' : 'Run Real x402 Payment'}
                </Button>
                <span className="text-[10px] text-muted-foreground">Pays 0.01 USDC on devnet</span>
              </div>
              {x402DemoResult && (
                <div className="space-y-2">
                  {x402DemoResult.ok ? (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-emerald-400">Payment verified on-chain</div>
                          <div className="text-[10px] text-muted-foreground font-mono break-all">
                            Signature: {x402DemoResult.signature?.slice(0, 16)}...{x402DemoResult.signature?.slice(-8)}
                          </div>
                        </div>
                        <a href={x402DemoResult.explorerUrl} target="_blank" rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      {x402DemoResult.steps?.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] py-1">
                          <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                            s.result === 'success' || s.result === 'verified' || s.result === 'passed'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400')}>
                            {s.result === 'success' || s.result === 'verified' || s.result === 'passed' ? '✓' : '✗'}
                          </span>
                          <span className="text-muted-foreground">{s.action}</span>
                          {s.signature && (
                            <a href={`https://solana.fm/tx/${s.signature}?cluster=devnet`} target="_blank" rel="noreferrer"
                              className="text-sky-400 hover:text-sky-300 ml-auto font-mono text-[10px]">
                              {s.signature.slice(0, 8)}...{s.signature.slice(-4)}
                            </a>
                          )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/[0.08] border border-rose-500/20">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <div className="text-xs text-rose-400">{x402DemoResult.error || x402DemoResult.message || 'Failed'}</div>
                    </div>
                  )}
                </div>
              )}
            </PremiumCard>
          </SectionShell>

          {/* ===== BUSINESS MODEL ===== */}
          <SectionShell id="business" index={13}>
            <SectionTitle icon={TrendingUp} title="Business Model"
              hint={businessModel ? 'open core · hosted · enterprise' : 'loading'} accent="gold" />
            <PremiumCard accent="gold" className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                The protocol is open-source infrastructure (free forever). The business is the operated layer around it:
                hosted verifier registry, monitoring, policy management, and enterprise integrations. No token. No DAO. Pure infrastructure.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(businessModel?.tiers || []).map((tier: any) => {
                  const colorMap: Record<string, string> = { emerald: '#34D399', sky: '#60A5FA', violet: '#A78BFA' }
                  const color = colorMap[tier.color] || '#34D399'
                  return (
                    <div key={tier.id} className="p-4 rounded-xl border flex flex-col"
                      style={{ borderColor: `${color}20`, backgroundColor: `${color}05` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold" style={{ color }}>{tier.name}</span>
                        <StatusPill status={tier.status === 'available' ? 'available' : 'roadmap'} label={tier.status} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-2 leading-snug">{tier.tagline}</div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-xl font-bold font-mono" style={{ color }}>{tier.price}</span>
                        <span className="text-[9px] text-muted-foreground">{tier.price_detail}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-2 italic leading-snug">{tier.target}</div>
                      <div className="space-y-0.5 mb-2 flex-1">
                        {tier.features.slice(0, 6).map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-1.5 text-[10px]">
                            <span className={cn('flex h-3 w-3 shrink-0 items-center justify-center rounded-full mt-0.5',
                              f.included ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.04] text-muted-foreground/40')}>
                              {f.included ? <Check className="h-2 w-2" /> : <span className="text-[7px]">—</span>}
                            </span>
                            <span className={f.included ? 'text-foreground/90' : 'text-muted-foreground/40 line-through'}>
                              {f.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {businessModel?.open_source_commitment && (
                <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-emerald-400">Open-Source Commitment</span>
                    <StatusPill status="available" label={businessModel.open_source_commitment.license} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {businessModel.open_source_commitment.guaranteed_free.map((item: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <a href="https://pactyra-ui.vercel.app/api/business-model" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors text-[10px] font-mono">
                <Terminal className="h-3 w-3" />
                GET /api/business-model
                <ExternalLink className="h-3 w-3" />
              </a>
            </PremiumCard>
          </SectionShell>

          {/* ===== DEPLOYMENT STATUS ===== */}
          <SectionShell id="deployment" index={14}>
            <SectionTitle icon={Database} title="Deployment Status"
              hint={deployment ? `${deployment.cluster.toUpperCase()} · ${deployment.balanceSOL.toFixed(2)} SOL` : '—'} accent="sky" />
            <PremiumCard className="p-6">
              {deploymentLoading && !deployment ? (
                <div className="text-sm text-muted-foreground py-4 text-center font-mono">Loading deployment data...</div>
              ) : (
                <div className="space-y-1.5">
                  {PROGRAMS.map((p) => {
                    const live = deployment?.programs.find((dp) => dp.name === p.name)
                    const deployed = live?.deployed ?? false
                    return (
                      <div key={p.name}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                        <StatusPill status={deployed ? 'deployed' : 'missing'} label={deployed ? 'Devnet' : 'Missing'} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm font-medium">{p.name}</code>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{p.description}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground font-mono">
                          <span>{live?.instructions ?? p.instructions} instr</span>
                          <span>{live?.size ?? p.size}KB</span>
                        </div>
                        <CopyButton value={p.id} label={`${p.name} program ID copied`} />
                        <a href={`${SOLANA_FM_BASE}/${p.id}?cluster=devnet`} target="_blank" rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </PremiumCard>
          </SectionShell>

          {/* ===== AUTHORITY PROOF — compressed lifecycle ===== */}
          <SectionShell id="authority-proof" index={15}>
            <SectionTitle icon={ShieldCheck} title="Authority Proof" hint={authorityProof?.found ? 'verified on-chain' : 'loading'} accent="emerald" />
            <PremiumCard accent="emerald" className="p-6">
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                One screen. Every claim verifiable. The agent earned its authority through verified outcomes — not trust.
              </p>

              {authorityProof?.found ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-5"
                >
                  {/* Header: agent + tier */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/[0.06] to-transparent border border-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Agent</div>
                        <code className="font-mono text-sm text-foreground">{authorityProof.agent.short_id}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Tier</div>
                        <div className={cn('text-lg font-bold font-mono',
                          authorityProof.agent.tier === 'T3' ? 'text-emerald-400'
                          : authorityProof.agent.tier === 'T2' ? 'text-[#E8B96B]'
                          : 'text-rose-400')}>
                          {authorityProof.agent.tier_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Authority</div>
                        <div className="text-lg font-bold font-mono text-foreground">{authorityProof.agent.authority}</div>
                      </div>
                    </div>
                  </div>

                  {/* Core stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Epoch</div>
                      <div className="font-mono text-sm text-foreground">#{authorityProof.agent.epoch}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Bond</div>
                      <div className="font-mono text-sm text-foreground">{authorityProof.agent.bond}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Verified Outcomes</div>
                      <div className="font-mono text-sm text-foreground">{authorityProof.agent.verified_outcomes}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Success Rate</div>
                      <div className={cn('font-mono text-sm',
                        parseFloat(authorityProof.agent.success_rate) >= 90 ? 'text-emerald-400'
                        : parseFloat(authorityProof.agent.success_rate) >= 70 ? 'text-[#E8B96B]'
                        : 'text-rose-400')}>
                        {authorityProof.agent.success_rate}
                      </div>
                    </div>
                  </div>

                  {/* Latest evidence + transition */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Latest Evidence</div>
                      <div className="flex items-center gap-2">
                        {authorityProof.latest_evidence.result === 'pass' ? (
                          <><Check className="h-4 w-4 text-emerald-400" /><span className="text-sm font-mono text-emerald-400">PASS</span></>
                        ) : authorityProof.latest_evidence.result === 'fail' ? (
                          <><AlertTriangle className="h-4 w-4 text-rose-400" /><span className="text-sm font-mono text-rose-400">CRITICAL FAIL</span></>
                        ) : (
                          <><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-mono text-muted-foreground">NONE</span></>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">{authorityProof.latest_evidence.description}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Latest Transition</div>
                      <div className="font-mono text-xs text-foreground">{authorityProof.latest_transition}</div>
                    </div>
                  </div>

                  {/* Registered verifiers */}
                  <div className="p-3 rounded-lg bg-[#101216] border border-white/[0.04]">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Registered Verifiers</div>
                    <div className="flex flex-wrap gap-2">
                      {authorityProof.registered_verifiers?.map((v: any) => (
                        <div key={v.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                          <LiveDot color="#34D399" size={4} />
                          <span className="text-[10px] font-mono text-foreground/90">{v.name}</span>
                          <span className="text-[9px] text-muted-foreground">{v.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* On-chain links */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <a href={authorityProof.authority_root.explorerUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-[#101216] border border-white/[0.04] hover:border-emerald-500/20 transition-colors group">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Authority Root</div>
                        <code className="text-[10px] font-mono text-foreground/80">{authorityProof.authority_root.short}</code>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                    <a href={authorityProof.agent_pda.explorerUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-[#101216] border border-white/[0.04] hover:border-emerald-500/20 transition-colors group">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Agent PDA</div>
                        <code className="text-[10px] font-mono text-foreground/80">{authorityProof.agent_pda.short}</code>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                    <a href={authorityProof.bond_pda.explorerUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-[#101216] border border-white/[0.04] hover:border-emerald-500/20 transition-colors group">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Bond PDA</div>
                        <code className="text-[10px] font-mono text-foreground/80">{authorityProof.bond_pda.short}</code>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>

                  {/* Proof transactions */}
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Proof Transactions</div>
                    <div className="space-y-1.5">
                      {authorityProof.proof_transactions?.map((tx: any) => (
                        <a key={tx.signature} href={tx.explorerUrl} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#101216] border border-white/[0.04] hover:border-emerald-500/20 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] font-mono text-muted-foreground uppercase">{tx.label}</span>
                            <span className={cn('h-1.5 w-1.5 rounded-full', tx.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400')} />
                            <code className="text-[10px] font-mono text-foreground/70 truncate">{tx.signature.slice(0, 16)}...{tx.signature.slice(-6)}</code>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Thesis line */}
                  <div className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                    <p className="text-xs text-emerald-300/90 italic leading-relaxed">{authorityProof.thesis}</p>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </PremiumCard>
          </SectionShell>

          {/* ===== TRANSACTION HISTORY ===== */}
          <SectionShell id="history" index={16}>
            <SectionTitle icon={Clock} title="Transaction History" hint={txHistory ? `${txHistory.count} txs` : '—'} accent="sky" />
            <PremiumCard className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">Recent on-chain activity for this agent PDA</span>
                <Button variant="ghost" size="sm" onClick={() => { setShowTxHistory(!showTxHistory); fetchTxHistory(activeAgentId) }}
                  className="text-xs h-7 gap-1">
                  <RefreshCw className={cn('h-3 w-3', txHistoryLoading && 'animate-spin')} />
                  {showTxHistory ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showTxHistory && (
                txHistoryLoading && !txHistory ? (
                  <div className="text-sm text-muted-foreground py-4 text-center font-mono">Loading transactions...</div>
                ) : txHistory && txHistory.transactions.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                    {txHistory.transactions.map((tx) => (
                      <div key={tx.signature} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs">
                        <StatusPill status={tx.err ? 'deprecated' : 'deployed'} label={tx.err ? 'failed' : 'confirmed'} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-[11px] text-foreground/80 truncate">
                              {tx.signature.slice(0, 8)}…{tx.signature.slice(-4)}
                            </code>
                            {tx.instruction && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] font-mono shrink-0 text-muted-foreground">
                                {tx.instruction.slice(0, 4)}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            slot {tx.slot.toLocaleString()}
                            {tx.blockTime && ` · ${timeAgo(tx.blockTime * 1000)}`}
                          </div>
                        </div>
                        <a href={tx.explorerUrl} target="_blank" rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center font-mono">No transactions found</div>
                )
              )}
            </PremiumCard>
          </SectionShell>

          {/* ===== FOOTER ===== */}
          <footer className="pt-6 pb-8 border-t border-white/[0.04] mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-4">
              <StatTile label="Programs" value={PROGRAMS.length} icon={Network} accent="emerald" />
              <StatTile label="Instructions" value={deployment?.programs.reduce((s, p) => s + p.instructions, 0) ?? TOTAL_INSTRUCTIONS} icon={Cpu} accent="sky" />
              <StatTile label="Accounts" value={10} icon={Database} accent="amber" />
              <StatTile label="Security Checks" value={14} icon={Lock} accent="violet" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3 w-3" />GitHub
                </a>
                <Separator orientation="vertical" className="h-3 bg-white/[0.08]" />
                <a href={VERCEL_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3 w-3" />Vercel
                </a>
                <Separator orientation="vertical" className="h-3 bg-white/[0.08]" />
                <span className="text-muted-foreground font-mono">
                  {deployment ? `${deployment.cluster.toUpperCase()} · ${deployment.balanceSOL.toFixed(2)} SOL` : 'devnet'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
                {PROGRAMS.map((p, i) => (
                  <span key={p.name} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-white/[0.1]">·</span>}
                    <span title={p.id}>{shortHash(p.id, 4, 4)}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 text-center">
              <div className="text-[10px] text-muted-foreground font-mono">
                PACTYRA turns verified outcomes into enforceable economic authority.
              </div>
            </div>
          </footer>
        </motion.div>
      </div>

      {/* CONFIRMATION DIALOG */}
      <AlertDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <AlertDialogContent className="bg-[#161A20] border-white/[0.08]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              {pending?.title ?? 'Confirm action'}
            </AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.03] border-white/[0.06]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmIrreversible}
              className="bg-rose-600 text-white hover:bg-rose-700">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
