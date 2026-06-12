import { Search, X } from 'lucide-react'
import { Sheet } from '../components/ui/Sheet'
import { glassInput, Spinner, EmptyState } from '../components/ui/Glass'
import { TransactionRow } from '../components/TransactionRow'
import { scrollFix } from '../hooks/useIosScroll'
import { useSearch } from '../hooks/useSearch'
import type { CategoryConfig, Expense } from '../types'
import { fmt } from '../lib/format'

// Zoeken over alle maanden — slide-up sheet vanuit Home
export function SearchSheet({ userId, allCategories, onClose, onEdit, onDelete }: {
  userId: string
  allCategories: CategoryConfig[]
  onClose: () => void
  onEdit: (exp: Expense) => void
  onDelete: (id: string) => void
}) {
  const { searchQuery, setSearchQuery, results, total, loading } = useSearch(userId)

  // Groepeer resultaten per maand
  const grouped: { key: string; label: string; items: Expense[] }[] = []
  let lastKey: string | null = null
  results.forEach(exp => {
    const d = new Date(exp.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    if (key !== lastKey) { grouped.push({ key, label, items: [] }); lastKey = key }
    grouped[grouped.length - 1].items.push(exp)
  })

  return (
    <Sheet onClose={onClose} title="Zoeken">
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          autoFocus type="text" placeholder="Zoek in alle uitgaven..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onFocus={scrollFix}
          className={`${glassInput} pl-10 pr-9 py-3 text-[15px]`}
        />
        {searchQuery.length > 0 && (
          <button onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-white/30 p-1">
            <X size={14} />
          </button>
        )}
      </div>

      {loading && <Spinner />}

      {!loading && searchQuery.trim().length < 2 && (
        <EmptyState emoji="🔍" title="Zoek in alle uitgaven" sub="Typ minimaal 2 tekens om te zoeken" />
      )}

      {!loading && searchQuery.trim().length >= 2 && results.length === 0 && (
        <EmptyState emoji="😶" title="Geen resultaten" sub={`Niets gevonden voor '${searchQuery.trim()}'`} />
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="sticky top-0 z-10 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-lg border border-white/10 mb-3 flex justify-between items-center">
            <span className="text-[12px] text-white/35">{results.length} resultaten</span>
            <span className="text-[13px] font-bold text-white/90 tabular-nums">totaal {fmt(total)}</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {grouped.map(({ key, label, items }) => (
              <div key={key}>
                <p className="text-[11px] text-white/35 font-bold uppercase tracking-[0.07em] mb-2 capitalize">{label}</p>
                <div className="flex flex-col gap-1.5">
                  {items.map(exp => (
                    <TransactionRow key={exp.id} exp={exp} allCategories={allCategories} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
