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

/**
 * Desktop-navigatie.
 * - orientation="vertical" (standaard): zijbalk links; `rail` = smalle icoonbalk (64px).
 * - orientation="horizontal": balk bovenaan; labels verdwijnen (container query) als het te krap wordt.
 */
export default function Sidebar({
  activePage, setActivePage,
  isAdmin, showJumbo, user,
  onShowSettings, onShowAdmin, onLogout, onOpenSearch,
  syncing, syncFlash, updateAvailable, hasLevelUp, hasActiveGymWorkout, hasActivePomo,
  overdueCount = 0,
  orientation = 'vertical', rail = false,
}) {
  const displayName = user?.email?.split('@')[0] || 'Student'
  const initial = displayName.charAt(0).toUpperCase()
  const horizontal = orientation === 'horizontal'
  const compact = rail || horizontal

  const navItems = [
    ...NAV_ITEMS,
    ...(showJumbo ? [{ id: 'jumbo', Icon: Briefcase, label: 'Jumbo ★' }] : []),
    ...(isAdmin ? [{ id: 'geld', Icon: Wallet, label: 'Geld' }] : []),
    ...(isAdmin ? [{ id: 'hypexai', Icon: Sparkles, label: 'Hypex AI' }] : []),
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
    const pomoActive = id === 'pomodoro' && hasActivePomo && !active
    const badge = id === 'taken' && overdueCount > 0 && !active
    return (
      <button
        key={id}
        type="button"
        onClick={() => setActivePage(id)}
        aria-current={active ? 'page' : undefined}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        className={`hx-nav-item${active ? ' is-active' : ''}${pomoActive ? ' is-running' : ''}`}
      >
        <Icon size={15} aria-hidden="true" />
        <span className="hx-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {badge && <span className="hx-badge"><CountBadge count={overdueCount} label={`${overdueCount} te laat`} /></span>}
        {badge && <span className="hx-dot" aria-hidden="true" />}
        {pomoActive && <span className="hx-badge"><Pill tone="accent">Actief</Pill></span>}
        {gymActive && <span className="hx-badge"><Pill tone="warning">Actief</Pill></span>}
        {levelUp && <span className="hx-badge"><Pill tone="school">Level up</Pill></span>}
        {(pomoActive || gymActive || levelUp) && <span className="hx-dot hx-dot--accent" aria-hidden="true" />}
      </button>
    )
  })

  const updateBtn = updateAvailable && (
    <button type="button" onClick={() => window.location.reload()} className="hx-nav-item"
      title="Update beschikbaar — herladen" aria-label="Update beschikbaar — herladen" style={{ color: 'var(--c-warning)' }}>
      <RefreshCw size={15} aria-hidden="true" />
    </button>
  )

  // ── Balk bovenaan ──────────────────────────────────────────────────────────
  if (horizontal) {
    return (
      <header className={`hx-sidebar hx-topbar${navItems.length > 7 ? ' is-many' : ''}`}>
        <div className="hx-topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {logo}
            <span className="hx-label" style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>Hypex</span>
          </div>

          <nav aria-label="Hoofdnavigatie" className="hx-topbar-nav">{navButtons}</nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {onOpenSearch && (
              <button type="button" onClick={onOpenSearch} className="hx-nav-item hx-topbar-search" title="Zoeken (Ctrl K)" aria-label="Zoeken (Ctrl K)" style={{ color: 'var(--c-text-3)' }}>
                <Search size={15} aria-hidden="true" />
                <span className="hx-label">Zoeken</span>
                <kbd className="hx-label" style={{ fontSize: 10, color: 'var(--c-text-3)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>Ctrl K</kbd>
              </button>
            )}
            <span style={{ padding: '0 6px', display: 'flex' }}>{syncIcon}</span>
            {updateBtn}
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

  // ── Zijbalk (vol of icoonrail) ─────────────────────────────────────────────
  return (
    <aside className={`hx-sidebar hx-sidebar--v${rail ? ' is-rail' : ''}`}>

      {/* Logo */}
      <div style={{ padding: rail ? '16px 0 12px' : '16px 14px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: rail ? 'center' : undefined, gap: 10 }}>
          {logo}
          {!rail && <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>Hypex</span>}
          {!rail && <span style={{ marginLeft: 'auto', display: 'flex' }}>{syncIcon}</span>}
        </div>
        {rail && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>{syncIcon}</div>}
      </div>

      {/* Zoeken */}
      {onOpenSearch && (
        <div style={{ padding: '0 8px 6px' }}>
          <button type="button" onClick={onOpenSearch} className="hx-nav-item" style={{ color: 'var(--c-text-3)' }}
            title={rail ? 'Zoeken (Ctrl K)' : undefined} aria-label={rail ? 'Zoeken (Ctrl K)' : undefined}>
            <Search size={15} aria-hidden="true" />
            <span className="hx-label" style={{ flex: 1 }}>Zoeken</span>
            <kbd className="hx-label" style={{ fontSize: 10, color: 'var(--c-text-3)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>Ctrl K</kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav aria-label="Hoofdnavigatie" style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {navButtons}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--c-border)', padding: '8px 8px 12px', flexShrink: 0 }}>
        <button type="button" onClick={onShowSettings} className="hx-nav-item" title={rail ? 'Instellingen' : undefined} aria-label={rail ? 'Instellingen' : undefined}>
          <Settings size={15} aria-hidden="true" /> <span className="hx-label">Instellingen</span>
        </button>

        {isAdmin && (
          <button type="button" onClick={onShowAdmin} className="hx-nav-item" style={{ color: 'var(--c-warning)' }} title={rail ? 'Admin' : undefined} aria-label={rail ? 'Admin' : undefined}>
            <Shield size={15} aria-hidden="true" /> <span className="hx-label">Admin</span>
          </button>
        )}

        <button type="button" onClick={onLogout} className="hx-nav-item hx-nav-item--danger" style={{ color: 'var(--c-text-3)' }} title={rail ? 'Uitloggen' : undefined} aria-label={rail ? 'Uitloggen' : undefined}>
          <LogOut size={15} aria-hidden="true" /> <span className="hx-label">Uitloggen</span>
        </button>

        {rail ? updateBtn : (
          <div style={{ padding: '4px 10px 6px' }}>
            <VersionChecker />
          </div>
        )}

        {/* Avatar */}
        {rail ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <div className="hx-avatar" title={displayName} aria-label={displayName}>{initial}</div>
          </div>
        ) : (
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
        )}
      </div>
    </aside>
  )
}
