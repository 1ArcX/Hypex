import React from 'react'
import { createPortal } from 'react-dom'
import { Play, Pause, RotateCcw, SkipForward, Settings, X, Bell, BellOff, Volume2, VolumeX, Coffee, Zap, Maximize2, Timer } from 'lucide-react'
import FocusMode from './FocusMode'
import PomodoroHero from './pomodoro/PomodoroHero'
import RewardScreen from './pomodoro/RewardScreen'
import { usePomodoroEngine, MODES, SOUND_TYPES, getMins } from './pomodoro/usePomodoroEngine'

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '36px', height: '36px', borderRadius: '10px',
  border: '1px solid var(--c-border)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--c-text-3)', cursor: 'pointer',
}

// ── Completion Popup ──────────────────────────────────────────────────────────
function CompletionPopup({ prevMode, nextMode, onStart, onSkip }) {
  const isWorkDone = prevMode === 'work'
  const modeColor  = MODES[nextMode].color

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 340, width: '100%',
        padding: 40, borderRadius: 24,
        background: `color-mix(in srgb, ${modeColor} 6%, transparent)`,
        border: `1px solid color-mix(in srgb, ${modeColor} 25%, transparent)`,
        boxShadow: `0 0 80px color-mix(in srgb, ${modeColor} 20%, transparent)`,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
          background: `color-mix(in srgb, ${modeColor} 15%, transparent)`,
          border: `2px solid color-mix(in srgb, ${modeColor} 40%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px color-mix(in srgb, ${modeColor} 30%, transparent)`,
        }}>
          {isWorkDone ? <Coffee size={36} color={modeColor} /> : <Zap size={36} color={modeColor} />}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
          {isWorkDone ? 'Focus sessie klaar! 🎯' : 'Pauze voorbij!'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: '0 0 28px', lineHeight: 1.5 }}>
          {nextMode === 'longBreak'
            ? 'Je hebt het verdiend — neem een lange pauze.'
            : nextMode === 'break'
            ? 'Neem even een korte pauze.'
            : 'Klaar voor de volgende focus sessie?'}
        </p>

        {/* Start button — dismisses AND starts timer */}
        <button onClick={onStart} style={{
          width: '100%', padding: '14px', borderRadius: 14,
          background: `color-mix(in srgb, ${modeColor} 20%, transparent)`,
          border: `1px solid color-mix(in srgb, ${modeColor} 40%, transparent)`,
          color: modeColor, cursor: 'pointer',
          fontSize: 15, fontWeight: 700,
          boxShadow: `0 0 20px color-mix(in srgb, ${modeColor} 15%, transparent)`,
          transition: 'all 0.2s',
        }}>
          {nextMode === 'work' ? '▶ Start Focus' : nextMode === 'break' ? '☕ Start Pauze' : '🌙 Start Lange Pauze'}
        </button>

        {/* Skip — just dismisses, timer stays paused */}
        <button onClick={onSkip} style={{
          marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-text-3)', fontSize: 13, padding: '6px',
        }}>
          Sla over
        </button>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PomodoroTimer({ onModeChange, onPomodoroActive, onFocusModeChange, userId, noFocusOverlay = false, fullPage = false, onSessionComplete, renderCards, renderFooter, seedTask, onSeedConsumed }) {
  const {
    state, dispatch, popup, focusMode, setFocusMode,
    soundType, setSoundType, volume, setVolume, scene, setScene,
    toggleRunning, reset, skip, switchMode, toggleNotif, skipPopup, closeFocusMode, startAfterPopup,
    goalApi, sendTestNotif,
  } = usePomodoroEngine({ onModeChange, onPomodoroActive, onFocusModeChange, userId, noFocusOverlay, onSessionComplete, seedTask, onSeedConsumed })

  // ── Display ───────────────────────────────────────────────────────────────
  const {
    mode, seconds, running, sessionsInCycle, sessionsPerLong, totalSessions,
    task, soundEnabled, notifEnabled, showSettings, todayMins,
    workMins, breakMins, longBreakMins,
  } = state

  const currentMins   = getMins(state)
  const totalSecs     = currentMins * 60
  const progress      = seconds / totalSecs
  const modeColor     = MODES[mode].color
  const radius        = 68
  const circ          = 2 * Math.PI * radius
  const dashOffset    = circ * (1 - progress)
  const mm            = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss            = String(seconds % 60).padStart(2, '0')
  const todayH        = Math.floor(todayMins / 60)
  const todayM        = todayMins % 60
  const todayStr      = todayH > 0 ? `${todayH}u ${todayM}m` : `${todayMins}m`

  // ── Full-page render (Pomodoro-pagina) ────────────────────────────────────
  if (fullPage) {
    return (
      <>
        {popup && createPortal(
          popup.reward
            ? <RewardScreen reward={popup.reward} xp={popup.reward.xp} tag={popup.tag} nextMode={popup.nextMode} onStart={startAfterPopup} onSkip={skipPopup} />
            : <CompletionPopup prevMode={popup.prevMode} nextMode={popup.nextMode} onStart={startAfterPopup} onSkip={skipPopup} />,
          document.body
        )}
        <PomodoroHero
          state={state}
          modes={MODES}
          soundTypes={SOUND_TYPES}
          progress={progress}
          timeLabel={`${mm}:${ss}`}
          isFresh={seconds === totalSecs}
          soundType={soundType}
          onSoundType={setSoundType}
          scene={scene}
          onScene={setScene}
          volume={volume}
          onVolume={setVolume}
          onToggleRunning={toggleRunning}
          onReset={reset}
          onSkip={skip}
          onSwitchMode={switchMode}
          onToggleNotif={toggleNotif}
          onTestNotif={sendTestNotif}
          dispatch={dispatch}
          footer={renderFooter?.()}
        >
          {renderCards?.({ ...state, goalApi })}
        </PomodoroHero>
      </>
    )
  }

  return (
    <>
      {/* Completion popup — via portal zodat het boven alle widgets staat */}
      {popup && createPortal(
        <CompletionPopup
          prevMode={popup.prevMode}
          nextMode={popup.nextMode}
          onStart={startAfterPopup}
          onSkip={skipPopup}
        />,
        document.body
      )}

      {/* Focus mode overlay */}
      {focusMode && !popup && !noFocusOverlay && (
        <FocusMode
          mode={mode}
          seconds={seconds}
          totalSecs={totalSecs}
          running={running}
          task={task}
          sessionsInCycle={sessionsInCycle}
          sessionsPerLong={sessionsPerLong}
          onToggleRunning={toggleRunning}
          onReset={reset}
          onSkip={skip}
          onClose={closeFocusMode}
          soundType={soundType}
          onSoundType={setSoundType}
          volume={volume}
          onVolume={setVolume}
        />
      )}

      <div
        className="glass-card transition-all duration-700"
        style={{
          padding: '18px',
          borderLeft: `3px solid color-mix(in srgb, ${modeColor} 45%, transparent)`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${modeColor} 6%, transparent) 0%, transparent 60%)`,
          boxShadow: running
            ? `0 0 40px color-mix(in srgb, ${modeColor} 18%, transparent), inset 0 0 30px color-mix(in srgb, ${modeColor} 4%, transparent)`
            : undefined,
          borderColor: running ? `color-mix(in srgb, ${modeColor} 30%, transparent)` : undefined,
          transition: 'border-color 0.6s, background 0.6s, box-shadow 0.6s',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `color-mix(in srgb, ${modeColor} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.6s' }}>
              <Timer size={12} style={{ color: modeColor }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: modeColor, transition: 'color 0.6s' }}>
              POMODORO
            </span>
            {/* Compact time display always visible in header */}
            {running && (
              <span style={{
                fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                color: modeColor, letterSpacing: 1,
                textShadow: `0 0 12px color-mix(in srgb, ${modeColor} 38%, transparent)`,
              }}>
                {mm}:{ss}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => dispatch({ type: 'TOGGLE_SOUND' })} style={iconBtn} title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}>
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button onClick={toggleNotif} style={iconBtn} title={notifEnabled ? 'Meldingen uit' : 'Meldingen aan'}>
              {notifEnabled ? <Bell size={13} /> : <BellOff size={13} />}
            </button>
            {notifEnabled && (
              <button
                onClick={sendTestNotif}
                style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                Test
              </button>
            )}
            <button onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} style={iconBtn}>
              {showSettings ? <X size={13} /> : <Settings size={13} />}
            </button>
          </div>
        </div>

        {/* ── Settings panel ── */}
        {showSettings && (
          <div style={{
            marginBottom: '14px', padding: '14px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)',
          }}>
            {[
              { label: 'Focus',       color: MODES.work.color,      val: workMins,      max: MODES.work.maxMins, action: v => dispatch({ type: 'SET_WORK_MINS',  v }) },
              { label: 'Pauze',       color: MODES.break.color,     val: breakMins,     max: MODES.break.maxMins, action: v => dispatch({ type: 'SET_BREAK_MINS', v }) },
              { label: 'Lange pauze', color: MODES.longBreak.color, val: longBreakMins, max: MODES.longBreak.maxMins, action: v => dispatch({ type: 'SET_LBRK_MINS',  v }) },
            ].map(({ label, color, val, max, action }) => (
              <div key={label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>{label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color }}>{val} min</span>
                </div>
                <input type="range" min="1" max={max} value={val}
                  onChange={e => action(+e.target.value)}
                  style={{ width: '100%', accentColor: color }} />
              </div>
            ))}
            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>Sessies per cyclus</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => dispatch({ type: 'SET_SPL', v: n })}
                    style={{
                      width: '26px', height: '26px', borderRadius: '7px', border: 'none',
                      cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                      background: sessionsPerLong === n ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'rgba(255,255,255,0.05)',
                      color: sessionsPerLong === n ? 'var(--accent)' : 'var(--c-text-3)',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Mode tabs ── */}
        <div style={{
          display: 'flex', gap: '3px', marginBottom: '14px',
          padding: '3px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)',
        }}>
          {Object.entries(MODES).map(([key, { label, color }]) => (
            <button key={key} onClick={() => switchMode(key)}
              style={{
                flex: 1, padding: '6px 2px', borderRadius: '9px', border: 'none',
                cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                letterSpacing: '0.02em', transition: 'all 0.2s',
                background: mode === key ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
                color: mode === key ? color : 'var(--c-text-3)',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Cycle progress dots ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '7px', marginBottom: '10px' }}>
          {Array.from({ length: sessionsPerLong }, (_, i) => {
            const done = i < sessionsInCycle
            return (
              <div key={i} style={{
                width:  done ? '8px' : '6px',
                height: done ? '8px' : '6px',
                borderRadius: '50%',
                background: done ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                boxShadow: done ? '0 0 6px color-mix(in srgb, var(--accent) 50%, transparent)' : 'none',
                transition: 'all 0.3s',
              }} />
            )
          })}
        </div>

        {/* ── Timer ring ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div style={{ position: 'relative', width: '164px', height: '164px' }}>
            <svg width="164" height="164" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="82" cy="82" r={radius} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
              <circle cx="82" cy="82" r={radius} fill="none"
                stroke={modeColor} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                style={{
                  filter: `drop-shadow(0 0 8px color-mix(in srgb, ${modeColor} 44%, transparent))`,
                  transition: 'stroke-dashoffset 0.5s ease, stroke 0.6s ease',
                }}
              />
            </svg>

            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '34px', fontWeight: 700, fontFamily: 'monospace',
                color: modeColor, lineHeight: 1, letterSpacing: '-1px',
                textShadow: `0 0 20px color-mix(in srgb, ${modeColor} 31%, transparent)`,
                transition: 'color 0.6s ease',
              }}>
                {mm}:{ss}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em',
                color: 'var(--c-text-3)', marginTop: '5px',
                textTransform: 'uppercase',
              }}>
                {MODES[mode].label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Task input ── */}
        <div style={{ marginBottom: '14px' }}>
          <input
            type="text"
            placeholder="Waar werk je aan?"
            value={task}
            onChange={e => dispatch({ type: 'SET_TASK', v: e.target.value })}
            onFocus={e => { e.target.style.borderColor = `color-mix(in srgb, ${modeColor} 35%, transparent)` }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--c-border)',
              borderRadius: '10px', padding: '9px 12px',
              color: 'var(--c-text-2)', fontSize: '12px',
              outline: 'none', transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button onClick={reset} style={iconBtn} title="Reset">
            <RotateCcw size={15} />
          </button>

          <button onClick={toggleRunning}
            style={{
              flex: 1, height: '40px', borderRadius: '12px',
              border: `1px solid color-mix(in srgb, ${modeColor} 40%, transparent)`,
              background: `color-mix(in srgb, ${modeColor} 10%, transparent)`,
              color: modeColor, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
            }}>
            {running
              ? <><Pause size={15} /> Pauzeer</>
              : <><Play  size={15} /> {seconds === totalSecs ? 'Start' : 'Hervat'}</>
            }
          </button>

          <button onClick={skip} style={iconBtn} title="Sla over">
            <SkipForward size={15} />
          </button>

          {!noFocusOverlay && (
            <button
              onClick={() => { setFocusMode(true); onFocusModeChange?.(true) }}
              title="Focusmodus"
              style={{
                ...iconBtn,
                display: 'flex', alignItems: 'center', gap: 4,
                width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 600,
                color: 'var(--c-text-2)',
              }}
            >
              <Maximize2 size={13} /> Focus
            </button>
          )}
        </div>

        {/* ── Daily stats ── */}
        <div style={{
          paddingTop: '12px', borderTop: '1px solid var(--c-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
            Vandaag gefocust
          </span>
          <span style={{ fontSize: '11px', color: 'var(--c-text-2)', fontWeight: 600 }}>
            {todayMins > 0 ? todayStr : '—'}
            {totalSessions > 0 && (
              <span style={{ marginLeft: '8px', color: 'var(--c-text-3)', fontWeight: 400 }}>
                · {totalSessions} sessie{totalSessions !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  )
}
