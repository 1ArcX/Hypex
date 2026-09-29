import type { ReactNode, CSSProperties } from 'react'

// Basisstijlen, gedeeld door alle geld-componenten — gebaseerd op de app-brede
// design tokens (src/index.css) zodat Geld dezelfde kaarten/radii/accent gebruikt.
export const glassCard =
  'bg-surface border border-line rounded-r-lg'
export const glassCardSm =
  'bg-surface border border-line rounded-r-md'
export const glassInput =
  'w-full rounded-r-md bg-surface-2 border border-line-strong text-white/90 placeholder-white/25 outline-none focus:border-accent/40 focus:bg-surface-3 transition-colors [color-scheme:dark]'

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
      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
    </div>
  )
}
