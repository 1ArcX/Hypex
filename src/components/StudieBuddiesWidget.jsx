import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const MODE_EMOJI = { work: '🍅', break: '☕', longBreak: '🌙' }

function fmtRemaining(endTime) {
  if (!endTime) return ''
  const ms = endTime - Date.now()
  if (ms <= 0) return '0:00'
  const secs = Math.ceil(ms / 1000)
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
}

function fmtMins(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

export default function StudieBuddiesWidget({ profiles = [] }) {
  const [onlineUsers, setOnlineUsers] = useState([])
  const [dailyStats, setDailyStats] = useState([])
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const channel = supabase.channel('studiebuddies')
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUsers(Object.values(state).flat())
      })
      .subscribe()

    const iv = setInterval(() => forceUpdate(n => n + 1), 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(iv)
    }
  }, [])

  useEffect(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    supabase
      .from('pomodoro_sessions')
      .select('user_id, duration_minutes')
      .gte('completed_at', startOfToday.toISOString())
      .eq('mode', 'work')
      .then(({ data }) => {
        if (!data) return
        const map = {}
        for (const row of data) {
          const uid = row.user_id
          if (!map[uid]) map[uid] = { userId: uid, totalMins: 0 }
          map[uid].totalMins += row.duration_minutes || 0
        }
        setDailyStats(Object.values(map).sort((a, b) => b.totalMins - a.totalMins))
      })
  }, [])

  const getNameForUserId = (userId) => {
    const profile = profiles.find(p => p.id === userId)
    return profile?.full_name || 'Student'
  }

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 10px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        👥 StudieBuddies
      </p>

      {onlineUsers.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Nog niemand aan het studeren</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onlineUsers.map((u, i) => {
            const remaining = fmtRemaining(u.endTime)
            const emoji = MODE_EMOJI[u.mode] || '🍅'
            return (
              <div key={`${u.userId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, color: '#22c55e', lineHeight: 1 }}>●</span>
                <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1, fontWeight: 500 }}>
                  {emoji} {u.name}
                </span>
                {remaining && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    {remaining}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {dailyStats.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 6px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            Vandaag gefocust
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dailyStats.map(s => (
              <div key={s.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{getNameForUserId(s.userId)}</span>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{fmtMins(s.totalMins)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
