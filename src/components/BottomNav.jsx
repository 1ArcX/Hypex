import React, { useState, useEffect, useRef } from 'react'
import { Home, Calendar, CheckSquare, Timer, MoreHorizontal, GraduationCap, Flame, FileText, Briefcase, BarChart2, Dumbbell } from 'lucide-react'

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
  { id: 'gym',          Icon: Dumbbell,      label: 'Gym'      },
]

export default function BottomNav({ activePage, setActivePage, isAdmin, showJumbo, hasLevelUp, hasActiveGymWorkout, hasActivePomo }) {
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
                const glowingStats = id === 'statistieken' && hasLevelUp && !active
                const glowingGym   = id === 'gym' && hasActiveGymWorkout && !active
                const glowingPomo  = id === 'pomodoro' && hasActivePomo && !active
                const glowing = glowingStats || glowingGym || glowingPomo
                const glowColor = glowingGym ? '#F97316' : glowingPomo ? '#EF4444' : '#FACC15'
                const glowBg    = glowingGym ? 'rgba(249,115,22,0.08)' : glowingPomo ? 'rgba(239,68,68,0.08)' : 'rgba(250,204,21,0.08)'
                const glowBorder= glowingGym ? '1px solid rgba(249,115,22,0.5)' : glowingPomo ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(250,204,21,0.5)'
                const glowAnim  = glowingGym ? 'sheetGymGlow 2s ease-in-out infinite' : glowingPomo ? 'sheetPomoGlow 2s ease-in-out infinite' : 'sheetStatsGlow 2s ease-in-out infinite'
                return (
                  <button
                    key={id}
                    onClick={() => handleSheet(id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 7, padding: '14px 8px', borderRadius: 18,
                      background: active
                        ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                        : glowing ? glowBg : 'var(--bg-card-2)',
                      border: active
                        ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)'
                        : glowing ? glowBorder : '1px solid var(--border)',
                      cursor: 'pointer',
                      color: active ? 'var(--accent)' : glowing ? glowColor : 'var(--text-2)',
                      animation: glowing ? glowAnim : 'none',
                      position: 'relative',
                    }}
                  >
                    <Icon size={22} strokeWidth={active || glowing ? 2.2 : 1.7} />
                    <span style={{ fontSize: 11, fontWeight: active || glowing ? 600 : 400 }}>{label}</span>
                    {glowing && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 7, height: 7, borderRadius: '50%',
                        background: glowingGym
                          ? 'linear-gradient(135deg, #F97316, #EF4444)'
                          : glowingPomo
                            ? 'linear-gradient(135deg, #EF4444, #EC4899)'
                            : 'linear-gradient(135deg, #FACC15, #F97316)',
                        boxShadow: `0 0 6px ${glowingGym ? 'rgba(249,115,22,0.8)' : glowingPomo ? 'rgba(239,68,68,0.8)' : 'rgba(250,204,21,0.8)'}`,
                        animation: 'dotPulse 1.2s ease-in-out infinite',
                      }} />
                    )}
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
        {(() => {
          const gymGlowing  = hasActiveGymWorkout && !sheetActive && !showSheet
          const pomoGlowing = hasActivePomo && !sheetActive && !showSheet
          return (
            <button
              onClick={() => setShowSheet(v => !v)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, padding: '10px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                color: sheetActive || showSheet ? 'var(--accent)' : gymGlowing ? '#F97316' : pomoGlowing ? '#EF4444' : 'var(--text-3)',
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
              <span style={{ fontSize: 10, fontWeight: sheetActive || showSheet || gymGlowing ? 600 : 400, position: 'relative' }}>
                {activeMeerItem && !showSheet ? activeMeerItem.label : 'Meer'}
              </span>
              {(gymGlowing || pomoGlowing) && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 17px + 6px)',
                  width: 7, height: 7, borderRadius: '50%',
                  background: gymGlowing
                    ? 'linear-gradient(135deg, #F97316, #EF4444)'
                    : 'linear-gradient(135deg, #EF4444, #EC4899)',
                  boxShadow: gymGlowing ? '0 0 6px rgba(249,115,22,0.8)' : '0 0 6px rgba(239,68,68,0.8)',
                  animation: 'dotPulse 1.2s ease-in-out infinite',
                }} />
              )}
            </button>
          )
        })()}
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
        @keyframes sheetStatsGlow {
          0%, 100% { box-shadow: 0 0 0px rgba(250,204,21,0); }
          50%       { box-shadow: 0 0 16px rgba(250,204,21,0.3); }
        }
        @keyframes sheetGymGlow {
          0%, 100% { box-shadow: 0 0 0px rgba(249,115,22,0); }
          50%       { box-shadow: 0 0 16px rgba(249,115,22,0.4); }
        }
        @keyframes sheetPomoGlow {
          0%, 100% { box-shadow: 0 0 0px rgba(239,68,68,0); }
          50%       { box-shadow: 0 0 16px rgba(239,68,68,0.45); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </>
  )
}
