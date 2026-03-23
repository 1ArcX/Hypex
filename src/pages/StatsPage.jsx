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

export default function StatsPage({ tasks, userId }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Statistieken</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>Jouw voortgang deze week</p>
        </div>

        <FocusCard />
        <TakenCard tasks={tasks} />
        <GewoontesCard userId={userId} />
      </div>
    </div>
  )
}
