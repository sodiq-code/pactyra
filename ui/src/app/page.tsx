'use client'

// PACTYRA — Agent Passport UI
// Evidence-bound economic authority for autonomous agents on Solana.
// Single-page dashboard: clean, dense, professional.

import { useState, useEffect, useCallback } from 'react'
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
  Shield, Activity, DollarSign, Lock, Zap, Copy, Check, RefreshCw,
  Plus, AlertTriangle, Users, Clock, ExternalLink, Sun, Moon, ChevronRight,
} from 'lucide-react'

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

// Irreversible governance actions gated by an AlertDialog confirmation.
type IrreversibleKey =
  | 'freeze'
  | 'replace_authority'
  | 'supersede'
  | 'deprecate'

interface IrreversibleAction {
  key: IrreversibleKey
  title: string
  description: string
  body: () => Record<string, unknown>
  label: string
}

const TIER_CONFIG: Record<Tier, { amount: number; gradient: string; glow: string; text: string }> = {
  Probation: { amount: 5,   gradient: 'from-rose-500 to-red-600',         glow: 'shadow-[0_0_24px_rgba(244,63,94,0.45)]',  text: 'text-rose-400' },
  Proven:    { amount: 50,  gradient: 'from-amber-400 to-orange-500',     glow: 'shadow-[0_0_24px_rgba(245,158,11,0.45)]', text: 'text-amber-400' },
  Trusted:   { amount: 500, gradient: 'from-emerald-400 to-teal-500',     glow: 'shadow-[0_0_28px_rgba(16,185,129,0.55)]', text: 'text-emerald-400' },
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
  { name: 'pactyra-core',       role: 'Authority root', desc: 'Bonds, tiers, capabilities, epochs, Execution PDA', color: 'emerald' },
  { name: 'pactyra-verifier',   role: 'Attestation',    desc: 'Pyth price freshness → record_outcome CPI',         color: 'sky' },
  { name: 'reference-treasury', role: 'Consumer',       desc: 'CPI-gated USDC transfers (assert → transfer → mark)', color: 'amber' },
  { name: 'threshold-multisig', role: 'Governance',    desc: '3-of-5 threshold backing protocol authority',       color: 'violet' },
] as const

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
      className="bg-card/50 border-border/50 backdrop-blur min-h-[44px] sm:min-h-0 sm:size-9">
      {mounted && theme === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4" />}
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
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy}
      title="Copy to clipboard" aria-label="Copy to clipboard">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" />
             : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  )
}

function SectionHeader({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {hint && <span className="ml-auto text-xs text-muted-foreground font-mono">{hint}</span>}
    </div>
  )
}

function Metric({ label, value, icon: Icon, accent = 'default' }: {
  label: string; value: number | string; icon: React.ElementType
  accent?: 'default' | 'emerald' | 'amber' | 'rose'
}) {
  const c = { default: 'text-foreground', emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400' }[accent]
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className={cn('font-mono text-xl font-semibold tabular-nums', c)}>{value}</div>
    </div>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm', mono && 'font-mono')}>{value}</div>
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
  const [showJudgeMode, setShowJudgeMode] = useState(false)
  const [x402DemoLoading, setX402DemoLoading] = useState(false)
  const [x402DemoResult, setX402DemoResult] = useState<any>(null)

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

  useEffect(() => {
    fetchAgent(PERMANENT_AGENT_ID)
    fetchDeployment()
    fetchTxHistory(PERMANENT_AGENT_ID)
  }, [fetchAgent, fetchDeployment, fetchTxHistory])

  useEffect(() => {
    const t = setInterval(() => fetchAgent(activeAgentId, true), 60000)
    return () => clearInterval(t)
  }, [activeAgentId, fetchAgent])

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
      const res = await fetch('/api/x402/demo', { cache: 'no-store' })
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

  // Trigger an irreversible action — first shows the confirmation dialog,
  // only dispatches to /api/governance if the user explicitly confirms.
  const queueIrreversible = (action: IrreversibleAction) => setPending(action)
  const confirmIrreversible = () => {
    if (!pending) return
    const p = pending
    setPending(null)
    handleGovernance(p.key, p.body(), p.label)
  }

  const tier: Tier = agent?.tier || 'Trusted'
  const tierCfg = TIER_CONFIG[tier]
  const maxAmount = agent?.maxAmount ?? tierCfg.amount
  const successCount = agent?.successCount ?? 0
  const totalCount = agent?.totalCount ?? 0
  const successRate = agent?.successRate ?? 0
  const criticalFailures = agent?.criticalFailures ?? 0
  // bondAmount comes from on-chain as micro-USDC (e.g. 5_000_000 = 5 USDC)
  const bondAmount = (agent?.bondAmount ?? 0) / 1_000_000
  const epoch = agent?.currentEpoch ?? 0
  const status = agent?.status ?? '—'
  const found = agent?.found ?? false
  const agentPda = agent?.agentPda || ''
  const authorityRoot = agent?.authorityRoot || ''
  // LIVE = we successfully fetched from devnet (agent may still be unregistered)
  const liveOk = agent !== null && !agentLoading
  const agentReady = found && status === 'Active'

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-60"
        style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(16,185,129,0.08), transparent 70%)' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* HEADER */}
        <header className="flex items-center justify-between gap-3 flex-wrap mb-6 sm:mb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_0_18px_rgba(16,185,129,0.4)]">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm font-bold tracking-wider">PACTYRA</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Agent Passport</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge variant="outline"
              className={cn('gap-1.5 font-mono text-xs',
                connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-400')}
              title={connected ? 'Wallet connected — live transactions enabled'
                               : 'Demo mode — connect Phantom for live governance'}>
              <span className={cn('h-1.5 w-1.5 rounded-full',
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
              {connected ? 'Connected' : 'Demo Mode'}
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
            <Button variant="outline" size="sm"
              onClick={() => { fetchAgent(activeAgentId); fetchDeployment(); fetchTxHistory(activeAgentId) }}
              className="bg-card/50 border-border/50 backdrop-blur gap-1.5 min-h-[44px] sm:min-h-0" title="Refresh data">
              <RefreshCw className={cn('h-3.5 w-3.5', agentLoading && 'animate-spin')} />
              <span className="hidden sm:inline text-xs">Refresh</span>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }} className="flex flex-col gap-6">

          {/* HERO */}
          <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Agent ID</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs sm:text-sm break-all text-foreground/90">{activeAgentId}</code>
                    <CopyButton value={activeAgentId} label="Agent ID copied" />
                  </div>
                  {agentPda && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">PDA: {shortHash(agentPda, 6, 6)}</span>
                      <CopyButton value={agentPda} label="Agent PDA copied" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                  <Badge className={cn('bg-gradient-to-r text-white border-0 px-3 py-1', tierCfg.gradient, tierCfg.glow)}>
                    <Shield className="h-3 w-3 mr-1" />{tier}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tier</span>
                </div>
              </div>

              <div className="flex items-end justify-between mb-6 pb-6 border-b border-border/40">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Current Authority</div>
                  <div className="flex items-baseline gap-1">
                    <DollarSign className={cn('h-8 w-8', tierCfg.text)} />
                    <span className={cn('text-5xl font-bold tracking-tight', tierCfg.text)}>{maxAmount}</span>
                    <span className="text-sm text-muted-foreground ml-1">USDC cap</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</div>
                  <Badge variant="outline"
                    className={cn('gap-1.5 font-mono',
                      status === 'Active' ? 'border-emerald-500/40 text-emerald-400'
                                          : 'border-rose-500/40 text-rose-400')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full',
                      status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500')} />
                    {status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Metric label="Verified" value={totalCount} icon={Activity} />
                <Metric label="Successful" value={successCount} icon={Check} accent="emerald" />
                <Metric label="Rate" value={`${successRate}%`} icon={Zap}
                  accent={successRate >= 90 ? 'emerald' : successRate >= 70 ? 'amber' : 'rose'} />
                <Metric label="Critical" value={criticalFailures} icon={AlertTriangle}
                  accent={criticalFailures === 0 ? 'emerald' : 'rose'} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <KV label="Bond" value={`${bondAmount} USDC`} mono />
                <KV label="Epoch" value={`#${epoch}`} mono />
                <KV label="Updated" value={agentLoading ? 'Loading...' : timeAgo(lastUpdated)} mono />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => handleRecordOutcome('pass', 'none')} disabled={recording !== ''}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] sm:min-h-9">
                  <Check className="h-4 w-4" />
                  {recording === 'success' ? 'Recording...' : 'Record Success'}
                </Button>
                <Button onClick={() => handleRecordOutcome('fail', 'critical')} disabled={recording !== ''}
                  variant="outline"
                  className="flex-1 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-400 min-h-[44px] sm:min-h-9">
                  <AlertTriangle className="h-4 w-4" />
                  {recording === 'critical' ? 'Recording...' : 'Record Critical Failure'}
                </Button>
              </div>

              {authorityRoot && (
                <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Authority root:</span>
                  <a href={`${SOLANA_FM_BASE}/${authorityRoot}?cluster=devnet`} target="_blank" rel="noreferrer"
                    className="font-mono hover:text-foreground inline-flex items-center gap-0.5"
                    title="View on Solana.fm">
                    {shortHash(authorityRoot, 6, 6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* HOW IT WORKS */}
          <section>
            <SectionHeader icon={Activity} title="How It Works" hint="register → earn → spend → prove" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { step: '1', title: 'Register & Bond', desc: 'Agent registers with a 5 USDC bond, locked in a PDA vault. Starts at Tier 1 ($5 authority).', color: 'emerald' },
                    { step: '2', title: 'Request Capability', desc: 'Agent requests scoped authority: target program, target account, amount limit, TTL.', color: 'sky' },
                    { step: '3', title: 'Assert & Execute', desc: 'assert_capability checks 14 security rules. Target program executes and calls mark_executed via CPI.', color: 'amber' },
                    { step: '4', title: 'Record Outcome', desc: 'Verifier records outcome. 5 passes → T2 ($50). 20+ at 95% → T3 ($500). Critical fail → slash, T1.', color: 'violet' },
                  ].map((s) => (
                    <div key={s.step} className={cn('flex items-start gap-3 p-3 rounded-lg border',
                      s.color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/15'
                      : s.color === 'sky'    ? 'bg-sky-500/5 border-sky-500/15'
                      : s.color === 'amber'   ? 'bg-amber-500/5 border-amber-500/15'
                      : 'bg-violet-500/5 border-violet-500/15')}>
                      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold',
                        s.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400'
                        : s.color === 'sky'    ? 'bg-sky-500/15 text-sky-400'
                        : s.color === 'amber'   ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-violet-500/15 text-violet-400')}>
                        {s.step}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground mb-0.5">{s.title}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* JUDGE MODE */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Judge Mode</h2>
              <Button variant="ghost" size="sm"
                onClick={() => setShowJudgeMode(!showJudgeMode)}
                className="ml-auto text-xs h-7 gap-1">
                {showJudgeMode ? 'Hide' : 'Show Evidence'}
              </Button>
            </div>
            {showJudgeMode && (
              <Card className="bg-card/50 backdrop-blur border-emerald-500/20">
                <CardContent className="pt-6 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Verifiable on-chain evidence for each protocol claim. Every link opens Solana.fm with the devnet cluster parameter — judges can independently verify each assertion.
                  </p>
                  <div className="space-y-1.5">
                    {JUDGE_CLAIMS.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-md bg-background/30 border border-border/30 hover:border-emerald-500/30 transition-colors">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-foreground">{c.claim}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.evidence}</div>
                        </div>
                        <a href={c.link} target="_blank" rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 shrink-0 inline-flex items-center gap-1 text-[10px] font-mono"
                          title="Verify on Solana.fm">
                          Verify
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

          {/* AGENT OPERATIONS */}
          <section>
            <SectionHeader icon={Plus} title="Agent Operations" hint="register · bond" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Register New Agent</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input value={registerId} onChange={(e) => setRegisterId(e.target.value)}
                      placeholder="64-char hex agent ID"
                      className="font-mono text-xs bg-background/50 border-border/50" />
                    <Button variant="outline" onClick={() => setRegisterId(randomAgentId())}
                      title="Generate random 32-byte agent ID" className="shrink-0">
                      <RefreshCw className="h-3.5 w-3.5" />Generate
                    </Button>
                    <Button onClick={handleRegister} disabled={registering || !registerId} className="shrink-0">
                      <Plus className="h-4 w-4" />
                      {registering ? 'Registering...' : 'Register'}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/40" />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">Lock Bond</div>
                    <div className="font-mono text-sm">
                      5 USDC
                      <span className="text-muted-foreground text-xs ml-2">stake against agent misbehavior</span>
                    </div>
                  </div>
                  <Button onClick={handleLockBond} disabled={lockingBond} variant="outline"
                    className="shrink-0 min-h-[44px] sm:min-h-9">
                    <Lock className="h-4 w-4" />
                    {lockingBond ? 'Locking...' : 'Lock Bond'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* GOVERNANCE */}
          <section>
            <SectionHeader icon={Shield} title="Governance" hint="delegate · freeze · supersede · replace" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6 space-y-5">
                <div>
                  <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />Session Keys
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
                    <Input value={delegateKey} onChange={(e) => setDelegateKey(e.target.value)}
                      placeholder="Delegate pubkey (base58)"
                      className="font-mono text-xs bg-background/50 border-border/50" />
                    <Input value={delegateMax} onChange={(e) => setDelegateMax(e.target.value)}
                      placeholder="Max USDC" type="number"
                      className="font-mono text-xs bg-background/50 border-border/50" />
                    <div className="flex gap-2">
                      <Button variant="default" size="sm"
                        disabled={govBusy === 'delegate' || !delegateKey}
                        onClick={() => handleGovernance('delegate',
                          { delegate: delegateKey, maxAmount: Number(delegateMax) * 1_000_000, expiresIn: 3600 }, 'Delegate')}>
                        {govBusy === 'delegate' ? '...' : 'Grant'}
                      </Button>
                      <Button variant="outline" size="sm"
                        disabled={govBusy === 'revoke_delegate'}
                        onClick={() => handleGovernance('revoke_delegate', {}, 'Revoke delegate')}>
                        Revoke
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator className="bg-border/40" />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium mb-1 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />Agent Status
                    </div>
                    <div className="text-xs text-muted-foreground">Freeze to halt agent activity instantly.</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" disabled={govBusy === 'freeze'}
                      onClick={() => queueIrreversible({
                        key: 'freeze',
                        title: 'Freeze Agent',
                        description: 'This will prevent the agent from asserting any capabilities. Continue?',
                        body: () => ({}),
                        label: 'Freeze',
                      })}
                      className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 min-h-[44px] sm:min-h-8">Freeze</Button>
                    <Button variant="outline" size="sm" disabled={govBusy === 'unfreeze'}
                      onClick={() => handleGovernance('unfreeze', {}, 'Unfreeze')}
                      className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 min-h-[44px] sm:min-h-8">Unfreeze</Button>
                  </div>
                </div>

                <Separator className="bg-border/40" />

                <div>
                  <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />Policy Supersede
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                    <Input value={oldPolicyTag} onChange={(e) => setOldPolicyTag(e.target.value)}
                      placeholder="Old version tag"
                      className="font-mono text-xs bg-background/50 border-border/50" />
                    <Input value={newPolicyTag} onChange={(e) => setNewPolicyTag(e.target.value)}
                      placeholder="New version tag"
                      className="font-mono text-xs bg-background/50 border-border/50" />
                    <Button variant="default" size="sm" disabled={govBusy === 'supersede'}
                      onClick={() => queueIrreversible({
                        key: 'supersede',
                        title: 'Supersede Policy',
                        description: 'This will mark the old policy as superseded. Existing capabilities will expire naturally. Continue?',
                        body: () => ({ oldVersionTag: oldPolicyTag, newVersionTag: newPolicyTag }),
                        label: 'Supersede policy',
                      })}
                      className="min-h-[44px] sm:min-h-8">
                      {govBusy === 'supersede' ? '...' : 'Supersede'}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/40" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />Deprecate Verifier
                    </div>
                    <div className="flex gap-2">
                      <Input value={verifierIdx} onChange={(e) => setVerifierIdx(e.target.value)}
                        placeholder="Index" type="number"
                        className="font-mono text-xs bg-background/50 border-border/50" />
                      <Button variant="outline" size="sm" disabled={govBusy === 'deprecate'}
                        onClick={() => queueIrreversible({
                          key: 'deprecate',
                          title: 'Deprecate Verifier',
                          description: 'This will mark the verifier as inactive. New receipts from this verifier will be rejected. Continue?',
                          body: () => ({ verifierIndex: Number(verifierIdx) }),
                          label: 'Deprecate verifier',
                        })}
                        className="min-h-[44px] sm:min-h-8">
                        {govBusy === 'deprecate' ? '...' : 'Deprecate'}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />Replace Authority
                    </div>
                    <div className="flex gap-2">
                      <Input value={newAuthority} onChange={(e) => setNewAuthority(e.target.value)}
                        placeholder="New authority pubkey"
                        className="font-mono text-xs bg-background/50 border-border/50" />
                      <Button variant="default" size="sm"
                        disabled={govBusy === 'replace_authority' || !newAuthority}
                        onClick={() => queueIrreversible({
                          key: 'replace_authority',
                          title: 'Replace Protocol Authority',
                          description: 'This transfers control of the VerifierRegistry to a new key. This is irreversible. Continue?',
                          body: () => ({ newAuthority }),
                          label: 'Replace authority',
                        })}
                        className="min-h-[44px] sm:min-h-8">
                        {govBusy === 'replace_authority' ? '...' : 'Replace'}
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator className="bg-border/40" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Alert className="bg-background/40 border-border/40">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-xs">
                      <span className="font-medium">Timelock:</span> 24h delay on all authority-replacement actions.
                    </AlertDescription>
                  </Alert>
                  <Alert className="bg-background/40 border-border/40">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <AlertDescription className="text-xs">
                      <span className="font-medium">Multisig:</span> 3-of-5 threshold ·
                      <a href={`${SOLANA_FM_BASE}/${MULTISIG_PDA}?cluster=devnet`} target="_blank" rel="noreferrer"
                        className="font-mono hover:text-foreground inline-flex items-center gap-0.5 ml-1"
                        title="View multisig PDA on Solana.fm">
                        {shortHash(MULTISIG_PDA, 6, 6)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* DEPLOYMENT STATUS */}
          <section>
            <SectionHeader icon={Activity} title="Deployment Status"
              hint={deployment ? `${deployment.cluster.toUpperCase()} · ${deployment.balanceSOL.toFixed(2)} SOL` : '—'} />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6">
                {deploymentLoading && !deployment ? (
                  <div className="text-sm text-muted-foreground py-4 text-center font-mono">Loading deployment data...</div>
                ) : (
                  <div className="space-y-1">
                    {PROGRAMS.map((p) => {
                      const live = deployment?.programs.find((dp) => dp.name === p.name)
                      const deployed = live?.deployed ?? false
                      return (
                        <div key={p.name}
                          className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                            deployed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400')}>
                            {deployed ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-sm font-medium">{p.name}</code>
                              <Badge variant="outline"
                                className={cn('text-[10px] py-0 px-1.5',
                                  deployed ? 'border-emerald-500/30 text-emerald-400'
                                           : 'border-rose-500/30 text-rose-400')}>
                                {deployed ? 'Devnet' : 'Missing'}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{p.description}</div>
                          </div>
                          <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground font-mono">
                            <span>{live?.instructions ?? p.instructions} instr</span>
                            <span>{live?.size ?? p.size}KB</span>
                          </div>
                          <CopyButton value={p.id} label={`${p.name} program ID copied`} />
                          <a href={`${SOLANA_FM_BASE}/${p.id}?cluster=devnet`} target="_blank" rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="View on Solana.fm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* EXECUTION PDA */}
          <section>
            <SectionHeader icon={Shield} title="Execution PDA" hint="assert → execute → record" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every capability assertion creates an on-chain Execution PDA that cryptographically binds the assertion to the actual action performed. The verifier cannot fabricate outcomes for actions that never happened — <span className="text-foreground font-medium">record_outcome requires Executed status</span>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {EXECUTION_STAGES.map((s, i) => (
                    <div key={s.stage} className="relative">
                      {i < EXECUTION_STAGES.length - 1 && (
                        <div className="hidden md:block absolute top-5 -right-2 z-10 text-muted-foreground/40">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex flex-col items-center text-center gap-2 p-3 rounded-lg bg-background/30 border border-border/30">
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full shrink-0',
                          i === 0 ? 'bg-amber-500/15 text-amber-400'
                          : i === 1 ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-teal-500/15 text-teal-400')}>
                          {i === 0 ? <Shield className="h-4 w-4" />
                           : i === 1 ? <Check className="h-4 w-4" />
                           : <Lock className="h-4 w-4" />}
                        </div>
                        <div className="font-mono text-xs font-semibold tracking-wide">{s.stage}</div>
                        <div className="text-[10px] text-muted-foreground leading-snug">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 text-[10px] text-muted-foreground font-mono">
                  <span className="shrink-0">action_id =</span>
                  <code className="text-[10px] text-foreground/70 bg-background/40 px-2 py-1 rounded break-all">
                    keccak256(agent_id, capability_id, action_type, target_program, target_account, amount, action_nonce)
                  </code>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* SECURITY CHECKS */}
          <section>
            <SectionHeader icon={Shield} title="Security Checks" hint="14 checks in assert_capability" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SECURITY_CHECKS.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 mt-0.5">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span className="text-muted-foreground">{check}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* PROTOCOL ARCHITECTURE */}
          <section>
            <SectionHeader icon={Shield} title="Protocol Architecture" hint="4 programs · CPI flow" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Four programs cooperate via CPI. The core program holds authority; the verifier attests outcomes; the treasury consumes authority to move USDC; the multisig governs trust-root operations.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ARCH_NODES.map((n, i) => (
                    <div key={n.name} className={cn('flex items-start gap-3 p-3 rounded-lg border',
                      n.color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20'
                      : n.color === 'sky'    ? 'bg-sky-500/5 border-sky-500/20'
                      : n.color === 'amber'   ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-violet-500/5 border-violet-500/20')}>
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold',
                        n.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400'
                        : n.color === 'sky'    ? 'bg-sky-500/15 text-sky-400'
                        : n.color === 'amber'  ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-violet-500/15 text-violet-400')}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono text-xs font-semibold">{n.name}</code>
                          <Badge variant="outline" className={cn('text-[9px] py-0 px-1.5',
                            n.color === 'emerald' ? 'border-emerald-500/30 text-emerald-400'
                            : n.color === 'sky'    ? 'border-sky-500/30 text-sky-400'
                            : n.color === 'amber'   ? 'border-amber-500/30 text-amber-400'
                            : 'border-violet-500/30 text-violet-400')}>
                            {n.role}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{n.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-muted-foreground font-mono">
                  <span className="text-emerald-400">core</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-sky-400">verifier</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-amber-400">treasury</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-violet-400">multisig</span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* AUTHORITY LOOP */}
          <section>
            <SectionHeader icon={Activity} title="Authority Loop" hint="$5 → $50 → $500 → $5" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Agents earn economic authority through verified execution history. Each tier unlocks higher transaction limits; a critical failure slashes the bond and resets authority to Tier 1.
                </p>
                <div className="flex items-center justify-between gap-2">
                  {[
                    { tier: 'T1', amount: '$5',   label: 'Probation', color: 'rose' },
                    { tier: 'T2', amount: '$50',  label: 'Proven',    color: 'amber' },
                    { tier: 'T3', amount: '$500', label: 'Trusted',   color: 'emerald' },
                  ].map((t, i) => (
                    <div key={t.tier} className="flex items-center gap-2 flex-1">
                      <div className={cn('flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border',
                        t.color === 'rose'     ? 'bg-rose-500/5 border-rose-500/20'
                        : t.color === 'amber'   ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-emerald-500/5 border-emerald-500/20')}>
                        <span className={cn('text-lg font-bold',
                          t.color === 'rose'     ? 'text-rose-400'
                          : t.color === 'amber'   ? 'text-amber-400'
                          : 'text-emerald-400')}>{t.amount}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{t.label}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{t.tier}</span>
                      </div>
                      {i < 2 && (
                        <div className="flex flex-col items-center shrink-0">
                          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-[8px] text-muted-foreground/60 font-mono mt-0.5">5✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-rose-400" />
                  <span>Critical failure → bond slashed, epoch++, back to T1</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-rose-400 font-mono">$5</span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* TRANSACTION HISTORY */}
          <section>
            <SectionHeader icon={Clock} title="Transaction History" hint={txHistory ? `${txHistory.count} txs` : '—'} />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6">
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
                        <div key={tx.signature} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-background/30 text-xs">
                          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                            tx.err ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400')}>
                            {tx.err ? <AlertTriangle className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-[11px] text-foreground/80 truncate">
                                {tx.signature.slice(0, 8)}…{tx.signature.slice(-4)}
                              </code>
                              {tx.instruction && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono shrink-0">
                                  {tx.instruction.slice(0, 4)}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              slot {tx.slot.toLocaleString()}
                              {tx.blockTime && ` · ${timeAgo(tx.blockTime * 1000)}`}
                            </div>
                          </div>
                          <a href={tx.explorerUrl} target="_blank" rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0" title="View on Solana.fm">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center font-mono">No transactions found</div>
                  )
                )}
              </CardContent>
            </Card>
          </section>

          {/* X402 PAYMENT */}
          <section>
            <SectionHeader icon={DollarSign} title="x402 Payment" hint="real USDC · on-chain verified" />
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Real x402 V2 HTTP payment protocol integration. The adapter checks PACTYRA capability, then makes a <span className="text-foreground font-medium">real on-chain USDC transfer</span>. No simulated signatures — the facilitator verifies the transaction on Solana before returning the resource.
                </p>

                {/* x402 flow visualization */}
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                  {[
                    { label: '402', desc: 'Payment Required', color: 'amber' },
                    { label: '✓', desc: 'Capability', color: 'emerald' },
                    { label: '$', desc: 'USDC Transfer', color: 'sky' },
                    { label: '200', desc: 'Verified', color: 'emerald' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className={cn('flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border',
                        s.color === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : s.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-sky-500/10 border-sky-500/20 text-sky-400')}>
                        <span className="font-bold text-sm">{s.label}</span>
                        <span className="text-[8px] text-muted-foreground uppercase">{s.desc}</span>
                      </div>
                      {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  ))}
                </div>

                {/* Run demo button */}
                <div className="flex items-center gap-3">
                  <Button onClick={runX402Demo} disabled={x402DemoLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <DollarSign className="h-4 w-4" />
                    {x402DemoLoading ? 'Running x402 flow...' : 'Run Real x402 Payment'}
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    Pays 0.01 USDC on devnet
                  </span>
                </div>

                {/* Results */}
                {x402DemoResult && (
                  <div className="space-y-2">
                    {x402DemoResult.ok ? (
                      <>
                        <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                          <Check className="h-4 w-4 text-emerald-400" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-emerald-400">Payment verified on-chain</div>
                            <div className="text-[10px] text-muted-foreground font-mono break-all">
                              Signature: {x402DemoResult.signature?.slice(0, 16)}...{x402DemoResult.signature?.slice(-8)}
                            </div>
                          </div>
                          <a href={x402DemoResult.explorerUrl} target="_blank" rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 shrink-0" title="View on Solana.fm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        {/* Show step results */}
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
                      <div className="flex items-center gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
                        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                        <div className="text-xs text-rose-400">{x402DemoResult.error || x402DemoResult.message || 'Failed'}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* FOOTER */}
          <footer className="pt-4 pb-8 border-t border-border/40">
            <div className="flex flex-col gap-4">
              {/* Footer stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="flex flex-col gap-0.5 p-2 rounded-md bg-card/30 border border-border/20">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Programs</span>
                  <span className="font-mono text-sm font-semibold text-emerald-400">{PROGRAMS.length}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-md bg-card/30 border border-border/20">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Instructions</span>
                  <span className="font-mono text-sm font-semibold text-sky-400">{deployment?.programs.reduce((s, p) => s + p.instructions, 0) ?? TOTAL_INSTRUCTIONS}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-md bg-card/30 border border-border/20">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Accounts</span>
                  <span className="font-mono text-sm font-semibold text-amber-400">10</span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-md bg-card/30 border border-border/20">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Security Checks</span>
                  <span className="font-mono text-sm font-semibold text-violet-400">13</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 text-xs">
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" title="GitHub repository">
                    <ExternalLink className="h-3 w-3" />GitHub
                  </a>
                  <Separator orientation="vertical" className="h-3 bg-border/40" />
                  <a href={VERCEL_URL} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" title="Vercel deployment">
                    <ExternalLink className="h-3 w-3" />Vercel
                  </a>
                  <Separator orientation="vertical" className="h-3 bg-border/40" />
                  <span className="text-muted-foreground font-mono">
                    {deployment ? `${deployment.cluster.toUpperCase()} · ${deployment.balanceSOL.toFixed(2)} SOL` : 'devnet'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
                  {PROGRAMS.map((p, i) => (
                    <span key={p.name} className="inline-flex items-center gap-1">
                      {i > 0 && <span className="text-border/60">·</span>}
                      <span title={p.id}>{shortHash(p.id, 4, 4)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </motion.div>

        {/* CONFIRMATION DIALOG for irreversible governance actions */}
        <AlertDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                {pending?.title ?? 'Confirm action'}
              </AlertDialogTitle>
              <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmIrreversible}
                className="bg-rose-600 text-white hover:bg-rose-700">
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
