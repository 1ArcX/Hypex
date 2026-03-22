import React, { useState, useEffect } from 'react'
import { Home, Calendar, CheckSquare, Timer, MoreHorizontal, GraduationCap, Flame, FileText, Briefcase, ChevronUp } from 'lucide-react'

const PRIMARY_TABS = [
  { id: 'dashboard', Icon: Home,        label: 'Home'   },
  { id: 'agenda',    Icon: Calendar,    label: 'Agenda' },
  { id: 'taken',     Icon: CheckSquare, label: 'Taken'  },
  { id: 'pomodoro',  Icon: Timer,       label: 'Pomo'   },
]

const MORE_BASE = [
  { id: 'school',    Icon: GraduationCap, label: 'School'    },
  { id: 'gewoontes', Icon: Flame,         label: 'Gewoontes' },
  { id: 'notities',  Icon: FileText,      label: 'Notities'  },
]

export default function BottomNav({ activePage, setActivePage, isAdmin }) {
  const [showMore, setShowMore] = useState(false)

  const moreItems = [
    ...MORE_BASE,
    ...(isAdmin ? [{ id: 'jumbo', Icon: Briefcase, label: 'Jumbo' }] : []),
  ]

  const moreActive = moreItems.some(i => i.id === activePage)

  // Auto-open/close second row based on active page
  useEffect(() => {
    if (moreItems.some(i => i.id === activePage)) setShowMore(true)
    else setShowMore(false)
  }, [activePage])

  // Determine icon for Meer button
  const activeMeerItem = moreItems.find(i => i.id === activePage)
  const MeerIcon = showMore ? ChevronUp : (activeMeerItem ? activeMeerItem.Icon : MoreHorizontal)

  return (
    <>
      {/* Uitklapbare meer-rij */}
      <div style={{
        overflow: 'hidden',
        maxHeight: showMore ? 58 : 0,
        transition: 'max-height 0.28s cubic-bezier(0.34, 1.3, 0.64, 1)',
        background: 'var(--bg-sidebar)',
        borderTop: showMore ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ display: 'flex', paddingBottom: 4, paddingTop: 4 }}>
          {moreItems.map(({ id, Icon, label }) => {
            const active = activePage === id
            return (
              <button
                key={id}
                onClick={() => { setActivePage(id); setShowMore(false) }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 3, padding: '6px 0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  transition: 'color 0.15s',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 400 }}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab bar */}
      <nav style={{
        display: 'flex', flexShrink: 0,
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        position: 'relative', zIndex: 100,
      }}>
        {PRIMARY_TABS.map(({ id, Icon, label }) => {
          const active = activePage === id
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, padding: '10px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setShowMore(v => !v)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, padding: '10px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: moreActive ? 'var(--accent)' : 'var(--text-2)',
            transition: 'color 0.15s',
          }}
        >
          <MeerIcon size={20} strokeWidth={moreActive ? 2.2 : 1.7} />
          <span style={{ fontSize: 10, fontWeight: moreActive ? 600 : 400 }}>Meer</span>
        </button>
      </nav>
    </>
  )
}
