import React from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX } from 'lucide-react'

const MODES = {
  work:      { label: 'FOCUS',       color: '#00FFD1', rgb: '0,255,209'   },
  break:     { label: 'PAUZE',       color: '#FF8C42', rgb: '255,140,66'  },
  longBreak: { label: 'LANGE PAUZE', color: '#A78BFA', rgb: '167,139,250' },
}

const SOUND_TYPES = [
  { id: 'off',   emoji: '🔇', label: 'Uit'    },
  { id: 'focus', emoji: '🧠', label: 'Focus'  },
  { id: 'brown', emoji: '🌫️', label: 'Brown'  },
  { id: 'rain',  emoji: '🌧️', label: 'Regen'  },
  { id: 'ocean', emoji: '🌊', label: 'Oceaan' },
]

export default function FocusMode({
  mode, seconds, totalSecs, running, task,
  sessionsInCycle, sessionsPerLong,
  onToggleRunning, onReset, onSkip, onClose,
  soundType, onSoundType, volume, onVolume,
}) {
  const { color, rgb, label } = MODES[mode] || MODES.work
  const progress    = totalSecs > 0 ? seconds / totalSecs : 0
  const radius      = 120
  const circ        = 2 * Math.PI * radius
  const dashOffset  = circ * (1 - progress)
  const mm          = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss          = String(seconds % 60).padStart(2, '0')

  const content = (
    <div className="focus-overlay">
      {/* Animated blobs */}
      <div className="focus-blob focus-blob--1" style={{ background: `radial-gradient(circle, rgba(${rgb},0.18) 0%, transparent 70%)` }} />
      <div className="focus-blob focus-blob--2" style={{ background: `radial-gradient(circle, rgba(${rgb},0.12) 0%, transparent 70%)` }} />
      <div className="focus-blob focus-blob--3" style={{ background: `radial-gradient(circle, rgba(${rgb},0.08) 0%, transparent 70%)` }} />

      {/* Close button — does NOT stop timer */}
      <button className="focus-close-btn" onClick={onClose} title="Sluit focusmodus (timer loopt door)">
        <X size={20} />
      </button>

      {/* Centered content */}
      <div className="focus-center">

        {/* Task name */}
        {task && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', textAlign: 'center', letterSpacing: '0.02em' }}>
            {task}
          </p>
        )}

        {/* Mode label */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
          color: `rgba(${rgb},0.7)`, margin: '0 0 28px', textTransform: 'uppercase',
        }}>
          {label}
        </p>

        {/* SVG progress ring */}
        <div className="focus-ring-wrap">
          <svg width="280" height="280" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
            <circle cx="140" cy="140" r={radius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <circle cx="140" cy="140" r={radius} fill="none"
              stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              style={{
                filter: `drop-shadow(0 0 16px ${color}80)`,
                transition: 'stroke-dashoffset 0.5s ease, stroke 0.6s ease',
              }}
            />
          </svg>

          <div className="focus-time">
            <span className="focus-time-digits" style={{ color, textShadow: `0 0 40px ${color}60` }}>
              {mm}:{ss}
            </span>
          </div>
        </div>

        {/* Play/pause button */}
        <button
          className="focus-play-btn"
          onClick={onToggleRunning}
          style={{
            border: `2px solid rgba(${rgb},0.5)`,
            background: `rgba(${rgb},0.12)`,
            color,
            boxShadow: running ? `0 0 30px rgba(${rgb},0.3)` : 'none',
          }}
        >
          {running ? <Pause size={30} /> : <Play size={30} style={{ marginLeft: 3 }} />}
        </button>

        {/* Reset + skip */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <button onClick={onReset} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '8px 16px', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          }}>
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={onSkip} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '8px 16px', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          }}>
            <SkipForward size={13} /> Sla over
          </button>
        </div>

        {/* Session dots */}
        <div className="focus-dots">
          {Array.from({ length: sessionsPerLong }, (_, i) => (
            <div
              key={i}
              className={`focus-dot${i < sessionsInCycle ? ' focus-dot--done' : ''}`}
              style={i < sessionsInCycle ? { background: color, boxShadow: `0 0 8px ${color}80` } : {}}
            />
          ))}
        </div>

        {/* Sound type pills */}
        <div className="focus-sound-pills">
          {SOUND_TYPES.map(({ id, emoji, label: lbl }) => (
            <button
              key={id}
              className={`focus-pill${soundType === id ? ' focus-pill--active' : ''}`}
              onClick={() => onSoundType(id)}
              style={soundType === id ? {
                background: `rgba(${rgb},0.2)`,
                border: `1px solid rgba(${rgb},0.5)`,
                color,
              } : {}}
            >
              {emoji} {lbl}
            </button>
          ))}
        </div>

        {/* Volume slider */}
        {soundType !== 'off' && (
          <div className="focus-volume">
            <VolumeX size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
            <input
              type="range" min="0" max="100" value={volume}
              onChange={e => onVolume(+e.target.value)}
              style={{ flex: 1, accentColor: color }}
            />
            <Volume2 size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          </div>
        )}

      </div>
    </div>
  )

  return createPortal(content, document.body)
}
