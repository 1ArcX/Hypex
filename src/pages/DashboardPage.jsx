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

  const urgentCount  = tasks.filter(t => !t.completed && (t.priority ?? 2) === 1).length
  const overdueCount = tasks.filter(t => !t.completed && t.date && t.date < today).length
  const openCount    = tasks.filter(t => !t.completed).length

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
      <div className="card" style={{
        padding: '22px 22px 20px',
        background: 'linear-gradient(135deg, #1e1e1e 0%, #171717 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Accent glow blob */}
        <div style={{
          position: 'absolute', top: '60%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 280, height: 180,
          background: `radial-gradient(ellipse, ${isBreak ? 'rgba(255,140,66,0.07)' : 'rgba(0,255,209,0.06)'} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Greeting row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 2px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
              {getGreeting()}
            </p>
            <p style={{ fontSize: 18, color: 'var(--text-1)', margin: 0, fontWeight: 700, letterSpacing: '-0.3px' }}>
              {displayName}
            </p>
          </div>
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

        {/* Klok gecenterd */}
        <div style={{ textAlign: 'center', marginBottom: totalToday > 0 ? 18 : 0, position: 'relative' }}>
          <Clock isBreak={isBreak} />
        </div>

        {totalToday > 0 && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Voortgang vandaag</span>
              <span style={{ fontSize: 11, color: progressPct === 100 ? 'var(--accent)' : 'var(--text-2)', fontWeight: 700 }}>
                {completedToday}/{totalToday} {progressPct === 100 ? '✓' : ''}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }}>
              <div style={{
                height: '100%', width: `${progressPct}%`, borderRadius: 6,
                background: progressPct === 100
                  ? 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff))'
                  : 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 70%, transparent), var(--accent))',
                transition: 'width 0.6s ease',
                boxShadow: progressPct > 0 ? '0 0 10px rgba(0,255,209,0.35)' : 'none',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── STATS MINI-GRID ── */}
      {openCount > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div style={{
            background: urgentCount > 0 ? 'rgba(255,60,60,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${urgentCount > 0 ? 'rgba(255,60,60,0.25)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 12, padding: '12px 10px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: urgentCount > 0 ? '#ff6b6b' : 'var(--text-2)', margin: 0, lineHeight: 1 }}>
              {urgentCount}
            </p>
            <p style={{ fontSize: 10, color: urgentCount > 0 ? 'rgba(255,107,107,0.6)' : 'var(--text-3)', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.04em' }}>
              Urgent
            </p>
          </div>
          <div style={{
            background: overdueCount > 0 ? 'rgba(255,120,50,0.07)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${overdueCount > 0 ? 'rgba(255,120,50,0.2)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 12, padding: '12px 10px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: overdueCount > 0 ? '#FF8C42' : 'var(--text-2)', margin: 0, lineHeight: 1 }}>
              {overdueCount}
            </p>
            <p style={{ fontSize: 10, color: overdueCount > 0 ? 'rgba(255,140,66,0.6)' : 'var(--text-3)', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.04em' }}>
              Te laat
            </p>
          </div>
          <div style={{
            background: 'rgba(0,255,209,0.05)',
            border: '1px solid rgba(0,255,209,0.12)',
            borderRadius: 12, padding: '12px 10px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', margin: 0, lineHeight: 1 }}>
              {openCount}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(0,255,209,0.5)', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.04em' }}>
              Open
            </p>
          </div>
        </div>
      )}

      {/* ── VANDAAG-STRIP ── */}
      {todayItems.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, paddingLeft: 2 }}>
            Schema vandaag
          </p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {todayItems.map((item, i) => {
              const icon = item.type === 'lesson' ? '📚' : item.type === 'work' ? '💼' : '✅'
              const nowMins = new Date().getHours()*60 + new Date().getMinutes()
              const isNow = item.sortMins <= nowMins && item.end && (parseInt(item.end)*60 + parseInt(item.end.split(':')[1]||0)) >= nowMins
              return (
                <button
                  key={i}
                  onClick={() => item.type === 'task' && item.raw && setDetailTask(item.raw)}
                  style={{
                    flexShrink: 0, padding: '9px 13px', borderRadius: 14,
                    background: isNow ? `${item.color}22` : `${item.color}11`,
                    border: `1px solid ${item.color}${isNow ? '60' : '30'}`,
                    color: item.color,
                    cursor: item.type === 'task' ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: 3, maxWidth: 140,
                    boxShadow: isNow ? `0 0 12px ${item.color}20` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                    <span style={{ fontSize: 11 }}>{icon}</span>
                    <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 500, flex: 1, whiteSpace: 'nowrap' }}>
                      {item.time}{item.end ? `–${item.end}` : ''}
                    </span>
                    {isNow && <span style={{ fontSize: 9, fontWeight: 700, background: `${item.color}25`, borderRadius: 4, padding: '1px 4px' }}>Nu</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── VOLGENDE + DEADLINES (2 kolommen) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: deadlines.length ? '1fr 1fr' : '1fr', gap: 10 }}>
        {/* Volgende gebeurtenis */}
        <div className="card" style={{
          padding: '14px 15px',
          borderLeft: '3px solid rgba(129,140,248,0.5)',
          background: 'linear-gradient(135deg, rgba(129,140,248,0.05) 0%, transparent 70%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 9, color: 'rgba(129,140,248,0.7)', margin: 0, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700 }}>Volgende</p>
            {ev && hasMore && (
              <button onClick={() => setSkip(s => s + 1)}
                style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 6, cursor: 'pointer', color: 'rgba(129,140,248,0.8)', padding: '2px 7px', fontSize: 13, lineHeight: 1 }}>›</button>
            )}
          </div>
          {ev ? (
            <div onClick={() => ev.type === 'task' && ev.raw && setDetailTask(ev.raw)}
              style={{ cursor: ev.type === 'task' ? 'pointer' : 'default' }}>
              <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.type === 'lesson' ? '📚 ' : ev.type === 'event' ? '📅 ' : '✅ '}{ev.label}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(129,140,248,0.8)', margin: 0, fontWeight: 500 }}>{ev.timeStr}</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Niets meer gepland</p>
          )}
        </div>

        {/* Deadline pills */}
        {deadlines.length > 0 && (
          <div className="card" style={{
            padding: '14px 15px',
            borderLeft: '3px solid rgba(255,80,80,0.5)',
            background: 'linear-gradient(135deg, rgba(255,60,60,0.06) 0%, transparent 70%)',
          }}>
            <p style={{ fontSize: 9, color: 'rgba(255,107,107,0.75)', margin: '0 0 8px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700 }}>🔥 Deadlines</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {deadlines.map(t => (
                <div key={t.id} onClick={() => setDetailTask(t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500 }}>{t.title}</span>
                  <span style={{
                    fontSize: 10, borderRadius: 8, padding: '2px 7px', flexShrink: 0, fontWeight: 700,
                    background: t.due_date === today ? 'rgba(255,60,60,0.2)' : 'rgba(255,107,107,0.1)',
                    color: t.due_date === today ? '#ff5555' : 'rgba(255,107,107,0.85)',
                    border: `1px solid ${t.due_date === today ? 'rgba(255,60,60,0.45)' : 'rgba(255,107,107,0.25)'}`,
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
          <div className="card" style={{
            padding: '14px 15px',
            borderLeft: '3px solid rgba(250,204,21,0.4)',
            background: 'linear-gradient(135deg, rgba(250,204,21,0.04) 0%, transparent 70%)',
          }}>
            <p style={{ fontSize: 9, color: 'rgba(250,204,21,0.7)', margin: '0 0 10px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700 }}>
              📋 Nog in te plannen · {unplanned.length}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unplanned.slice(0, 5).map(task => {
                const subject = subjects.find(s => s.id === task.subject_id)
                return (
                  <div key={task.id} onClick={() => setDetailTask(task)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.025)', cursor: 'pointer', border: '1px solid transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(250,204,21,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(250,204,21,0.5)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{task.title}</span>
                    {subject && <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{subject.name}</span>}
                  </div>
                )
              })}
              {unplanned.length > 5 && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0 10px' }}>+{unplanned.length - 5} meer</p>
              )}
            </div>
          </div>
        )
      })()}

      <button className="btn-neon" onClick={() => openNewTask()}
        style={{
          padding: '14px', fontSize: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, width: '100%',
          boxShadow: '0 0 20px rgba(0,255,209,0.1)',
        }}>
        + Taak toevoegen
      </button>

      {/* Padding voor bottom nav */}
      <div style={{ height: 80 }} />
    </div>
  )
}
