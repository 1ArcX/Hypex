import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'

const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function getWeekDays(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = (day === 0 ? -6 : 1 - day) + offset * 7
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + mondayOffset + i)
    return d.toISOString().slice(0, 10)
  })
}

function weekLabel(days) {
  const a = new Date(days[0]), b = new Date(days[6])
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} ${MONTHS_NL[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MONTHS_NL[a.getMonth()]} – ${b.getDate()} ${MONTHS_NL[b.getMonth()]} ${b.getFullYear()}`
}

function fmtMins(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? (m > 0 ? `${h}u ${m}m` : `${h}u`) : `${m}m`
}

const BAR_MAX_H = 72

function BarChart({ days, values, todayStr, formatLabel, color = 'var(--accent)', dimColor = 'rgba(0,255,209,0.4)' }) {
  const maxVal = Math.max(...values, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
      {days.map((dateStr, i) => {
        const val = values[i]
        const isToday = dateStr === todayStr
        const isFuture = dateStr > todayStr
        const barH = val > 0 ? Math.max(5, Math.round((val / maxVal) * BAR_MAX_H)) : 0
        return (
          <div key={dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <div style={{
                width: '100%', height: barH || 3, borderRadius: 4,
                background: isFuture ? 'rgba(255,255,255,0.06)'
                  : val === 0 ? 'rgba(255,255,255,0.08)'
                  : isToday ? color : dimColor,
                boxShadow: isToday && val > 0 ? `0 0 8px ${color}55` : 'none',
                transition: 'height 0.35s ease',
              }} />
            </div>
            <span style={{ fontSize: 9, color: isToday ? color : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>
              {DAYS[i]}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
              {isFuture ? '' : formatLabel(val)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Level / XP ────────────────────────────────────────────────────────────────
const LEVEL_XP = 100
const LEVEL_NAMES = ['Beginner', 'Leerling', 'Gevorderd', 'Expert', 'Meester', 'Legende']
function getLevel(xp) { return Math.floor(xp / LEVEL_XP) + 1 }

function XPCard({ userId }) {
  const [xp, setXp] = useState(() => { try { return parseInt(localStorage.getItem('habit_xp') || '0') } catch { return 0 } })
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    if (!userId) return
    supabase.from('habit_achievements').select('xp, seen_achievements').eq('user_id', userId).single()
      .then(({ data }) => {
        if (data?.xp) { setXp(prev => Math.max(prev, data.xp)); localStorage.setItem('habit_xp', String(Math.max(0, data.xp))) }
        if (data?.seen_achievements) setAchievements(data.seen_achievements)
      })
  }, [userId])

  const level = getLevel(xp)
  const xpIn = xp % LEVEL_XP
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] || `Level ${level}`
  const labelMap = { streak_7:'🔥 7d', streak_14:'🔥 14d', streak_30:'🔥 30d', perfect_3:'💎 3d', perfect_7:'💎 7d', level_5:'⭐ Lvl5', level_10:'🌟 Lvl10' }

  return (
    <div className="card" style={{ padding: '18px 20px', border: '1px solid rgba(250,204,21,0.25)', background: 'rgba(250,204,21,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: 'rgba(250,204,21,0.1)', border: '2px solid rgba(250,204,21,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
          {level >= 5 ? '🌟' : level >= 3 ? '⭐' : '✨'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{levelName}</span>
            <span style={{ fontSize: 12, color: '#FACC15', fontWeight: 700 }}>Lvl {level}</span>
          </div>
          <div style={{ margin: '6px 0 4px', height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${xpIn}%`, borderRadius: 4, background: 'linear-gradient(90deg,#FACC15,#F59E0B)', transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{xpIn}/{LEVEL_XP} XP naar volgende level · {xp} XP totaal</span>
        </div>
      </div>
      {achievements.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {achievements.slice(-10).map((id, i) => (
            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', color: 'rgba(250,204,21,0.9)' }}>
              {labelMap[id] || id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Focus ─────────────────────────────────────────────────────────────────────
function FocusCard({ userId, weekOffset }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const days = getWeekDays(weekOffset)
  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase.from('pomodoro_sessions')
      .select('completed_at, duration_minutes')
      .eq('user_id', userId)
      .gte('completed_at', days[0])
      .lte('completed_at', days[6] + 'T23:59:59')
      .then(({ data: rows }) => {
        const map = {}
        for (const r of (rows || [])) {
          const d = r.completed_at?.slice(0, 10)
          if (d) map[d] = (map[d] || 0) + (r.duration_minutes || 0)
        }
        // Merge localStorage for current week (this device's data)
        if (weekOffset === 0) {
          const ls = (() => { try { return JSON.parse(localStorage.getItem('pomodoro_stats') || '{}') } catch { return {} } })()
          for (const [k, v] of Object.entries(ls)) {
            if (days.includes(k)) map[k] = Math.max(map[k] || 0, v)
          }
        }
        setData(map)
        setLoading(false)
      })
  }, [userId, weekOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  const values = days.map(d => data[d] || 0)
  const total = values.reduce((a, b) => a + b, 0)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Focus (Pomodoro)</span>
        {total > 0 && <span style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>{fmtMins(total)}</span>}
      </div>
      <div style={{ marginBottom: 14, minHeight: 16 }}>
        {loading ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Laden…</span>
          : total === 0 ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Geen focussessies deze week</span>
          : <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Gem. {fmtMins(Math.round(total / values.filter(v => v > 0).length))} per sessiedag</span>}
      </div>
      <BarChart days={days} values={values} todayStr={todayStr} formatLabel={v => v > 0 ? fmtMins(v) : '—'} />
    </div>
  )
}

// ── Taken ─────────────────────────────────────────────────────────────────────
function TakenCard({ tasks, weekOffset }) {
  const days = getWeekDays(weekOffset)
  const todayStr = new Date().toISOString().slice(0, 10)

  // Completed tasks: those where updated_at falls in the selected week (completed = true)
  // Also include tasks whose date is in the week (completed or not, for total)
  const completedThisWeek = tasks.filter(t => {
    if (!t.completed) return false
    const completedOn = t.updated_at?.slice(0, 10) || t.date
    return completedOn && days.includes(completedOn)
  })
  const scheduledThisWeek = tasks.filter(t => t.date && days.includes(t.date))
  const incompleteDue = scheduledThisWeek.filter(t => !t.completed)
  const completedPerDay = days.map(d =>
    completedThisWeek.filter(t => (t.updated_at?.slice(0, 10) || t.date) === d).length
  )
  const maxBar = Math.max(...completedPerDay, 1)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Taken</span>
        <span style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>{completedThisWeek.length} voltooid</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          {incompleteDue.length > 0
            ? `${incompleteDue.length} openstaand deze week`
            : completedThisWeek.length > 0 ? 'Alle geplande taken afgerond 🎉' : 'Geen taken deze week'}
        </span>
      </div>
      <BarChart
        days={days} values={completedPerDay} todayStr={todayStr}
        formatLabel={v => v > 0 ? String(v) : '—'}
      />
    </div>
  )
}

// ── Gewoontes ─────────────────────────────────────────────────────────────────
function GewoontesCard({ userId, weekOffset }) {
  const [habits, setHabits] = useState([])
  const [completions, setCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const days = getWeekDays(weekOffset)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    const from = days[0], to = days[6]
    Promise.all([
      supabase.from('habits').select('id, name, icon, frequency, color')
        .eq('user_id', userId).eq('archived', false)
        .order('sort_order').order('created_at'),
      supabase.from('habit_completions').select('habit_id, date')
        .eq('user_id', userId).gte('date', from).lte('date', to),
    ]).then(([habitsRes, compRes]) => {
      const map = {}
      for (const row of (compRes.data || [])) {
        if (!map[row.habit_id]) map[row.habit_id] = new Set()
        map[row.habit_id].add(row.date)
      }
      setHabits(habitsRes.data || [])
      setCompletions(map)
      setLoading(false)
    })
  }, [userId, weekOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = new Date().toISOString().slice(0, 10)

  const habitRows = habits.map(habit => {
    const freq = habit.frequency ?? [0, 1, 2, 3, 4, 5, 6]
    const scheduledDays = days.filter((_, i) => freq.includes(i))
    const completedDays = scheduledDays.filter(d => completions[habit.id]?.has(d))
    const pct = scheduledDays.length > 0 ? Math.round((completedDays.length / scheduledDays.length) * 100) : 0
    return { habit, scheduledDays, completedDays, pct }
  }).filter(r => r.scheduledDays.length > 0)

  // Per-day completion count for chart
  const perDay = days.map(d =>
    habits.filter(h => {
      const freq = h.frequency ?? [0, 1, 2, 3, 4, 5, 6]
      const dayIdx = days.indexOf(d)
      return freq.includes(dayIdx) && completions[h.id]?.has(d)
    }).length
  )
  const perDayTotal = days.map(d =>
    habits.filter(h => {
      const freq = h.frequency ?? [0, 1, 2, 3, 4, 5, 6]
      return freq.includes(days.indexOf(d))
    }).length
  )

  if (loading) return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Gewoontes</span>
      <div style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 12 }}>Laden…</div>
    </div>
  )

  const totalScheduled = habitRows.reduce((s, r) => s + r.scheduledDays.length, 0)
  const totalDone = habitRows.reduce((s, r) => s + r.completedDays.length, 0)
  const overallPct = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Gewoontes</span>
        {totalScheduled > 0 && <span style={{ fontSize: 15, color: overallPct >= 80 ? 'var(--accent)' : 'var(--text-2)', fontWeight: 700 }}>{overallPct}%</span>}
      </div>

      {/* Bar chart — completions per day */}
      {habits.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
            {days.map((d, i) => {
              const val = perDay[i], tot = perDayTotal[i]
              const isToday = d === todayStr, isFuture = d > todayStr
              const maxV = Math.max(...perDay, 1)
              const barH = val > 0 ? Math.max(5, Math.round((val / maxV) * BAR_MAX_H)) : 0
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                    <div style={{ width: '100%', height: barH || 3, borderRadius: 4, background: isFuture ? 'rgba(255,255,255,0.06)' : val === 0 ? 'rgba(255,255,255,0.08)' : isToday ? '#A78BFA' : 'rgba(167,139,250,0.4)', transition: 'height 0.35s ease' }} />
                  </div>
                  <span style={{ fontSize: 9, color: isToday ? '#A78BFA' : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>{DAYS[i]}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{isFuture ? '' : tot > 0 ? `${val}/${tot}` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {habitRows.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Geen actieve gewoontes.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {habitRows.map(({ habit, completedDays, scheduledDays, pct }) => (
            <div key={habit.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15 }}>{habit.icon || '🎯'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{habit.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? 'var(--accent)' : 'var(--text-2)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct >= 100 ? 'var(--accent)' : '#A78BFA', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ marginTop: 3, fontSize: 10, color: 'var(--text-3)' }}>{completedDays.length} / {scheduledDays.length} geplande dagen</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Jumbo ─────────────────────────────────────────────────────────────────────
function JumboCard() {
  const shifts = (() => { try { return JSON.parse(localStorage.getItem('pmt_work_shifts')) || [] } catch { return [] } })()
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

  const monthShifts = shifts.filter(s => s.date?.startsWith(monthStr) && s.start_time && s.end_time)
  if (!monthShifts.length) return null

  const totalMins = monthShifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    return sum + (eh * 60 + em) - (sh * 60 + sm)
  }, 0)
  const hStr = totalMins % 60 > 0 ? `${Math.floor(totalMins/60)}u ${totalMins%60}m` : `${Math.floor(totalMins/60)}u`

  const weeks = [0,1,2,3].map(w => {
    const wShifts = monthShifts.filter(s => { const d = new Date(s.date+'T00:00:00'); return d.getDate() >= w*7+1 && d.getDate() <= (w+1)*7 })
    const mins = wShifts.reduce((sum, s) => {
      const [sh,sm] = s.start_time.split(':').map(Number), [eh,em] = s.end_time.split(':').map(Number)
      return sum + (eh*60+em) - (sh*60+sm)
    }, 0)
    return { label: `W${w+1}`, mins, count: wShifts.length }
  })
  const maxMins = Math.max(...weeks.map(w => w.mins), 1)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Jumbo — {MONTHS[now.getMonth()]}</span>
        <span style={{ fontSize: 15, color: '#FACC15', fontWeight: 700 }}>{hStr}</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          {monthShifts.length} dienst{monthShifts.length !== 1 ? 'en' : ''} · gem. {Math.round(totalMins / monthShifts.length / 60 * 10) / 10}u per dienst
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {weeks.map((w, i) => {
          const barH = w.mins > 0 ? Math.max(4, Math.round((w.mins / maxMins) * 64)) : 3
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ height: 64, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div style={{ width: '100%', height: barH, borderRadius: 4, background: w.mins === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(250,204,21,0.55)', boxShadow: w.mins > 0 ? '0 0 6px rgba(250,204,21,0.2)' : 'none', transition: 'height 0.4s ease' }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{w.label}</span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{w.mins > 0 ? `${Math.floor(w.mins/60)}u` : '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week nav ──────────────────────────────────────────────────────────────────
function WeekNav({ weekOffset, onChange }) {
  const days = getWeekDays(weekOffset)
  const isCurrentWeek = weekOffset === 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(weekOffset - 1)}
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center' }}>
        <ChevronLeft size={14} />
      </button>
      <span style={{ fontSize: 12, color: isCurrentWeek ? 'var(--accent)' : 'var(--text-2)', fontWeight: isCurrentWeek ? 700 : 400, flex: 1, textAlign: 'center', minWidth: 160 }}>
        {isCurrentWeek ? 'Deze week' : weekLabel(days)}
      </span>
      <button onClick={() => onChange(Math.min(0, weekOffset + 1))} disabled={isCurrentWeek}
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 8px', cursor: isCurrentWeek ? 'not-allowed' : 'pointer', color: isCurrentWeek ? 'rgba(255,255,255,0.2)' : 'var(--text-2)', display: 'flex', alignItems: 'center' }}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatsPage({ tasks, userId }) {
  const [weekOffset, setWeekOffset] = useState(0)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#00FFD1', margin: 0, borderLeft: '3px solid rgba(0,255,209,0.5)', paddingLeft: 12 }}>Statistieken</h1>
        </div>

        {/* Level altijd bovenaan */}
        <XPCard userId={userId} />

        {/* Week navigator — gedeeld voor alle kaarten */}
        <WeekNav weekOffset={weekOffset} onChange={setWeekOffset} />

        <FocusCard userId={userId} weekOffset={weekOffset} />
        <TakenCard tasks={tasks} weekOffset={weekOffset} />
        <GewoontesCard userId={userId} weekOffset={weekOffset} />
        <JumboCard />
      </div>
    </div>
  )
}
