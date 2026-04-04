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

function fmtMins(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}u ${m}m` : `${h}u`) : `${m}m`
}

function loadLocalStats() {
  try { return JSON.parse(localStorage.getItem(LS_STATS)) || {} } catch { return {} }
}

export default function PomodoroStats({ refreshKey, userId }) {
  const weekDays = getWeekDays()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [statsMap, setStatsMap] = useState(() => loadLocalStats())

  useEffect(() => {
    if (!userId) {
      setStatsMap(loadLocalStats())
      return
    }
    const from = weekDays[0]
    supabase
      .from('pomodoro_sessions')
      .select('date, duration_mins')
      .eq('user_id', userId)
      .eq('mode', 'work')
      .gte('date', from)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setStatsMap(loadLocalStats())
          return
        }
        // Sommeer minuten per dag
        const map = {}
        for (const row of data) {
          map[row.date] = (map[row.date] || 0) + (row.duration_mins || 0)
        }
        // Merge met localStorage (neem max per dag)
        const local = loadLocalStats()
        for (const [day, mins] of Object.entries(local)) {
          map[day] = Math.max(map[day] || 0, mins)
        }
        setStatsMap(map)
      })
  }, [userId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const values = weekDays.map(d => statsMap[d] || 0)
  const maxVal = Math.max(...values, 1)
  const total = values.reduce((a, b) => a + b, 0)
  const BAR_MAX_H = 52

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Focus deze week
        </span>
        {total > 0 && (
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
            {fmtMins(total)}
          </span>
        )}
      </div>
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
