import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const LS_STATS = 'pomodoro_stats'
const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

function getWeekDays() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + mondayOffset + i)
    return d.toISOString().slice(0, 10)
  })
}

function getPrevWeekDays() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + mondayOffset - 7 + i)
    return d.toISOString().slice(0, 10)
  })
}

function fmtMins(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}u ${m}m` : `${h}u`) : `${m}m`
}

// jsDayToFreq: converts JS getDay() (0=Sun) to frequency index (0=Mon)
function jsDayToFreq(jsDay) { return (jsDay + 6) % 7 }

function FocusCard() {
  const stats = (() => { try { return JSON.parse(localStorage.getItem(LS_STATS)) || {} } catch { return {} } })()
  const weekDays = getWeekDays()
  const prevWeekDays = getPrevWeekDays()
  const todayStr = new Date().toISOString().slice(0, 10)

  const values = weekDays.map(d => stats[d] || 0)
  const prevValues = prevWeekDays.map(d => stats[d] || 0)
  const total = values.reduce((a, b) => a + b, 0)
  const prevTotal = prevValues.reduce((a, b) => a + b, 0)
  const diff = total - prevTotal
  const maxVal = Math.max(...values, 1)
  const BAR_MAX_H = 72

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Focus (Pomodoro)
        </span>
        {total > 0 && (
          <span style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>
            {fmtMins(total)}
          </span>
        )}
      </div>

      {prevTotal > 0 || total > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: diff >= 0 ? 'var(--accent)' : 'rgba(255,80,80,0.8)' }}>
            {diff >= 0 ? `↑ ${fmtMins(diff)} meer dan vorige week` : `↓ ${fmtMins(-diff)} minder dan vorige week`}
          </span>
        </div>
      ) : <div style={{ marginBottom: 14 }} />}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {weekDays.map((dateStr, i) => {
          const mins = values[i]
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const barH = mins > 0 ? Math.max(4, Math.round((mins / maxVal) * BAR_MAX_H)) : 0
          return (
            <div key={dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div style={{
                  width: '100%',
                  height: barH || 3,
                  borderRadius: 4,
                  background: isFuture ? 'rgba(255,255,255,0.06)'
                             : mins === 0 ? 'rgba(255,255,255,0.08)'
                             : isToday ? 'var(--accent)'
                             : 'rgba(0,255,209,0.45)',
                  boxShadow: isToday && mins > 0 ? '0 0 8px var(--accent-dim)' : 'none',
                  transition: 'height 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>
                {DAYS[i]}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
                {isFuture ? '' : fmtMins(mins)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TakenCard({ tasks }) {
  const weekDays = getWeekDays()
  const todayStr = new Date().toISOString().slice(0, 10)

  const weekTasks = tasks.filter(t => t.date && weekDays.includes(t.date))
  const completed = weekTasks.filter(t => t.completed)
  const total = weekTasks.length
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0

  // completed per day
  const completedPerDay = weekDays.map(d =>
    weekTasks.filter(t => t.date === d && t.completed).length
  )
  const totalPerDay = weekDays.map(d =>
    weekTasks.filter(t => t.date === d).length
  )
  const maxBar = Math.max(...completedPerDay, 1)
  const BAR_MAX_H = 72

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Taken
        </span>
        <span style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>
          {completed.length} voltooid
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          {total > 0 ? `${pct}% van ${total} taken deze week` : 'Geen taken deze week'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {weekDays.map((dateStr, i) => {
          const done = completedPerDay[i]
          const tot = totalPerDay[i]
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const barH = done > 0 ? Math.max(4, Math.round((done / maxBar) * BAR_MAX_H)) : 0
          return (
            <div key={dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div style={{
                  width: '100%',
                  height: barH || 3,
                  borderRadius: 4,
                  background: isFuture ? 'rgba(255,255,255,0.06)'
                             : done === 0 ? 'rgba(255,255,255,0.08)'
                             : isToday ? 'var(--accent)'
                             : 'rgba(0,255,209,0.45)',
                  boxShadow: isToday && done > 0 ? '0 0 8px var(--accent-dim)' : 'none',
                  transition: 'height 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>
                {DAYS[i]}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
                {isFuture ? '' : tot > 0 ? `${done}/${tot}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GewoontesCard({ userId }) {
  const [habits, setHabits] = useState([])
  const [completions, setCompletions] = useState({})
  const [loading, setLoading] = useState(true)

  const weekDays = getWeekDays() // ['YYYY-MM-DD', ...] Ma to Zo

  useEffect(() => {
    if (!userId) return
    const fetchAll = async () => {
      const [habitsRes, completionsRes] = await Promise.all([
        supabase.from('habits').select('id, name, icon, frequency, color')
          .eq('user_id', userId).eq('archived', false)
          .order('sort_order').order('created_at'),
        (() => {
          const from = new Date()
          from.setDate(from.getDate() - 14)
          return supabase.from('habit_completions').select('habit_id, date')
            .eq('user_id', userId).gte('date', from.toISOString().slice(0, 10))
        })(),
      ])

      const map = {}
      for (const row of (completionsRes.data || [])) {
        if (!map[row.habit_id]) map[row.habit_id] = new Set()
        map[row.habit_id].add(row.date)
      }
      setHabits(habitsRes.data || [])
      setCompletions(map)
      setLoading(false)
    }
    fetchAll()
  }, [userId])

  if (loading) return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        Gewoontes
      </span>
      <div style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 12 }}>Laden…</div>
    </div>
  )

  const habitRows = habits.map(habit => {
    const freq = habit.frequency ?? [0, 1, 2, 3, 4, 5, 6]
    // weekDays[0]=Ma (freq 0), weekDays[6]=Zo (freq 6)
    const scheduledDays = weekDays.filter((_, i) => freq.includes(i))
    const completedDays = scheduledDays.filter(d => completions[habit.id]?.has(d))
    const pct = scheduledDays.length > 0
      ? Math.round((completedDays.length / scheduledDays.length) * 100)
      : 0
    return { habit, scheduledDays, completedDays, pct }
  }).filter(r => r.scheduledDays.length > 0)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        Gewoontes
      </span>

      {habitRows.length === 0 ? (
        <div style={{ marginTop: 14, color: 'var(--text-3)', fontSize: 12 }}>
          Geen actieve gewoontes deze week.
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {habitRows.map(({ habit, completedDays, scheduledDays, pct }) => (
            <div key={habit.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{habit.icon || '🎯'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{habit.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? 'var(--accent)' : 'var(--text-2)', minWidth: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: 3,
                  background: 'var(--accent)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ marginTop: 3, fontSize: 10, color: 'var(--text-3)' }}>
                {completedDays.length} / {scheduledDays.length} dagen
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function XPCard() {
  const xp      = (() => { try { return parseInt(localStorage.getItem('habit_xp')) || 0 } catch { return 0 } })()
  const level   = Math.floor(xp / 100) + 1
  const xpIn    = xp % 100
  const LEVEL_NAMES = ['Beginner','Leerling','Gevorderd','Expert','Meester','Legende']
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] || `Level ${level}`

  const achievements = (() => {
    try { return JSON.parse(localStorage.getItem('habit_achievements')) || [] } catch { return [] }
  })()

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Gewoontes niveau
        </span>
        <span style={{ fontSize: 11, color: '#FACC15', fontWeight: 700 }}>
          🏆 Lvl {level}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: 'rgba(250,204,21,0.1)', border: '2px solid rgba(250,204,21,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>
          {level >= 5 ? '🌟' : level >= 3 ? '⭐' : '✨'}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>{levelName}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 8px' }}>{xp} XP totaal</p>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${xpIn}%`, borderRadius: 3,
              background: 'linear-gradient(90deg, #FACC15, #F59E0B)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '3px 0 0', textAlign: 'right' }}>
            {xpIn}/100 XP
          </p>
        </div>
      </div>

      {achievements.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Behaald ({achievements.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {achievements.slice(-8).map((id, i) => {
              const labels = {
                streak_7: '🔥7', streak_14: '🔥14', streak_30: '🔥30',
                perfect_3: '💎3', perfect_7: '💎7',
                level_5: '⭐L5', level_10: '🌟L10',
              }
              return (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 10,
                  background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)',
                  color: 'rgba(250,204,21,0.9)',
                }}>
                  {labels[id] || id}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function JumboCard() {
  const shifts = (() => { try { return JSON.parse(localStorage.getItem('pmt_work_shifts')) || [] } catch { return [] } })()
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const MONTHS_NL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

  const monthShifts = shifts.filter(s => s.date?.startsWith(monthStr) && s.start_time && s.end_time)
  if (!monthShifts.length) return null

  const totalMins = monthShifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    return sum + (eh * 60 + em) - (sh * 60 + sm)
  }, 0)

  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const hStr = m > 0 ? `${h}u ${m}m` : `${h}u`

  // Bar chart per week (4 weken)
  const weeks = [0, 1, 2, 3].map(w => {
    const weekShifts = monthShifts.filter(s => {
      const d = new Date(s.date + 'T00:00:00')
      return d.getDate() >= w * 7 + 1 && d.getDate() <= (w + 1) * 7
    })
    const mins = weekShifts.reduce((sum, s) => {
      const [sh, sm] = s.start_time.split(':').map(Number)
      const [eh, em] = s.end_time.split(':').map(Number)
      return sum + (eh * 60 + em) - (sh * 60 + sm)
    }, 0)
    return { label: `W${w + 1}`, mins, count: weekShifts.length }
  })
  const maxMins = Math.max(...weeks.map(w => w.mins), 1)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Jumbo — {MONTHS_NL[now.getMonth()]}
        </span>
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
                <div style={{
                  width: '100%', height: barH, borderRadius: 4,
                  background: w.mins === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(250,204,21,0.55)',
                  boxShadow: w.mins > 0 ? '0 0 6px rgba(250,204,21,0.2)' : 'none',
                  transition: 'height 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{w.label}</span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
                {w.mins > 0 ? `${Math.floor(w.mins / 60)}u` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StatsPage({ tasks, userId }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#00FFD1', margin: 0, borderLeft: '3px solid rgba(0,255,209,0.5)', paddingLeft: 12 }}>Statistieken</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0', paddingLeft: 15 }}>Jouw voortgang deze week</p>
        </div>

        <FocusCard />
        <TakenCard tasks={tasks} />
        <GewoontesCard userId={userId} />
        <XPCard />
        <JumboCard />
      </div>
    </div>
  )
}
