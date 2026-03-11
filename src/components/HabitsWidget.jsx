import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X, Trash2, Flame, Pencil } from 'lucide-react'

const EMOJIS = [
  '🏃','📚','💧','🧘','🥗','😴','💪','🎯','✍️','🎨',
  '🎵','🌿','☀️','🚴','🧹','💊','📖','🧠','❤️','🍎',
  '🌙','⚡','🎸','🏊','🤸','💻','🌟','🔥','🫁','🥤',
]
const COLORS = ['#00FFD1','#818CF8','#F59E0B','#EF4444','#10B981','#3B82F6','#EC4899','#8B5CF6']
const DAY_LABELS = ['Ma','Di','Wo','Do','Vr','Za','Zo']

// Convert JS Date.getDay() (0=Sun) to our index (0=Ma…6=Zo)
function jsDayToFreq(jsDay) {
  return (jsDay + 6) % 7
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function calcStreak(completionSet, habit) {
  const freq = habit.frequency ?? [0, 1, 2, 3, 4, 5, 6]
  let streak = 0
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10)
    const dayFreq = jsDayToFreq(d.getDay())
    if (freq.includes(dayFreq)) {
      if (completionSet.has(dateStr)) streak++
      else break
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ─── Add / Edit modal ────────────────────────────────────────────────────────
function HabitModal({ habit, onSave, onClose, onDelete }) {
  const [name, setName] = useState(habit?.name || '')
  const [icon, setIcon] = useState(habit?.icon || '🌟')
  const [color, setColor] = useState(habit?.color || '#00FFD1')
  const [frequency, setFrequency] = useState(habit?.frequency ?? [0, 1, 2, 3, 4, 5, 6])

  const toggleDay = (i) =>
    setFrequency(f => f.includes(i) ? f.filter(d => d !== i) : [...f, i].sort((a, b) => a - b))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(10px)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 24, position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>
            {habit ? 'Gewoonte bewerken' : 'Nieuwe gewoonte'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Name + icon preview */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Naam</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              fontSize: 22, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, flexShrink: 0,
            }}>{icon}</div>
            <input
              className="glass-input"
              placeholder="bijv. Sporten, Lezen, Water…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && onSave({ name: name.trim(), icon, color, frequency })}
              autoFocus
              style={{ flex: 1, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Emoji grid */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Icoon</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setIcon(e)} style={{
                fontSize: 17, padding: '4px 0', borderRadius: 8, cursor: 'pointer',
                background: icon === e ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: icon === e ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                transition: 'all 0.1s',
              }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Color row */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Kleur</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                background: c,
                border: color === c ? '2px solid white' : '2px solid transparent',
                boxShadow: color === c ? `0 0 10px ${c}90` : 'none',
                transition: 'all 0.15s',
              }} />
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Herhaling</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {DAY_LABELS.map((label, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                background: frequency.includes(i) ? color : 'rgba(255,255,255,0.05)',
                color: frequency.includes(i) ? '#000' : 'rgba(255,255,255,0.35)',
                border: frequency.includes(i) ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.07)',
                boxShadow: frequency.includes(i) ? `0 0 8px ${color}40` : 'none',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {habit && (
            <button onClick={() => onDelete(habit.id)} style={{
              padding: '10px 14px', borderRadius: 10,
              border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.07)',
              color: '#FF6B6B', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13,
          }}>Annuleer</button>
          <button
            onClick={() => name.trim() && onSave({ name: name.trim(), icon, color, frequency })}
            disabled={!name.trim()}
            style={{
              flex: 2, padding: '10px', borderRadius: 10,
              border: `1px solid ${color}50`, background: `${color}15`,
              color, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              opacity: !name.trim() ? 0.4 : 1, transition: 'opacity 0.15s',
            }}>
            {habit ? 'Opslaan' : '+ Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main widget ─────────────────────────────────────────────────────────────
export default function HabitsWidget({ userId }) {
  const [habits, setHabits] = useState([])
  const [completions, setCompletions] = useState({})   // { habitId: Set<dateStr> }
  const [modalHabit, setModalHabit] = useState(null)   // null | 'new' | habitObj
  const [loading, setLoading] = useState(true)
  const [animating, setAnimating] = useState({})       // { habitId: bool }

  const today = todayStr()
  const last7 = getLast7Days()
  const todayFreq = jsDayToFreq(new Date().getDay())

  const todayHabits = habits.filter(h => (h.frequency ?? [0,1,2,3,4,5,6]).includes(todayFreq))
  const otherHabits = habits.filter(h => !(h.frequency ?? [0,1,2,3,4,5,6]).includes(todayFreq))
  const doneToday = todayHabits.filter(h => completions[h.id]?.has(today)).length

  const fetchHabits = useCallback(async () => {
    const { data } = await supabase
      .from('habits').select('*')
      .eq('user_id', userId).eq('archived', false)
      .order('sort_order').order('created_at')
    setHabits(data || [])
  }, [userId])

  const fetchCompletions = useCallback(async () => {
    const from = new Date()
    from.setDate(from.getDate() - 60)
    const { data } = await supabase
      .from('habit_completions').select('habit_id, date')
      .eq('user_id', userId).gte('date', from.toISOString().slice(0, 10))
    const map = {}
    for (const row of (data || [])) {
      if (!map[row.habit_id]) map[row.habit_id] = new Set()
      map[row.habit_id].add(row.date)
    }
    setCompletions(map)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    Promise.all([fetchHabits(), fetchCompletions()]).then(() => setLoading(false))
  }, [userId, fetchHabits, fetchCompletions])

  const toggleCompletion = async (habit) => {
    const set = completions[habit.id] || new Set()
    const done = set.has(today)

    // Bounce animation
    setAnimating(a => ({ ...a, [habit.id]: true }))
    setTimeout(() => setAnimating(a => ({ ...a, [habit.id]: false })), 350)

    // Optimistic
    const next = new Set(set)
    if (done) next.delete(today); else next.add(today)
    setCompletions(c => ({ ...c, [habit.id]: next }))

    if (done) {
      await supabase.from('habit_completions').delete()
        .eq('habit_id', habit.id).eq('user_id', userId).eq('date', today)
    } else {
      await supabase.from('habit_completions')
        .insert({ habit_id: habit.id, user_id: userId, date: today })
    }
  }

  const saveHabit = async (data) => {
    if (modalHabit && modalHabit !== 'new') {
      await supabase.from('habits').update(data).eq('id', modalHabit.id)
    } else {
      await supabase.from('habits').insert({ ...data, user_id: userId, sort_order: habits.length })
    }
    setModalHabit(null)
    fetchHabits()
  }

  const deleteHabit = async (id) => {
    await supabase.from('habits').update({ archived: true }).eq('id', id)
    setModalHabit(null)
    fetchHabits()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="glass-card p-4">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Flame size={15} color="#FF8C42" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Gewoontes</span>
            {todayHabits.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: doneToday === todayHabits.length ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
              }}>
                {doneToday}/{todayHabits.length}
              </span>
            )}
          </div>
          <button onClick={() => setModalHabit('new')} style={{
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
            color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
          }}>
            <Plus size={12} /> Nieuw
          </button>
        </div>

        {/* Progress bar */}
        {todayHabits.length > 0 && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(doneToday / todayHabits.length) * 100}%`,
              background: doneToday === todayHabits.length
                ? 'linear-gradient(90deg, var(--accent), #818CF8)'
                : 'var(--accent)',
              borderRadius: 4, transition: 'width 0.4s',
              boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 50%, transparent)',
            }} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <div className="animate-spin" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && habits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🌱</div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: '0 0 2px' }}>Nog geen gewoontes</p>
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, margin: 0 }}>Klik op Nieuw om te beginnen</p>
          </div>
        )}

        {/* Today habits */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {todayHabits.map(habit => {
              const set = completions[habit.id] || new Set()
              const done = set.has(today)
              const streak = calcStreak(set, habit)
              const bounce = animating[habit.id]

              return (
                <div key={habit.id}
                  onClick={() => toggleCompletion(habit)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                    border: done ? `1px solid ${habit.color}35` : '1px solid rgba(255,255,255,0.06)',
                    background: done ? `${habit.color}0C` : 'rgba(255,255,255,0.015)',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}>

                  {/* Circle check */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${done ? habit.color : 'rgba(255,255,255,0.18)'}`,
                    background: done ? habit.color : 'transparent',
                    transition: 'all 0.2s',
                    transform: bounce ? 'scale(1.35)' : 'scale(1)',
                    boxShadow: done ? `0 0 12px ${habit.color}60` : 'none',
                  }}>
                    {done && (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2 6.5l3 3 6-6" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  {/* Icon + name + dots */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 15 }}>{habit.icon}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 500,
                        color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)',
                        textDecoration: done ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'color 0.2s',
                      }}>{habit.name}</span>
                    </div>
                    {/* 7-day history dots */}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {last7.map(date => {
                        const dayFreq = jsDayToFreq(new Date(date + 'T12:00:00').getDay())
                        const scheduled = (habit.frequency ?? [0,1,2,3,4,5,6]).includes(dayFreq)
                        const completed = set.has(date)
                        return (
                          <div key={date} style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: completed
                              ? habit.color
                              : (scheduled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'),
                            boxShadow: completed ? `0 0 4px ${habit.color}80` : 'none',
                            transition: 'background 0.2s',
                          }} />
                        )
                      })}
                    </div>
                  </div>

                  {/* Streak + pencil */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    {streak > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Flame size={12} color={streak >= 7 ? '#FF8C42' : 'rgba(255,140,66,0.45)'} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: streak >= 7 ? '#FF8C42' : 'rgba(255,255,255,0.3)' }}>
                          {streak}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setModalHabit(habit) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.18)', padding: '2px', borderRadius: 4, lineHeight: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.18)'}>
                      <Pencil size={11} />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Habits not scheduled today */}
            {otherHabits.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', margin: '0 0 5px 2px' }}>Niet vandaag</p>
                {otherHabits.map(habit => (
                  <div key={habit.id}
                    onClick={() => setModalHabit(habit)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, cursor: 'pointer', opacity: 0.38 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.55'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.38'}>
                    <span style={{ fontSize: 14 }}>{habit.icon}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{habit.name}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                      {(habit.frequency ?? []).map(d => (
                        <span key={d} style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{DAY_LABELS[d]}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalHabit !== null && (
        <HabitModal
          habit={modalHabit === 'new' ? null : modalHabit}
          onSave={saveHabit}
          onClose={() => setModalHabit(null)}
          onDelete={deleteHabit}
        />
      )}
    </>
  )
}
