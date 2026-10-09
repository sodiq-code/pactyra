'use client'

// SSR is disabled for the dashboard: every panel renders live devnet state
// fetched on mount, so server HTML would immediately diverge from the first
// client render (sparkline trend, tier badges, timestamps) and trigger
// hydration mismatches. Client-only rendering keeps the tree deterministic.

import dynamic from 'next/dynamic'

const PactyraPage = dynamic(() => import('@/components/pactyra-page'), {
  ssr: false,
  loading: () => null,
})

export default function Page() {
  return <PactyraPage />
}
