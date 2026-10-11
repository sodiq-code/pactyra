'use client'

/**
 * PACTYRA — Stale Epoch Rejection (demo / screen-record page)
 * ----------------------------------------------------------
 * Displays a REAL on-chain StaleEpoch rejection (Anchor error 6002 / 0x1772)
 * captured from Solana devnet. This page is purpose-built for screen
 * recording segments 1 (cold open) and 9 (old capability fails) of the
 * PACTYRA demo video.
 *
 * Data source: /home/z/my-project/demo-video/stale-epoch-result.json
 * The static payload is embedded directly so the page always renders even
 * if the dev server is slow. A live fetch from /api/demo/stale-epoch is
 * attempted on mount to refresh the on-chain state if available.
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ------------------------------------------------------------------ */
/* Real captured StaleEpoch rejection (Solana devnet)                 */
/* ------------------------------------------------------------------ */
const STATIC_RESULT = {
  ok: true,
  rejected: true,
  message: 'The agent retries with its old capability. Rejected — the authority epoch has incremented.',
  agent: {
    tier: 'Probation (T1)',
    currentEpoch: 2,
    criticalFailures: 1,
    agentPda: '5zeTP8Dct4c2zm8dNchPXDEGkn7AUZEW3Niujx7KqKT4',
  },
  capability: {
    epoch: 1,
    pda: '311cusanUs39gGLhZ8DTMMp63m7493zJZAuPvG3p9RyC',
    status: 'stale — issued under a previous authority epoch',
  },
  rejection: {
    code: 'StaleEpoch',
    errorCode: 6002,
    message: 'The private key is still valid. The capability is permanently invalid. Its authority epoch has passed.',
    check: 'Check 4: capability.authority_epoch == agent.current_epoch — FAILS',
    rawError:
      'Simulation failed. \nMessage: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1772. \nLogs: \n[\n  "Program FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf invoke [1]",\n  "Program log: Instruction: AssertCapability",\n  "Program 11111111111111111111111111111111 invoke ...',
  },
  enforcement: '14 security checks — check 4 (Authority epoch current) fails',
  narrative: 'The agent still has its key, but it no longer has the authority it had earned.',
  timestamp: '2026-10-10T23:30:26.779Z',
}

/* The on-chain program log lines we want to surface as evidence. The
 * real captured simulation produced these Anchor log lines. */
const PROGRAM_LOG_LINES: { text: string; tone: 'dim' | 'warn' | 'err' | 'ok' }[] = [
  { text: 'Program FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf invoke [1]', tone: 'dim' },
  { text: 'Program log: Instruction: AssertCapability', tone: 'dim' },
  {
    text: 'Program log: AnchorError thrown in programs/pactyra-core/src/lib.rs:647. Error Code: StaleEpoch. Error Number: 6002. Error Message: The authority epoch is stale.',
    tone: 'err',
  },
  { text: 'Program log: Leftover accounts data after instruction', tone: 'dim' },
  { text: 'Program FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf consumed 4993 of 1400000 compute units', tone: 'dim' },
  { text: 'Program FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf failed: custom program error: 0x1772', tone: 'err' },
]

const PACTYRA_CORE_ID = 'FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf'
const CLUSTER = 'Solana Devnet'

type Result = typeof STATIC_RESULT

export default function StaleEpochDemoPage() {
  const [result, setResult] = useState<Result>(STATIC_RESULT)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/demo/stale-epoch', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (cancelled) return
        if (data && data.rejected === true && data.rejection?.code === 'StaleEpoch') {
          // Reconcile the errorCode with the on-chain log (0x1772 = 6002)
          const reconciled: Result = {
            ...data,
            rejection: { ...data.rejection, errorCode: 6002 },
          }
          setResult(reconciled)
          setLive(true)
        }
      })
      .catch(() => {
        /* keep static payload */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const agent = result.agent
  const cap = result.capability
  const rej = result.rejection

  return (
    <main
      className="min-h-screen w-full flex flex-col p-6 gap-4"
      style={{ backgroundColor: '#0A0B0D', fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif' }}
    >
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between gap-6 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <PactyraMark />
            <div className="flex flex-col leading-tight">
              <span
                className="text-[15px] font-semibold tracking-[0.14em] text-white"
                style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
              >
                PACTYRA
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Stale Epoch Rejection
              </span>
            </div>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Program
            </span>
            <span
              className="text-[12px] text-white/70"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              {PACTYRA_CORE_ID.slice(0, 8)}…{PACTYRA_CORE_ID.slice(-6)}
            </span>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Cluster
            </span>
            <span
              className="text-[12px] text-white/70"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              {CLUSTER}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span
              className="text-[11px] uppercase tracking-[0.18em] text-white/60"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              {live ? 'Live · Devnet' : 'Captured · Devnet'}
            </span>
          </div>

          <Badge
            className="relative px-4 py-1.5 text-[13px] font-bold tracking-[0.18em] uppercase rounded-md"
            style={{
              backgroundColor: 'rgba(248, 113, 113, 0.12)',
              color: '#F87171',
              border: '1px solid rgba(248, 113, 113, 0.4)',
              boxShadow: '0 0 0 0 rgba(248, 113, 113, 0.5)',
              animation: 'stale-rejected-pulse 2s ease-out infinite',
            }}
          >
            ✕ Rejected
          </Badge>
        </div>
      </header>

      {/* ===== HERO STRIP: the rejection headline ===== */}
      <section
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background:
            'linear-gradient(135deg, rgba(248,113,113,0.10) 0%, rgba(16,18,22,0.9) 55%, rgba(232,185,107,0.06) 100%)',
          border: '1px solid rgba(248, 113, 113, 0.28)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 40px rgba(0,0,0,0.45)',
        }}
      >
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.24em] text-red-300/70">
              On-Chain Rejection · assert_capability
            </span>
            <div className="flex items-baseline gap-4 flex-wrap">
              <span
                className="text-[44px] leading-none font-bold tracking-tight"
                style={{
                  color: '#F87171',
                  fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
                  textShadow: '0 0 28px rgba(248,113,113,0.35)',
                }}
              >
                StaleEpoch
              </span>
              <span
                className="text-[22px] font-semibold text-white/85"
                style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
              >
                error&nbsp;6002
              </span>
              <span
                className="text-[14px] text-white/45"
                style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
              >
                0x1772
              </span>
            </div>
            <p className="text-[13px] text-white/55 max-w-2xl leading-relaxed">
              {rej.message}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Enforcement
              </span>
            </div>
            <div
              className="text-[12px] text-white/75 text-right"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              {result.enforcement}
            </div>
            <div className="mt-1 flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/25">
              <span className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">
                Check 4
              </span>
              <span
                className="text-[11px] text-red-300"
                style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
              >
                authority_epoch ≠ current_epoch
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== THREE CARDS: Agent · Capability · Failed Check ===== */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Agent state */}
        <Card
          className="rounded-2xl py-5 gap-3"
          style={{
            backgroundColor: '#101216',
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <CardHeader className="px-5 pb-0">
            <CardTitle className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Agent State
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded"
                style={{
                  color: '#E8B96B',
                  backgroundColor: 'rgba(232,185,107,0.10)',
                  border: '1px solid rgba(232,185,107,0.28)',
                  fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
                }}
              >
                {agent.tier}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <DataRow
              label="current_epoch"
              value={String(agent.currentEpoch)}
              valueTone="gold"
              big
            />
            <DataRow
              label="critical_failures"
              value={String(agent.criticalFailures)}
              valueTone="red"
            />
            <DataRow
              label="agent_pda"
              value={agent.agentPda}
              mono
              truncate
            />
          </CardContent>
        </Card>

        {/* Stale capability */}
        <Card
          className="rounded-2xl py-5 gap-3"
          style={{
            backgroundColor: '#101216',
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <CardHeader className="px-5 pb-0">
            <CardTitle className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Capability (stale)
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded"
                style={{
                  color: '#F87171',
                  backgroundColor: 'rgba(248,113,113,0.10)',
                  border: '1px solid rgba(248,113,113,0.28)',
                  fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
                }}
              >
                expired
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <DataRow
              label="authority_epoch"
              value={String(cap.epoch)}
              valueTone="gold"
              big
              hint="← previous epoch"
            />
            <DataRow label="status" value={cap.status} valueTone="red" />
            <DataRow label="capability_pda" value={cap.pda} mono truncate />
          </CardContent>
        </Card>

        {/* The failed check (highlighted) */}
        <Card
          className="rounded-2xl py-5 gap-3 relative overflow-hidden"
          style={{
            backgroundColor: '#101216',
            borderColor: 'rgba(248,113,113,0.35)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(248,113,113,0.08), 0 12px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: 'linear-gradient(180deg, #F87171, rgba(248,113,113,0.2))' }}
          />
          <CardHeader className="px-5 pb-0">
            <CardTitle className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                The Check That Failed
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded"
                style={{
                  color: '#F87171',
                  backgroundColor: 'rgba(248,113,113,0.10)',
                  border: '1px solid rgba(248,113,113,0.28)',
                  fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
                }}
              >
                fail
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="text-[13px] text-white/45"
                style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
              >
                Check 4
              </span>
              <span className="text-[12px] text-white/30">·</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Authority epoch current
              </span>
            </div>
            <div
              className="text-[12px] leading-relaxed px-3 py-2.5 rounded-md"
              style={{
                fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
                backgroundColor: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.18)',
                color: 'rgba(248,113,113,0.92)',
              }}
            >
              capability.authority_epoch&nbsp;==&nbsp;agent.current_epoch
              <div className="mt-1.5 text-[11px] text-red-300/70">
                {cap.epoch} ≠ {agent.currentEpoch} &nbsp;→&nbsp; assertion aborts
              </div>
            </div>
            <div className="mt-3 text-[12px] leading-relaxed text-white/55">
              {rej.check}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ===== TRANSACTION EVIDENCE ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card
          className="rounded-2xl py-5 gap-3 lg:col-span-3"
          style={{
            backgroundColor: '#0C0E12',
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <CardHeader className="px-5 pb-0">
            <CardTitle className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Transaction Evidence · Program Logs
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] text-white/40"
                style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
              >
                assert_capability
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <div
              className="rounded-md p-3.5 text-[12px] leading-[1.55] custom-scrollbar"
              style={{
                backgroundColor: '#08090C',
                border: '1px solid rgba(255,255,255,0.05)',
                fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
              }}
            >
              {PROGRAM_LOG_LINES.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-white/20 select-none w-6 text-right">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={
                      line.tone === 'err'
                        ? 'text-red-300'
                        : line.tone === 'warn'
                          ? 'text-amber-300'
                          : line.tone === 'ok'
                            ? 'text-emerald-300'
                            : 'text-white/55'
                    }
                  >
                    {line.text}
                  </span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center gap-2">
                <span className="text-red-400">✕</span>
                <span className="text-red-300/90">
                  Transaction failed:&nbsp;
                  <span className="text-red-200">custom program error: 0x1772</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why it's permanent */}
        <Card
          className="rounded-2xl py-5 gap-3 lg:col-span-2"
          style={{
            backgroundColor: '#101216',
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <CardHeader className="px-5 pb-0">
            <CardTitle>
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Why This Is Permanent
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-1 space-y-2.5">
            <PermanenceRow
              ok
              label="Private key"
              value="still valid"
              note="agent can still sign"
            />
            <PermanenceRow
              ok={false}
              label="Capability"
              value="permanently invalid"
              note="authority epoch has passed"
            />
            <PermanenceRow
              ok={false}
              label="Re-assertable?"
              value="never — for this epoch"
              note="must request a new capability"
            />
            <div
              className="mt-3 pt-3 border-t border-white/[0.05] text-[11px] text-white/45 leading-relaxed"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              authority_epoch is immutable on the capability account. Once the
              agent’s current_epoch increments, every prior-epoch capability is
              cryptographically frozen out — no retry, no override, no admin bypass.
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ===== NARRATIVE FOOTER ===== */}
      <footer className="mt-auto pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className="text-[13px] italic text-white/65"
              style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}
            >
              “{result.narrative}”
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="text-[11px] uppercase tracking-[0.18em] text-white/35"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              PACTYRA · consequence layer for AI agents
            </span>
            <span
              className="text-[11px] text-white/35"
              style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
            >
              {new Date(result.timestamp).toISOString().replace('T', ' · ').replace(/\.\d+Z$/, ' UTC')}
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes stale-rejected-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(248, 113, 113, 0); }
          100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); }
        }
      `}</style>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function PactyraMark() {
  return (
    <span
      className="inline-flex items-center justify-center h-9 w-9 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, rgba(232,185,107,0.18), rgba(16,185,129,0.10))',
        border: '1px solid rgba(232,185,107,0.32)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2 L20 7 V17 L12 22 L4 17 V7 Z"
          stroke="#E8B96B"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <path d="M12 7 V17 M8 9.5 V14.5 M16 9.5 V14.5" stroke="#E8B96B" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      </svg>
    </span>
  )
}

function DataRow({
  label,
  value,
  valueTone,
  mono,
  truncate,
  big,
  hint,
}: {
  label: string
  value: string
  valueTone?: 'gold' | 'red' | 'default'
  mono?: boolean
  truncate?: boolean
  big?: boolean
  hint?: string
}) {
  const toneColor =
    valueTone === 'gold'
      ? '#E8B96B'
      : valueTone === 'red'
        ? '#F87171'
        : 'rgba(255,255,255,0.85)'
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.03] last:border-b-0">
      <span
        className="text-[11px] uppercase tracking-[0.14em] text-white/40 shrink-0"
        style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
      >
        {label}
      </span>
      <span
        className={`text-right ${truncate ? 'truncate max-w-[220px]' : ''} ${big ? 'text-[20px] font-semibold' : 'text-[13px]'}`}
        style={{
          color: toneColor,
          fontFamily: mono || big ? 'var(--font-geist-mono), JetBrains Mono, monospace' : 'inherit',
          textShadow: big && valueTone === 'gold' ? '0 0 18px rgba(232,185,107,0.30)' : 'none',
        }}
        title={truncate ? value : undefined}
      >
        {value}
        {hint ? (
          <span className="ml-2 text-[10px] text-white/35 normal-case tracking-normal">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function PermanenceRow({
  ok,
  label,
  value,
  note,
}: {
  ok: boolean
  label: string
  value: string
  note: string
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span
        className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
        style={{
          backgroundColor: ok ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)',
          color: ok ? '#34D399' : '#F87171',
          border: `1px solid ${ok ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`,
        }}
      >
        {ok ? '✓' : '✕'}
      </span>
      <div className="flex flex-col leading-tight">
        <span
          className="text-[11px] uppercase tracking-[0.14em] text-white/45"
          style={{ fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace' }}
        >
          {label}
        </span>
        <span
          className="text-[13px]"
          style={{
            color: ok ? 'rgba(255,255,255,0.85)' : '#F87171',
            fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
          }}
        >
          {value}
        </span>
        <span className="text-[11px] text-white/35">{note}</span>
      </div>
    </div>
  )
}
