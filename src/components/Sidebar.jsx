import React from 'react'
import { Home, Timer, Calendar, GraduationCap, CheckSquare, Flame, FileText, Briefcase, Settings, Shield, LogOut, RefreshCw, BarChart2 } from 'lucide-react'
import VersionChecker from './VersionChecker'

const NAV_ITEMS = [
  { id: 'dashboard',    Icon: Home,           label: 'Dashboard'    },
  { id: 'agenda',       Icon: Calendar,       label: 'Agenda'       },
  { id: 'taken',        Icon: CheckSquare,    label: 'Taken'        },
  { id: 'pomodoro',     Icon: Timer,          label: 'Pomodoro'     },
  { id: 'school',       Icon: GraduationCap,  label: 'School'       },
  { id: 'gewoontes',    Icon: Flame,          label: 'Gewoontes'    },
  { id: 'notities',     Icon: FileText,       label: 'Notities'     },
  { id: 'statistieken', Icon: BarChart2,      label: 'Statistieken' },
]

export default function Sidebar({
  activePage, setActivePage,
  isAdmin, showJumbo, user,
  onShowSettings, onShowAdmin, onLogout,
  syncing, syncFlash, updateAvailable,
}) {
  const displayName = user?.email?.split('@')[0] || 'Student'
  const initial = displayName.charAt(0).toUpperCase()

  const navItems = [
    ...NAV_ITEMS,
    ...(showJumbo ? [{ id: 'jumbo', Icon: Briefcase, label: 'Jumbo ★' }] : []),
  ]

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--accent-dim)',
            border: '1px solid rgba(0,255,209,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 16, color: 'var(--accent)' }}>⬡</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Hypex</span>
          {/* Sync indicator */}
          <RefreshCw
            size={11}
            style={{
              marginLeft: 'auto',
              color: syncFlash ? '#1DB954' : 'var(--text-3)',
              transition: 'color 0.5s',
              animation: syncing ? 'spin 0.8s linear infinite' : 'none',
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {navItems.map(({ id, Icon, label }) => {
          const active = activePage === id
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                marginBottom: 2,
                background: active ? 'var(--accent-dim)' : 'transparent',
                border: 'none',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'var(--text-1)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-2)'
                }
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 8px 12px', flexShrink: 0 }}>
        <button
          onClick={onShowSettings}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, marginBottom: 2,
            background: 'transparent', border: 'none', borderLeft: '2px solid transparent',
            cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, textAlign: 'left',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
        >
          <Settings size={15} /> Instellingen
        </button>

        {isAdmin && (
          <button
            onClick={onShowAdmin}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, marginBottom: 2,
              background: 'transparent', border: 'none', borderLeft: '2px solid transparent',
              cursor: 'pointer', color: '#FFB400', fontSize: 13, textAlign: 'left',
              transition: 'all 0.12s',
            }}
          >
            <Shield size={15} /> Admin
          </button>
        )}

        <button
          onClick={onLogout}
          className="hidden md:flex"
          style={{
            width: '100%', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, marginBottom: 6,
            background: 'transparent', border: 'none', borderLeft: '2px solid transparent',
            cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, textAlign: 'left',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,80,80,0.7)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}
        >
          <LogOut size={15} /> Uitloggen
        </button>

        <div style={{ padding: '0 10px 6px' }}>
          <VersionChecker />
        </div>

        {/* Avatar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'var(--bg-card-2)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'var(--accent-dim)',
            border: '1px solid rgba(0,255,209,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0,
          }}>
            {initial}
          </div>
          <span style={{
            fontSize: 12, color: 'var(--text-2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName}
          </span>
        </div>
      </div>
    </aside>
  )
}
