import React from 'react'
import { Home, Timer, Calendar, GraduationCap, CheckSquare, Flame, FileText, Briefcase, Settings, Shield, LogOut, RefreshCw, BarChart2, Dumbbell, Wallet, Sparkles, Search } from 'lucide-react'
import VersionChecker from './VersionChecker'
import { CountBadge, Pill } from './ui'

const NAV_ITEMS = [
  { id: 'dashboard',    Icon: Home,           label: 'Dashboard'    },
  { id: 'agenda',       Icon: Calendar,       label: 'Agenda'       },
  { id: 'taken',        Icon: CheckSquare,    label: 'Taken'        },
  { id: 'pomodoro',     Icon: Timer,          label: 'Pomodoro'     },
  // { id: 'school', Icon: GraduationCap, label: 'School' },  // INACTIVE
  // { id: 'gewoontes', Icon: Flame, label: 'Gewoontes' },  // INACTIVE
  // { id: 'gym', Icon: Dumbbell, label: 'Gym' },  // INACTIVE
  { id: 'notities',     Icon: FileText,       label: 'Notities'     },
  { id: 'statistieken', Icon: BarChart2,      label: 'Statistieken' },
]

export default function Sidebar({
  activePage, setActivePage,
  isAdmin, showJumbo, user,
  onShowSettings, onShowAdmin, onLogout, onOpenSearch,
  syncing, syncFlash, updateAvailable, hasLevelUp, hasActiveGymWorkout, hasActivePomo,
  overdueCount = 0,
}) {
  const displayName = user?.email?.split('@')[0] || 'Student'
  const initial = displayName.charAt(0).toUpperCase()

  const navItems = [
    ...NAV_ITEMS,
    ...(showJumbo ? [{ id: 'jumbo', Icon: Briefcase, label: 'Jumbo ★' }] : []),
    ...(isAdmin ? [{ id: 'geld', Icon: Wallet, label: 'Geld' }] : []),
    ...(isAdmin ? [{ id: 'hypexai', Icon: Sparkles, label: 'Hypex AI' }] : []),
  ]

  return (
    <aside className="hx-sidebar" style={{
      width: 208,
      flexShrink: 0,
      background: 'rgba(255,255,255,0.02)',
      borderRight: '1px solid var(--c-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
    }}>

      {/* Logo */}
      <div style={{ padding: '16px 14px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 10px color-mix(in srgb, var(--accent) 30%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }} aria-hidden="true">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>Hypex</span>
          {/* Sync indicator */}
          <RefreshCw
            size={12}
            aria-label={syncing ? 'Synchroniseren…' : 'Gesynchroniseerd'}
            style={{
              marginLeft: 'auto',
              color: syncFlash ? 'var(--c-success)' : 'var(--c-text-3)',
              transition: 'color 0.5s',
              animation: syncing ? 'spin 0.8s linear infinite' : 'none',
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Zoeken */}
      {onOpenSearch && (
        <div style={{ padding: '0 8px 6px' }}>
          <button type="button" onClick={onOpenSearch} className="hx-nav-item" style={{ color: 'var(--c-text-3)' }}>
            <Search size={15} aria-hidden="true" />
            <span style={{ flex: 1 }}>Zoeken</span>
            <kbd style={{ fontSize: 10, color: 'var(--c-text-3)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>Ctrl K</kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav aria-label="Hoofdnavigatie" style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {navItems.map(({ id, Icon, label }) => {
          const active = activePage === id
          const levelUp   = id === 'statistieken' && hasLevelUp && !active
          const gymActive = id === 'gym' && hasActiveGymWorkout && !active
          const pomoActive = id === 'pomodoro' && hasActivePomo && !active
          const badge = id === 'taken' && overdueCount > 0 && !active
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePage(id)}
              aria-current={active ? 'page' : undefined}
              className={`hx-nav-item${active ? ' is-active' : ''}${pomoActive ? ' is-running' : ''}`}
            >
              <Icon size={15} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              {badge && <CountBadge count={overdueCount} label={`${overdueCount} te laat`} />}
              {pomoActive && <Pill tone="accent">Actief</Pill>}
              {gymActive && <Pill tone="warning">Actief</Pill>}
              {levelUp && <Pill tone="school">Level up</Pill>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--c-border)', padding: '8px 8px 12px', flexShrink: 0 }}>
        <button type="button" onClick={onShowSettings} className="hx-nav-item">
          <Settings size={15} aria-hidden="true" /> Instellingen
        </button>

        {isAdmin && (
          <button type="button" onClick={onShowAdmin} className="hx-nav-item" style={{ color: 'var(--c-warning)' }}>
            <Shield size={15} aria-hidden="true" /> Admin
          </button>
        )}

        <button type="button" onClick={onLogout} className="hx-nav-item hx-nav-item--danger" style={{ color: 'var(--c-text-3)' }}>
          <LogOut size={15} aria-hidden="true" /> Uitloggen
        </button>

        <div style={{ padding: '4px 10px 6px' }}>
          <VersionChecker />
        </div>

        {/* Avatar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px',
          borderRadius: 'var(--r-sm)',
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--accent)', color: 'var(--on-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }} aria-hidden="true">
            {initial}
          </div>
          <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
        </div>
      </div>
    </aside>
  )
}
