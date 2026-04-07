import React, { useState, useEffect, useRef } from 'react'
import { Home, Calendar, CheckSquare, Timer, MoreHorizontal, GraduationCap, Flame, FileText, Briefcase, BarChart2 } from 'lucide-react'

const PRIMARY_TABS = [
  { id: 'dashboard', Icon: Home,          label: 'Home'      },
  { id: 'agenda',    Icon: Calendar,      label: 'Agenda'    },
  { id: 'taken',     Icon: CheckSquare,   label: 'Taken'     },
  { id: 'gewoontes', Icon: Flame,         label: 'Gewoontes' },
]

const SHEET_BASE = [
  { id: 'school',       Icon: GraduationCap, label: 'School'   },
  { id: 'pomodoro',     Icon: Timer,         label: 'Pomodoro' },
  { id: 'statistieken', Icon: BarChart2,     label: 'Stats'    },
  { id: 'notities',     Icon: FileText,      label: 'Notities' },
]

export default function BottomNav({ activePage, setActivePage, isAdmin, showJumbo }) {
  const [showSheet, setShowSheet] = useState(false)
  const sheetRef = useRef(null)

  const sheetItems = [
    ...SHEET_BASE,
    ...(showJumbo ? [{ id: 'jumbo', Icon: Briefcase, label: 'Jumbo' }] : []),
  ]

  const sheetActive = sheetItems.some(i => i.id === activePage)
  const activeMeerItem = sheetItems.find(i => i.id === activePage)

  const handlePrimary = (id) => { setActivePage(id); setShowSheet(false) }
  const handleSheet = (id) => { setActivePage(id); setShowSheet(false) }

  useEffect(() => {
    if (!showSheet) return
    const handler = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) setShowSheet(false)
    }
    document.addEventListener('touchstart', handler)
    return () => document.removeEventListener('touchstart', handler)
  }, [showSheet])

  return (
    <>
      {/* Bottom sheet overlay */}
      {showSheet && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        }}>
          <div
            ref={sheetRef}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--bg-sidebar)',
              borderRadius: '22px 22px 0 0',
              border: '1px solid var(--border)',
              borderBottom: 'none',
              padding: '12px 20px calc(20px + env(safe-area-inset-bottom))',
              animation: 'sheetUp 0.3s cubic-bezier(0.34,1.1,0.64,1)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Meer</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {sheetItems.map(({ id, Icon, label }) => {
                const active = activePage === id
                return (
                  <button
                    key={id}
                    onClick={() => handleSheet(id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 7, padding: '14px 8px', borderRadius: 18,
                      background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-card-2)',
                      border: active ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                    }}
                  >
                    <Icon size={22} strokeWidth={active ? 2.2 : 1.7} />
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
              onClick={() => handlePrimary(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, padding: '10px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 6, width: 34, height: 34, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  animation: 'pillIn 0.22s ease',
                }} />
              )}
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} style={{ position: 'relative' }} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, position: 'relative' }}>{label}</span>
            </button>
          )
        })}

        {/* Meer */}
        <button
          onClick={() => setShowSheet(v => !v)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, padding: '10px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: sheetActive || showSheet ? 'var(--accent)' : 'var(--text-3)',
            transition: 'color 0.15s', position: 'relative',
          }}
        >
          {(sheetActive || showSheet) && (
            <div style={{
              position: 'absolute', top: 6, width: 34, height: 34, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              animation: 'pillIn 0.22s ease',
            }} />
          )}
          {activeMeerItem && !showSheet
            ? <activeMeerItem.Icon size={20} strokeWidth={2.2} style={{ position: 'relative' }} />
            : <MoreHorizontal size={20} strokeWidth={showSheet ? 2.2 : 1.7} style={{ position: 'relative' }} />
          }
          <span style={{ fontSize: 10, fontWeight: sheetActive || showSheet ? 600 : 400, position: 'relative' }}>
            {activeMeerItem && !showSheet ? activeMeerItem.label : 'Meer'}
          </span>
        </button>
      </nav>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes pillIn {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  )
}
