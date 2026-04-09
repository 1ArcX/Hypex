import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '../supabaseClient'
import { Plus, X, Trash2, Flame, Pencil, Minus, Trophy, Search, ChevronLeft, PauseCircle, PlayCircle, BarChart2, BookOpen } from 'lucide-react'

const EMOJIS = [
  '🏃','📚','💧','🧘','🥗','😴','💪','🎯','✍️','🎨',
  '🎵','🌿','☀️','🚴','🧹','💊','📖','🧠','❤️','🍎',
  '🌙','⚡','🎸','🏊','🤸','💻','🌟','🔥','🫁','🥤',
]
const COLORS = ['#00FFD1','#818CF8','#F59E0B','#EF4444','#10B981','#3B82F6','#EC4899','#8B5CF6']
const DAY_LABELS = ['Ma','Di','Wo','Do','Vr','Za','Zo']
const COUNTER_UNITS = ['glazen','ml','keer','km','minuten',"pagina's"]

// ─── Habit bibliotheek met categorieën ───────────────────────────────────────
const HABIT_CATEGORIES = [
  {
    key: 'trending', label: 'Trending', emoji: '🔥', desc: 'Populaire gewoontes',
    habits: [
      { name: 'Water drinken', icon: '💧', color: '#38BDF8', type: 'counter', unit: 'glazen', target: 8 },
      { name: 'Lezen', icon: '📚', color: '#818CF8', type: 'check' },
      { name: 'Meditatie', icon: '🧘', color: '#A78BFA', type: 'check' },
      { name: 'Journaling', icon: '✍️', color: '#EC4899', type: 'check' },
      { name: 'Geen social media', icon: '📵', color: '#8B5CF6', type: 'check' },
    ],
  },
  {
    key: 'fitness', label: 'Fitness', emoji: '💪', desc: 'Beweeg meer elke dag',
    habits: [
      { name: 'Sporten', icon: '🏃', color: '#10B981', type: 'check' },
      { name: 'Push-ups', icon: '💪', color: '#EF4444', type: 'counter', unit: 'keer', target: 20 },
      { name: 'Wandelen', icon: '☀️', color: '#FACC15', type: 'check' },
      { name: 'Fietsen', icon: '🚴', color: '#00FFD1', type: 'check' },
      { name: 'Zwemmen', icon: '🏊', color: '#38BDF8', type: 'check' },
      { name: 'Stretchen', icon: '🤸', color: '#F59E0B', type: 'check' },
      { name: 'Stappen', icon: '👟', color: '#4ADE80', type: 'counter', unit: 'km', target: 5 },
    ],
  },
  {
    key: 'gezondheid', label: 'Gezondheid', emoji: '❤️', desc: 'Voel je beter',
    habits: [
      { name: 'Gezond eten', icon: '🥗', color: '#4ADE80', type: 'check' },
      { name: 'Goed slapen', icon: '😴', color: '#6366F1', type: 'check' },
      { name: 'Supplementen', icon: '💊', color: '#F59E0B', type: 'check' },
      { name: 'Vroeg opstaan', icon: '⏰', color: '#FACC15', type: 'check' },
      { name: 'Geen alcohol', icon: '🚫', color: '#EF4444', type: 'check' },
      { name: 'Fruit eten', icon: '🍎', color: '#EF4444', type: 'check' },
    ],
  },
  {
    key: 'mindfulness', label: 'Mindfulness', emoji: '🧘', desc: 'Rust in je hoofd',
    habits: [
      { name: 'Meditatie', icon: '🧘', color: '#A78BFA', type: 'check' },
      { name: 'Dankbaarheid', icon: '🙏', color: '#EC4899', type: 'check' },
      { name: 'Ademhaling', icon: '🫁', color: '#38BDF8', type: 'check' },
      { name: 'Dagboek', icon: '📔', color: '#818CF8', type: 'check' },
      { name: 'Natuur in', icon: '🌿', color: '#10B981', type: 'check' },
    ],
  },
  {
    key: 'productiviteit', label: 'Productiviteit', emoji: '🎯', desc: 'Bereik je doelen',
    habits: [
      { name: 'Lezen', icon: '📚', color: '#818CF8', type: 'check' },
      { name: 'Taal leren', icon: '🗣', color: '#F59E0B', type: 'check' },
      { name: 'Studeren', icon: '📖', color: '#6366F1', type: 'check' },
      { name: 'Coderen', icon: '💻', color: '#00FFD1', type: 'check' },
      { name: 'Geen social media', icon: '📵', color: '#8B5CF6', type: 'check' },
      { name: 'Journaling', icon: '✍️', color: '#EC4899', type: 'check' },
      { name: 'Pagina\'s lezen', icon: '📖', color: '#818CF8', type: 'counter', unit: "pagina's", target: 20 },
    ],
  },
]

// ─── Motiverende quotes ───────────────────────────────────────────────────────
const QUOTES = [
  { text: 'Kleine stappen leiden tot grote veranderingen.', author: 'Onbekend' },
  { text: 'Je hoeft niet geweldig te zijn om te beginnen, maar je moet beginnen om geweldig te worden.', author: 'Zig Ziglar' },
  { text: 'Succes is de som van kleine inspanningen, elke dag herhaald.', author: 'Robert Collier' },
  { text: 'Een gewoonte is een draad. Elke dag weef je een draad. Uiteindelijk heb je een touw.', author: 'Onbekend' },
  { text: 'Je bent wat je herhaaldelijk doet. Excellentie is dus geen daad, maar een gewoonte.', author: 'Aristoteles' },
  { text: 'Het moeilijkste is om te beginnen. Dan is de rest slechts doorzetten.', author: 'Onbekend' },
  { text: 'Discipline is kiezen tussen wat je nu wilt en wat je het meest wilt.', author: 'Onbekend' },
  { text: 'Jij bent je eigen superkracht. Gebruik hem.', author: 'Onbekend' },
]

function getDailyQuote() {
  const idx = Math.floor(Date.now() / 86400000) % QUOTES.length
  return QUOTES[idx]
}

// ─── XP + Level ──────────────────────────────────────────────────────────────
const XP_PER_HABIT = 10
const LEVEL_XP = 100

function loadXP() { try { return parseInt(localStorage.getItem('habit_xp') || '0') } catch { return 0 } }
function saveXP(xp) { localStorage.setItem('habit_xp', String(Math.max(0, xp))) }
function getLevel(xp) { return Math.floor(xp / LEVEL_XP) + 1 }
function xpInLevel(xp) { return xp % LEVEL_XP }

// ─── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { key: 'streak_7',  icon: '🔥', title: '7 dagen streak!',   desc: 'Geweldig volgehouden!' },
  { key: 'streak_14', icon: '⚡', title: '2 weken streak!',   desc: 'Je bent niet te stoppen!' },
  { key: 'streak_30', icon: '🏆', title: '30 dagen streak!',  desc: 'Absolute machine.' },
  { key: 'perfect_3', icon: '⭐', title: '3 perfecte dagen!', desc: 'Alles 3 dagen gedaan!' },
  { key: 'perfect_7', icon: '👑', title: 'Perfecte week!',    desc: 'Elke dag alles gedaan!' },
  { key: 'level_5',   icon: '🎯', title: 'Level 5 bereikt!',  desc: '500 XP — lekker bezig!' },
  { key: 'level_10',  icon: '💎', title: 'Level 10 bereikt!', desc: '1000 XP — respect!' },
]

function loadSeenAchievements() {
  try { return new Set(JSON.parse(localStorage.getItem('habit_achievements_seen') || '[]')) } catch { return new Set() }
}
function saveSeenAchievements(s) { localStorage.setItem('habit_achievements_seen', JSON.stringify([...s])) }
function loadPerfectDays() {
  try { return new Set(JSON.parse(localStorage.getItem('habit_perfect_days') || '[]')) } catch { return new Set() }
}
function savePerfectDays(s) { localStorage.setItem('habit_perfect_days', JSON.stringify([...s])) }

async function loadAchievementsCloud(userId) {
  try {
    const { data } = await supabase.from('habit_achievements')
      .select('xp, seen_achievements, perfect_days').eq('user_id', userId).single()
    if (!data) return null
    return { xp: data.xp || 0, seenAchievements: new Set(data.seen_achievements || []), perfectDays: new Set(data.perfect_days || []) }
  } catch { return null }
}

async function saveAchievementsCloud(userId, xp, seenAchievements, perfectDays) {
  if (!userId) return
  const safeXp = Math.max(0, xp)
  try {
    await supabase.from('habit_achievements').upsert({
      user_id: userId, xp: safeXp,
      seen_achievements: [...seenAchievements],
      perfect_days: [...perfectDays],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    supabase.from('profiles').update({ xp: safeXp }).eq('id', userId).then(() => {})
  } catch {}
}

// ─── localStorage ─────────────────────────────────────────────────────────────
function loadCounterConfig() { try { return JSON.parse(localStorage.getItem('habit_counter_config')) || {} } catch { return {} } }
function saveCounterConfig(cfg) { localStorage.setItem('habit_counter_config', JSON.stringify(cfg)) }
function loadCounterValues() { try { return JSON.parse(localStorage.getItem('habit_counter_values')) || {} } catch { return {} } }
function saveCounterValues(vals) { localStorage.setItem('habit_counter_values', JSON.stringify(vals)) }

function loadNote(habitId, date) {
  try { return localStorage.getItem(`habit_note_${habitId}_${date}`) || '' } catch { return '' }
}
function saveNote(habitId, date, text) {
  try { localStorage.setItem(`habit_note_${habitId}_${date}`, text) } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsDayToFreq(jsDay) { return (jsDay + 6) % 7 }
function todayStr() { return new Date().toISOString().slice(0, 10) }

function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function getLast30Days() {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
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

function calcBestStreak(completionSet, habit) {
  const freq = habit.frequency ?? [0, 1, 2, 3, 4, 5, 6]
  let best = 0, cur = 0
  const d = new Date(); d.setDate(d.getDate() - 364)
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10)
    const dayFreq = jsDayToFreq(d.getDay())
    if (freq.includes(dayFreq)) {
      if (completionSet.has(dateStr)) { cur++; best = Math.max(best, cur) }
      else cur = 0
    }
    d.setDate(d.getDate() + 1)
  }
  return best
}

function streakColor(streak) {
  if (streak >= 30) return '#FF3D00'
  if (streak >= 14) return '#FF6B00'
  if (streak >= 7)  return '#FF8C42'
  if (streak >= 3)  return '#FFA040'
  return 'rgba(255,140,66,0.5)'
}

// ─── Toasts & Banners ─────────────────────────────────────────────────────────
function AchievementToast({ achievement, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3800); return () => clearTimeout(t) }, [onDone])
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, animation: 'habitSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderRadius: 18, background: 'rgba(10,10,26,0.97)', backdropFilter: 'blur(24px)', border: '1px solid rgba(250,204,21,0.45)', boxShadow: '0 8px 48px rgba(0,0,0,0.7)', minWidth: 240, maxWidth: 320 }}>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{achievement.icon}</span>
        <div>
          <p style={{ color: '#FACC15', fontWeight: 700, fontSize: 14, margin: 0 }}>{achievement.title}</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '3px 0 0' }}>{achievement.desc}</p>
        </div>
      </div>
      <style>{`@keyframes habitSlideUp { from { opacity:0; transform:translateX(-50%) translateY(24px) scale(0.9); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }`}</style>
    </div>,
    document.body
  )
}

function PerfectDayBanner({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{ margin: '0 0 10px', padding: '12px 16px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,255,209,0.12), rgba(129,140,248,0.12))', border: '1px solid rgba(0,255,209,0.35)', animation: 'habitPop 0.5s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 24 }}>🌟</span>
      <div>
        <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13, margin: 0 }}>Perfecte dag!</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: '2px 0 0' }}>Alle gewoontes van vandaag gedaan 💪</p>
      </div>
      <style>{`@keyframes habitPop { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>
  )
}

// ─── Notitie modal ─────────────────────────────────────────────────────────────
function NoteModal({ habit, date, onClose }) {
  const [text, setText] = useState(() => loadNote(habit.id, date))
  const save = () => { saveNote(habit.id, date, text); onClose() }
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 10001, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 32px' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'rgba(20,20,36,0.98)', borderRadius: '20px 20px 0 0', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{habit.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Notitie voor vandaag</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Hoe ging het? Wat viel je op?"
          rows={4}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', color: 'white', fontSize: 14, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        <button onClick={save} style={{ marginTop: 10, width: '100%', padding: '12px', borderRadius: 14, background: `${habit.color}22`, border: `1px solid ${habit.color}50`, color: habit.color, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Opslaan
        </button>
      </div>
    </div>,
    document.body
  )
}

// ─── Statistieken modal ────────────────────────────────────────────────────────
function HabitDetailModal({ habit, completions, counterConfig, counterValues, onClose }) {
  const set       = completions[habit.id] || new Set()
  const streak    = calcStreak(set, habit)
  const bestStrk  = calcBestStreak(set, habit)
  const last30    = getLast30Days()
  const freq      = habit.frequency ?? [0, 1, 2, 3, 4, 5, 6]

  const scheduledDays = last30.filter(d => freq.includes(jsDayToFreq(new Date(d + 'T12:00:00').getDay())))
  const doneDays      = scheduledDays.filter(d => set.has(d))
  const pct           = scheduledDays.length ? Math.round((doneDays.length / scheduledDays.length) * 100) : 0

  // Group by week for calendar
  const weeks = []
  let week = []
  const firstDay = new Date(last30[0] + 'T12:00:00')
  const startPad = jsDayToFreq(firstDay.getDay())
  for (let i = 0; i < startPad; i++) week.push(null)
  for (const day of last30) {
    week.push(day)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length) weeks.push(week)

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 40px' }}>
        {/* Header */}
        <div style={{ padding: '56px 20px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `${habit.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{habit.icon}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{habit.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Statistieken</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '0 20px 20px' }}>
          {[
            { label: 'Voltooiing', value: `${pct}%`, sub: 'laatste 30 dagen' },
            { label: 'Huidige streak', value: streak, sub: streak === 1 ? 'dag' : 'dagen' },
            { label: 'Beste streak', value: bestStrk, sub: bestStrk === 1 ? 'dag' : 'dagen' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: habit.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Calendar heatmap */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontWeight: 500 }}>Laatste 30 dagen</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {DAY_LABELS.map(l => <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{l}</div>)}
          </div>
          {weeks.map((w, wi) => (
            <div key={wi} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {w.map((day, di) => {
                if (!day) return <div key={di} style={{ flex: 1, aspectRatio: '1', borderRadius: 6 }} />
                const scheduled = freq.includes(jsDayToFreq(new Date(day + 'T12:00:00').getDay()))
                const done = set.has(day)
                return (
                  <div key={day} style={{
                    flex: 1, aspectRatio: '1', borderRadius: 6,
                    background: done ? habit.color : (scheduled ? 'rgba(255,255,255,0.07)' : 'transparent'),
                    boxShadow: done ? `0 0 6px ${habit.color}60` : 'none',
                  }} title={day} />
                )
              })}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: habit.color }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Gedaan</span>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.07)', marginLeft: 8 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Gemist</span>
          </div>
        </div>

        {/* Completion bar */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8, fontWeight: 500 }}>Voltooiing afgelopen 30 dagen</div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: habit.color, borderRadius: 8, transition: 'width 0.6s ease', boxShadow: `0 0 8px ${habit.color}60` }} />
          </div>
          <div style={{ fontSize: 11, color: habit.color, marginTop: 4, textAlign: 'right', fontWeight: 600 }}>{doneDays.length}/{scheduledDays.length} dagen</div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Bibliotheek modal ─────────────────────────────────────────────────────────
function HabitLibraryModal({ onPick, onCreateOwn, onClose }) {
  const [query, setQuery]   = useState('')
  const [catKey, setCatKey] = useState(null)

  const allHabits = HABIT_CATEGORIES.flatMap(c => c.habits.map(h => ({ ...h, _cat: c.label })))
  const results   = query.length > 1
    ? allHabits.filter(h => h.name.toLowerCase().includes(query.toLowerCase()))
    : null

  const activeCat = catKey ? HABIT_CATEGORIES.find(c => c.key === catKey) : null

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#0e0e1a', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '56px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={catKey ? () => setCatKey(null) : onClose}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: 'white', margin: 0 }}>
          {activeCat ? activeCat.label : 'Kies een gewoonte'}
        </h2>
        <div style={{ width: 36 }} />
      </div>

      {/* Search */}
      {!catKey && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '10px 14px' }}>
            <Search size={16} color="rgba(255,255,255,0.35)" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Zoek gewoonte..."
              style={{ background: 'none', border: 'none', color: 'white', fontSize: 15, flex: 1, outline: 'none', fontFamily: 'inherit' }}
              autoFocus
            />
            {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, lineHeight: 0 }}><X size={14} /></button>}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {/* Zoekresultaten */}
        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Geen resultaten</div>
            )}
            {results.map((h, i) => (
              <button key={i} onClick={() => onPick(h)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${h.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{h.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{h._cat}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Categorie habits */}
        {activeCat && !results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeCat.habits.map((h, i) => (
              <button key={i} onClick={() => onPick(h)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${h.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{h.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>{h.name}</div>
                  {h.type === 'counter' && <div style={{ fontSize: 11, color: h.color, marginTop: 2 }}>Doel: {h.target} {h.unit}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>→</div>
              </button>
            ))}
          </div>
        )}

        {/* Categorieën */}
        {!catKey && !results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {HABIT_CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => setCatKey(cat.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.055)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 4 }}>{cat.label}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{cat.desc}</div>
                </div>
                <span style={{ fontSize: 36, lineHeight: 1 }}>{cat.emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create own button */}
      <div style={{ padding: '16px 20px 40px' }}>
        <button onClick={onCreateOwn} style={{ width: '100%', padding: '16px', borderRadius: 18, background: '#F59E0B', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#000' }}>
          Maak zelf een gewoonte
        </button>
      </div>
    </div>,
    document.body
  )
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
function HabitModal({ habit, presetData, onSave, onClose, onDelete, onPause, counterConfig }) {
  const existingConfig = habit ? (counterConfig[habit.id] || {}) : {}
  const p = presetData || {}
  const [name, setName]               = useState(habit?.name || p.name || '')
  const [icon, setIcon]               = useState(habit?.icon || p.icon || '🌟')
  const [color, setColor]             = useState(habit?.color || p.color || '#00FFD1')
  const [frequency, setFrequency]     = useState(habit?.frequency ?? [0, 1, 2, 3, 4, 5, 6])
  const [habitType, setHabitType]     = useState(existingConfig.type || p.type || 'check')
  const [counterUnit, setCounterUnit] = useState(existingConfig.unit || p.unit || 'glazen')
  const [counterTarget, setCounterTarget] = useState(existingConfig.target || p.target || 8)
  const [remindTimes, setRemindTimes] = useState(
    habit?.remind_times && !Array.isArray(habit.remind_times) ? habit.remind_times : {}
  )

  const REMIND_DEFAULTS = { ochtend: '08:00', middag: '13:00', avond: '20:00' }
  const REMIND_OPTIONS  = {
    ochtend: ['06:00','07:00','08:00','09:00','10:00','11:00'],
    middag:  ['11:00','12:00','13:00','14:00','15:00','16:00'],
    avond:   ['17:00','18:00','19:00','20:00','21:00','22:00'],
  }

  const toggleDay = (i) =>
    setFrequency(f => f.includes(i) ? f.filter(d => d !== i) : [...f, i].sort((a, b) => a - b))

  const toggleRemind = (slot) =>
    setRemindTimes(r => slot in r ? (({ [slot]: _, ...rest }) => rest)(r) : { ...r, [slot]: REMIND_DEFAULTS[slot] })

  const setRemindTime = (slot, time) =>
    setRemindTimes(r => ({ ...r, [slot]: time }))

  const handleSave = () => {
    if (!name.trim()) return
    const counterData = habitType === 'counter'
      ? { type: 'counter', unit: counterUnit, target: counterTarget }
      : { type: 'check' }
    onSave({ name: name.trim(), icon, color, frequency, remind_times: remindTimes }, counterData)
  }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>{habit ? 'Bewerken' : 'Nieuwe gewoonte'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Naam */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Naam</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ fontSize: 22, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, flexShrink: 0 }}>{icon}</div>
            <input className="glass-input" placeholder="bijv. Sporten, Lezen…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus style={{ flex: 1, fontSize: 14 }} />
          </div>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', gap: 6, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            {[['check','Aanvinken ✓'],['counter','Teller 🔢']].map(([val, lbl]) => (
              <button key={val} onClick={() => setHabitType(val)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: habitType === val ? `${color}20` : 'transparent', color: habitType === val ? color : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: habitType === val ? 600 : 400, transition: 'all 0.15s' }}>{lbl}</button>
            ))}
          </div>
        </div>

        {habitType === 'counter' && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 4 }}>Eenheid</label>
                <select className="glass-input" value={counterUnit} onChange={e => setCounterUnit(e.target.value)} style={{ fontSize: 12, colorScheme: 'dark', width: '100%' }}>
                  {COUNTER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 4 }}>Doel</label>
                <input type="number" className="glass-input" value={counterTarget} min={1} onChange={e => setCounterTarget(Math.max(1, +e.target.value))} style={{ fontSize: 12, colorScheme: 'dark', width: '100%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Icoon */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Icoon</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setIcon(e)} style={{ fontSize: 17, padding: '4px 0', borderRadius: 8, cursor: 'pointer', background: icon === e ? 'rgba(255,255,255,0.12)' : 'transparent', border: icon === e ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent', transition: 'all 0.1s' }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Kleur */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Kleur</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', background: c, border: color === c ? '2px solid white' : '2px solid transparent', boxShadow: color === c ? `0 0 10px ${c}90` : 'none', transition: 'all 0.15s' }} />
            ))}
          </div>
        </div>

        {/* Herhaling */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Herhaling</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {DAY_LABELS.map((label, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: frequency.includes(i) ? color : 'rgba(255,255,255,0.05)', color: frequency.includes(i) ? '#000' : 'rgba(255,255,255,0.35)', border: frequency.includes(i) ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.07)', boxShadow: frequency.includes(i) ? `0 0 8px ${color}40` : 'none' }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Herinnering */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block', marginBottom: 6 }}>Herinnering <span style={{ opacity: 0.45 }}>(optioneel)</span></label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['ochtend','☀️','Ochtend'],['middag','🌤','Middag'],['avond','🌙','Avond']].map(([slot, emoji, label]) => {
              const active = slot in remindTimes
              return (
                <div key={slot} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button onClick={() => toggleRemind(slot)} style={{ width: '100%', padding: '8px 4px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', background: active ? `${color}18` : 'rgba(255,255,255,0.04)', color: active ? color : 'rgba(255,255,255,0.3)', border: active ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.07)', fontWeight: active ? 600 : 400 }}>
                    <div style={{ fontSize: 16 }}>{emoji}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 9, opacity: 0.55, marginTop: 1 }}>{active ? remindTimes[slot] : REMIND_DEFAULTS[slot]}</div>
                  </button>
                  {active && (
                    <select value={remindTimes[slot]} onChange={e => setRemindTime(slot, e.target.value)} style={{ width: '100%', padding: '5px 4px', borderRadius: 8, fontSize: 11, background: 'rgba(255,255,255,0.06)', color, border: `1px solid ${color}40`, colorScheme: 'dark', textAlign: 'center', cursor: 'pointer' }}>
                      {REMIND_OPTIONS[slot].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Knoppen */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {habit && (
            <>
              <button onClick={() => onDelete(habit.id)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.07)', color: '#FF6B6B', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={14} />
              </button>
              <button onClick={() => onPause(habit)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                {habit.paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                {habit.paused ? 'Hervatten' : 'Pauzeren'}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13 }}>Annuleer</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{ flex: 2, padding: '10px', borderRadius: 10, border: `1px solid ${color}50`, background: `${color}15`, color, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: !name.trim() ? 0.4 : 1 }}>
            {habit ? 'Opslaan' : '+ Toevoegen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────
export default function HabitsWidget({ userId, compact = false, syncTrigger = 0, seamless = false }) {
  const [habits, setHabits]           = useState([])
  const [completions, setCompletions] = useState({})
  const [counterValues, setCounterValues] = useState(() => loadCounterValues())
  const [counterConfig, setCounterConfig] = useState(() => loadCounterConfig())
  const [modalHabit, setModalHabit]   = useState(null)      // null | 'new' | habit
  const [showLibrary, setShowLibrary] = useState(false)
  const [detailHabit, setDetailHabit] = useState(null)
  const [noteHabit, setNoteHabit]     = useState(null)
  const [loading, setLoading]         = useState(true)
  const [animating, setAnimating]     = useState({})
  const [dragIdx, setDragIdx]         = useState(null)

  const [xp, setXpState]                     = useState(loadXP)
  const [pendingAchievement, setPendingAchievement] = useState(null)
  const [showPerfectDay, setShowPerfectDay]   = useState(false)
  const seenAchievementsRef = useRef(loadSeenAchievements())
  const perfectDaysRef      = useRef(loadPerfectDays())
  const channelRef          = useRef(null)
  const ignoreRemoteRef     = useRef(false)

  const today     = todayStr()
  const todayFreq = jsDayToFreq(new Date().getDay())
  const quote     = getDailyQuote()

  const todayHabits = habits.filter(h =>
    !h.paused && (h.frequency ?? [0,1,2,3,4,5,6]).includes(todayFreq)
  )
  const otherHabits = habits.filter(h =>
    !h.paused && !(h.frequency ?? [0,1,2,3,4,5,6]).includes(todayFreq)
  )
  const pausedHabits = habits.filter(h => h.paused)

  function isHabitDone(habit) {
    const cfg = counterConfig[habit.id]
    if (cfg?.type === 'counter') return (counterValues[habit.id]?.[today] || 0) >= (cfg.target || 1)
    return completions[habit.id]?.has(today) || false
  }

  const doneToday    = todayHabits.filter(h => isHabitDone(h)).length
  const level        = getLevel(xp)
  const xpProgress   = xpInLevel(xp)
  const perfectTotal = perfectDaysRef.current.size

  // Week completion %
  const last7 = getLast7Days()
  const weekScheduled = last7.reduce((acc, d) => {
    const df = jsDayToFreq(new Date(d + 'T12:00:00').getDay())
    return acc + habits.filter(h => !h.paused && (h.frequency ?? [0,1,2,3,4,5,6]).includes(df)).length
  }, 0)
  const weekDone = last7.reduce((acc, d) => {
    return acc + habits.filter(h => !h.paused && (completions[h.id] || new Set()).has(d)).length
  }, 0)
  const weekPct = weekScheduled ? Math.round((weekDone / weekScheduled) * 100) : 0

  const [activeTab, setActiveTab] = useState(() => {
    const h = new Date().getHours()
    if (h < 12) return 'ochtend'
    if (h < 17) return 'middag'
    return 'avond'
  })

  // ── Perfect day check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!todayHabits.length || loading) return
    const allDone = todayHabits.every(h => isHabitDone(h))
    if (allDone && !perfectDaysRef.current.has(today)) {
      perfectDaysRef.current.add(today)
      savePerfectDays(perfectDaysRef.current)
      setShowPerfectDay(true)
      const recentPerfect = [...perfectDaysRef.current].filter(d => {
        const ago = new Date(); ago.setDate(ago.getDate() - 7)
        return d >= ago.toISOString().slice(0, 10)
      }).length
      const achKey = recentPerfect >= 7 ? 'perfect_7' : recentPerfect >= 3 ? 'perfect_3' : null
      if (achKey && !seenAchievementsRef.current.has(achKey)) {
        seenAchievementsRef.current.add(achKey)
        saveSeenAchievements(seenAchievementsRef.current)
        setTimeout(() => setPendingAchievement(ACHIEVEMENTS.find(a => a.key === achKey)), 1500)
      }
      saveAchievementsCloud(userId, loadXP(), seenAchievementsRef.current, perfectDaysRef.current)
    }
  }, [completions, counterValues]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHabits = useCallback(async () => {
    const { data } = await supabase.from('habits').select('*')
      .eq('user_id', userId).eq('archived', false)
      .order('sort_order').order('created_at')
    setHabits(data || [])
  }, [userId])

  const fetchCompletions = useCallback(async () => {
    const from = new Date(); from.setDate(from.getDate() - 60)
    const { data } = await supabase.from('habit_completions').select('habit_id, date')
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

  useEffect(() => {
    if (!userId) return
    loadAchievementsCloud(userId).then(cloud => {
      if (!cloud) return
      const bestXp = Math.max(loadXP(), cloud.xp)
      saveXP(bestXp); setXpState(bestXp)
      const mergedSeen = new Set([...seenAchievementsRef.current, ...cloud.seenAchievements])
      seenAchievementsRef.current = mergedSeen; saveSeenAchievements(mergedSeen)
      const mergedDays = new Set([...perfectDaysRef.current, ...cloud.perfectDays])
      perfectDaysRef.current = mergedDays; savePerfectDays(mergedDays)
    })
  }, [userId])

  useEffect(() => {
    if (syncTrigger === 0 || !userId) return
    fetchHabits(); fetchCompletions()
  }, [syncTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime sync
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`habits:${userId}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'counter_config' }, ({ payload }) => {
        if (ignoreRemoteRef.current) return
        const merged = { ...loadCounterConfig(), ...payload }
        setCounterConfig(merged); saveCounterConfig(merged)
      })
      .on('broadcast', { event: 'counter_values' }, ({ payload }) => {
        if (ignoreRemoteRef.current) return
        const merged = { ...loadCounterValues(), ...payload }
        setCounterValues(merged); saveCounterValues(merged)
      })
      .on('broadcast', { event: 'request_state' }, () => {
        channel.send({ type: 'broadcast', event: 'counter_config', payload: loadCounterConfig() })
        channel.send({ type: 'broadcast', event: 'counter_values', payload: loadCounterValues() })
      })
      .subscribe(() => { channel.send({ type: 'broadcast', event: 'request_state', payload: {} }) })
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const broadcastConfig = useCallback((cfg) => {
    if (!channelRef.current) return
    ignoreRemoteRef.current = true
    channelRef.current.send({ type: 'broadcast', event: 'counter_config', payload: cfg })
    setTimeout(() => { ignoreRemoteRef.current = false }, 200)
  }, [])

  const broadcastValues = useCallback((vals) => {
    if (!channelRef.current) return
    ignoreRemoteRef.current = true
    channelRef.current.send({ type: 'broadcast', event: 'counter_values', payload: vals })
    setTimeout(() => { ignoreRemoteRef.current = false }, 200)
  }, [])

  const awardXP = useCallback((delta) => {
    const current = loadXP()
    const newXp = Math.max(0, current + delta)
    saveXP(newXp); setXpState(newXp)
    if (delta > 0) {
      const oldLevel = getLevel(current), newLevel = getLevel(newXp)
      if (newLevel > oldLevel) {
        localStorage.setItem('levelup_pending', JSON.stringify({ newLevel, oldLevel }))
        window.dispatchEvent(new Event('levelup'))
        const ach = ACHIEVEMENTS.find(a => a.key === `level_${newLevel}`)
        if (ach && !seenAchievementsRef.current.has(ach.key)) {
          seenAchievementsRef.current.add(ach.key)
          saveSeenAchievements(seenAchievementsRef.current)
          setTimeout(() => setPendingAchievement(ach), 400)
        }
      }
    }
    saveAchievementsCloud(userId, newXp, seenAchievementsRef.current, perfectDaysRef.current)
  }, [userId])

  const toggleCompletion = async (habit, skipNote = false) => {
    setAnimating(a => ({ ...a, [habit.id]: true }))
    setTimeout(() => setAnimating(a => ({ ...a, [habit.id]: false })), 350)
    const set  = completions[habit.id] || new Set()
    const done = set.has(today)
    const next = new Set(set)
    if (done) next.delete(today); else next.add(today)
    setCompletions(c => ({ ...c, [habit.id]: next }))

    if (!done) {
      awardXP(XP_PER_HABIT)
      await supabase.from('habit_completions').insert({ habit_id: habit.id, user_id: userId, date: today })
      // Prompt for note
      if (!skipNote) setNoteHabit(habit)
      const streak = calcStreak(next, habit)
      for (const n of [7, 14, 30]) {
        if (streak === n) {
          const ach = ACHIEVEMENTS.find(a => a.key === `streak_${n}`)
          if (ach && !seenAchievementsRef.current.has(ach.key)) {
            seenAchievementsRef.current.add(ach.key)
            saveSeenAchievements(seenAchievementsRef.current)
            saveAchievementsCloud(userId, loadXP(), seenAchievementsRef.current, perfectDaysRef.current)
            setPendingAchievement(ach)
          }
        }
      }
    } else {
      awardXP(-XP_PER_HABIT)
      await supabase.from('habit_completions').delete()
        .eq('habit_id', habit.id).eq('user_id', userId).eq('date', today)
    }
  }

  const adjustCounter = (habit, delta) => {
    const cfg     = counterConfig[habit.id]
    const current = counterValues[habit.id]?.[today] || 0
    const newCount = Math.max(0, current + delta)
    const newVals = { ...counterValues, [habit.id]: { ...(counterValues[habit.id] || {}), [today]: newCount } }
    setCounterValues(newVals); saveCounterValues(newVals); broadcastValues(newVals)
    const target = cfg?.target || 1
    const wasDone = current >= target, isDone = newCount >= target
    const xpDelta = Math.floor(XP_PER_HABIT * Math.min(newCount, target) / target) - Math.floor(XP_PER_HABIT * Math.min(current, target) / target)
    if (xpDelta !== 0) awardXP(xpDelta)
    if (!wasDone && isDone) {
      supabase.from('habit_completions').insert({ habit_id: habit.id, user_id: userId, date: today }).then(() => {})
      setCompletions(c => { const s = new Set(c[habit.id] || []); s.add(today); return { ...c, [habit.id]: s } })
    } else if (wasDone && !isDone) {
      supabase.from('habit_completions').delete().eq('habit_id', habit.id).eq('user_id', userId).eq('date', today).then(() => {})
      setCompletions(c => { const s = new Set(c[habit.id] || []); s.delete(today); return { ...c, [habit.id]: s } })
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
    if (habitId) {
      const newCfg = { ...counterConfig, [habitId]: counterData }
      setCounterConfig(newCfg); saveCounterConfig(newCfg); broadcastConfig(newCfg)
    }
    setModalHabit(null); fetchHabits()
  }

  const deleteHabit = async (id) => {
    await supabase.from('habits').update({ archived: true }).eq('id', id)
    setModalHabit(null); fetchHabits()
  }

  const pauseHabit = async (habit) => {
    await supabase.from('habits').update({ paused: !habit.paused }).eq('id', habit.id)
    setModalHabit(null); fetchHabits()
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDragStart = (idx) => setDragIdx(idx)
  const onDragOver  = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newHabits = [...habits]
    const [moved]   = newHabits.splice(dragIdx, 1)
    newHabits.splice(idx, 0, moved)
    setHabits(newHabits)
    setDragIdx(idx)
  }
  const onDrop = async () => {
    setDragIdx(null)
    // Save new order
    const updates = habits.map((h, i) => supabase.from('habits').update({ sort_order: i }).eq('id', h.id))
    await Promise.all(updates)
  }

  // ── Compact mode ───────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className={seamless ? '' : 'glass-card'} style={{ padding: '14px 16px', ...(seamless ? {} : { borderLeft: '3px solid rgba(34,197,94,0.45)', background: 'linear-gradient(135deg, rgba(34,197,94,0.05) 0%, transparent 60%)' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {!seamless && <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Gewoontes</span>}
          {todayHabits.length > 0 && <span style={{ fontSize: 11, color: doneToday === todayHabits.length ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{doneToday}/{todayHabits.length}</span>}
        </div>
        {todayHabits.length > 0 && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(doneToday / todayHabits.length) * 100}%`, background: doneToday === todayHabits.length ? 'linear-gradient(90deg, var(--accent), #818CF8)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        )}
        {loading ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Laden...</div> :
          todayHabits.length === 0 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '4px 0' }}>Geen gewoontes voor vandaag</div> :
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {todayHabits.slice(0, 6).map(habit => {
              const done = isHabitDone(habit)
              const cfg  = counterConfig[habit.id]
              const count = cfg?.type === 'counter' ? (counterValues[habit.id]?.[today] || 0) : null
              return (
                <div key={habit.id} onClick={() => cfg?.type === 'counter' ? adjustCounter(habit, 1) : toggleCompletion(habit, true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, cursor: 'pointer', background: done ? `${habit.color}18` : 'rgba(255,255,255,0.05)', border: done ? `1px solid ${habit.color}40` : '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 14 }}>{habit.icon}</span>
                  {cfg?.type === 'counter' ? <span style={{ fontSize: 11, color: done ? habit.color : 'rgba(255,255,255,0.5)' }}>{count}/{cfg.target}</span> : done && <span style={{ fontSize: 11, color: habit.color }}>✓</span>}
                </div>
              )
            })}
          </div>
        }
      </div>
    )
  }

  // ── Full render ────────────────────────────────────────────────────────────
  function habitSlot(habit) {
    const rt = habit.remind_times
    if (!rt || typeof rt !== 'object' || Array.isArray(rt)) return null
    for (const slot of ['ochtend', 'middag', 'avond']) { if (slot in rt) return slot }
    return null
  }

  const altijdHabits = todayHabits.filter(h => !habitSlot(h))
  const slotHabits   = {
    ochtend: todayHabits.filter(h => habitSlot(h) === 'ochtend'),
    middag:  todayHabits.filter(h => habitSlot(h) === 'middag'),
    avond:   todayHabits.filter(h => habitSlot(h) === 'avond'),
  }
  const TABS = [{ key: 'ochtend', label: 'Ochtend' }, { key: 'middag', label: 'Middag' }, { key: 'avond', label: 'Avond' }]

  function HabitCard({ habit, idx }) {
    const set       = completions[habit.id] || new Set()
    const streak    = calcStreak(set, habit)
    const bounce    = animating[habit.id]
    const cfg       = counterConfig[habit.id]
    const isCounter = cfg?.type === 'counter'
    const count     = isCounter ? (counterValues[habit.id]?.[today] || 0) : 0
    const target    = isCounter ? (cfg.target || 1) : 1
    const done      = isHabitDone(habit)
    const note      = loadNote(habit.id, today)

    const subLine = done
      ? (note ? `📝 ${note.slice(0, 32)}${note.length > 32 ? '…' : ''}` : '✓ Gedaan vandaag')
      : streak > 0 ? `🔥 ${streak} ${streak === 1 ? 'dag' : 'dagen'} op rij`
      : '⭐ Ga ervoor!'

    return (
      <div
        draggable
        onDragStart={() => onDragStart(idx)}
        onDragOver={e => onDragOver(e, idx)}
        onDrop={onDrop}
        onClick={() => !isCounter && toggleCompletion(habit)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', borderRadius: 18,
          background: done ? `${habit.color}12` : 'rgba(255,255,255,0.055)',
          cursor: isCounter ? 'default' : 'pointer',
          transition: 'background 0.25s, opacity 0.2s',
          transform: bounce ? 'scale(0.98)' : 'scale(1)',
          opacity: dragIdx !== null && dragIdx !== idx ? 0.5 : 1,
        }}
      >
        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, background: `${habit.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, transform: bounce ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.2s' }}>
          {habit.icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2, color: done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)', textDecoration: done && !isCounter ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {habit.name}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{subLine}</div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Stats button */}
          <button onClick={e => { e.stopPropagation(); setDetailHabit(habit) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.18)', padding: '4px', lineHeight: 0 }}>
            <BarChart2 size={13} />
          </button>

          {isCounter ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ minWidth: 58, padding: '7px 10px', borderRadius: 13, background: done ? `${habit.color}25` : 'rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <span style={{ fontSize: 19, fontWeight: 700, color: done ? habit.color : 'white' }}>{count}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>/{target}</span>
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{cfg.unit}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); adjustCounter(habit, -1) }}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.45)' }}>
                  <Minus size={11} />
                </button>
                <button onClick={e => { e.stopPropagation(); adjustCounter(habit, 1) }}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${habit.color}60`, background: `${habit.color}20`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: habit.color }}>
                  <Plus size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div onClick={e => { e.stopPropagation(); toggleCompletion(habit) }}
                style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', border: `2px solid ${done ? habit.color : 'rgba(255,255,255,0.2)'}`, background: done ? habit.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.22s', boxShadow: done ? `0 0 14px ${habit.color}55` : 'none', transform: bounce ? 'scale(1.25)' : 'scale(1)' }}>
                {done && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              {/* Note icon */}
              <button onClick={e => { e.stopPropagation(); setNoteHabit(habit) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: note ? habit.color : 'rgba(255,255,255,0.18)', padding: 0, lineHeight: 0 }}>
                <BookOpen size={11} />
              </button>
            </div>
          )}

          {/* Edit */}
          <button onClick={e => { e.stopPropagation(); setModalHabit(habit) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.18)', padding: '4px', lineHeight: 0 }}>
            <Pencil size={12} />
          </button>
        </div>
      </div>
    )
  }

  function SectionHeader({ label }) {
    return <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.3)', padding: '10px 4px 5px', letterSpacing: '0.03em' }}>{label}</div>
  }

  const activeSlotHabits = slotHabits[activeTab] || []

  return (
    <>
      <div style={{ paddingBottom: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>Gewoontes</span>
            {todayHabits.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: doneToday === todayHabits.length ? '#22C55E' : 'rgba(255,255,255,0.4)' }}>
                {doneToday}/{todayHabits.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: 'rgba(250,204,21,0.07)' }}>
              <Trophy size={10} color="#FACC15" />
              <span style={{ fontSize: 11, color: '#FACC15', fontWeight: 600 }}>Lvl {level}</span>
            </div>
            <button onClick={() => setShowLibrary(true)} style={{ width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: weekPct >= 80 ? '#22C55E' : weekPct >= 50 ? '#F59E0B' : 'rgba(255,255,255,0.8)' }}>{weekPct}%</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Deze week</div>
          </div>
          <div style={{ flex: 1, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FACC15' }}>⭐ {perfectTotal}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Perfecte dagen</div>
          </div>
          <div style={{ flex: 2, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              "{quote.text}"
            </div>
          </div>
        </div>

        {/* Progress bars */}
        {todayHabits.length > 0 && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(doneToday / todayHabits.length) * 100}%`, background: doneToday === todayHabits.length ? 'linear-gradient(90deg, #22C55E, #818CF8)' : '#22C55E', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        )}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${(xpProgress / LEVEL_XP) * 100}%`, background: 'linear-gradient(90deg, #FACC15, #F59E0B)', borderRadius: 4, transition: 'width 0.6s' }} />
        </div>

        {/* Time tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '7px 18px', borderRadius: 22, border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 14, flexShrink: 0, transition: 'all 0.18s', background: activeTab === tab.key ? 'rgba(255,255,255,0.14)' : 'transparent', color: activeTab === tab.key ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {showPerfectDay && <PerfectDayBanner onDone={() => setShowPerfectDay(false)} />}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div className="animate-spin" style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
          </div>
        )}

        {!loading && habits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>Nog geen gewoontes</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, margin: 0 }}>Tik op + om te beginnen</p>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Altijd */}
            {altijdHabits.length > 0 && (
              <>
                <SectionHeader label="Altijd" />
                {altijdHabits.map((habit, idx) => <HabitCard key={habit.id} habit={habit} idx={idx} />)}
              </>
            )}

            {/* Tijdslot */}
            {activeSlotHabits.length > 0 && (
              <>
                <SectionHeader label={{ ochtend: 'Ochtend', middag: 'Middag', avond: 'Avond' }[activeTab]} />
                {activeSlotHabits.map((habit, idx) => <HabitCard key={habit.id} habit={habit} idx={altijdHabits.length + idx} />)}
              </>
            )}

            {altijdHabits.length === 0 && activeSlotHabits.length === 0 && todayHabits.length > 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                Geen gewoontes voor {TABS.find(t => t.key === activeTab)?.label.toLowerCase()}
              </div>
            )}

            {/* Niet vandaag */}
            {otherHabits.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <SectionHeader label="Niet vandaag" />
                {otherHabits.map(habit => (
                  <div key={habit.id} onClick={() => setModalHabit(habit)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 18, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', opacity: 0.4, marginBottom: 6 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{habit.icon}</div>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{habit.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{(habit.frequency ?? []).map(d => DAY_LABELS[d]).join(' ')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gepauzeerd */}
            {pausedHabits.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <SectionHeader label="Gepauzeerd ⏸" />
                {pausedHabits.map(habit => (
                  <div key={habit.id} onClick={() => setModalHabit(habit)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 18, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', opacity: 0.35, marginBottom: 6 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{habit.icon}</div>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{habit.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>gepauzeerd</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Library modal */}
      {showLibrary && (
        <HabitLibraryModal
          onPick={preset => { setShowLibrary(false); setModalHabit({ _preset: preset }) }}
          onCreateOwn={() => { setShowLibrary(false); setModalHabit('new') }}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Edit / create modal */}
      {modalHabit !== null && modalHabit !== 'new' && !modalHabit._preset && (
        <HabitModal
          habit={modalHabit}
          counterConfig={counterConfig}
          onSave={saveHabit}
          onClose={() => setModalHabit(null)}
          onDelete={deleteHabit}
          onPause={pauseHabit}
        />
      )}
      {(modalHabit === 'new' || modalHabit?._preset) && (
        <HabitModal
          habit={null}
          presetData={modalHabit?._preset}
          counterConfig={counterConfig}
          onSave={saveHabit}
          onClose={() => setModalHabit(null)}
          onDelete={deleteHabit}
          onPause={() => {}}
        />
      )}

      {detailHabit && (
        <HabitDetailModal
          habit={detailHabit}
          completions={completions}
          counterConfig={counterConfig}
          counterValues={counterValues}
          onClose={() => setDetailHabit(null)}
        />
      )}

      {noteHabit && (
        <NoteModal
          habit={noteHabit}
          date={today}
          onClose={() => setNoteHabit(null)}
        />
      )}

      {pendingAchievement && (
        <AchievementToast achievement={pendingAchievement} onDone={() => setPendingAchievement(null)} />
      )}
    </>
  )
}
