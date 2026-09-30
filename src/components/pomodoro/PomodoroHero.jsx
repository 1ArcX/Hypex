import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Play, Pause, RotateCcw, SkipForward, Settings, X, Bell, BellOff, Volume2, VolumeX,
  Brain, Coffee, Moon, Zap, Pencil, Ban, Target, Wind, CloudRain, Waves, Image as ImageIcon, Minus, Plus, Sparkles,
} from 'lucide-react'
import SceneCanvas from './SceneCanvas'
import { SCENES, SCENE_BY_ID, SCENE_FOR_SOUND, sceneThumb } from './scenes'

const SOUND_ICONS = { off: Ban, focus: Target, brown: Wind, rain: CloudRain, ocean: Waves }
const MODE_ICONS = { work: Brain, break: Coffee, longBreak: Moon }
const MODE_TITLES = { work: 'Focussessie', break: 'Pauze', longBreak: 'Lange pauze' }
const PRESETS = { work: [15, 20, 25, 30, 45, 60], break: [5, 10, 15, 20], longBreak: [10, 15, 20, 30] }
const SET_ACTION = { work: 'SET_WORK_MINS', break: 'SET_BREAK_MINS', longBreak: 'SET_LBRK_MINS' }
const MINS_KEY = { work: 'workMins', break: 'breakMins', longBreak: 'longBreakMins' }

// Sluit een popover bij klik buiten (behalve op de eigen trigger) of Escape
function useDismiss(ref, triggerSelector, onClose) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest(triggerSelector)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [ref, triggerSelector, onClose])
}

// Minuten-invoer: getal intypen, pas toepassen bij Enter/blur
function NumField({ value, min, max, onCommit, label, disabled }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const commit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n)) onCommit(Math.max(min, Math.min(max, n)))
    else setDraft(String(value))
  }
  return (
    <input className="pomo-num tnum" inputMode="numeric" value={draft} disabled={disabled} aria-label={label}
      onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
  )
}

function SettingsPopover({ state, modes, dispatch, onToggleNotif, onTestNotif, onClose }) {
  const ref = useRef(null)
  useDismiss(ref, '[data-pomo-gear]', onClose)

  const { soundEnabled, notifEnabled, workMins, breakMins, longBreakMins, sessionsPerLong, running } = state
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
        { label: 'Focus',       color: modes.work.color,      val: workMins,      max: modes.work.maxMins,      type: 'SET_WORK_MINS' },
        { label: 'Pauze',       color: modes.break.color,     val: breakMins,     max: modes.break.maxMins,     type: 'SET_BREAK_MINS' },
        { label: 'Lange pauze', color: modes.longBreak.color, val: longBreakMins, max: modes.longBreak.maxMins, type: 'SET_LBRK_MINS' },
      ].map(({ label, color, val, max, type }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="t-meta">{label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color }}>
              <NumField value={val} min={1} max={max} disabled={running} label={`${label} in minuten`} onCommit={v => dispatch({ type, v })} /> min
            </span>
          </div>
          <input type="range" min="1" max={max} value={val} disabled={running}
            onChange={e => dispatch({ type, v: +e.target.value })}
            style={{ width: '100%', accentColor: color }} aria-label={`${label} minuten`} />
        </div>
      ))}
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="t-meta">Sessies per cyclus</span>
        <div className="pomo-stepper">
          <button type="button" className="pomo-mini" onClick={() => dispatch({ type: 'SET_SPL', v: sessionsPerLong - 1 })} disabled={sessionsPerLong <= 1} aria-label="Minder sessies"><Minus size={12} /></button>
          <span className="tnum" aria-live="polite">{sessionsPerLong}</span>
          <button type="button" className="pomo-mini" onClick={() => dispatch({ type: 'SET_SPL', v: sessionsPerLong + 1 })} disabled={sessionsPerLong >= 12} aria-label="Meer sessies"><Plus size={12} /></button>
        </div>
      </div>
    </div>
  )
}

function ScenePicker({ scene, autoScene, onScene, onClose, tint }) {
  const ref = useRef(null)
  useDismiss(ref, '[data-pomo-scene]', onClose)
  const options = [{ id: 'auto', label: 'Automatisch', thumb: sceneThumb(autoScene, tint) }, ...SCENES.map(s => ({ id: s.id, label: s.label, thumb: sceneThumb(s.id, tint) }))]
  return (
    <div ref={ref} className="pomo-scene-picker" role="dialog" aria-label="Achtergrond kiezen">
      <p className="t-meta" style={{ margin: '0 0 10px' }}>Achtergrond</p>
      <div className="pomo-scene-grid">
        {options.map(o => {
          const active = scene === o.id
          return (
            <button key={o.id} type="button" className={`pomo-scene-opt${active ? ' is-active' : ''}`} aria-pressed={active}
              onClick={() => onScene(o.id)} style={{ backgroundImage: `linear-gradient(180deg, transparent 40%, rgba(4,8,20,0.85)), url(${o.thumb})` }}>
              {o.id === 'auto' && <span className="pomo-scene-badge"><Sparkles size={10} /> volgt geluid</span>}
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PomodoroHero({
  state, modes, soundTypes, progress, timeLabel, isFresh,
  soundType, onSoundType, scene = 'auto', onScene, volume, onVolume,
  onToggleRunning, onReset, onSkip, onSwitchMode, onToggleNotif, onTestNotif, dispatch,
  children,
}) {
  const { mode, running, task, showSettings } = state
  const modeColor = modes[mode].color
  const autoScene = SCENE_FOR_SOUND[soundType] || 'nacht'
  const activeScene = scene === 'auto' || !SCENE_BY_ID[scene] ? autoScene : scene
  const ModeIcon = MODE_ICONS[mode]
  const curMins = state[MINS_KEY[mode]]
  const maxMins = modes[mode].maxMins
  const [pickerOpen, setPickerOpen] = useState(false)

  // De scène beslaat het "podium" tot bovenkant van de kaarten; daaronder vervaagt hij naar donker
  const contentRef = useRef(null)
  const cardsRef = useRef(null)
  const [stageH, setStageH] = useState(null)
  useLayoutEffect(() => {
    const measure = () => {
      const c = cardsRef.current
      setStageH(c ? c.offsetTop + 80 : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (contentRef.current) ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [])
  const accent = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), [])

  // ── Tijd aanpassen via de timer ─────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ringRef = useRef(null)
  const live = useRef({})
  live.current = { mode, curMins, maxMins, running, editing }

  const setMins = (v) => dispatch({ type: SET_ACTION[mode], v: Math.max(1, Math.min(maxMins, v)) })
  const startEdit = () => { if (running) return; setDraft(String(curMins)); setEditing(true) }
  const commitEdit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n) && n > 0) setMins(n)
    setEditing(false)
  }

  // Scrollwiel op de ring: ±1 min (Shift ±5). Native listener, want React's wheel is passief.
  useEffect(() => {
    const el = ringRef.current
    if (!el) return
    const onWheel = (e) => {
      const l = live.current
      if (l.running || l.editing) return
      e.preventDefault()
      const step = (e.shiftKey ? 5 : 1) * (e.deltaY < 0 ? 1 : -1)
      dispatch({ type: SET_ACTION[l.mode], v: Math.max(1, Math.min(l.maxMins, l.curMins + step)) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [dispatch])

  const onTimeKey = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      setMins(curMins + (e.shiftKey ? 5 : 1) * (e.key === 'ArrowUp' ? 1 : -1))
    }
  }

  // Ring
  const R = 118
  const circ = 2 * Math.PI * R
  const dash = circ * (1 - progress)

  // Chips: presets + de huidige waarde als die er niet tussen zit
  const chips = PRESETS[mode].includes(curMins) ? PRESETS[mode] : [...PRESETS[mode], curMins].sort((a, b) => a - b)

  const startLabel = running ? 'Pauzeer' : isFresh ? (mode === 'work' ? 'Start focus' : mode === 'break' ? 'Start pauze' : 'Start lange pauze') : 'Hervat'

  return (
    <section className={`pomo-hero${running ? ' is-running' : ''}`} style={{ '--pomo-mode': modeColor }}>
      <div className="pomo-bg" aria-hidden="true">
        <SceneCanvas scene={activeScene} height={stageH} />
        <div className="pomo-bg-shade" />
      </div>

      {/* Achtergrond kiezen */}
      <div className="pomo-tools">
        <button type="button" data-pomo-scene className={`pomo-round pomo-round-sm${pickerOpen ? ' is-active' : ''}`}
          onClick={() => setPickerOpen(o => !o)} aria-label="Achtergrond kiezen" aria-expanded={pickerOpen} title="Achtergrond">
          <ImageIcon size={16} />
        </button>
        {pickerOpen && (
          <ScenePicker scene={scene} autoScene={autoScene} tint={accent}
            onScene={id => onScene?.(id)} onClose={() => setPickerOpen(false)} />
        )}
      </div>

      <div className="pomo-content" ref={contentRef}>
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

        {/* Timer — tik op de tijd om minuten in te typen, of scroll/pijltjes */}
        <div className="pomo-ring" ref={ringRef}>
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
            {editing ? (
              <span className="pomo-ring-edit">
                <input autoFocus className="pomo-ring-input tnum" inputMode="numeric" value={draft} aria-label="Minuten"
                  onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
                  onBlur={commitEdit} />
                <span className="pomo-ring-unit">min</span>
              </span>
            ) : running ? (
              <span className="pomo-ring-time tnum" role="timer" aria-live="off">{timeLabel}</span>
            ) : (
              <button type="button" className="pomo-ring-time pomo-ring-time-btn tnum" onClick={startEdit} onKeyDown={onTimeKey}
                aria-label={`${curMins} minuten, klik om aan te passen`} title="Klik om aan te passen · scroll of ↑↓ voor ±1 min">
                {timeLabel}
              </button>
            )}
            <span className="pomo-ring-mode">
              {mode === 'work' ? <Zap size={15} aria-hidden="true" /> : <ModeIcon size={15} aria-hidden="true" />}
              {modes[mode].label}
            </span>
            {!running && !editing && <span className="pomo-ring-hint">Tik om aan te passen</span>}
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
          {chips.map(n => {
            const active = curMins === n
            return (
              <button key={n} type="button" disabled={running} onClick={() => setMins(n)}
                className={`pomo-chip tnum${active ? ' is-active' : ''}`} aria-pressed={active}>
                {n}m
              </button>
            )
          })}
        </div>

        {/* Focus modes (ambient geluid) */}
        <div className="pomo-sounds" role="group" aria-label="Focusgeluid">
          {soundTypes.map(({ id, label }) => {
            const Icon = SOUND_ICONS[id] || Ban
            const active = soundType === id
            return (
              <button key={id} type="button" onClick={() => onSoundType(id)} aria-pressed={active}
                className={`pomo-sound${active ? ' is-active' : ''}`}
                style={id === 'off' ? undefined : { backgroundImage: `linear-gradient(180deg, rgba(4,8,20,0.2), rgba(4,8,20,0.72)), url(${sceneThumb(SCENE_FOR_SOUND[id], accent)})` }}>
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

        {children && <div className="pomo-cards" ref={cardsRef}>{children}</div>}
      </div>
    </section>
  )
}
