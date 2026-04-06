import React, { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
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

export default function StudieBuddiesWidget({ profiles = [], onlineUsers = [] }) {
  const [dailyStats, setDailyStats] = useState([])
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(iv)
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
    <div className="card" style={{
      padding: '14px 16px',
      borderLeft: '3px solid rgba(167,139,250,0.45)',
      background: 'linear-gradient(135deg, rgba(167,139,250,0.05) 0%, transparent 60%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={11} style={{ color: '#A78BFA' }} />
        </div>
        <span style={{ fontSize: 10, color: '#A78BFA', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700 }}>StudieBuddies</span>
      </div>

      {onlineUsers.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Nog niemand aan het studeren</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onlineUsers.map((u, i) => {
            const remaining = fmtRemaining(u.endTime)
            const emoji = MODE_EMOJI[u.mode] || '🍅'
            return (
              <div key={`${u.userId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#A78BFA', boxShadow: '0 0 6px rgba(167,139,250,0.6)', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1, fontWeight: 500 }}>
                  {emoji} {u.name}
                </span>
                {remaining && (
                  <span style={{ fontSize: 11, color: '#A78BFA', fontFamily: 'monospace', fontWeight: 600 }}>
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
