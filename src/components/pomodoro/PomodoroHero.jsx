import React, { useEffect, useRef } from 'react'
import {
  Play, Pause, RotateCcw, SkipForward, Settings, X, Bell, BellOff, Volume2, VolumeX,
  Brain, Coffee, Moon, Zap, Pencil, Ban, Target, Wind, CloudRain, Waves,
} from 'lucide-react'

// Achtergrondscène per focus-geluid. Foto's staan in public/pomodoro/; ontbreekt er een,
// dan valt de laag terug op de gradient eronder.
const SCENES = {
  night: { img: '/pomodoro/night.webp', fallback: 'radial-gradient(900px 420px at 75% 10%, #1b2b55 0%, transparent 60%), linear-gradient(180deg, #0a1128 0%, #0b1a33 55%, #050a17 100%)' },
  brown: { img: '/pomodoro/brown.webp', fallback: 'radial-gradient(900px 420px at 30% 20%, #3a2413 0%, transparent 60%), linear-gradient(180deg, #1a120c 0%, #120d0a 60%, #070504 100%)' },
  rain:  { img: '/pomodoro/rain.webp',  fallback: 'radial-gradient(900px 420px at 50% 0%, #22324a 0%, transparent 60%), linear-gradient(180deg, #0e1622 0%, #0b121c 60%, #05080d 100%)' },
  ocean: { img: '/pomodoro/ocean.webp', fallback: 'radial-gradient(900px 420px at 60% 15%, #12406b 0%, transparent 60%), linear-gradient(180deg, #071a33 0%, #06223d 55%, #030c18 100%)' },
}
const SCENE_FOR_SOUND = { off: 'night', focus: 'night', brown: 'brown', rain: 'rain', ocean: 'ocean' }
const SOUND_ICONS = { off: Ban, focus: Target, brown: Wind, rain: CloudRain, ocean: Waves }
const MODE_ICONS = { work: Brain, break: Coffee, longBreak: Moon }
const MODE_TITLES = { work: 'Focussessie', break: 'Pauze', longBreak: 'Lange pauze' }
const PRESETS = { work: [15, 20, 25, 30, 45, 60], break: [5, 10, 15, 20], longBreak: [10, 15, 20, 30] }
const SET_ACTION = { work: 'SET_WORK_MINS', break: 'SET_BREAK_MINS', longBreak: 'SET_LBRK_MINS' }
const MINS_KEY = { work: 'workMins', break: 'breakMins', longBreak: 'longBreakMins' }

function SettingsPopover({ state, modes, dispatch, onToggleNotif, onTestNotif, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-pomo-gear]')) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const { soundEnabled, notifEnabled, workMins, breakMins, longBreakMins, sessionsPerLong } = state
  return (
    <div ref={ref} className="pomo-popover" role="dialog" aria-label="Timer instellingen">
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button type="button" className={`pomo-toggle${soundEnabled ? ' is-on' : ''}`} onClick={() => dispatch({ type: 'TOGGLE_SOUND' })}>
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} Eindsignaal
        </button>
        <button type="button" className={`pomo-toggle${notifEnabled ? ' is-on' : ''}`} onClick={onToggleNotif}>
          {notifEnabled ? <Bell size={14} /> : <BellOff size={14} />} Meldingen
        </button>
        {notifEnabled && (
          <button type="button" onClick={onTestNotif} style={{ fontSize: 11, color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
            Test
          </button>
        )}
      </div>
      {[
        { label: 'Focus',       color: modes.work.color,      val: workMins,      max: 60, type: 'SET_WORK_MINS' },
        { label: 'Pauze',       color: modes.break.color,     val: breakMins,     max: 30, type: 'SET_BREAK_MINS' },
        { label: 'Lange pauze', color: modes.longBreak.color, val: longBreakMins, max: 60, type: 'SET_LBRK_MINS' },
      ].map(({ label, color, val, max, type }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="t-meta">{label}</span>
            <span className="tnum" style={{ fontSize: 11, fontWeight: 600, color }}>{val} min</span>
          </div>
          <input type="range" min="1" max={max} value={val} disabled={state.running}
            onChange={e => dispatch({ type, v: +e.target.value })}
            style={{ width: '100%', accentColor: color }} aria-label={`${label} minuten`} />
        </div>
      ))}
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="t-meta">Sessies per cyclus</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[2, 3, 4, 5, 6].map(n => (
            <button key={n} type="button" onClick={() => dispatch({ type: 'SET_SPL', v: n })} className={`pomo-mini${sessionsPerLong === n ? ' is-active' : ''}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PomodoroHero({
  state, modes, soundTypes, progress, timeLabel, isFresh,
  soundType, onSoundType, volume, onVolume,
  onToggleRunning, onReset, onSkip, onSwitchMode, onToggleNotif, onTestNotif, dispatch,
  children,
}) {
  const { mode, running, task, showSettings } = state
  const modeColor = modes[mode].color
  const activeScene = SCENE_FOR_SOUND[soundType] || 'night'
  const ModeIcon = MODE_ICONS[mode]

  // Ring
  const R = 118
  const circ = 2 * Math.PI * R
  const dash = circ * (1 - progress)

  const startLabel = running ? 'Pauzeer' : isFresh ? (mode === 'work' ? 'Start focus' : mode === 'break' ? 'Start pauze' : 'Start lange pauze') : 'Hervat'

  return (
    <section className={`pomo-hero${running ? ' is-running' : ''}`} style={{ '--pomo-mode': modeColor }}>
      {/* Achtergrondlagen — cross-fade bij wisselen van focus-geluid */}
      <div className="pomo-bg" aria-hidden="true">
        {Object.entries(SCENES).map(([key, sc]) => (
          <div key={key} className="pomo-bg-layer"
            style={{ backgroundImage: `url(${sc.img}), ${sc.fallback}`, opacity: key === activeScene ? 1 : 0 }} />
        ))}
        <div className="pomo-bg-shade" />
      </div>

      <div className="pomo-content">
        {/* Modus selectie */}
        <div className="pomo-modes" role="tablist" aria-label="Timer modus">
          {Object.entries(modes).map(([key, { label, color }]) => {
            const Icon = MODE_ICONS[key]
            const active = mode === key
            return (
              <button key={key} type="button" role="tab" aria-selected={active} onClick={() => onSwitchMode(key)}
                className={`pomo-mode${active ? ' is-active' : ''}`} style={{ '--c': color }}>
                <Icon size={15} aria-hidden="true" /> {label}
              </button>
            )
          })}
        </div>

        {/* Timer */}
        <div className="pomo-ring">
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <defs>
              <linearGradient id="pomoRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${modeColor} 55%, white)` }} />
                <stop offset="100%" style={{ stopColor: modeColor }} />
              </linearGradient>
            </defs>
            <circle cx="130" cy="130" r={R} fill="rgba(5,10,24,0.35)" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle cx="130" cy="130" r={R} fill="none" stroke="url(#pomoRingGrad)" strokeWidth="10"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
              transform="rotate(-90 130 130)" className="pomo-ring-arc" />
          </svg>
          <div className="pomo-ring-inner">
            <span className="pomo-ring-title">{MODE_TITLES[mode]}</span>
            <span className="pomo-ring-time tnum" role="timer" aria-live="off">{timeLabel}</span>
            <span className="pomo-ring-mode">
              {mode === 'work' ? <Zap size={15} aria-hidden="true" /> : <ModeIcon size={15} aria-hidden="true" />}
              {modes[mode].label}
            </span>
          </div>
        </div>

        {/* Waar werk je aan */}
        <label className="pomo-input">
          <Pencil size={15} aria-hidden="true" />
          <input type="text" placeholder="Waar werk je aan? (optioneel)" value={task}
            onChange={e => dispatch({ type: 'SET_TASK', v: e.target.value })} />
        </label>

        {/* Snelle tijdopties */}
        <div className="pomo-chips" role="group" aria-label="Duur">
          {PRESETS[mode].map(n => {
            const active = state[MINS_KEY[mode]] === n
            return (
              <button key={n} type="button" disabled={running} onClick={() => dispatch({ type: SET_ACTION[mode], v: n })}
                className={`pomo-chip tnum${active ? ' is-active' : ''}`} aria-pressed={active}>
                {n}m
              </button>
            )
          })}
        </div>

        {/* Focus modes (ambient) */}
        <div className="pomo-sounds" role="group" aria-label="Focusgeluid">
          {soundTypes.map(({ id, label }) => {
            const Icon = SOUND_ICONS[id] || Ban
            const sc = SCENES[SCENE_FOR_SOUND[id]]
            const active = soundType === id
            return (
              <button key={id} type="button" onClick={() => onSoundType(id)} aria-pressed={active}
                className={`pomo-sound${active ? ' is-active' : ''}`}
                style={id === 'off' ? undefined : { backgroundImage: `linear-gradient(180deg, rgba(4,8,20,0.15), rgba(4,8,20,0.7)), url(${sc.img}), ${sc.fallback}` }}>
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
        {soundType !== 'off' && (
          <div className="pomo-volume">
            <VolumeX size={14} aria-hidden="true" />
            <input type="range" min="0" max="100" value={volume} onChange={e => onVolume(+e.target.value)} aria-label="Volume focusgeluid" />
            <Volume2 size={14} aria-hidden="true" />
          </div>
        )}

        {/* Bediening */}
        <div className="pomo-controls">
          {running ? (
            <button type="button" className="pomo-round" onClick={onSkip} aria-label="Sla over" title="Sla over"><SkipForward size={18} /></button>
          ) : (
            <button type="button" className="pomo-round" onClick={onReset} aria-label="Reset" title="Reset"><RotateCcw size={18} /></button>
          )}
          <button type="button" className="pomo-start" onClick={onToggleRunning}>
            {running ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            {startLabel}
          </button>
          <div style={{ position: 'relative' }}>
            <button type="button" data-pomo-gear className={`pomo-round${showSettings ? ' is-active' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} aria-label="Instellingen" aria-expanded={showSettings} title="Instellingen">
              {showSettings ? <X size={18} /> : <Settings size={18} />}
            </button>
            {showSettings && (
              <SettingsPopover state={state} modes={modes} dispatch={dispatch}
                onToggleNotif={onToggleNotif} onTestNotif={onTestNotif}
                onClose={() => dispatch({ type: 'TOGGLE_SETTINGS' })} />
            )}
          </div>
        </div>

        {children && <div className="pomo-cards">{children}</div>}
      </div>
    </section>
  )
}
