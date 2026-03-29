import React, { useState, useMemo } from 'react'
import Clock from '../components/Clock'
import WeatherWidget from '../components/WeatherWidget'
import SpotifyWidget from '../components/SpotifyWidget'

function useNextEvent({ tasks, calendarEvents, magisterLessons, skip }) {
  return useMemo(() => {
    const now = new Date()
    const pad2 = n => String(n).padStart(2, '0')
    const fmt = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
    const todayStr = fmt(now)

    const DAYS_NL = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
    const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
    const fmtLabel = d => {
      const isToday = fmt(d) === todayStr
      if (isToday) return `vandaag ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }

    // Read Magister lessons from sessionStorage cache
    const weekStart = (() => {
      const d = new Date(now); const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0); return d
    })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const cacheKey = `magister_sched_${fmt(weekStart)}_${fmt(weekEnd)}`
    const cachedLessons = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey)) || [] } catch { return [] } })()
    const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(weekStart.getDate() + 7)
    const nextWeekEnd = new Date(weekEnd); nextWeekEnd.setDate(weekEnd.getDate() + 7)
    const nextCacheKey = `magister_sched_${fmt(nextWeekStart)}_${fmt(nextWeekEnd)}`
    const nextWeekLessons = (() => { try { return JSON.parse(sessionStorage.getItem(nextCacheKey)) || [] } catch { return [] } })()
    const allLessons = [...(cachedLessons.length ? cachedLessons : magisterLessons), ...nextWeekLessons]

    const items = [
      ...tasks
        .filter(t => t.date && (t.time || t.start_time) && !t.completed)
        .map(t => {
          const ts = (t.start_time || t.time || '').slice(0, 5)
          const d = new Date(t.date + 'T' + ts)
          return { label: t.title, ts: d, type: 'task', raw: t }
        })
        .filter(t => t.ts >= now),
      ...allLessons
        .filter(l => l.start && !l.uitgevallen && new Date(l.start) >= now)
        .map(l => ({ label: l.vak || 'Les', ts: new Date(l.start), type: 'lesson', raw: l })),
      ...calendarEvents
        .filter(ev => ev.start_time && new Date(ev.start_time) >= now)
        .map(ev => ({ label: ev.title, ts: new Date(ev.start_time), type: 'event', raw: ev })),
    ].sort((a, b) => a.ts - b.ts)

    const idx = Math.min(skip, items.length - 1)
    const next = items[Math.max(0, idx)] || null
    if (!next) return { item: null, hasMore: false }
    return { item: { ...next, timeStr: fmtLabel(next.ts) }, hasMore: idx < items.length - 1 }
  }, [tasks, calendarEvents, magisterLessons, skip])
}

export default function DashboardPage({
  isBreak, tasks, subjects, calendarEvents, magisterLessons,
  magisterError, displayName, homeRain, onNavigate,
  setDetailTask, openNewTask, onRequestPwaInstall, profiles, userId,
}) {
  const [skip, setSkip] = useState(0)
  const { item: ev, hasMore } = useNextEvent({ tasks, calendarEvents, magisterLessons, skip })

  const pad2 = n => String(n).padStart(2, '0')
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` })()
  const todayTasks = tasks.filter(t => t.date === todayStr)
  const completedToday = todayTasks.filter(t => t.completed).length
  const totalToday = todayTasks.length

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
        {(() => { const h = new Date().getHours(); return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond' })()}, {displayName}
      </p>

      {/* Clock */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <Clock isBreak={isBreak} />
      </div>

      {/* Progress bar */}
      {totalToday > 0 && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Voortgang vandaag</span>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{completedToday}/{totalToday} taken</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
            <div style={{
              height: '100%',
              width: `${(completedToday / totalToday) * 100}%`,
              background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s',
              boxShadow: '0 0 8px var(--accent-dim)',
            }} />
          </div>
        </div>
      )}

      {/* Naderende deadlines */}
      {(() => {
        const now = new Date()
        const in3 = new Date(now); in3.setDate(now.getDate() + 3)
        const in3Str = in3.toISOString().slice(0, 10)
        const todayS = now.toISOString().slice(0, 10)
        const deadlines = tasks
          .filter(t => !t.completed && t.due_date && t.due_date >= todayS && t.due_date <= in3Str)
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
        if (!deadlines.length) return null
        const fmt = d => {
          if (d === todayS) return 'Vandaag'
          const tom = new Date(now); tom.setDate(now.getDate() + 1)
          if (d === tom.toISOString().slice(0, 10)) return 'Morgen'
          const dt = new Date(d + 'T00:00:00')
          return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
        }
        return (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,80,80,0.04)' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,107,107,0.8)', margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              ⏰ Naderende deadlines
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {deadlines.map(t => (
                <div key={t.id} onClick={() => setDetailTask(t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: t.due_date === todayS ? '#ff6b6b' : 'rgba(255,107,107,0.7)', flexShrink: 0, marginLeft: 8, fontWeight: 600 }}>
                    {fmt(t.due_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Volgende gebeurtenis */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Volgende gebeurtenis</p>
          {ev && (
            <button
              onClick={() => setSkip(s => s + 1)}
              disabled={!hasMore}
              style={{ background: 'none', border: 'none', cursor: hasMore ? 'pointer' : 'default', color: hasMore ? 'var(--text-2)' : 'var(--text-3)', padding: 0, fontSize: 16, lineHeight: 1 }}
            >›</button>
          )}
        </div>
        {ev ? (
          <div
            onClick={() => ev.type === 'task' && ev.raw && setDetailTask(ev.raw)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: ev.type === 'task' ? 'pointer' : 'default' }}
          >
            <div>
              <p style={{ fontSize: 15, color: 'var(--text-1)', fontWeight: 600, margin: '0 0 2px' }}>{ev.label}</p>
              <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0, fontWeight: 500 }}>{ev.timeStr}</p>
            </div>
            <span style={{ fontSize: 20 }}>
              {ev.type === 'lesson' ? '🎓' : ev.type === 'event' ? '📅' : '✅'}
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Niets meer gepland</p>
        )}
      </div>

      {/* Magister error/koppel prompt */}
      {(() => {
        const hasCreds = !!localStorage.getItem(`magister_credentials_${userId}`)
        const hasError = !!magisterError
        if (!hasCreds || hasError) return (
          <div
            className="card"
            onClick={() => onNavigate('school')}
            style={{
              padding: '16px 18px', cursor: 'pointer',
              border: hasError ? '1px solid rgba(255,107,107,0.35)' : '1px solid rgba(250,204,21,0.25)',
              background: hasError ? 'rgba(255,80,80,0.06)' : 'rgba(250,204,21,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: hasError ? 'rgba(255,80,80,0.12)' : 'rgba(250,204,21,0.12)',
                border: hasError ? '1px solid rgba(255,80,80,0.3)' : '1px solid rgba(250,204,21,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {hasError ? '⚠️' : '🎓'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>
                  {hasError ? 'Magister fout' : 'Koppel Magister'}
                </p>
                <p style={{ fontSize: 12, margin: 0, color: hasError ? 'rgba(255,107,107,0.8)' : 'var(--text-2)' }}>
                  {hasError ? magisterError + ' — tik om opnieuw in te loggen' : 'Zie je rooster, cijfers en huiswerk'}
                </p>
              </div>
              <span style={{ fontSize: 16, color: 'var(--text-3)' }}>›</span>
            </div>
          </div>
        )
        return null
      })()}

      {/* Regen grafiek */}
      {homeRain && Math.max(...homeRain.map(d => d.precip)) > 0.1 && (() => {
        const data = homeRain
        const maxP = Math.max(...data.map(d => d.precip), 0.5)
        const W = 260, H = 64, PL = 4, PB = 14, PR = 4, PT = 4
        const iW = W - PL - PR, iH = H - PT - PB
        const xOf = i => PL + (i / (data.length - 1 || 1)) * iW
        const yOf = v => PT + iH - (v / maxP) * iH
        const pts = data.map((d, i) => [xOf(i), yOf(d.precip)])
        const lineD = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
        const areaD = `${lineD} L${pts[pts.length-1][0].toFixed(1)},${(PT+iH).toFixed(1)} L${PL},${(PT+iH).toFixed(1)} Z`
        const maxLabel = maxP < 0.5 ? 'Lichte regen' : maxP < 2 ? 'Matige regen' : 'Zware regen'
        const rainIdxs = data.map((d, i) => d.precip > 0.1 ? i : -1).filter(i => i !== -1)
        const startTime = data[rainIdxs[0]]?.time
        const endTime = data[rainIdxs[rainIdxs.length - 1]]?.time
        const timeLabel = startTime === endTime || !endTime ? `vanaf ${startTime}` : `${startTime}–${endTime}`
        return (
          <div className="card"
            style={{ padding: '12px 14px', border: '1px solid rgba(0,180,255,0.25)', background: 'rgba(0,150,255,0.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>🌧️</span>
              <span style={{ fontSize: 12, color: 'rgba(0,200,255,0.9)', fontWeight: 600 }}>{maxLabel} {timeLabel}</span>
            </div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              <defs>
                <linearGradient id="dRainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(0,180,255,0.5)" />
                  <stop offset="100%" stopColor="rgba(0,180,255,0.02)" />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#dRainGrad)" />
              <path d={lineD} fill="none" stroke="rgba(0,200,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" />
              <line x1={PL} y1={PT+iH} x2={W-PR} y2={PT+iH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            </svg>
          </div>
        )
      })()}

      {/* Spotify + Weather: Spotify boven op mobiel, naast elkaar op desktop */}
      <div className="grid gap-4 md:grid-cols-2">
        <SpotifyWidget />
        <WeatherWidget userId={userId} onRequestPwaInstall={onRequestPwaInstall} stacked />
      </div>

{/* Oningeplande taken */}
      {(() => {
        const unplanned = tasks.filter(t => !t.completed && !t.date)
        if (!unplanned.length) return null
        return (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid rgba(250,204,21,0.15)', background: 'rgba(250,204,21,0.03)' }}>
            <p style={{ fontSize: 10, color: 'rgba(250,204,21,0.7)', margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              📋 Nog in te plannen ({unplanned.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {unplanned.map(task => {
                const subject = subjects.find(s => s.id === task.subject_id)
                return (
                  <div key={task.id} onClick={() => setDetailTask(task)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    {subject && <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{subject.name}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <button className="btn-neon" onClick={() => openNewTask()}
        style={{ padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
        + Taak toevoegen
      </button>
    </div>
  )
}
