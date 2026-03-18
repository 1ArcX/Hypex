import React, { useState } from 'react'
import { Home, Calendar, CheckSquare, Timer, MoreHorizontal, GraduationCap, Flame, FileText, Briefcase, X } from 'lucide-react'

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

  return (
    <>
      {/* Bottom-sheet "Meer" */}
      {showMore && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowMore(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              borderRadius: '16px 16px 0 0',
              padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Meer pagina's</span>
              <button
                onClick={() => setShowMore(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {moreItems.map(({ id, Icon, label }) => {
                const active = activePage === id
                return (
                  <button
                    key={id}
                    onClick={() => { setActivePage(id); setShowMore(false) }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '14px 8px', borderRadius: 12,
                      background: active ? 'var(--accent-dim)' : 'var(--bg-card-2)',
                      border: active ? '1px solid rgba(0,255,209,0.3)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                    }}
                  >
                    <Icon size={22} />
                    <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
          onClick={() => setShowMore(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, padding: '10px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: moreActive ? 'var(--accent)' : 'var(--text-2)',
            transition: 'color 0.15s',
          }}
        >
          <MoreHorizontal size={20} strokeWidth={moreActive ? 2.2 : 1.7} />
          <span style={{ fontSize: 10, fontWeight: moreActive ? 600 : 400 }}>Meer</span>
        </button>
      </nav>
    </>
  )
}
