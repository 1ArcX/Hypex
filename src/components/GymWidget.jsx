import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  Dumbbell, Star, Plus, X, ChevronRight, Check, Trash2,
  CalendarPlus, Play, Square, Clock, Search, ChevronDown, ChevronUp,
  Edit3, RotateCcw, Flame
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const DAYS_FULL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']

function getNLDay() {
  const jsDay = new Date().getDay() // 0=Sun
  return (jsDay + 6) % 7           // 0=Mon, 6=Sun
}

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10)
}

function getDayDateStr(nlDay) {
  const todayNL = getNLDay()
  const d = new Date()
  d.setDate(d.getDate() + (nlDay - todayNL))
  return d.toISOString().slice(0, 10)
}

const MUSCLE_GROUPS = [
  { name: 'Borst',     emoji: '🫀', color: '#3B82F6' },
  { name: 'Rug',       emoji: '🦅', color: '#10B981' },
  { name: 'Schouders', emoji: '🏔️', color: '#8B5CF6' },
  { name: 'Benen',     emoji: '🦵', color: '#F97316' },
  { name: 'Biceps',    emoji: '💪', color: '#06B6D4' },
  { name: 'Triceps',   emoji: '⚡', color: '#EAB308' },
  { name: 'Core',      emoji: '🎯', color: '#EF4444' },
  { name: 'Cardio',    emoji: '🏃', color: '#EC4899' },
  { name: 'Full Body', emoji: '🔥', color: '#00FFD1' },
  { name: 'Rust',      emoji: '😴', color: '#6B7280' },
]

const EXERCISE_LIBRARY = {
  'Borst': [
    { name: 'Bankdrukken (Barbell)',    defaultSets: 4, defaultReps: 8  },
    { name: 'Schuine Bankdrukken (DB)', defaultSets: 3, defaultReps: 10 },
    { name: 'Decline Bankdrukken',      defaultSets: 3, defaultReps: 10 },
    { name: 'Cable Fly',                defaultSets: 3, defaultReps: 12 },
    { name: 'DB Fly',                   defaultSets: 3, defaultReps: 12 },
    { name: 'Pec Deck Machine',         defaultSets: 3, defaultReps: 12 },
    { name: 'Dips (Borst)',             defaultSets: 3, defaultReps: 10 },
    { name: 'Push-ups',                 defaultSets: 3, defaultReps: 15 },
    { name: 'Chest Press Machine',      defaultSets: 3, defaultReps: 12 },
  ],
  'Rug': [
    { name: 'Deadlift',                 defaultSets: 4, defaultReps: 5  },
    { name: 'Pull-ups',                 defaultSets: 4, defaultReps: 8  },
    { name: 'Chin-ups',                 defaultSets: 3, defaultReps: 8  },
    { name: 'Lat Pulldown',             defaultSets: 4, defaultReps: 10 },
    { name: 'Gebogen Roeien (Barbell)', defaultSets: 4, defaultReps: 8  },
    { name: 'Single Arm DB Row',        defaultSets: 3, defaultReps: 10 },
    { name: 'Seated Cable Row',         defaultSets: 3, defaultReps: 12 },
    { name: 'T-Bar Row',                defaultSets: 3, defaultReps: 10 },
    { name: 'Face Pull',                defaultSets: 3, defaultReps: 15 },
    { name: 'Shrugs',                   defaultSets: 3, defaultReps: 12 },
  ],
  'Schouders': [
    { name: 'Military Press (Barbell)', defaultSets: 4, defaultReps: 8  },
    { name: 'Overhead Press (DB)',      defaultSets: 3, defaultReps: 10 },
    { name: 'Arnold Press',             defaultSets: 3, defaultReps: 10 },
    { name: 'Zijwaartse Raise (DB)',    defaultSets: 4, defaultReps: 12 },
    { name: 'Frontale Raise',           defaultSets: 3, defaultReps: 12 },
    { name: 'Achterste Delt Fly',       defaultSets: 3, defaultReps: 15 },
    { name: 'Cable Lateral Raise',      defaultSets: 3, defaultReps: 15 },
    { name: 'Upright Row',              defaultSets: 3, defaultReps: 12 },
    { name: 'Face Pull',                defaultSets: 3, defaultReps: 15 },
  ],
  'Benen': [
    { name: 'Squat (Barbell)',          defaultSets: 4, defaultReps: 8  },
    { name: 'Leg Press',                defaultSets: 4, defaultReps: 12 },
    { name: 'Roemeense Deadlift',       defaultSets: 3, defaultReps: 10 },
    { name: 'Bulgarian Split Squat',    defaultSets: 3, defaultReps: 10 },
    { name: 'Hack Squat',               defaultSets: 3, defaultReps: 12 },
    { name: 'Lunges',                   defaultSets: 3, defaultReps: 12 },
    { name: 'Leg Curl',                 defaultSets: 3, defaultReps: 12 },
    { name: 'Leg Extension',            defaultSets: 3, defaultReps: 12 },
    { name: 'Calf Raise',               defaultSets: 4, defaultReps: 15 },
    { name: 'Hip Thrust',               defaultSets: 3, defaultReps: 12 },
    { name: 'Step-ups',                 defaultSets: 3, defaultReps: 12 },
  ],
  'Biceps': [
    { name: 'Barbell Curl',             defaultSets: 4, defaultReps: 10 },
    { name: 'Hammer Curl',              defaultSets: 3, defaultReps: 12 },
    { name: 'Incline DB Curl',          defaultSets: 3, defaultReps: 12 },
    { name: 'Concentration Curl',       defaultSets: 3, defaultReps: 12 },
    { name: 'Preacher Curl',            defaultSets: 3, defaultReps: 10 },
    { name: 'Cable Curl',               defaultSets: 3, defaultReps: 12 },
    { name: 'Reverse Curl',             defaultSets: 3, defaultReps: 12 },
    { name: 'Spider Curl',              defaultSets: 3, defaultReps: 12 },
  ],
  'Triceps': [
    { name: 'Skull Crusher',            defaultSets: 4, defaultReps: 10 },
    { name: 'Tricep Pushdown (Cable)',  defaultSets: 4, defaultReps: 12 },
    { name: 'Overhead Tricep Extension',defaultSets: 3, defaultReps: 12 },
    { name: 'Close Grip Bench Press',   defaultSets: 3, defaultReps: 10 },
    { name: 'Dips (Triceps)',           defaultSets: 3, defaultReps: 12 },
    { name: 'Diamond Push-ups',         defaultSets: 3, defaultReps: 12 },
    { name: 'Kickbacks',                defaultSets: 3, defaultReps: 15 },
  ],
  'Core': [
    { name: 'Plank',                    defaultSets: 3, defaultReps: 60 },
    { name: 'Crunches',                 defaultSets: 3, defaultReps: 20 },
    { name: 'Russian Twist',            defaultSets: 3, defaultReps: 20 },
    { name: 'Leg Raise',                defaultSets: 3, defaultReps: 15 },
    { name: 'Ab Wheel',                 defaultSets: 3, defaultReps: 10 },
    { name: 'Dead Bug',                 defaultSets: 3, defaultReps: 10 },
    { name: 'Hollow Hold',              defaultSets: 3, defaultReps: 30 },
    { name: 'Cable Crunch',             defaultSets: 3, defaultReps: 15 },
    { name: 'Hanging Knee Raise',       defaultSets: 3, defaultReps: 15 },
    { name: 'Side Plank',               defaultSets: 3, defaultReps: 30 },
  ],
  'Cardio': [
    { name: 'Hardlopen',                defaultSets: 1, defaultReps: 30 },
    { name: 'Stationaire Fiets',        defaultSets: 1, defaultReps: 30 },
    { name: 'Jump Rope',                defaultSets: 5, defaultReps: 60 },
    { name: 'Roeimachine',              defaultSets: 1, defaultReps: 20 },
    { name: 'HIIT',                     defaultSets: 1, defaultReps: 20 },
    { name: 'Crosstrainer',             defaultSets: 1, defaultReps: 30 },
    { name: 'Zwemmen',                  defaultSets: 1, defaultReps: 30 },
    { name: 'Treadmill',                defaultSets: 1, defaultReps: 20 },
  ],
  'Full Body': [
    { name: 'Burpees',                  defaultSets: 4, defaultReps: 10 },
    { name: 'Clean & Press',            defaultSets: 4, defaultReps: 5  },
    { name: 'Kettlebell Swing',         defaultSets: 4, defaultReps: 15 },
    { name: 'Turkish Get-Up',           defaultSets: 3, defaultReps: 5  },
    { name: 'Thrusters',                defaultSets: 4, defaultReps: 8  },
    { name: 'Farmers Walk',             defaultSets: 3, defaultReps: 40 },
    { name: 'Man Makers',               defaultSets: 3, defaultReps: 8  },
    { name: 'Bear Complex',             defaultSets: 3, defaultReps: 5  },
  ],
  'Rust': [],
}

const POPULAR_SPLITS = [
  {
    name: 'Push / Pull / Legs',
    days: ['Borst', 'Rug', 'Benen', 'Rust', 'Schouders', 'Biceps', 'Rust'],
  },
  {
    name: 'Bro Split',
    days: ['Borst', 'Rug', 'Schouders', 'Benen', 'Biceps', 'Triceps', 'Rust'],
  },
  {
    name: 'Upper / Lower',
    days: ['Borst', 'Benen', 'Rug', 'Benen', 'Schouders', 'Core', 'Rust'],
  },
  {
    name: 'Full Body 3x',
    days: ['Full Body', 'Rust', 'Full Body', 'Rust', 'Full Body', 'Rust', 'Rust'],
  },
]

function getMuscleGroupInfo(name) {
  return MUSCLE_GROUPS.find(m => m.name === name) || { name: name || '—', emoji: '🏋️', color: '#6B7280' }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MuscleGroupModal({ onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: 'var(--bg-sidebar)',
        borderRadius: '22px 22px 0 0', border: '1px solid var(--border)',
        borderBottom: 'none', padding: '12px 20px calc(28px + env(safe-area-inset-bottom))',
        animation: 'gymSheetUp 0.28s cubic-bezier(0.34,1.1,0.64,1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 16px' }}>Spiergroep kiezen</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {MUSCLE_GROUPS.map(mg => (
            <button key={mg.name} onClick={() => onSelect(mg.name)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 8px', borderRadius: 16,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 24 }}>{mg.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: mg.color }}>{mg.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExerciseLibraryModal({ muscleGroup, favorites, onToggleFavorite, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(muscleGroup || 'Borst')
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const groups = Object.keys(EXERCISE_LIBRARY).filter(g => g !== 'Rust')
  const base = EXERCISE_LIBRARY[selectedGroup] || []
  const filtered = search.trim()
    ? Object.values(EXERCISE_LIBRARY).flat().filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : base

  // Sort: favorites first
  const sorted = [...filtered].sort((a, b) => {
    const af = favorites.has(a.name), bf = favorites.has(b.name)
    if (af && !bf) return -1
    if (!af && bf) return 1
    return 0
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', height: '80vh',
        background: 'var(--bg-sidebar)', borderRadius: '22px 22px 0 0',
        border: '1px solid var(--border)', borderBottom: 'none',
        display: 'flex', flexDirection: 'column',
        animation: 'gymSheetUp 0.28s cubic-bezier(0.34,1.1,0.64,1)',
      }}>
        {/* Handle + header */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Oefeningen</p>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek oefening..."
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Group tabs */}
          {!search.trim() && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {groups.map(g => {
                const mg = getMuscleGroupInfo(g)
                const active = selectedGroup === g
                return (
                  <button key={g} onClick={() => setSelectedGroup(g)} style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                    background: active ? mg.color : 'var(--bg-card)',
                    border: `1px solid ${active ? mg.color : 'var(--border)'}`,
                    color: active ? '#fff' : 'var(--text-2)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{mg.emoji} {g}</button>
                )
              })}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {sorted.map(ex => {
            const isFav = favorites.has(ex.name)
            return (
              <div key={ex.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 0', borderBottom: '1px solid var(--border)',
              }}>
                <button onClick={() => onToggleFavorite(ex.name)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isFav ? '#FACC15' : 'var(--text-3)', flexShrink: 0,
                }}>
                  <Star size={16} fill={isFav ? '#FACC15' : 'none'} />
                </button>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{ex.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>{ex.defaultSets} sets × {ex.defaultReps} reps</p>
                </div>
                <button onClick={() => onAdd(ex)} style={{
                  padding: '6px 14px', borderRadius: 10,
                  background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                  color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Voeg toe</button>
              </div>
            )
          })}

          {/* Custom exercise */}
          <div style={{ paddingTop: 12 }}>
            {!showCustom ? (
              <button onClick={() => setShowCustom(true)} style={{
                width: '100%', padding: '11px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px dashed var(--border)',
                color: 'var(--text-3)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Plus size={16} /> Eigen oefening toevoegen
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus value={customName} onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) { onAdd({ name: customName.trim(), defaultSets: 3, defaultReps: 10 }); setCustomName(''); setShowCustom(false) } }}
                  placeholder="Naam oefening..."
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 12,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text-1)', fontSize: 14, outline: 'none',
                  }}
                />
                <button onClick={() => { if (customName.trim()) { onAdd({ name: customName.trim(), defaultSets: 3, defaultReps: 10 }); setCustomName(''); setShowCustom(false) } }} style={{
                  padding: '9px 16px', borderRadius: 12,
                  background: 'var(--accent)', border: 'none',
                  color: '#000', fontWeight: 700, cursor: 'pointer',
                }}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkoutModal({ schedule, dayIdx, userId, onClose, onSaved }) {
  const daySchedule = schedule[dayIdx] || {}
  const mg = getMuscleGroupInfo(daySchedule.muscle_group)
  const templateExercises = daySchedule.exercises || []

  const [exercises, setExercises] = useState(() =>
    templateExercises.map(ex => ({
      ...ex,
      sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
        id: i, reps: ex.reps || 10, weight: ex.lastWeight || '', done: false,
      })),
    }))
  )
  const [timerSec, setTimerSec] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => setTimerSec(s => s + 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const toggleSet = (exIdx, setIdx) => {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done }),
    }))
  }

  const updateSet = (exIdx, setIdx, field, val) => {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val }),
    }))
  }

  const addSet = (exIdx) => {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex,
      sets: [...ex.sets, { id: ex.sets.length, reps: ex.sets.at(-1)?.reps || 10, weight: ex.sets.at(-1)?.weight || '', done: false }],
    }))
  }

  const handleFinish = async () => {
    setSaving(true)
    const dateStr = getDayDateStr(dayIdx)
    const logData = {
      user_id: userId,
      date: dateStr,
      muscle_group: daySchedule.muscle_group,
      notes,
      duration_minutes: Math.round(timerSec / 60),
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, done: s.done })),
      })),
    }
    await supabase.from('gym_logs').upsert(logData, { onConflict: 'user_id,date' })

    // Update lastWeight in schedule for next time
    const updatedExercises = (daySchedule.exercises || []).map(ex => {
      const logged = exercises.find(e => e.name === ex.name)
      if (!logged) return ex
      const lastDoneSet = [...logged.sets].reverse().find(s => s.done && s.weight)
      return lastDoneSet ? { ...ex, lastWeight: lastDoneSet.weight } : ex
    })
    await supabase.from('gym_schedule').upsert(
      { user_id: userId, day_of_week: dayIdx, muscle_group: daySchedule.muscle_group, exercises: updatedExercises },
      { onConflict: 'user_id,day_of_week' }
    )

    // Sync to calendar (hele dag event)
    await supabase.from('calendar_events')
      .delete().eq('user_id', userId)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`)
      .like('description', 'gym:%')
    await supabase.from('calendar_events').insert({
      user_id: userId,
      title: `${mg.emoji} ${daySchedule.muscle_group} workout`,
      description: `gym:${dateStr}`,
      start_time: new Date(`${dateStr}T00:00:00`).toISOString(),
      end_time:   new Date(`${dateStr}T23:59:00`).toISOString(),
      color: mg.color,
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  const doneCount = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0)
  const totalSets  = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'var(--bg-base)', display: 'flex', flexDirection: 'column',
      animation: 'gymFadeIn 0.2s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px env(safe-area-inset-top)',
        background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
          <X size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
            {mg.emoji} {daySchedule.muscle_group}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
            {doneCount}/{totalSets} sets klaar
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: 'var(--accent)', fontSize: 14, fontWeight: 700,
        }}>
          <Clock size={14} />
          {formatTime(timerSec)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{
          height: '100%', background: mg.color,
          width: `${totalSets ? (doneCount / totalSets) * 100 : 0}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Exercise list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
        {exercises.map((ex, exIdx) => (
          <div key={ex.name} style={{
            background: 'var(--bg-card)', borderRadius: 16,
            border: '1px solid var(--border)', marginBottom: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 14px 10px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: mg.color, flexShrink: 0 }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-1)', flex: 1 }}>{ex.name}</p>
            </div>
            {/* Set header */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 36px', gap: 8, padding: '8px 14px', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>
              <span>SET</span><span>REPS</span><span>KG</span><span />
            </div>
            {ex.sets.map((set, setIdx) => (
              <div key={set.id} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 1fr 36px', gap: 8,
                padding: '6px 14px', alignItems: 'center',
                background: set.done ? `color-mix(in srgb, ${mg.color} 8%, transparent)` : 'transparent',
                transition: 'background 0.2s',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{setIdx + 1}</span>
                <input
                  type="number" value={set.reps} min={1}
                  onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                  style={{
                    padding: '7px 8px', borderRadius: 8, background: 'var(--bg-base)',
                    border: '1px solid var(--border)', color: 'var(--text-1)',
                    fontSize: 14, fontWeight: 600, textAlign: 'center', outline: 'none',
                  }}
                />
                <input
                  type="number" value={set.weight} min={0} step={0.5}
                  onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                  placeholder="—"
                  style={{
                    padding: '7px 8px', borderRadius: 8, background: 'var(--bg-base)',
                    border: '1px solid var(--border)', color: 'var(--text-1)',
                    fontSize: 14, fontWeight: 600, textAlign: 'center', outline: 'none',
                  }}
                />
                <button onClick={() => toggleSet(exIdx, setIdx)} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: set.done ? mg.color : 'var(--bg-base)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s',
                  border: `1px solid ${set.done ? mg.color : 'var(--border)'}`,
                }}>
                  {set.done && <Check size={14} color="#fff" strokeWidth={2.5} />}
                </button>
              </div>
            ))}
            <button onClick={() => addSet(exIdx)} style={{
              width: '100%', padding: '10px', background: 'none', border: 'none',
              color: 'var(--text-3)', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Plus size={13} /> Set toevoegen
            </button>
          </div>
        ))}

        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notities... (optioneel)"
          rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-1)', fontSize: 14, outline: 'none',
            resize: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Finish button */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
        background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)',
      }}>
        <button onClick={handleFinish} disabled={saving} style={{
          width: '100%', padding: '14px', borderRadius: 16,
          background: mg.color, border: 'none',
          color: '#000', fontSize: 16, fontWeight: 800,
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Check size={18} strokeWidth={3} />
          {saving ? 'Opslaan...' : 'Workout afronden'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GymWidget({ userId }) {
  const [schedule, setSchedule] = useState(Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, muscle_group: null, exercises: [] })))
  const [selectedDay, setSelectedDay] = useState(getNLDay)
  const [favorites, setFavorites] = useState(new Set())
  const [showMGModal, setShowMGModal] = useState(false)
  const [showExModal, setShowExModal] = useState(false)
  const [showWorkout, setShowWorkout] = useState(false)
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [logs, setLogs] = useState({}) // date -> log
  const [loading, setLoading] = useState(true)
  const [syncMsg, setSyncMsg] = useState('')
  const [tab, setTab] = useState('schema') // 'schema' | 'logs'

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [{ data: sched }, { data: favs }, { data: logsData }] = await Promise.all([
      supabase.from('gym_schedule').select('*').eq('user_id', userId),
      supabase.from('gym_favorites').select('exercise_name').eq('user_id', userId),
      supabase.from('gym_logs').select('date,muscle_group,exercises,duration_minutes,notes').eq('user_id', userId).order('date', { ascending: false }).limit(30),
    ])
    const base = Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, muscle_group: null, exercises: [] }))
    if (sched) sched.forEach(row => { base[row.day_of_week] = row })
    setSchedule(base)
    setFavorites(new Set((favs || []).map(f => f.exercise_name)))
    const logMap = {}
    ;(logsData || []).forEach(l => { logMap[l.date] = l })
    setLogs(logMap)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Save schedule for selected day ────────────────────────────────────────
  const saveDay = async (mg, exercises) => {
    const row = { user_id: userId, day_of_week: selectedDay, muscle_group: mg, exercises }
    await supabase.from('gym_schedule').upsert(row, { onConflict: 'user_id,day_of_week' })
    setSchedule(prev => prev.map((d, i) => i === selectedDay ? { ...d, muscle_group: mg, exercises } : d))
  }

  // ── Select muscle group ────────────────────────────────────────────────────
  const handleSelectMG = async (mg) => {
    setShowMGModal(false)
    const currentEx = schedule[selectedDay]?.exercises || []
    await saveDay(mg, currentEx)

    // Remove calendar event for this day if changed to Rust or no group
    const dateStr = getDayDateStr(selectedDay)
    if (!mg || mg === 'Rust') {
      await supabase.from('calendar_events')
        .delete().eq('user_id', userId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .like('description', 'gym:%')
    } else {
      // Upsert calendar event with new muscle group
      const info = getMuscleGroupInfo(mg)
      await supabase.from('calendar_events')
        .delete().eq('user_id', userId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .like('description', 'gym:%')
      await supabase.from('calendar_events').insert({
        user_id: userId,
        title: `${info.emoji} ${mg}`,
        description: `gym:${dateStr}`,
        start_time: new Date(`${dateStr}T00:00:00`).toISOString(),
        end_time:   new Date(`${dateStr}T23:59:00`).toISOString(),
        color: info.color,
      })
    }
  }

  // ── Toggle favorite ────────────────────────────────────────────────────────
  const toggleFavorite = async (name) => {
    const isFav = favorites.has(name)
    if (isFav) {
      await supabase.from('gym_favorites').delete().eq('user_id', userId).eq('exercise_name', name)
      setFavorites(prev => { const s = new Set(prev); s.delete(name); return s })
    } else {
      await supabase.from('gym_favorites').upsert({ user_id: userId, exercise_name: name }, { onConflict: 'user_id,exercise_name' })
      setFavorites(prev => new Set([...prev, name]))
    }
  }

  // ── Add exercise to day ────────────────────────────────────────────────────
  const addExercise = async (ex) => {
    const current = schedule[selectedDay] || {}
    const existing = current.exercises || []
    if (existing.find(e => e.name === ex.name)) return
    const updated = [...existing, { name: ex.name, sets: ex.defaultSets, reps: ex.defaultReps }]
    await saveDay(current.muscle_group, updated)
  }

  // ── Remove exercise from day ───────────────────────────────────────────────
  const removeExercise = async (name) => {
    const current = schedule[selectedDay] || {}
    const updated = (current.exercises || []).filter(e => e.name !== name)
    await saveDay(current.muscle_group, updated)
  }

  // ── Apply split ────────────────────────────────────────────────────────────
  const applySplit = async (split) => {
    setShowSplitModal(false)
    const rows = split.days.map((mg, i) => ({ user_id: userId, day_of_week: i, muscle_group: mg, exercises: [] }))
    await supabase.from('gym_schedule').upsert(rows, { onConflict: 'user_id,day_of_week' })
    setSchedule(prev => prev.map((d, i) => ({ ...d, muscle_group: split.days[i] || null, exercises: [] })))
  }

  // ── Sync week to calendar ─────────────────────────────────────────────────
  const syncToCalendar = async () => {
    const today = new Date()
    const todayNL = getNLDay()
    const events = []
    schedule.forEach((day, i) => {
      if (!day.muscle_group || day.muscle_group === 'Rust') return
      const mg = getMuscleGroupInfo(day.muscle_group)
      const d = new Date(today)
      d.setDate(d.getDate() + (i - todayNL))
      const dateStr = d.toISOString().slice(0, 10)
      events.push({
        user_id: userId,
        title: `${mg.emoji} ${day.muscle_group}`,
        description: `gym:${dateStr}`,
        start_time: new Date(`${dateStr}T00:00:00`).toISOString(),
        end_time:   new Date(`${dateStr}T23:59:00`).toISOString(),
        color: mg.color,
      })
    })
    if (!events.length) { setSyncMsg('Geen trainingsdagen ingepland.'); setTimeout(() => setSyncMsg(''), 3000); return }
    // Remove existing gym events for this week
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - todayNL)
    const weekEnd   = new Date(today); weekEnd.setDate(today.getDate() + (6 - todayNL))
    await supabase.from('calendar_events')
      .delete().eq('user_id', userId)
      .gte('start_time', weekStart.toISOString().slice(0, 10) + 'T00:00:00')
      .lte('start_time', weekEnd.toISOString().slice(0, 10) + 'T23:59:59')
      .like('description', 'gym:%')
    await supabase.from('calendar_events').insert(events)
    setSyncMsg(`${events.length} workouts gesynchroniseerd ✓`)
    setTimeout(() => setSyncMsg(''), 3000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const daySchedule = schedule[selectedDay] || {}
  const mg = getMuscleGroupInfo(daySchedule.muscle_group)
  const dayExercises = daySchedule.exercises || []

  // Sort exercises: favorites first
  const sortedExercises = [...dayExercises].sort((a, b) => {
    const af = favorites.has(a.name), bf = favorites.has(b.name)
    return (af === bf) ? 0 : af ? -1 : 1
  })

  const todayDateStr = getTodayDateStr()
  const todayLog = logs[todayDateStr]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes gymSheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes gymFadeIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin       { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 0 16px', flexShrink: 0 }}>
        {[['schema', 'Schema'], ['logs', 'Logboek']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '9px', borderRadius: 12,
            background: tab === id ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg-card)',
            border: `1px solid ${tab === id ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)'}`,
            color: tab === id ? 'var(--accent)' : 'var(--text-2)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'schema' && (
        <>
          {/* ── Week strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 20 }}>
            {DAYS_NL.map((day, i) => {
              const s = schedule[i]
              const info = getMuscleGroupInfo(s?.muscle_group)
              const active = i === selectedDay
              const isToday = i === getNLDay()
              const hasLog = !!logs[getDayDateStr(i)]
              return (
                <button key={i} onClick={() => setSelectedDay(i)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 14,
                  background: active
                    ? (s?.muscle_group ? `color-mix(in srgb, ${info.color} 15%, transparent)` : 'color-mix(in srgb, var(--accent) 12%, transparent)')
                    : 'var(--bg-card)',
                  border: `1px solid ${active
                    ? (s?.muscle_group ? info.color : 'var(--accent)')
                    : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                }}>
                  <span style={{ fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>{day}</span>
                  <span style={{ fontSize: 18 }}>{s?.muscle_group ? info.emoji : '—'}</span>
                  {hasLog && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: info.color || 'var(--accent)' }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Day header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>{DAYS_FULL[selectedDay]}</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>
                {daySchedule.muscle_group ? `${mg.emoji} ${daySchedule.muscle_group}` : 'Geen training'}
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => setShowMGModal(true)} style={{
                padding: '8px 14px', borderRadius: 12,
                background: daySchedule.muscle_group
                  ? `color-mix(in srgb, ${mg.color} 15%, transparent)`
                  : 'var(--bg-card)',
                border: `1px solid ${daySchedule.muscle_group ? mg.color : 'var(--border)'}`,
                color: daySchedule.muscle_group ? mg.color : 'var(--text-2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {daySchedule.muscle_group ? 'Wijzig' : '+ Kies groep'}
              </button>
            </div>
          </div>

          {/* ── Exercises ── */}
          {daySchedule.muscle_group && daySchedule.muscle_group !== 'Rust' && (
            <>
              {sortedExercises.length === 0 ? (
                <div style={{
                  padding: '28px 16px', borderRadius: 16, textAlign: 'center',
                  background: 'var(--bg-card)', border: '1px dashed var(--border)', marginBottom: 12,
                }}>
                  <Dumbbell size={28} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
                  <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>Nog geen oefeningen</p>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 12 }}>Voeg oefeningen toe uit de bibliotheek</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {sortedExercises.map(ex => {
                    const isFav = favorites.has(ex.name)
                    return (
                      <div key={ex.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 14,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: mg.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{ex.name}</p>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>{ex.sets} sets × {ex.reps} reps</p>
                        </div>
                        <button onClick={() => toggleFavorite(ex.name)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: isFav ? '#FACC15' : 'var(--text-3)',
                        }}>
                          <Star size={16} fill={isFav ? '#FACC15' : 'none'} />
                        </button>
                        <button onClick={() => removeExercise(ex.name)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
                        }}>
                          <X size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <button onClick={() => setShowExModal(true)} style={{
                width: '100%', padding: '11px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px dashed var(--border)',
                color: 'var(--text-3)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 16,
              }}>
                <Plus size={16} /> Oefening toevoegen
              </button>

              {/* Start workout */}
              {sortedExercises.length > 0 && (
                <button onClick={() => setShowWorkout(true)} style={{
                  width: '100%', padding: '15px', borderRadius: 16, border: 'none',
                  background: mg.color, color: '#000', fontSize: 16, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <Play size={18} fill="#000" />
                  Workout starten
                </button>
              )}

              {/* Today log badge */}
              {todayLog && selectedDay === getNLDay() && (
                <div style={{
                  marginTop: 12, padding: '12px 14px', borderRadius: 14,
                  background: 'color-mix(in srgb, #10B981 12%, transparent)',
                  border: '1px solid #10B98133',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Check size={16} color="#10B981" />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#10B981' }}>Vandaag gelogd!</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
                      {todayLog.duration_minutes ? `${todayLog.duration_minutes} min` : ''} {todayLog.exercises?.length || 0} oefeningen
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {daySchedule.muscle_group === 'Rust' && (
            <div style={{
              padding: '32px 16px', borderRadius: 16, textAlign: 'center',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 40 }}>😴</span>
              <p style={{ margin: '12px 0 4px', fontWeight: 700, color: 'var(--text-1)' }}>Rustdag</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Herstel is net zo belangrijk als trainen.</p>
            </div>
          )}

          {!daySchedule.muscle_group && (
            <div style={{
              padding: '28px 16px', borderRadius: 16, textAlign: 'center',
              background: 'var(--bg-card)', border: '1px dashed var(--border)', marginBottom: 16,
            }}>
              <Dumbbell size={28} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
              <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>Geen spiergroep ingesteld</p>
            </div>
          )}

          {/* ── Tools row ── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setShowSplitModal(true)} style={{
              flex: 1, padding: '10px', borderRadius: 12,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Flame size={14} /> Split kiezen
            </button>
            <button onClick={syncToCalendar} style={{
              flex: 1, padding: '10px', borderRadius: 12,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <CalendarPlus size={14} /> Sync agenda
            </button>
          </div>
          {syncMsg && (
            <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 13, color: '#10B981', fontWeight: 600 }}>{syncMsg}</p>
          )}
        </>
      )}

      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.keys(logs).length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
              <Dumbbell size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Nog geen workouts gelogd</p>
            </div>
          ) : (
            Object.entries(logs).map(([date, log]) => {
              const info = getMuscleGroupInfo(log.muscle_group)
              const d = new Date(date)
              const label = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={date} style={{
                  padding: '14px', borderRadius: 16,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${info.color} 20%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {info.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-1)', fontSize: 14 }}>{log.muscle_group}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>{label}</p>
                    </div>
                    {log.duration_minutes && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
                        <Clock size={12} /> {log.duration_minutes} min
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(log.exercises || []).map(ex => (
                      <span key={ex.name} style={{
                        padding: '4px 10px', borderRadius: 8,
                        background: `color-mix(in srgb, ${info.color} 12%, transparent)`,
                        color: info.color, fontSize: 12, fontWeight: 600,
                      }}>{ex.name}</span>
                    ))}
                  </div>
                  {log.notes && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>{log.notes}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showMGModal && <MuscleGroupModal onSelect={handleSelectMG} onClose={() => setShowMGModal(false)} />}
      {showExModal && (
        <ExerciseLibraryModal
          muscleGroup={daySchedule.muscle_group}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onAdd={(ex) => { addExercise(ex); setShowExModal(false) }}
          onClose={() => setShowExModal(false)}
        />
      )}
      {showWorkout && (
        <WorkoutModal
          schedule={schedule} dayIdx={selectedDay}
          userId={userId}
          onClose={() => setShowWorkout(false)}
          onSaved={loadAll}
        />
      )}

      {/* Split modal */}
      {showSplitModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setShowSplitModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: 'var(--bg-sidebar)',
            borderRadius: '22px 22px 0 0', border: '1px solid var(--border)', borderBottom: 'none',
            padding: '12px 20px calc(28px + env(safe-area-inset-bottom))',
            animation: 'gymSheetUp 0.28s cubic-bezier(0.34,1.1,0.64,1)',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 6px' }}>Trainingsschema kiezen</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>Past een schema toe op je volledige week.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {POPULAR_SPLITS.map(split => (
                <button key={split.name} onClick={() => applySplit(split)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px', borderRadius: 14,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{split.name}</p>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {split.days.map((d, i) => {
                        const info = getMuscleGroupInfo(d)
                        return (
                          <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: `color-mix(in srgb, ${info.color} 18%, transparent)`, color: info.color, fontWeight: 600 }}>
                            {DAYS_NL[i]}: {d}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-3)" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
