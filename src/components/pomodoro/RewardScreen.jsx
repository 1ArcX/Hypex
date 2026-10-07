import React, { useEffect, useRef, useState } from 'react'
import { fmtFocus } from '../../hooks/useFocusProgress'

// Beloningsscherm na een focussessie: laat zien wat de sessie heeft opgeleverd
// (dagdoel-ring, streak, laatste 7 dagen, records/mijlpalen, week t.o.v. vorige week, XP).
// Volgorde: +minuten → ring loopt → streak → hoogtepunten. Zonder animatie bij reduced motion.

const DAY_LETTERS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const NEXT_LABEL = { work: '▶ Start focus', break: '☕ Start pauze', longBreak: '🌙 Start lange pauze' }

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useCountUp(from, to, delay, duration, instant) {
  const [v, setV] = useState(instant ? to : from)
  useEffect(() => {
    if (instant) { setV(to); return }
    let raf, t0
    const timer = setTimeout(() => {
      const step = (t) => {
        if (!t0) t0 = t
        const p = Math.min(1, (t - t0) / duration)
        setV(from + (to - from) * (1 - Math.pow(1 - p, 3)))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [from, to, delay, duration, instant])
  return v
}

const heatLevel = (mins, goal) => !mins ? 0 : mins < goal * 0.25 ? 1 : mins < goal * 0.5 ? 2 : mins < goal ? 3 : 4

function highlightText(h) {
  switch (h.kind) {
    case 'streakMilestone': return { icon: '🔥', text: `${h.value} dagen op rij!` }
    case 'record':          return { icon: '🏆', text: `Nieuw record: ${fmtFocus(h.value)} op één dag`, sub: `vorige: ${fmtFocus(h.prev)}` }
    case 'totalMilestone':  return { icon: '🎉', text: `${h.value} uur totaal gefocust` }
    default: return null
  }
}

export default function RewardScreen({ reward, xp, tag, nextMode, onStart, onSkip, startLabel, skipLabel }) {
  const { before, after, highlights, mins } = reward
  const reduced = useRef(prefersReduced()).current
  const [phase, setPhase] = useState(reduced ? 3 : 0)
  const startRef = useRef(null)

  useEffect(() => {
    startRef.current?.focus()
    if (reduced) return
    const ts = [setTimeout(() => setPhase(1), 450), setTimeout(() => setPhase(2), 1250), setTimeout(() => setPhase(3), 1750)]
    return () => ts.forEach(clearTimeout)
  }, [reduced])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onSkip() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onSkip])

  const shownMins  = useCountUp(0, mins, 150, 650, reduced)
  const shownToday = useCountUp(before.todayMins, after.todayMins, 450, 900, reduced)
  const goal = after.goal
  const ringPct = Math.min(1, shownToday / goal)
  const goalHit = after.todayMins >= goal
  const streakUp = after.streak > before.streak
  const streak = phase >= 2 ? after.streak : before.streak
  const celebrate = highlights.length > 0
  // Dagdoel staat al in de titel en de groene ring; de lijst is voor de overige doorbraken
  const items = highlights.filter(h => h.kind !== 'goal').map(highlightText).filter(Boolean)

  const title = highlights.some(h => h.kind === 'goal') ? 'Dagdoel gehaald!'
    : highlights.some(h => h.kind === 'record') ? 'Nieuw record!'
    : streakUp ? (after.streak > 1 ? 'Streak verlengd!' : 'Streak gestart!')
    : 'Lekker bezig!'

  const R = 52, C = 2 * Math.PI * R

  return (
    <div className="reward-overlay" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <div className={`reward-card${goalHit ? ' is-goal' : ''}${reduced ? ' is-static' : ''}`}>
        {celebrate && phase >= 3 && (
          <div className="reward-burst" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--a': `${i * 22.5}deg`, '--d': `${(i % 4) * 40}ms` }} />)}
          </div>
        )}

        <p className="reward-eyebrow">Focussessie voltooid{tag ? ` · ${tag}` : ''}</p>
        <div className="reward-plus tnum" aria-label={`${mins} minuten erbij`}>+{Math.round(shownMins)}<span> min</span></div>
        <h2 id="reward-title" className="reward-title">{title}</h2>

        <div className="reward-main">
          {/* Dagdoel-ring */}
          <div className="reward-ring" aria-label={`Vandaag ${fmtFocus(after.todayMins)} van je dagdoel ${fmtFocus(goal)}`}>
            <svg viewBox="0 0 124 124" aria-hidden="true">
              <circle cx="62" cy="62" r={R} className="reward-ring-track" />
              <circle cx="62" cy="62" r={R} className="reward-ring-arc"
                strokeDasharray={C} strokeDashoffset={C * (1 - ringPct)} transform="rotate(-90 62 62)" />
            </svg>
            <div className="reward-ring-inner">
              <span className="reward-ring-val tnum">{fmtFocus(shownToday)}</span>
              <span className="reward-ring-sub tnum">van {fmtFocus(goal)}</span>
            </div>
          </div>

          {/* Streak */}
          <div className={`reward-streak${streakUp && phase >= 2 ? ' is-up' : ''}`}>
            <span className="reward-flame" aria-hidden="true">🔥</span>
            <span className="reward-streak-num tnum">{streak}</span>
            <span className="reward-streak-lbl">{streak === 1 ? 'dag op rij' : 'dagen op rij'}</span>
            {streakUp && phase >= 2 && <span className="reward-streak-plus">+1</span>}
            <span className="reward-streak-best tnum">Langste: {Math.max(after.longest, after.streak)}</span>
          </div>
        </div>

        <p className="reward-goal-line">
          {goalHit ? 'Je dagdoel is binnen. Alles wat nu komt is bonus.' : `Nog ${fmtFocus(goal - after.todayMins)} tot je dagdoel`}
        </p>

        {/* Laatste 7 dagen: vandaag kleurt bij */}
        <div className="reward-days" aria-label="Focus de laatste 7 dagen">
          {after.last7.map((d, i) => {
            const isToday = i === 6
            const mins = isToday && phase < 1 ? before.todayMins : d.mins
            const lvl = heatLevel(mins, goal)
            return (
              <div key={d.date} className="reward-day">
                <span className={`reward-tile lvl-${lvl}${isToday ? ' is-today' : ''}${isToday && phase >= 1 ? ' is-filled' : ''}`}
                  title={`${d.date}: ${fmtFocus(mins)}`} />
                <span className="reward-day-lbl">{DAY_LETTERS[new Date(d.date + 'T12:00:00').getDay()]}</span>
              </div>
            )
          })}
        </div>

        {/* Hoogtepunten (alleen als ze er echt zijn) */}
        {items.length > 0 && (
          <ul className={`reward-highlights${phase >= 3 ? ' is-in' : ''}`}>
            {items.map((it, i) => (
              <li key={i} style={{ '--i': i }}>
                <span aria-hidden="true">{it.icon}</span>
                <span>{it.text}{it.sub && <small> · {it.sub}</small>}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="reward-meta">
          <span className="tnum">
            Deze week {fmtFocus(after.week)}
            {after.weekDelta != null && (after.weekDelta >= 0
              ? <b className="is-up" title="t.o.v. dezelfde dagen vorige week"> ↑ {after.weekDelta}%</b>
              : <b className="is-down"> · nog {fmtFocus(after.prevWeek - after.week)} tot vorige week</b>)}
          </span>
          {xp > 0 && <span className="reward-xp tnum">+{xp} XP</span>}
        </div>

        <button ref={startRef} type="button" className="reward-start" onClick={onStart}>
          {startLabel || NEXT_LABEL[nextMode] || NEXT_LABEL.break}
        </button>
        <button type="button" className="reward-skip" onClick={onSkip}>{skipLabel || 'Sla over'}</button>
      </div>
    </div>
  )
}
