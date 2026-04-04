import React, { useState, useMemo } from 'react'
import Clock from '../components/Clock'
import WeatherWidget from '../components/WeatherWidget'
import SpotifyWidget from '../components/SpotifyWidget'

// ── Helpers ─────────────────────────���──────────────────���───────────────────────
function pad2(n) { return String(n).padStart(2, '0') }
function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'
}

function fmtDeadline(d, todayS) {
  if (d === todayS) return 'Vandaag'
  const tom = new Date(); tom.setDate(tom.getDate() + 1)
  if (d === tom.toISOString().slice(0, 10)) return 'Morgen'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

// ── Vandaag-strip: haal alle geplande items van vandaag op ─────────────────────
function useTodayItems(tasks, magisterLessons, calendarEvents) {
  return useMemo(() => {
    const today = todayDateStr()
    const items = []

    // Magister lessen
    const fmt = d => { const x = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
    const now = new Date()
    const weekStart = (() => { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0); return d })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const cacheKey = `magister_sched_${weekStart.toISOString().slice(0,10)}_${weekEnd.toISOString().slice(0,10)}`
    const lessons = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey)) || [] } catch { return [] } })()
    const allLessons = lessons.length ? lessons : (magisterLessons || [])
    for (const l of allLessons) {
      if (!l.start || l.uitgevallen) continue
      if (new Date(l.start).toISOString().slice(0,10) !== today) continue
      const s = new Date(l.start)
      const e = l.einde ? new Date(l.einde) : null
      items.push({
        sortMins: s.getHours()*60 + s.getMinutes(),
        time: `${pad2(s.getHours())}:${pad2(s.getMinutes())}`,
        label: l.vak || 'Les',
        color: '#818CF8',
        type: 'lesson',
        end: e ? `${pad2(e.getHours())}:${pad2(e.getMinutes())}` : null,
      })
    }

    // Taken met tijd
    for (const t of tasks) {
      if (t.date !== today || t.completed) continue
      const ts = t.start_time || t.time
      if (!ts) continue
      const [h, m] = ts.split(':').map(Number)
      items.push({
        sortMins: h*60 + m,
        time: ts.slice(0,5),
        label: t.title,
        color: t.color || 'var(--accent)',
        type: 'task',
        raw: t,
        end: t.end_time?.slice(0,5) || null,
      })
    }

    // Werkdiensten
    try {
      const shifts = JSON.parse(localStorage.getItem('pmt_work_shifts')) || []
      for (const s of shifts) {
        if (s.date?.slice(0,10) !== today) continue
        if (!s.start_time) continue
        const [h, m] = s.start_time.split(':').map(Number)
        items.push({
          sortMins: h*60 + m,
          time: s.start_time.slice(0,5),
          label: 'Werk',
          color: '#F59E0B',
          type: 'work',
          end: s.end_time?.slice(0,5) || null,
        })
      }
    } catch {}

    return items.sort((a, b) => a.sortMins - b.sortMins)
  }, [tasks, magisterLessons, calendarEvents])
}

// ── Next event hook ─────────────────────��───────────────���──────────────────────
function useNextEvent({ tasks, calendarEvents, magisterLessons, skip }) {
  return useMemo(() => {
    const now = new Date()
    const fmt = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
    const todayStr = fmt(now)
    const DAYS_NL = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
    const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
    const fmtLabel = d => {
      if (fmt(d) === todayStr) return `vandaag ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }
    const weekStart = (() => { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0); return d })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const cacheKey = `magister_sched_${fmt(weekStart)}_${fmt(weekEnd)}`
    const cachedLessons = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey)) || [] } catch { return [] } })()
    const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(weekStart.getDate() + 7)
    const nextWeekEnd = new Date(weekEnd); nextWeekEnd.setDate(weekEnd.getDate() + 7)
    const nextCacheKey = `magister_sched_${fmt(nextWeekStart)}_${fmt(nextWeekEnd)}`
    const nextWeekLessons = (() => { try { return JSON.parse(sessionStorage.getItem(nextCacheKey)) || [] } catch { return [] } })()
    const allLessons = [...(cachedLessons.length ? cachedLessons : magisterLessons), ...nextWeekLessons]

    const items = [
      ...tasks.filter(t => t.date && (t.time || t.start_time) && !t.completed)
        .map(t => { const ts = (t.start_time || t.time || '').slice(0, 5); const d = new Date(t.date + 'T' + ts); return { label: t.title, ts: d, type: 'task', raw: t } })
        .filter(t => t.ts >= now),
      ...allLessons.filter(l => l.start && !l.uitgevallen && new Date(l.start) >= now)
        .map(l => ({ label: l.vak || 'Les', ts: new Date(l.start), type: 'lesson' })),
      ...calendarEvents.filter(ev => ev.start_time && new Date(ev.start_time) >= now)
        .map(ev => ({ label: ev.title, ts: new Date(ev.start_time), type: 'event', raw: ev })),
    ].sort((a, b) => a.ts - b.ts)

    const idx = Math.min(skip, items.length - 1)
    const next = items[Math.max(0, idx)] || null
    if (!next) return { item: null, hasMore: false }
    return { item: { ...next, timeStr: fmtLabel(next.ts) }, hasMore: idx < items.length - 1 }
  }, [tasks, calendarEvents, magisterLessons, skip])
}

// ── Main ──────────────────────────────��───────────────────────────���────────────
export default function DashboardPage({
  isBreak, tasks, subjects, calendarEvents, magisterLessons,
  magisterError, displayName, homeRain, onNavigate,
  setDetailTask, openNewTask, onRequestPwaInstall, profiles, userId,
}) {
  const [skip, setSkip] = useState(0)
  const { item: ev, hasMore } = useNextEvent({ tasks, calendarEvents, magisterLessons, skip })
  const todayItems = useTodayItems(tasks, magisterLessons, calendarEvents)

  const today = todayDateStr()
  const todayTasks = tasks.filter(t => t.date === today)
  const completedToday = todayTasks.filter(t => t.completed).length
  const totalToday = todayTasks.length
  const progressPct = totalToday > 0 ? (completedToday / totalToday) * 100 : 0

  const hasMagisterCreds = !!localStorage.getItem(`magister_credentials_${userId}`)
  const showMagisterBanner = !hasMagisterCreds || !!magisterError

  // Naderende deadlines (max 3 pills)
  const now = new Date()
  const in3 = new Date(now); in3.setDate(now.getDate() + 3)
  const deadlines = tasks
    .filter(t => !t.completed && t.due_date && t.due_date >= today && t.due_date <= in3.toISOString().slice(0, 10))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── HERO: Greeting + Clock + Progress ── */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: totalToday > 0 ? 16 : 0 }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 6px' }}>
              {getGreeting()}, <strong style={{ color: 'var(--text-1)' }}>{displayName}</strong>
            </p>
            <Clock isBreak={isBreak} />
          </div>
          {/* Magister status badge in hero */}
          {showMagisterBanner && (
            <button
              onClick={() => onNavigate('school')}
              title={magisterError || 'Koppel Magister'}
              style={{
                background: magisterError ? 'rgba(255,80,80,0.08)' : 'rgba(250,204,21,0.08)',
                border: magisterError ? '1px solid rgba(255,80,80,0.3)' : '1px solid rgba(250,204,21,0.3)',
                borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13 }}>{magisterError ? '⚠️' : '🎓'}</span>
              <span style={{ fontSize: 11, color: magisterError ? 'rgba(255,107,107,0.9)' : 'rgba(250,204,21,0.9)', fontWeight: 600 }}>
                {magisterError ? 'Fout' : 'Koppel'}
              </span>
            </button>
          )}
        </div>

        {totalToday > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Vandaag</span>
              <span style={{ fontSize: 11, color: progressPct === 100 ? 'var(--accent)' : 'var(--text-2)', fontWeight: 600 }}>
                {completedToday}/{totalToday} taken {progressPct === 100 ? '✓' : ''}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
              <div style={{
                height: '100%', width: `${progressPct}%`, borderRadius: 4,
                background: progressPct === 100 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 70%, transparent)',
                transition: 'width 0.5s ease',
                boxShadow: progressPct > 0 ? '0 0 8px var(--accent-dim)' : 'none',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── VANDAAG-STRIP ── */}
      {todayItems.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 6px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, paddingLeft: 2 }}>
            Vandaag
          </p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {todayItems.map((item, i) => (
              <button
                key={i}
                onClick={() => item.type === 'task' && item.raw && setDetailTask(item.raw)}
                style={{
                  flexShrink: 0, padding: '7px 12px', borderRadius: 20,
                  background: `${item.color}18`,
                  border: `1px solid ${item.color}40`,
                  color: item.color,
                  cursor: item.type === 'task' ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 2, maxWidth: 130,
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>
                  {item.time}{item.end ? `–${item.end}` : ''}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── VOLGENDE + DEADLINES (2 kolommen) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: deadlines.length ? '1fr 1fr' : '1fr', gap: 10 }}>
        {/* Volgende gebeurtenis */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 9, color: 'var(--text-3)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Volgende</p>
            {ev && hasMore && (
              <button onClick={() => setSkip(s => s + 1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 0, fontSize: 14, lineHeight: 1 }}>›</button>
            )}
          </div>
          {ev ? (
            <div onClick={() => ev.type === 'task' && ev.raw && setDetailTask(ev.raw)}
              style={{ cursor: ev.type === 'task' ? 'pointer' : 'default' }}>
              <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.type === 'lesson' ? '🎓 ' : ev.type === 'event' ? '📅 ' : '✅ '}{ev.label}
              </p>
              <p style={{ fontSize: 11, color: 'var(--accent)', margin: 0 }}>{ev.timeStr}</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Niets meer</p>
          )}
        </div>

        {/* Deadline pills */}
        {deadlines.length > 0 && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 9, color: 'rgba(255,107,107,0.8)', margin: '0 0 6px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>⏰ Deadlines</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {deadlines.map(t => (
                <div key={t.id} onClick={() => setDetailTask(t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.title}</span>
                  <span style={{
                    fontSize: 10, borderRadius: 10, padding: '1px 6px', flexShrink: 0, fontWeight: 600,
                    background: t.due_date === today ? 'rgba(255,80,80,0.15)' : 'rgba(255,107,107,0.08)',
                    color: t.due_date === today ? '#ff6b6b' : 'rgba(255,107,107,0.8)',
                    border: `1px solid ${t.due_date === today ? 'rgba(255,80,80,0.4)' : 'rgba(255,107,107,0.2)'}`,
                  }}>
                    {fmtDeadline(t.due_date, today)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── REGEN GRAFIEK ── */}
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

      {/* ── SPOTIFY + WEATHER ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <SpotifyWidget />
        <WeatherWidget userId={userId} onRequestPwaInstall={onRequestPwaInstall} stacked />
      </div>

      {/* ── ONGEPLANDE TAKEN ── */}
      {(() => {
        const unplanned = tasks.filter(t => !t.completed && !t.date)
        if (!unplanned.length) return null
        return (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid rgba(250,204,21,0.15)', background: 'rgba(250,204,21,0.03)' }}>
            <p style={{ fontSize: 10, color: 'rgba(250,204,21,0.7)', margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              📋 Nog in te plannen ({unplanned.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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

      {/* Padding voor bottom nav */}
      <div style={{ height: 80 }} />
    </div>
  )
}
