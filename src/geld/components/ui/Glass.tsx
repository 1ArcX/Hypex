import type { ReactNode, CSSProperties } from 'react'

// Frosted-glass basisstijlen, gedeeld door alle geld-componenten
export const glassCard =
  'bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
export const glassCardSm =
  'bg-white/[0.04] backdrop-blur-lg border border-white/[0.07] rounded-2xl'
export const glassInput =
  'w-full rounded-2xl bg-white/[0.06] border border-white/10 text-white/90 placeholder-white/25 outline-none focus:border-teal-300/40 focus:bg-white/[0.08] transition-colors [color-scheme:dark]'

export function GlassCard({ children, className = '', onClick, style }: {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <div className={`${glassCard} ${onClick ? 'cursor-pointer active:scale-[0.985] transition-transform' : ''} ${className}`}
      onClick={onClick} style={style}>
      {children}
    </div>
  )
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-2.5 ${className}`}>
      {children}
    </p>
  )
}

export function ProgressBar({ pct, color, height = 6, segments }: {
  pct: number
  color: string
  height?: number
  // optioneel tweede segment (bv. spaargeld-deel in enveloppen)
  segments?: { pct: number; color: string }[]
}) {
  return (
    <div className="w-full rounded-full bg-white/[0.07] overflow-hidden flex" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-500 shrink-0"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      {segments?.map((s, i) => (
        <div key={i} className="h-full shrink-0 transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, background: s.color }} />
      ))}
    </div>
  )
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="text-center py-10">
      <div className="text-4xl mb-2.5">{emoji}</div>
      <p className="text-[15px] font-semibold text-white/70 mb-1">{title}</p>
      <p className="text-[13px] text-white/35">{sub}</p>
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-300 animate-spin" />
    </div>
  )
}
