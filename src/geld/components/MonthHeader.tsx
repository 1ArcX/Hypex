import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useMonthNav } from '../hooks/useMonthNav'
import { useGeldStore } from '../store/geldStore'

// Gedeelde kop: maandnavigatie + zoekknop (alleen op Home)
export function MonthHeader({ showSearch = false }: { showSearch?: boolean }) {
  const { monthLabel, isCurrentMonth, goToPrevMonth, goToNextMonth } = useMonthNav()
  const setSearchOpen = useGeldStore(s => s.setSearchOpen)

  const navBtn = 'w-9 h-9 rounded-full bg-white/[0.06] backdrop-blur-lg border border-white/10 flex items-center justify-center cursor-pointer shrink-0 transition-colors'

  return (
    <div className="flex items-center gap-2 mb-5">
      <button onClick={goToPrevMonth} className={`${navBtn} text-white/60`}>
        <ChevronLeft size={16} />
      </button>
      <div className="flex-1 text-center">
        <p className={`text-[15px] font-bold m-0 capitalize ${isCurrentMonth ? 'text-white/90' : 'text-teal-300'}`}>
          {monthLabel}
        </p>
        {!isCurrentMonth && (
          <p className="text-[9px] font-bold text-teal-300/70 m-0 tracking-[0.08em]">VORIGE MAAND — BEWERKBAAR</p>
        )}
      </div>
      <button onClick={goToNextMonth} disabled={isCurrentMonth}
        className={`${navBtn} ${isCurrentMonth ? 'text-white/10 cursor-default' : 'text-white/60'}`}>
        <ChevronRight size={16} />
      </button>
      {showSearch && (
        <button onClick={() => setSearchOpen(true)} className={`${navBtn} text-white/60`}>
          <Search size={15} />
        </button>
      )}
    </div>
  )
}
