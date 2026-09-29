import { Sheet } from './ui/Sheet'

export type GeldAction = 'expense' | 'planned' | 'income' | 'savings'

const ACTIONS: { id: GeldAction; emoji: string; label: string; sub: string; tint: string }[] = [
  { id: 'expense', emoji: '💸', label: 'Uitgave',          sub: 'Log wat je hebt uitgegeven',          tint: 'var(--accent)' },
  { id: 'planned', emoji: '📌', label: 'Geplande uitgave', sub: 'Pin iets vast voor later',            tint: '#FBBF24' },
  { id: 'income',  emoji: '💚', label: 'Inkomsten',        sub: 'Eenmalige inkomsten invullen',        tint: '#34D399' },
  { id: 'savings', emoji: '🏦', label: 'Spaargeld afhalen', sub: 'Opname of lening van je spaargeld',  tint: '#F87171' },
]

// Het +-menu: één plek voor alle log-acties
export function ActionSheet({ onClose, onAction }: {
  onClose: () => void
  onAction: (action: GeldAction) => void
}) {
  return (
    <Sheet onClose={onClose} title="Toevoegen">
      <div className="flex flex-col gap-2.5">
        {ACTIONS.map(a => (
          <button key={a.id} onClick={() => onAction(a.id)}
            className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border cursor-pointer text-left active:scale-[0.985] transition-transform"
            style={{ background: `color-mix(in srgb, ${a.tint} 6%, transparent)`, borderColor: `color-mix(in srgb, ${a.tint} 18%, transparent)` }}>
            <span className="text-2xl shrink-0">{a.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-bold text-white/90">{a.label}</span>
              <span className="block text-[11px] text-white/35">{a.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
