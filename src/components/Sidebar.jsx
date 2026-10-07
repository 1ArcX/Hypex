import React from 'react'
import { Home, Timer, Calendar, GraduationCap, CheckSquare, Flame, FileText, Briefcase, Settings, Shield, LogOut, RefreshCw, BarChart2, Dumbbell, Wallet, Search } from 'lucide-react'
import VersionChecker from './VersionChecker'
import { CountBadge, Pill } from './ui'

const NAV_ITEMS = [
  { id: 'dashboard',    Icon: Home,           label: 'Dashboard'    },
  { id: 'agenda',       Icon: Calendar,       label: 'Agenda'       },
  { id: 'taken',        Icon: CheckSquare,    label: 'Taken'        },
  { id: 'focus',        Icon: Timer,          label: 'Focus'        },
  // { id: 'school', Icon: GraduationCap, label: 'School' },  // INACTIVE
  // { id: 'gewoontes', Icon: Flame, label: 'Gewoontes' },  // INACTIVE
  // { id: 'gym', Icon: Dumbbell, label: 'Gym' },  // INACTIVE
  { id: 'notities',     Icon: FileText,       label: 'Notities'     },
  { id: 'statistieken', Icon: BarChart2,      label: 'Statistieken' },
]

/**
 * Desktop-navigatie.
 * - orientation="vertical" (standaard): zijbalk links, icoon + tekst.
 * - orientation="horizontal": balk bovenaan; navknoppen staan 45° schuin (uiteinde rechtsonder).
 */
export default function Sidebar({
  activePage, setActivePage,
  isAdmin, showJumbo, user,
  onShowSettings, onShowAdmin, onLogout, onOpenSearch,
  syncing, syncFlash, updateAvailable, hasLevelUp, hasActiveGymWorkout, hasActivePomo,
  overdueCount = 0,
  orientation = 'vertical',
}) {
  const displayName = user?.email?.split('@')[0] || 'Student'
  const initial = displayName.charAt(0).toUpperCase()
  const horizontal = orientation === 'horizontal'

  const navItems = [
    ...NAV_ITEMS,
    ...(showJumbo ? [{ id: 'jumbo', Icon: Briefcase, label: 'Jumbo ★' }] : []),
    ...(isAdmin ? [{ id: 'geld', Icon: Wallet, label: 'Geld' }] : []),
    // Hypex AI: INACTIVE (uit de navigatie, code blijft in pages/HypexAIPage.jsx)
  ]

  const syncIcon = (
    <RefreshCw
      size={12}
      aria-label={syncing ? 'Synchroniseren…' : 'Gesynchroniseerd'}
      style={{
        color: syncFlash ? 'var(--c-success)' : 'var(--c-text-3)',
        transition: 'color 0.5s',
        animation: syncing ? 'spin 0.8s linear infinite' : 'none',
        flexShrink: 0,
      }}
    />
  )

  const logo = (
    <img
      src="/logo.png" alt="" aria-hidden="true" width={30} height={30}
      style={{ width: 30, height: 30, flexShrink: 0, display: 'block' }}
    />
  )

  const navButtons = navItems.map(({ id, Icon, label }) => {
    const active = activePage === id
    const levelUp   = id === 'statistieken' && hasLevelUp && !active
    const gymActive = id === 'gym' && hasActiveGymWorkout && !active
    const pomoActive = id === 'focus' && hasActivePomo && !active
    const badge = id === 'taken' && overdueCount > 0 && !active
    const button = (
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
    // Bovenbalk: vaste slot per knop; de knop zelf draait 45° binnen de slot
    return horizontal ? <div key={id} className="hx-tilt-slot">{button}</div> : button
  })

  // ── Balk bovenaan ──────────────────────────────────────────────────────────
  if (horizontal) {
    return (
      <header className="hx-sidebar hx-topbar">
        <div className="hx-topbar-inner">
          <div className="hx-topbar-side">
            {logo}
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>Hypex</span>
          </div>

          <nav aria-label="Hoofdnavigatie" className="hx-topbar-nav">{navButtons}</nav>

          <div className="hx-topbar-side" style={{ gap: 4 }}>
            {onOpenSearch && (
              <button type="button" onClick={onOpenSearch} className="hx-nav-item" style={{ color: 'var(--c-text-3)' }}>
                <Search size={15} aria-hidden="true" />
                <span>Zoeken</span>
                <kbd style={{ fontSize: 10, color: 'var(--c-text-3)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>Ctrl K</kbd>
              </button>
            )}
            <span style={{ padding: '0 6px', display: 'flex' }}>{syncIcon}</span>
            {updateAvailable && (
              <button type="button" onClick={() => window.location.reload()} className="hx-nav-item"
                title="Update beschikbaar — herladen" aria-label="Update beschikbaar — herladen" style={{ color: 'var(--c-warning)' }}>
                <RefreshCw size={15} aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={onShowSettings} className="hx-nav-item" title="Instellingen" aria-label="Instellingen">
              <Settings size={15} aria-hidden="true" />
            </button>
            {isAdmin && (
              <button type="button" onClick={onShowAdmin} className="hx-nav-item" title="Admin" aria-label="Admin" style={{ color: 'var(--c-warning)' }}>
                <Shield size={15} aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={onLogout} className="hx-nav-item hx-nav-item--danger" title="Uitloggen" aria-label="Uitloggen" style={{ color: 'var(--c-text-3)' }}>
              <LogOut size={15} aria-hidden="true" />
            </button>
            <div className="hx-avatar" title={displayName} aria-label={displayName}>{initial}</div>
          </div>
        </div>
      </header>
    )
  }

  // ── Zijbalk links ──────────────────────────────────────────────────────────
  return (
    <aside className="hx-sidebar hx-sidebar--v">

      {/* Logo */}
      <div style={{ padding: '16px 14px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logo}
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>Hypex</span>
          <span style={{ marginLeft: 'auto', display: 'flex' }}>{syncIcon}</span>
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
        {navButtons}
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
          <div className="hx-avatar" aria-hidden="true">{initial}</div>
          <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
        </div>
      </div>
    </aside>
  )
}
