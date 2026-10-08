'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import { motion, useInView, useMotionValue, useSpring, useTransform, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

// ============================================================
// SectionShell — consistent premium section wrapper with reveal-on-scroll
// Supports staggered reveals via the `index` prop (50ms per section)
// ============================================================
export function SectionShell({
  id,
  children,
  className,
  index = 0,
}: {
  id?: string
  children: ReactNode
  className?: string
  index?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px 0px -60px 0px' })
  return (
    <motion.section
      id={id}
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.5),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn('scroll-mt-24', className)}
    >
      {children}
    </motion.section>
  )
}

// ============================================================
// SectionTitle — refined section header with icon dot + hint
// ============================================================
export function SectionTitle({
  icon: Icon,
  title,
  hint,
  accent = 'emerald',
}: {
  icon: React.ElementType
  title: string
  hint?: string
  accent?: 'emerald' | 'gold' | 'sky' | 'violet' | 'rose' | 'amber'
}) {
  const accentColor =
    accent === 'emerald' ? 'text-emerald-400'
    : accent === 'gold' ? 'text-[#E8B96B]'
    : accent === 'sky' ? 'text-sky-400'
    : accent === 'violet' ? 'text-violet-400'
    : accent === 'rose' ? 'text-rose-400'
    : 'text-amber-400'
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className={cn('flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.03] border border-white/[0.06]', accentColor)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">{title}</h2>
      {hint && (
        <span className="ml-auto text-[11px] text-muted-foreground font-mono tracking-normal">{hint}</span>
      )}
    </div>
  )
}

// ============================================================
// PremiumCard — layered surface with inset highlight + drop shadow
// ============================================================
export function PremiumCard({
  children,
  className,
  accent,
}: {
  children: ReactNode
  className?: string
  accent?: 'emerald' | 'gold' | 'rose' | 'sky' | 'violet' | 'amber'
}) {
  const accentBorder =
    accent === 'emerald' ? 'border-emerald-500/20'
    : accent === 'gold' ? 'border-[#E8B96B]/20'
    : accent === 'rose' ? 'border-rose-500/20'
    : accent === 'sky' ? 'border-sky-500/20'
    : accent === 'violet' ? 'border-violet-500/20'
    : accent === 'amber' ? 'border-amber-500/20'
    : 'border-white/[0.06]'
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'pactyra-surface rounded-2xl border transition-all duration-300 hover:shadow-[0_12px_36px_rgba(0,0,0,0.45)]',
        accentBorder,
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ============================================================
// AuthorityGauge — signature circular arc gauge for the hero
// ============================================================
export function AuthorityGauge({
  tier,
  amount,
  successCount,
  totalCount,
  size = 280,
}: {
  tier: 'Probation' | 'Proven' | 'Trusted'
  amount: number
  successCount: number
  totalCount: number
  size?: number
}) {
  const strokeWidth = size * 0.042
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Tier progress: T1=0-33%, T2=33-66%, T3=66-100%
  const tierProgress =
    tier === 'Trusted' ? 1
    : tier === 'Proven' ? 0.66
    : 0.33

  // Animate the ring fill
  const progressRef = useRef(0)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  useEffect(() => {
    const controls = animate(progressRef.current, tierProgress, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setAnimatedProgress(v),
    })
    return () => controls.stop()
  }, [tierProgress])

  const dashOffset = circumference * (1 - animatedProgress)

  const tierColor =
    tier === 'Trusted' ? '#34D399'
    : tier === 'Proven' ? '#E8B96B'
    : '#F87171'

  // Count-up animation for the amount
  const countRef = useRef(0)
  const [displayAmount, setDisplayAmount] = useState(0)
  useEffect(() => {
    const controls = animate(countRef.current, amount, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplayAmount(Math.round(v)),
    })
    return () => controls.stop()
  }, [amount])

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8B96B" />
            <stop offset="100%" stopColor={tierColor} />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          filter="url(#gauge-glow)"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
          current authority
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-light text-muted-foreground">$</span>
          <span
            className="font-mono text-7xl font-bold tabular-nums pactyra-gold-glow leading-none"
            style={{ color: tierColor }}
          >
            {displayAmount}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 font-mono">
          {tier === 'Trusted' ? 'Tier 3 · Trusted' : tier === 'Proven' ? 'Tier 2 · Proven' : 'Tier 1 · Probation'}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CountUp — animated number counter
// ============================================================
export function CountUp({
  value,
  duration = 1,
  suffix = '',
  prefix = '',
}: {
  value: number
  duration?: number
  suffix?: string
  prefix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, value, duration])
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{display}{suffix}
    </span>
  )
}

// ============================================================
// Sparkline — success rate mini chart
// ============================================================
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = '#34D399',
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length === 0) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = width / Math.max(data.length - 1, 1)
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ============================================================
// LiveDot — pulsing dot for live indicators
// ============================================================
export function LiveDot({ color = '#34D399', size = 6 }: { color?: string; size?: number }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  )
}

// ============================================================
// AuthorityTimeline — horizontal timeline of authority transitions
// ============================================================
export interface TimelineNode {
  label: string
  amount: string
  type: 'register' | 'tier-up' | 'tier-down' | 'slash' | 'now' | 'tx'
  txHash?: string
  explorerUrl?: string
}

export function AuthorityTimeline({ nodes }: { nodes: TimelineNode[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  if (nodes.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto hide-scrollbar pb-2"
    >
      <div className="relative flex items-center min-w-full px-2" style={{ minWidth: `${nodes.length * 120}px` }}>
        {/* Connecting line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {/* Nodes */}
        <div className="relative flex items-center justify-between w-full">
          {nodes.map((node, i) => {
            const color =
              node.type === 'slash' ? '#F87171'
              : node.type === 'tier-up' ? '#34D399'
              : node.type === 'tier-down' ? '#F87171'
              : node.type === 'now' ? '#34D399'
              : node.type === 'register' ? '#60A5FA'
              : '#E8B96B'
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col items-center gap-2 relative z-10"
              >
                {/* Label above */}
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {node.label}
                </div>
                {/* Amount */}
                <div
                  className="text-sm font-mono font-bold tabular-nums whitespace-nowrap"
                  style={{ color }}
                >
                  {node.amount}
                </div>
                {/* Dot */}
                <div className="relative">
                  {node.type === 'now' && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ backgroundColor: color, opacity: 0.4 }}
                    />
                  )}
                  <a
                    href={node.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-full border-2 transition-all hover:scale-125"
                    style={{
                      width: node.type === 'now' ? 14 : 10,
                      height: node.type === 'now' ? 14 : 10,
                      backgroundColor: color,
                      borderColor: 'rgba(255,255,255,0.1)',
                      boxShadow: node.type === 'slash' ? `0 0 12px ${color}80` : 'none',
                      cursor: node.explorerUrl ? 'pointer' : 'default',
                    }}
                    onClick={(e) => { if (!node.explorerUrl) e.preventDefault() }}
                  />
                </div>
                {/* Tx hash below */}
                {node.txHash && (
                  <div className="text-[9px] font-mono text-muted-foreground/60 whitespace-nowrap">
                    {node.txHash.slice(0, 6)}…{node.txHash.slice(-4)}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// WireDiagram — animated SVG wire for verifier architecture
// ============================================================
export function WireDiagram({
  items,
  targetLabel,
  targetColor = '#10B981',
  finalLabel,
  finalColor = '#E8B96B',
}: {
  items: { id: string; label: string; sublabel?: string; color: string }[]
  targetLabel: string
  targetColor?: string
  finalLabel: string
  finalColor?: string
}) {
  return (
    <div className="relative w-full py-6">
      <svg viewBox="0 0 800 240" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="wire-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Source nodes (top row) */}
        {items.map((item, i) => {
          const x = 100 + (i * 600) / Math.max(items.length - 1, 1)
          return (
            <g key={item.id}>
              {/* Wire to center */}
              <line
                x1={x}
                y1={50}
                x2={400}
                y2={120}
                stroke={item.color}
                strokeWidth="1"
                strokeOpacity="0.3"
                strokeDasharray="4 4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="8"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </line>
              {/* Node circle */}
              <circle cx={x} cy={50} r="6" fill={item.color} fillOpacity="0.2" stroke={item.color} strokeWidth="1.5" />
              {/* Node label */}
              <text x={x} y={28} textAnchor="middle" fill="#E8EAED" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
                {item.label}
              </text>
              {item.sublabel && (
                <text x={x} y={42} textAnchor="middle" fill="#8A8F98" fontSize="9" fontFamily="ui-monospace, monospace">
                  {item.sublabel}
                </text>
              )}
            </g>
          )
        })}
        {/* Center: VERIFIED OUTCOME */}
        <g>
          <rect x={320} y={100} width={160} height={40} rx={8} fill="#1C2128" stroke="#34D399" strokeWidth="1" strokeOpacity="0.4" />
          <text x={400} y={125} textAnchor="middle" fill="#34D399" fontSize="11" fontWeight="700" fontFamily="ui-monospace, monospace" letterSpacing="0.05em">
            VERIFIED OUTCOME
          </text>
        </g>
        {/* Wire to record_outcome */}
        <line x1={400} y1={140} x2={400} y2={170} stroke={targetColor} strokeWidth="1.5" strokeOpacity="0.5">
          <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1.5s" repeatCount="indefinite" />
        </line>
        <line x1={400} y1={140} x2={400} y2={170} stroke={targetColor} strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.4" />
        {/* record_outcome — with pulsing glow */}
        <g>
          {/* Pulsing glow ring */}
          <rect x={300} y={170} width={200} height={36} rx={8} fill="none" stroke={targetColor} strokeWidth="1" strokeOpacity="0.4">
            <animate attributeName="stroke-opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="width" values="200;208;200" dur="2s" repeatCount="indefinite" />
            <animate attributeName="height" values="36;44;36" dur="2s" repeatCount="indefinite" />
            <animate attributeName="x" values="300;296;300" dur="2s" repeatCount="indefinite" />
            <animate attributeName="y" values="170;166;170" dur="2s" repeatCount="indefinite" />
          </rect>
          {/* Solid rect */}
          <rect x={300} y={170} width={200} height={36} rx={8} fill={targetColor} fillOpacity="0.1" stroke={targetColor} strokeWidth="1" strokeOpacity="0.5" />
          <text x={400} y={193} textAnchor="middle" fill={targetColor} fontSize="11" fontWeight="700" fontFamily="ui-monospace, monospace">
            pactyra_core::record_outcome
          </text>
        </g>
        {/* Wire to authority change (down) */}
        <line x1={400} y1={206} x2={400} y2={230} stroke={finalColor} strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.4">
          <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1.5s" repeatCount="indefinite" />
        </line>
      </svg>
      {/* Final label below SVG */}
      <div className="flex justify-center -mt-1">
        <div
          className="px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold tracking-wider"
          style={{
            backgroundColor: `${finalColor}1A`,
            border: `1px solid ${finalColor}40`,
            color: finalColor,
          }}
        >
          {finalLabel}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Filmstrip — horizontal scrollable scene cards
// ============================================================
export interface FilmstripFrame {
  id: number
  title: string
  subtitle: string
  color: 'emerald' | 'sky' | 'amber' | 'teal' | 'rose' | 'gold' | 'violet'
  stateBefore?: { tier: string; authority: string; epoch: string }
  stateAfter?: { tier: string; authority: string; epoch: string }
}

export function Filmstrip({
  frames,
  activeId,
  onSelect,
}: {
  frames: FilmstripFrame[]
  activeId: number
  onSelect: (id: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = activeRef.current
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [activeId])

  // Arrow key navigation: left/right to move between scenes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onSelect(Math.max(1, activeId - 1))
      } else if (e.key === 'ArrowRight') {
        const maxId = frames.length
        onSelect(Math.min(maxId, activeId + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, frames.length, onSelect])

  const colorMap = {
    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', dot: '#34D399' },
    sky: { border: 'border-sky-500/30', bg: 'bg-sky-500/5', text: 'text-sky-400', dot: '#60A5FA' },
    amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400', dot: '#FBBF24' },
    teal: { border: 'border-teal-500/30', bg: 'bg-teal-500/5', text: 'text-teal-400', dot: '#2DD4BF' },
    rose: { border: 'border-rose-500/30', bg: 'bg-rose-500/5', text: 'text-rose-400', dot: '#F87171' },
    gold: { border: 'border-[#E8B96B]/30', bg: 'bg-[#E8B96B]/5', text: 'text-[#E8B96B]', dot: '#E8B96B' },
    violet: { border: 'border-violet-500/30', bg: 'bg-violet-500/5', text: 'text-violet-400', dot: '#A78BFA' },
  }

  return (
    <div ref={scrollRef} className="overflow-x-auto hide-scrollbar pb-2">
      <div className="flex gap-3 px-1 min-w-min items-center">
        {frames.map((frame) => {
          const c = colorMap[frame.color]
          const isActive = frame.id === activeId
          return (
            <motion.button
              key={frame.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(frame.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              animate={{ scale: isActive ? 1.15 : 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'relative shrink-0 w-[240px] p-3 rounded-xl border text-left transition-colors',
                isActive ? cn(c.bg, c.border) : 'bg-white/[0.02] border-white/[0.06] opacity-60 hover:opacity-100'
              )}
              style={isActive ? { boxShadow: `0 0 24px ${c.dot}30` } : {}}
            >
              {/* Scene number */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn('flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold', c.text, c.bg)}
                  style={{ border: `1px solid ${c.dot}40` }}
                >
                  {frame.id}
                </div>
                {isActive && (
                  <span className={cn('text-[9px] font-mono uppercase tracking-wider', c.text)}>
                    ● active
                  </span>
                )}
              </div>
              {/* Title */}
              <div className={cn('text-xs font-semibold mb-0.5', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {frame.title}
              </div>
              {/* Subtitle */}
              <div className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                {frame.subtitle}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// TierBadge — refined tier badge with glow
// ============================================================
export function TierBadge({
  tier,
  size = 'md',
}: {
  tier: 'Probation' | 'Proven' | 'Trusted'
  size?: 'sm' | 'md' | 'lg'
}) {
  const config = {
    Probation: { gradient: 'from-rose-500/80 to-red-600/80', text: 'text-rose-300', glow: 'shadow-[0_0_20px_rgba(248,113,113,0.25)]' },
    Proven: { gradient: 'from-[#E8B96B]/80 to-amber-600/80', text: 'text-[#F0D094]', glow: 'shadow-[0_0_20px_rgba(232,185,107,0.25)]' },
    Trusted: { gradient: 'from-emerald-400/80 to-teal-500/80', text: 'text-emerald-300', glow: 'shadow-[0_0_24px_rgba(16,185,129,0.35)]' },
  }[tier]

  const sizeClass = size === 'lg' ? 'px-4 py-1.5 text-sm' : size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r font-mono font-semibold border border-white/10',
      config.gradient, config.text, config.glow, sizeClass
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {tier}
    </span>
  )
}

// ============================================================
// StatusPill — refined status badge
// ============================================================
export function StatusPill({
  status,
  label,
}: {
  status: 'live' | 'active' | 'deployed' | 'missing' | 'deprecated' | 'roadmap' | 'planned' | 'available'
  label?: string
}) {
  const config = {
    live: { color: '#34D399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: true },
    active: { color: '#34D399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: true },
    deployed: { color: '#34D399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: false },
    available: { color: '#34D399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: false },
    missing: { color: '#F87171', bg: 'bg-rose-500/10', border: 'border-rose-500/20', pulse: false },
    deprecated: { color: '#F87171', bg: 'bg-rose-500/10', border: 'border-rose-500/20', pulse: false },
    roadmap: { color: '#FBBF24', bg: 'bg-amber-500/10', border: 'border-amber-500/20', pulse: false },
    planned: { color: '#A78BFA', bg: 'bg-violet-500/10', border: 'border-violet-500/20', pulse: false },
  }[status]

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
      config.bg, config.border
    )} style={{ color: config.color }}>
      {config.pulse && <LiveDot color={config.color} size={5} />}
      {label || status}
    </span>
  )
}

// ============================================================
// StatTile — compact stat tile for grids
// ============================================================
export function StatTile({
  label,
  value,
  icon: Icon,
  accent = 'default',
  sub,
}: {
  label: string
  value: string | number
  icon?: React.ElementType
  accent?: 'default' | 'emerald' | 'gold' | 'rose' | 'sky' | 'amber'
  sub?: string
}) {
  const color =
    accent === 'emerald' ? 'text-emerald-400'
    : accent === 'gold' ? 'text-[#E8B96B]'
    : accent === 'rose' ? 'text-rose-400'
    : accent === 'sky' ? 'text-sky-400'
    : accent === 'amber' ? 'text-amber-400'
    : 'text-foreground'
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={cn('font-mono text-xl font-bold tabular-nums', color)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground font-mono">{sub}</div>}
    </div>
  )
}

// ============================================================
// AuthorityLoopDiagram — circular flow diagram with animated traveling arrow
// Renders $5 → $50 → $500 → $5 as a circular arc with a moving dot
// ============================================================
export function AuthorityLoopDiagram({
  currentTier,
  size = 320,
}: {
  currentTier: 'Probation' | 'Proven' | 'Trusted'
  size?: number
}) {
  const tiers = [
    { label: 'T1', amount: '$5',   name: 'Probation', color: '#F87171', angle: 0 },
    { label: 'T2', amount: '$50',  name: 'Proven',    color: '#E8B96B', angle: 120 },
    { label: 'T3', amount: '$500', name: 'Trusted',   color: '#34D399', angle: 240 },
  ]
  const radius = size * 0.36
  const cx = size / 2
  const cy = size / 2

  // Position nodes on a circle
  const nodePos = (angle: number) => ({
    x: cx + radius * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + radius * Math.sin((angle - 90) * Math.PI / 180),
  })

  return (
    <div className="flex items-center justify-center py-4">
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <linearGradient id="loop-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F87171" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#E8B96B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Circular track */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeDasharray="4 6" />
        {/* Gradient arc overlay */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="url(#loop-arc-grad)" strokeWidth="2" strokeDasharray="4 6" />
        {/* Animated traveling dot along the circle */}
        <circle r="4" fill="#E8B96B">
          <animateMotion dur="4s" repeatCount="indefinite" path={`M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`} />
        </circle>
        {/* Tier nodes */}
        {tiers.map((t) => {
          const pos = nodePos(t.angle)
          const isCurrent =
            (currentTier === 'Probation' && t.label === 'T1') ||
            (currentTier === 'Proven' && t.label === 'T2') ||
            (currentTier === 'Trusted' && t.label === 'T3')
          return (
            <g key={t.label}>
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isCurrent ? 22 : 16}
                fill={t.color}
                fillOpacity={isCurrent ? 0.15 : 0.05}
                stroke={t.color}
                strokeWidth={isCurrent ? 2 : 1}
                strokeOpacity={isCurrent ? 0.8 : 0.3}
              />
              {isCurrent && (
                <circle cx={pos.x} cy={pos.y} r={22} fill="none" stroke={t.color} strokeWidth="1" strokeOpacity="0.4">
                  <animate attributeName="r" from="22" to="32" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Amount label */}
              <text x={pos.x} y={pos.y - 2} textAnchor="middle" fill={t.color} fontSize="13" fontWeight="700" fontFamily="ui-monospace, monospace">
                {t.amount}
              </text>
              <text x={pos.x} y={pos.y + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="ui-monospace, monospace" letterSpacing="0.1em">
                {t.label}
              </text>
            </g>
          )
        })}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#8A8F98" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="0.15em" textTransform="uppercase">
          AUTHORITY
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#E8EAED" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
          LOOP
        </text>
      </svg>
    </div>
  )
}

// ============================================================
// SlashFlash — wraps children and flashes red when triggered
// ============================================================
export function SlashFlash({ triggered, children }: { triggered: boolean; children: ReactNode }) {
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (triggered) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1200)
      return () => clearTimeout(t)
    }
  }, [triggered])
  return (
    <div className={cn('transition-colors', flash && 'animate-pactyra-flash-slash')}>
      {children}
    </div>
  )
}

// ============================================================
// MiniAuthorityBadge — for sticky sub-header on scroll
// ============================================================
export function MiniAuthorityBadge({
  tier,
  amount,
  epoch,
}: {
  tier: 'Probation' | 'Proven' | 'Trusted'
  amount: number
  epoch: number
}) {
  const color = tier === 'Trusted' ? '#34D399' : tier === 'Proven' ? '#E8B96B' : '#F87171'
  return (
    <div className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <LiveDot color={color} size={5} />
      <span className="text-[11px] font-mono text-muted-foreground">tier</span>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>{tier[0]}</span>
      <span className="h-3 w-px bg-white/[0.08]" />
      <span className="text-[11px] font-mono text-[#E8B96B] font-semibold">${amount}</span>
      <span className="h-3 w-px bg-white/[0.08]" />
      <span className="text-[11px] font-mono text-muted-foreground">e#{epoch}</span>
    </div>
  )
}

// ============================================================
// PressableButton — button with active:scale press feedback
// ============================================================
export function PressableButton({
  children,
  className,
  onClick,
  disabled,
  variant = 'default',
  size = 'md',
  as = 'button',
  href,
  target,
  rel,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  as?: 'button' | 'a'
  href?: string
  target?: string
  rel?: string
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-xs',
    lg: 'h-10 px-5 text-sm',
  }
  const variants = {
    default: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    outline: 'bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-foreground',
    ghost: 'hover:bg-white/[0.04] text-foreground',
  }
  const classes = cn(base, sizes[size], variants[variant], className)
  if (as === 'a') {
    return (
      <motion.a
        href={href}
        target={target}
        rel={rel}
        whileTap={{ scale: 0.98 }}
        className={classes}
      >
        {children}
      </motion.a>
    )
  }
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      className={classes}
    >
      {children}
    </motion.button>
  )
}
