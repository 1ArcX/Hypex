import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X, Trash2, Flame, Pencil, ChevronDown, ChevronUp, Minus } from 'lucide-react'

const EMOJIS = [
  '🏃','📚','💧','🧘','🥗','😴','💪','🎯','✍️','🎨',
  '🎵','🌿','☀️','🚴','🧹','💊','📖','🧠','❤️','🍎',
  '🌙','⚡','🎸','🏊','🤸','💻','🌟','🔥','🫁','🥤',
]
const COLORS = ['#00FFD1','#818CF8','#F59E0B','#EF4444','#10B981','#3B82F6','#EC4899','#8B5CF6']
const DAY_LABELS = ['Ma','Di','Wo','Do','Vr','Za','Zo']

// Preset habits library
const PRESET_HABITS = [
  { name: 'Water drinken', icon: '💧', color: '#38BDF8', type: 'counter', unit: 'glazen', target: 8 },
  { name: 'Water drinken (ml)', icon: '💧', color: '#38BDF8', type: 'counter', unit: 'ml', target: 2000 },
  { name: 'Sporten', icon: '🏃', color: '#10B981', type: 'check' },
  { name: 'Lezen', icon: '📚', color: '#818CF8', type: 'check' },
  { name: 'Meditatie', icon: '🧘', color: '#A78BFA', type: 'check' },
  { name: 'Gezond eten', icon: '🥗', color: '#4ADE80', type: 'check' },
  { name: 'Goed slapen', icon: '😴', color: '#6366F1', type: 'check' },
  { name: 'Supplementen', icon: '💊', color: '#F59E0B', type: 'check' },
  { name: 'Push-ups', icon: '💪', color: '#EF4444', type: 'counter', unit: 'keer', target: 20 },
  { name: 'Wandelen', icon: '☀️', color: '#FACC15', type: 'check' },
  { name: 'Journaling', icon: '✍️', color: '#EC4899', type: 'check' },
  { name: 'Geen social media', icon: '📵', color: '#8B5CF6', type: 'check' },
  { name: 'Fiets', icon: '🚴', color: '#00FFD1', type: 'check' },
  { name: 'Zwemmen', icon: '🏊', color: '#38BDF8', type: 'check' },
]

const COUNTER_UNITS = ['glazen', 'ml', 'keer', 'km', 'minuten', 'pagina\'s']

// localStorage helpers for counter config + values
function loadCounterConfig() {
  try { return JSON.parse(localStorage.getItem('habit_counter_config')) || {} } catch { return {} }
}
function saveCounterConfig(cfg) {
  localStorage.setItem('habit_counter_config', JSON.stringify(cfg))
}
function loadCounterValues() {
  try { return JSON.parse(localStorage.getItem('habit_counter_values')) || {} } catch { return {} }
}
function saveCounterValues(vals) {
  localStorage.setItem('habit_counter_values', JSON.stringify(vals))
}

function jsDayToFreq(jsDay) { return (jsDay + 6) % 7 }
function todayStr() { return new Date().toISOString().slice(0, 10) }

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
function HabitModal({ habit, onSave, onClose, onDelete, counterConfig }) {
  const existingConfig = habit ? (counterConfig[habit.id] || {}) : {}
  const [name, setName] = useState(habit?.name || '')
  const [icon, setIcon] = useState(habit?.icon || '🌟')
  const [color, setColor] = useState(habit?.color || '#00FFD1')
  const [frequency, setFrequency] = useState(habit?.frequency ?? [0, 1, 2, 3, 4, 5, 6])
  const [habitType, setHabitType] = useState(existingConfig.type || 'check')
  const [counterUnit, setCounterUnit] = useState(existingConfig.unit || 'glazen')
  const [counterTarget, setCounterTarget] = useState(existingConfig.target || 8)
  const [showLibrary, setShowLibrary] = useState(false)

  const toggleDay = (i) =>
    setFrequency(f => f.includes(i) ? f.filter(d => d !== i) : [...f, i].sort((a, b) => a - b))

  const pickPreset = (preset) => {
    setName(preset.name)
    setIcon(preset.icon)
    setColor(preset.color)
    if (preset.type === 'counter') {
      setHabitType('counter')
      setCounterUnit(preset.unit)
      setCounterTarget(preset.target)
    } else {
      setHabitType('check')
    }
    setShowLibrary(false)
  }

  const handleSave = () => {
    if (!name.trim()) return
    const counterData = habitType === 'counter'
      ? { type: 'counter', unit: counterUnit, target: counterTarget }
      : { type: 'check' }
    onSave({ name: name.trim(), icon, color, frequency }, counterData)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(10px)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>
            {habit ? 'Gewoonte bewerken' : 'Nieuwe gewoonte'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Bibliotheek toggle */}
        {!habit && (
          <button
            onClick={() => setShowLibrary(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: 10, marginBottom: 14, cursor: 'pointer',
              background: showLibrary ? 'rgba(0,255,209,0.08)' : 'rgba(255,255,255,0.04)',
              border: showLibrary ? '1px solid rgba(0,255,209,0.25)' : '1px solid rgba(255,255,255,0.08)',
              color: showLibrary ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: 500,
            }}>
            <span>Kies uit bibliotheek</span>
            {showLibrary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {/* Library grid */}
        {showLibrary && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16,
            maxHeight: 240, overflowY: 'auto',
          }}>
            {PRESET_HABITS.map((p, idx) => (
              <button key={idx} onClick={() => pickPreset(p)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = p.color + '60' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>{p.name}</p>
                  {p.type === 'counter' && (
                    <p style={{ fontSize: 10, color: p.color, margin: 0 }}>{p.target} {p.unit}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

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
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
              style={{ flex: 1, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Habit type toggle */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', gap: 6, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            {[['check','Aanvinken ✓'],['counter','Teller 🔢']].map(([val, lbl]) => (
              <button key={val} onClick={() => setHabitType(val)} style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: habitType === val ? `${color}20` : 'transparent',
                color: habitType === val ? color : 'rgba(255,255,255,0.35)',
                fontSize: 12, fontWeight: habitType === val ? 600 : 400, transition: 'all 0.15s',
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Counter settings */}
        {habitType === 'counter' && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 4 }}>Eenheid</label>
                <select className="glass-input" value={counterUnit} onChange={e => setCounterUnit(e.target.value)}
                  style={{ fontSize: 12, colorScheme: 'dark', width: '100%' }}>
                  {COUNTER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 4 }}>Doel</label>
                <input type="number" className="glass-input" value={counterTarget} min={1}
                  onChange={e => setCounterTarget(Math.max(1, +e.target.value))}
                  style={{ fontSize: 12, colorScheme: 'dark', width: '100%' }} />
              </div>
            </div>
          </div>
        )}

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
          <button onClick={handleSave} disabled={!name.trim()} style={{
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
export default function HabitsWidget({ userId, compact = false }) {
  const [habits, setHabits] = useState([])
  const [completions, setCompletions] = useState({})   // { habitId: Set<dateStr> }
  const [counterValues, setCounterValues] = useState(() => loadCounterValues())
  const [counterConfig, setCounterConfig] = useState(() => loadCounterConfig())
  const [modalHabit, setModalHabit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [animating, setAnimating] = useState({})

  const today = todayStr()
  const last7 = getLast7Days()
  const todayFreq = jsDayToFreq(new Date().getDay())

  const todayHabits = habits.filter(h => (h.frequency ?? [0,1,2,3,4,5,6]).includes(todayFreq))
  const otherHabits = habits.filter(h => !(h.frequency ?? [0,1,2,3,4,5,6]).includes(todayFreq))

  // A counter habit is "done" if count >= target
  function isHabitDone(habit) {
    const cfg = counterConfig[habit.id]
    if (cfg?.type === 'counter') {
      const count = counterValues[habit.id]?.[today] || 0
      return count >= (cfg.target || 1)
    }
    return completions[habit.id]?.has(today) || false
  }

  const doneToday = todayHabits.filter(h => isHabitDone(h)).length

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

  // Toggle check habit
  const toggleCompletion = async (habit) => {
    setAnimating(a => ({ ...a, [habit.id]: true }))
    setTimeout(() => setAnimating(a => ({ ...a, [habit.id]: false })), 350)
    const set = completions[habit.id] || new Set()
    const done = set.has(today)
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

  // Increment/decrement counter habit
  const adjustCounter = (habit, delta) => {
    const cfg = counterConfig[habit.id]
    const current = counterValues[habit.id]?.[today] || 0
    const newCount = Math.max(0, current + delta)
    const newVals = {
      ...counterValues,
      [habit.id]: { ...(counterValues[habit.id] || {}), [today]: newCount },
    }
    setCounterValues(newVals)
    saveCounterValues(newVals)

    // Mark as completion in DB when reaching target, remove when going below
    const target = cfg?.target || 1
    const wasDone = current >= target
    const isDone = newCount >= target
    if (!wasDone && isDone) {
      supabase.from('habit_completions').insert({ habit_id: habit.id, user_id: userId, date: today }).then(() => {})
      setCompletions(c => {
        const s = new Set(c[habit.id] || [])
        s.add(today)
        return { ...c, [habit.id]: s }
      })
    } else if (wasDone && !isDone) {
      supabase.from('habit_completions').delete().eq('habit_id', habit.id).eq('user_id', userId).eq('date', today).then(() => {})
      setCompletions(c => {
        const s = new Set(c[habit.id] || [])
        s.delete(today)
        return { ...c, [habit.id]: s }
      })
    }
  }

  const saveHabit = async (data, counterData) => {
    let habitId
    if (modalHabit && modalHabit !== 'new') {
      await supabase.from('habits').update(data).eq('id', modalHabit.id)
      habitId = modalHabit.id
    } else {
      const { data: inserted } = await supabase.from('habits').insert({ ...data, user_id: userId, sort_order: habits.length }).select().single()
      habitId = inserted?.id
    }
    // Save counter config locally
    if (habitId) {
      const newCfg = { ...counterConfig, [habitId]: counterData }
      setCounterConfig(newCfg)
      saveCounterConfig(newCfg)
    }
    setModalHabit(null)
    fetchHabits()
  }

  const deleteHabit = async (id) => {
    await supabase.from('habits').update({ archived: true }).eq('id', id)
    setModalHabit(null)
    fetchHabits()
  }

  // ── Compact mode (for mobile home screen preview) ────────────────────────
  if (compact) {
    return (
      <div className="glass-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={13} color="#FF8C42" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Gewoontes</span>
          </div>
          {todayHabits.length > 0 && (
            <span style={{ fontSize: 11, color: doneToday === todayHabits.length ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              {doneToday}/{todayHabits.length}
            </span>
          )}
        </div>
        {todayHabits.length > 0 && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(doneToday / todayHabits.length) * 100}%`,
              background: doneToday === todayHabits.length ? 'linear-gradient(90deg, var(--accent), #818CF8)' : 'var(--accent)',
              borderRadius: 4, transition: 'width 0.4s',
            }} />
          </div>
        )}
        {loading ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Laden...</div>
        ) : todayHabits.length === 0 ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '4px 0' }}>Geen gewoontes voor vandaag</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {todayHabits.slice(0, 6).map(habit => {
              const done = isHabitDone(habit)
              const cfg = counterConfig[habit.id]
              const count = cfg?.type === 'counter' ? (counterValues[habit.id]?.[today] || 0) : null
              return (
                <div key={habit.id}
                  onClick={() => cfg?.type === 'counter' ? adjustCounter(habit, 1) : toggleCompletion(habit)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    borderRadius: 20, cursor: 'pointer',
                    background: done ? `${habit.color}18` : 'rgba(255,255,255,0.05)',
                    border: done ? `1px solid ${habit.color}40` : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  <span style={{ fontSize: 14 }}>{habit.icon}</span>
                  {cfg?.type === 'counter' ? (
                    <span style={{ fontSize: 11, color: done ? habit.color : 'rgba(255,255,255,0.5)' }}>
                      {count}/{cfg.target}
                    </span>
                  ) : (
                    done && <span style={{ fontSize: 11, color: habit.color }}>✓</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Full render ────────────────────────────────────────────────────────────
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
                ? 'linear-gradient(90deg, var(--accent), #818CF8)' : 'var(--accent)',
              borderRadius: 4, transition: 'width 0.4s',
              boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 50%, transparent)',
            }} />
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <div className="animate-spin" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && habits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🌱</div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: '0 0 2px' }}>Nog geen gewoontes</p>
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, margin: 0 }}>Klik op Nieuw om te beginnen</p>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {todayHabits.map(habit => {
              const set = completions[habit.id] || new Set()
              const streak = calcStreak(set, habit)
              const bounce = animating[habit.id]
              const cfg = counterConfig[habit.id]
              const isCounter = cfg?.type === 'counter'
              const count = isCounter ? (counterValues[habit.id]?.[today] || 0) : null
              const target = isCounter ? (cfg.target || 1) : null
              const done = isHabitDone(habit)

              return (
                <div key={habit.id}
                  onClick={() => !isCounter && toggleCompletion(habit)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 12,
                    cursor: isCounter ? 'default' : 'pointer',
                    border: done ? `1px solid ${habit.color}35` : '1px solid rgba(255,255,255,0.06)',
                    background: done ? `${habit.color}0C` : 'rgba(255,255,255,0.015)',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}>

                  {/* Check circle OR counter controls */}
                  {isCounter ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); adjustCounter(habit, -1) }}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', border: `1px solid rgba(255,255,255,0.15)`,
                          background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'rgba(255,255,255,0.4)',
                        }}>
                        <Minus size={10} />
                      </button>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${done ? habit.color : 'rgba(255,255,255,0.18)'}`,
                        background: done ? `${habit.color}20` : 'transparent',
                        transition: 'all 0.2s',
                        transform: bounce ? 'scale(1.2)' : 'scale(1)',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: done ? habit.color : 'rgba(255,255,255,0.7)', lineHeight: 1 }}>{count}</span>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>/{target}</span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); adjustCounter(habit, 1) }}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', border: `1px solid ${habit.color}60`,
                          background: `${habit.color}15`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: habit.color,
                        }}>
                        <Plus size={10} />
                      </button>
                    </div>
                  ) : (
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
                  )}

                  {/* Icon + name + dots */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 15 }}>{habit.icon}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 500,
                        color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)',
                        textDecoration: done && !isCounter ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'color 0.2s',
                      }}>{habit.name}</span>
                      {isCounter && (
                        <span style={{ fontSize: 10, color: habit.color, opacity: 0.7 }}>{cfg.unit}</span>
                      )}
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
                            background: completed ? habit.color : (scheduled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'),
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
          counterConfig={counterConfig}
          onSave={saveHabit}
          onClose={() => setModalHabit(null)}
          onDelete={deleteHabit}
        />
      )}
    </>
  )
}
