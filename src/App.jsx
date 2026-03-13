import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './components/AuthPage'
import Clock from './components/Clock'
import Timeline from './components/Timeline'
import TaskModal from './components/TaskModal'
import TaskDetailModal from './components/TaskDetailModal'
import NotesWidget from './components/NotesWidget'
import WeatherWidget from './components/WeatherWidget'
import PomodoroTimer from './components/PomodoroTimer'
import { LogOut, GraduationCap, Home, CalendarDays, CheckSquare, Layers, FileText, Flame, GripVertical, RefreshCw } from 'lucide-react'
import SpotifyWidget from './components/SpotifyWidget'
import ThemeSettings from './components/ThemeSettings'
import { Settings } from 'lucide-react'
import AdminPanel from './components/AdminPanel'
import TasksWidget from './components/TasksWidget'
import MagisterWidget from './components/MagisterWidget'
import HabitsWidget from './components/HabitsWidget'
import PasswordResetPage from './components/PasswordResetPage'
import OnboardingModal from './components/OnboardingModal'
import { Shield } from 'lucide-react'

const ADMIN_EMAIL = 'zhafirfachri@gmail.com'

function DraggableWidget({ id, col, index, onDragStart, onDragEnd, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      <div
        draggable
        onDragStart={(e) => onDragStart(e, col, index, id)}
        onDragEnd={onDragEnd}
        style={{
          position: 'absolute', top: 10, right: 10,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          cursor: 'grab',
          color: 'rgba(255,255,255,0.4)',
          padding: '2px',
          borderRadius: '4px',
          background: 'rgba(0,0,0,0.3)',
          zIndex: 20,
          lineHeight: 0,
        }}
        title="Versleep widget"
      >
        <GripVertical size={16} />
      </div>
    </div>
  )
}

function DropZone({ col, index, dropTarget, onDragOver, onDragLeave, onDrop }) {
  const key = `${col}:${index}`
  const active = dropTarget === key
  return (
    <div
      onDragOver={(e) => onDragOver(e, col, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, col, index)}
      style={{
        height: active ? 56 : 16,
        transition: 'height 0.15s ease',
        borderRadius: 8,
        border: active ? '2px dashed var(--accent)' : '2px solid transparent',
        background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
        flexShrink: 0,
      }}
    />
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [tasks, setTasks] = useState([])
  const [subjects, setSubjects] = useState([])
  const [isBreak, setIsBreak] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [defaultTime, setDefaultTime] = useState('09:00')
  const [defaultDate, setDefaultDate] = useState('')
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  const [theme, setTheme] = useState({ accent: '#00FFD1', bg1: '#0a0a1a', bg2: '#0d1117' })
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)
  const [mobileTab, setMobileTab] = useState('home')
  const [toolTab, setToolTab]     = useState('weer')
  const [takenTab, setTakenTab]   = useState('taken')
  const [magisterLessons, setMagisterLessons] = useState([])
  const [calendarEvents, setCalendarEvents]   = useState([])
  const [magisterError, setMagisterError]     = useState(null)
  const [detailTask, setDetailTask]           = useState(null)
  const [subjectLinks, setSubjectLinks]       = useState({})
  const [nextEventSkip, setNextEventSkip]     = useState(0)
  const [showPwaPrompt, setShowPwaPrompt]     = useState(false)
  const [homeRain, setHomeRain]               = useState(null)
  const [showOnboarding, setShowOnboarding]   = useState(false)
  const [syncTrigger, setSyncTrigger]         = useState(0)
  const [syncing, setSyncing]                 = useState(false)
  const [syncFlash, setSyncFlash]             = useState(false)

  // Reset skip counter when switching to home tab
  useEffect(() => { if (mobileTab === 'home') setNextEventSkip(0) }, [mobileTab])

  // Fetch rain data for home screen
  useEffect(() => {
    if (!session) return
    const fetchHomeRain = async () => {
      try {
        const stored = localStorage.getItem('weather_coords')
        const { lat, lon } = stored ? JSON.parse(stored) : { lat: 52.52, lon: 5.72 }
        const res = await fetch(
          `https://cdn-secure.buienalarm.nl/api/3.4/forecast.php?lat=${lat}&lon=${lon}&region=nl&unit=mm/u`
        )
        const json = await res.json()
        if (!json?.precip?.length) return
        setHomeRain(json.precip.map((precip, i) => {
          const d = new Date((json.start + i * json.delta) * 1000)
          return {
            precip: isNaN(precip) ? 0 : precip,
            time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
          }
        }))
      } catch {}
    }
    fetchHomeRain()
    const iv = setInterval(fetchHomeRain, 10 * 60 * 1000)
    return () => clearInterval(iv)
  }, [session])

  // Drag-and-drop widget order
  const DEFAULT_LEFT  = ['habits', 'notes', 'tasks']
  const DEFAULT_RIGHT = ['weather', 'spotify', 'pomodoro']
  const [widgetOrder, setWidgetOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('widget_order'))
      if (saved?.left?.length && saved?.right?.length) return saved
    } catch {}
    return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT }
  })
  const dragState = useRef({ sourceColumn: null, sourceIndex: null, widgetId: null })
  const [dropTarget, setDropTarget] = useState(null)

  // ✅ FIX: user vroeg beschikbaar via useMemo (geen undefined bij vakken/kalender)
  const user = useMemo(() => session?.user || null, [session])
  const isAdmin = user?.email === ADMIN_EMAIL

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) console.error('Error fetching profiles:', error)
    else {
      const rows = data || []
      setProfiles(rows)
      // Auto-create profile for new users
      if (user?.id && !rows.find(p => p.id === user.id)) {
        await supabase.from('profiles').upsert({ id: user.id, full_name: user.email?.split('@')[0] || 'Student' })
        fetchProfiles()
      }
    }
  }

  // Onboarding: toon bij eerste login als locatie of Magister niet is ingesteld
  useEffect(() => {
    if (!user) return
    const done = localStorage.getItem(`onboarding_done_${user.id}`)
    if (!done) {
      const needsLocation = !localStorage.getItem('weather_coords')
      const needsMagister = !localStorage.getItem('magister_credentials')
      if (needsLocation || needsMagister) setShowOnboarding(true)
    }
  }, [user])

  // ✅ FIX: mounted flag voorkomt state-update na unmount
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(session)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Load data
  useEffect(() => {
    if (session && user?.id) {
      fetchTasks(); fetchSubjects(); fetchProfiles(); fetchSubjectLinks()
      // Fetch today's calendar events for home screen "next event"
      supabase.from('calendar_events').select('*').eq('user_id', user.id).then(({ data }) => {
        if (data) setCalendarEvents(data)
      })
    }
  }, [session, user?.id])

  // ✅ FIX: useMemo voor userProfile (geen stale closure)
  const userProfile = useMemo(() => {
    if (!user?.id) return null
    return profiles.find(p => p.id === user.id) || null
  }, [profiles, user?.id])


  // Effect voor accent kleur
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', theme.accent)
  }, [theme.accent])

  useEffect(() => {
    const handler = () => { if (user?.id) fetchTasks() }
    window.addEventListener('refreshTasks', handler)
    return () => window.removeEventListener('refreshTasks', handler)
  }, [user?.id])

  // Auto-sync elke 30 seconden
  const doSync = useCallback(async () => {
    if (!user?.id) return
    setSyncing(true)
    await Promise.all([
      fetchTasks(),
      fetchSubjects(),
      supabase.from('calendar_events').select('*').eq('user_id', user.id).then(({ data }) => {
        if (data) setCalendarEvents(data)
      }),
    ])
    setSyncTrigger(t => t + 1)
    setSyncing(false)
    setSyncFlash(true)
    setTimeout(() => setSyncFlash(false), 2000)
  }, [user?.id])

  useEffect(() => {
    if (!session || !user?.id) return
    const interval = setInterval(doSync, 30000)
    return () => clearInterval(interval)
  }, [session, user?.id, doSync])

  const fetchTasks = async () => {
    if (!user?.id) return
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('date', { ascending: true })
    if (error) console.error(error)
    setTasks(data || [])
  }

  const fetchSubjects = async () => {
    if (!user?.id) return
    const { data, error } = await supabase.from('subjects').select('*').eq('user_id', user.id).order('name', { ascending: true })
    if (error) console.error(error)
    const rows = data || []
    // Dedup: keep first row per name, delete the rest
    const seen = new Set()
    const toDelete = []
    for (const s of rows) {
      if (seen.has(s.name)) toDelete.push(s.id)
      else seen.add(s.name)
    }
    if (toDelete.length > 0) {
      await supabase.from('subjects').delete().in('id', toDelete)
      const { data: clean } = await supabase.from('subjects').select('*').eq('user_id', user.id).order('name', { ascending: true })
      setSubjects(clean || [])
    } else {
      setSubjects(rows)
    }
  }

  const fetchSubjectLinks = async () => {
    const { data } = await supabase.from('subject_links').select('vak_naam, url')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.vak_naam] = row.url })
      setSubjectLinks(map)
    }
  }

  const handleSaveTask = async (taskData) => {
    if (!user?.id) return
    const fields = {
      title: taskData.title,
      description: taskData.description || null,
      time: taskData.time || taskData.start_time,
      date: taskData.date || null,
      start_time: taskData.start_time || null,
      end_time: taskData.end_time || null,
      subject_id: taskData.subject_id || null,
      completed: taskData.completed ?? false
    }
    let error
    if (taskData.id) {
      ({ error } = await supabase.from('tasks').update(fields).eq('id', taskData.id).eq('user_id', user.id))
    } else {
      ({ error } = await supabase.from('tasks').insert({ ...fields, completed: false, user_id: user.id }))
    }
    if (error) { console.error('Taak opslaan mislukt:', error); return }
    setShowTaskModal(false)
    setSelectedTask(null)
    fetchTasks()
  }

  const handleDeleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setShowTaskModal(false)
    setSelectedTask(null)
    fetchTasks()
  }

  const handleToggleTask = async (task) => {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  const openNewTask = (time) => {
    setSelectedTask(null)
    setDefaultTime(time || '09:00')
    setShowTaskModal(true)
  }

  const openEditTask = (task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (e, column, index, widgetId) => {
    dragState.current = { sourceColumn: column, sourceIndex: index, widgetId }
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, column, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const key = `${column}:${index}`
    setDropTarget(prev => prev === key ? prev : key)
  }

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setDropTarget(null)
  }

  const handleDrop = (e, targetColumn, insertIndex) => {
    e.preventDefault()
    const { sourceColumn, sourceIndex, widgetId } = dragState.current
    if (!widgetId) return
    // No-op: dropped back on same position
    if (sourceColumn === targetColumn && (sourceIndex === insertIndex || sourceIndex + 1 === insertIndex)) {
      setDropTarget(null)
      return
    }
    const next = { left: [...widgetOrder.left], right: [...widgetOrder.right] }
    next[sourceColumn].splice(sourceIndex, 1)
    let idx = insertIndex
    if (sourceColumn === targetColumn && sourceIndex < insertIndex) idx--
    idx = Math.max(0, Math.min(next[targetColumn].length, idx))
    next[targetColumn].splice(idx, 0, widgetId)
    setWidgetOrder(next)
    localStorage.setItem('widget_order', JSON.stringify(next))
    setDropTarget(null)
  }

  const handleDragEnd = () => {
    dragState.current = { sourceColumn: null, sourceIndex: null, widgetId: null }
    setDropTarget(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#00FFD1', borderTopColor: 'transparent' }} />
    </div>
  )

  if (passwordRecovery) return (
    <>
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <PasswordResetPage onDone={() => setPasswordRecovery(false)} />
    </>
  )

  if (!session) return (
    <>
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <AuthPage />
    </>
  )

  function getWidgetElement(id) {
    return {
      habits:   <HabitsWidget userId={user.id} syncTrigger={syncTrigger} />,
      notes:    <NotesWidget userId={user.id} syncTrigger={syncTrigger} />,
      tasks:    <TasksWidget tasks={tasks} subjects={subjects}
                  onAdd={async (data) => { if (!user?.id) return; await supabase.from('tasks').insert({ ...data, completed: false, user_id: user.id }); fetchTasks() }}
                  onEdit={openEditTask} onDelete={handleDeleteTask} onToggle={handleToggleTask}
                  onViewDetail={setDetailTask} onNew={() => openNewTask()} />,
      weather:  <WeatherWidget userId={user?.id} onRequestPwaInstall={() => setShowPwaPrompt(true)} />,
      spotify:  <SpotifyWidget />,
      pomodoro: <PomodoroTimer onModeChange={setIsBreak} userId={user?.id} />,
    }[id] ?? null
  }

  function renderColumn(col) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <DropZone col={col} index={0} dropTarget={dropTarget}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} />
        {widgetOrder[col].map((id, i) => (
          <React.Fragment key={id}>
            <DraggableWidget id={id} col={col} index={i}
              onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {getWidgetElement(id)}
            </DraggableWidget>
            <DropZone col={col} index={i + 1} dropTarget={dropTarget}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} />
          </React.Fragment>
        ))}
      </div>
    )
  }

  const displayName = userProfile?.full_name || user?.email?.split('@')[0] || 'Student'
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter(t => t.date === todayStr)
  const completedToday = todayTasks.filter(t => t.completed).length
  const totalToday = todayTasks.length

  // Next upcoming event across coming days (lessons, calendar events, tasks with time)
  const nextEvent = (() => {
    const now = new Date()
    const pad2 = n => String(n).padStart(2, '0')
    const fmt = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`

    const DAYS_NL = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
    const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
    const fmtLabel = d => {
      const isToday = fmt(d) === todayStr
      if (isToday) return `vandaag ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }

    // Read Magister lessons from sessionStorage cache
    const weekStart = (() => {
      const d = new Date(now); const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0); return d
    })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const cacheKey = `magister_sched_${fmt(weekStart)}_${fmt(weekEnd)}`
    const cachedLessons = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey)) || [] } catch { return [] } })()
    // Ook volgende week ophalen uit cache
    const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(weekStart.getDate() + 7)
    const nextWeekEnd   = new Date(weekEnd);   nextWeekEnd.setDate(weekEnd.getDate() + 7)
    const nextCacheKey  = `magister_sched_${fmt(nextWeekStart)}_${fmt(nextWeekEnd)}`
    const nextWeekLessons = (() => { try { return JSON.parse(sessionStorage.getItem(nextCacheKey)) || [] } catch { return [] } })()
    const allLessons = [...(cachedLessons.length ? cachedLessons : magisterLessons), ...nextWeekLessons]

    const items = [
      ...tasks
        .filter(t => t.date && (t.time || t.start_time) && !t.completed)
        .map(t => {
          const ts = (t.start_time || t.time || '').slice(0, 5)
          const d = new Date(t.date + 'T' + ts)
          return { label: t.title, ts: d, type: 'task', raw: t }
        })
        .filter(t => t.ts >= now),
      ...allLessons
        .filter(l => l.start && !l.uitgevallen && new Date(l.start) >= now)
        .map(l => {
          const d = new Date(l.start)
          return { label: l.vak || 'Les', ts: d, type: 'lesson', raw: l }
        }),
      ...calendarEvents
        .filter(ev => ev.start_time && new Date(ev.start_time) >= now)
        .map(ev => {
          const d = new Date(ev.start_time)
          return { label: ev.title, ts: d, type: 'event', raw: ev }
        }),
    ].sort((a, b) => a.ts - b.ts)

    const idx = Math.min(nextEventSkip, items.length - 1)
    const next = items[Math.max(0, idx)] || null
    if (!next) return { item: null, hasMore: false }
    return { item: { ...next, timeStr: fmtLabel(next.ts) }, hasMore: idx < items.length - 1 }
  })()

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      {/* Animated background */}
      <div className="mesh-bg"><div className="mesh-blob" /></div>

      {/* Main content */}
      <div className="flex flex-col" style={{ position: 'relative', zIndex: 10, height: '100%' }}>

        {/* Top navbar — sticky zodat hij nooit wegscrollt */}
        <nav className="flex items-center justify-between px-6 py-4"
          style={{
            position: 'sticky', top: 0, zIndex: 50,
            borderBottom: '1px solid rgba(0,255,209,0.08)',
            background: 'rgba(5,10,20,0.85)',
            backdropFilter: 'blur(20px)'
          }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
              <GraduationCap size={16} color="var(--accent)" />
            </div>
            <span className="font-semibold text-white text-sm hidden sm:block">Student Dashboard</span>
          </div>

          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Hoi, {displayName} 👋
          </span>

          {/* Progress bar */}
          {totalToday > 0 && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {completedToday}/{totalToday} taken
              </span>
              <div className="w-32 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedToday / totalToday) * 100}%`,
                    background: 'linear-gradient(90deg, var(--accent), #818CF8)',
                    boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 50%, transparent)'
                  }} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Sync indicator */}
            <span
              title="Taken, notities en gewoontes worden elke 30 seconden automatisch gesynchroniseerd"
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              <RefreshCw
                size={12}
                style={{
                  color: syncFlash ? '#1DB954' : 'rgba(255,255,255,0.2)',
                  transition: 'color 0.5s',
                  animation: syncing ? 'spin 0.8s linear infinite' : 'none',
                }}
              />
              <span className="hidden sm:block" style={{ fontSize: 10, color: syncFlash ? '#1DB954' : 'rgba(255,255,255,0.2)', transition: 'color 0.5s' }}>
                {syncing ? 'Syncing…' : '30s'}
              </span>
            </span>

            <span className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {user?.email}
            </span>
            <button onClick={() => supabase.auth.signOut()}
              className="btn-neon flex items-center gap-1.5"
              style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)' }}>
              <LogOut size={13} />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>

            {/* Tutorial knop */}
            <button onClick={() => setShowOnboarding(true)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '6px 12px', cursor: 'pointer',
              }}>
              <span style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
                backgroundImage: 'linear-gradient(90deg, var(--accent), #a78bfa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Tutorial</span>
            </button>

            {/* Instellingen knop */}
            <button onClick={() => setShowThemeSettings(true)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)'
              }}>
              <Settings size={16} />
            </button>

            {isAdmin && (
              <button onClick={() => setShowAdmin(true)} title="Admin Paneel"
                style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: '12px', padding: '8px', cursor: 'pointer', color: '#FFB400' }}>
                <Shield size={16} />
              </button>
            )}
          </div>
        </nav>

        {/* Desktop: 3-column grid */}
        <div className="hidden md:block" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="grid gap-4 p-6"
          style={{ gridTemplateColumns: '280px 1fr 300px', alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ position: 'sticky', top: '80px' }}>{renderColumn('left')}</div>

          {/* MIDDLE COLUMN */}
          <div className="space-y-4">
            <div className="glass-card p-6">
              <Clock isBreak={isBreak} />
              <div className="mt-1 mb-4"
                style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,255,209,0.2), transparent)' }} />
              <div style={{ height: '60vh' }}>
                <Timeline
                  userId={user.id}
                  tasks={tasks}
                  subjects={subjects}
                  onToggleTask={handleToggleTask}
                  onEditTask={openEditTask}
                  isAdmin={isAdmin}
                  onLessonsChange={setMagisterLessons}
                  onEventsChange={setCalendarEvents}
                  onMagisterError={setMagisterError}
                />
              </div>
            </div>
            <MagisterWidget userId={user.id} onSubjectsSync={() => { fetchSubjects(); fetchProfiles(); fetchSubjectLinks() }} />
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ position: 'sticky', top: '80px' }}>{renderColumn('right')}</div>
        </div>
        </div>

        {/* ═══ MOBILE LAYOUT — tab-based, geen pagina-scroll ═══ */}
        {(() => {
          const hour = new Date().getHours()
          const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

          const subTabStyle = (active) => ({
            fontSize: 12, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: active ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
            color: active ? '#000' : 'rgba(255,255,255,0.5)',
            fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', flexShrink: 0,
          })

          const TABS = [
            { id: 'home',    Icon: Home,         label: 'Home'      },
            { id: 'agenda',  Icon: CalendarDays,  label: 'Agenda'    },
            { id: 'taken',   Icon: CheckSquare,   label: 'Taken'     },
            { id: 'habits',  Icon: Flame,         label: 'Gewoontes' },
            { id: 'tools',   Icon: Layers,        label: 'Tools'     },
          ]

          return (
            <div className="md:hidden flex-1 flex flex-col" style={{ overflow: 'hidden', minHeight: 0 }}>

              {/* ─── Tab content ─── */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

                {/* HOME */}
                {mobileTab === 'home' && (
                  <div style={{ height: '100%', overflowY: 'auto', padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{greeting}, {displayName}</p>
                    <div className="glass-card" style={{ padding: '20px 20px 16px' }}>
                      <Clock isBreak={isBreak} />
                    </div>

                    {totalToday > 0 && (
                      <div className="glass-card" style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Voortgang vandaag</span>
                          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{completedToday}/{totalToday} taken</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${(completedToday / totalToday) * 100}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s', boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 50%, transparent)' }} />
                        </div>
                      </div>
                    )}

                    {/* Volgende gebeurtenis — altijd zichtbaar */}
                    {(() => {
                      const { item: ev, hasMore } = nextEvent
                      return (
                        <div className="glass-card" style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Volgende gebeurtenis</p>
                            {ev && (
                              <button
                                onClick={() => setNextEventSkip(s => s + 1)}
                                disabled={!hasMore}
                                title="Volgende"
                                style={{ background: 'none', border: 'none', cursor: hasMore ? 'pointer' : 'default', color: hasMore ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)', padding: 0, fontSize: 16, lineHeight: 1 }}>
                                ›
                              </button>
                            )}
                          </div>
                          {ev ? (
                            <div
                              onClick={() => ev.type === 'task' && ev.raw && setDetailTask(ev.raw)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: ev.type === 'task' ? 'pointer' : 'default' }}>
                              <div>
                                <p style={{ fontSize: 15, color: 'white', fontWeight: 600, margin: '0 0 2px' }}>{ev.label}</p>
                                <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0, fontWeight: 500 }}>{ev.timeStr}</p>
                              </div>
                              <span style={{ fontSize: 20 }}>
                                {ev.type === 'lesson' ? '🎓' : ev.type === 'event' ? '📅' : '✅'}
                              </span>
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Niets meer gepland</p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Magister — grote prompt als niet gekoppeld of fout */}
                    {(() => {
                      const hasCreds = !!localStorage.getItem('magister_credentials')
                      const hasError = !!magisterError
                      if (!hasCreds || hasError) return (
                        <div
                          className="glass-card"
                          onClick={() => { setMobileTab('tools'); setToolTab('magister') }}
                          style={{
                            padding: '18px 20px', cursor: 'pointer',
                            border: hasError
                              ? '1px solid rgba(255,107,107,0.35)'
                              : '1px solid rgba(250,204,21,0.25)',
                            background: hasError
                              ? 'rgba(255,80,80,0.06)'
                              : 'rgba(250,204,21,0.04)',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                              background: hasError ? 'rgba(255,80,80,0.12)' : 'rgba(250,204,21,0.12)',
                              border: hasError ? '1px solid rgba(255,80,80,0.3)' : '1px solid rgba(250,204,21,0.3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 22,
                            }}>
                              {hasError ? '⚠️' : '🎓'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{
                                fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 3px',
                              }}>
                                {hasError ? 'Magister fout' : 'Koppel Magister'}
                              </p>
                              <p style={{
                                fontSize: 12, margin: 0,
                                color: hasError ? 'rgba(255,107,107,0.8)' : 'rgba(255,255,255,0.45)',
                              }}>
                                {hasError ? magisterError + ' — tik om opnieuw in te loggen' : 'Zie je rooster, cijfers en huiswerk'}
                              </p>
                            </div>
                            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>›</span>
                          </div>
                        </div>
                      )
                      return null
                    })()}

                    {/* Regen grafiek — toon als het regent */}
                    {homeRain && Math.max(...homeRain.slice(0,12).map(d=>d.precip)) > 0.1 && (() => {
                      const data = homeRain
                      const maxP = Math.max(...data.map(d=>d.precip), 0.5)
                      const W=260,H=64,PL=4,PB=14,PR=4,PT=4
                      const iW=W-PL-PR, iH=H-PT-PB
                      const xOf=i=>PL+(i/(data.length-1||1))*iW
                      const yOf=v=>PT+iH-(v/maxP)*iH
                      const pts=data.map((d,i)=>[xOf(i),yOf(d.precip)])
                      const lineD=pts.map(([x,y],i)=>`${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
                      const areaD=`${lineD} L${pts[pts.length-1][0].toFixed(1)},${(PT+iH).toFixed(1)} L${PL},${(PT+iH).toFixed(1)} Z`
                      const maxLabel = maxP<0.5?'Lichte regen':maxP<2?'Matige regen':'Zware regen'
                      return (
                        <div className="glass-card" onClick={() => { setMobileTab('tools'); setToolTab('weer') }}
                          style={{ padding:'12px 14px', border:'1px solid rgba(0,180,255,0.25)', background:'rgba(0,150,255,0.06)', cursor:'pointer' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                            <span style={{ fontSize:14 }}>🌧️</span>
                            <span style={{ fontSize:12, color:'rgba(0,200,255,0.9)', fontWeight:600 }}>{maxLabel} de komende 2 uur</span>
                            <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginLeft:'auto' }}>›</span>
                          </div>
                          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block', overflow:'visible' }}>
                            <defs>
                              <linearGradient id="hRainGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(0,180,255,0.5)" />
                                <stop offset="100%" stopColor="rgba(0,180,255,0.02)" />
                              </linearGradient>
                            </defs>
                            <path d={areaD} fill="url(#hRainGrad)" />
                            <path d={lineD} fill="none" stroke="rgba(0,200,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" />
                            <line x1={PL} y1={PT+iH} x2={W-PR} y2={PT+iH} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                            {[0,6,12,18,23].map(i=>(
                              <text key={i} x={xOf(Math.min(i,data.length-1))} y={H-1} textAnchor="middle"
                                style={{ fontSize:7, fill:'rgba(255,255,255,0.3)', fontFamily:'sans-serif' }}>
                                {data[Math.min(i,data.length-1)]?.time||''}
                              </text>
                            ))}
                          </svg>
                        </div>
                      )
                    })()}

                    {/* Oningeplande taken */}
                    {(() => {
                      const unplanned = tasks.filter(t => !t.completed && !t.date)
                      if (!unplanned.length) return null
                      return (
                        <div className="glass-card" style={{ padding:'12px 14px', border:'1px solid rgba(250,204,21,0.15)', background:'rgba(250,204,21,0.03)' }}>
                          <p style={{ fontSize:10, color:'rgba(250,204,21,0.7)', margin:'0 0 8px', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>
                            📋 Nog in te plannen ({unplanned.length})
                          </p>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {unplanned.map(task => {
                              const subject = subjects.find(s => s.id === task.subject_id)
                              return (
                                <div key={task.id} onClick={() => setDetailTask(task)}
                                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', cursor:'pointer' }}>
                                  <span style={{ fontSize:13, color:'rgba(255,255,255,0.75)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                                  {subject && <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>{subject.name}</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Habits compact preview */}
                    <div onClick={() => setMobileTab('habits')} style={{ cursor: 'pointer' }}>
                      <HabitsWidget userId={user.id} compact />
                    </div>

                    <button className="btn-neon" onClick={() => { setMobileTab('taken'); openNewTask() }}
                      style={{ padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
                      + Taak toevoegen
                    </button>
                  </div>
                )}

                {/* AGENDA */}
                {mobileTab === 'agenda' && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px 16px 16px' }}>
                    <div className="glass-card" style={{ flex: 1, padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <Timeline
                        userId={user.id} tasks={tasks} subjects={subjects}
                        onToggleTask={handleToggleTask} onEditTask={openEditTask} isAdmin={isAdmin}
                        onLessonsChange={setMagisterLessons} onEventsChange={setCalendarEvents}
                        onMagisterError={setMagisterError}
                        isMobile
                      />
                    </div>
                  </div>
                )}

                {/* TAKEN / NOTITIES */}
                {mobileTab === 'taken' && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', flexShrink: 0 }}>
                      <button style={subTabStyle(takenTab === 'taken')}   onClick={() => setTakenTab('taken')}>Taken</button>
                      <button style={subTabStyle(takenTab === 'notities')} onClick={() => setTakenTab('notities')}>Notities</button>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', padding: '12px 16px 16px' }}>
                      {takenTab === 'taken' && (
                        <div style={{ height: '100%', overflowY: 'auto' }}>
                          <TasksWidget
                            tasks={tasks} subjects={subjects}
                            onAdd={async (data) => { if (!user?.id) return; await supabase.from('tasks').insert({ ...data, completed: false, user_id: user.id }); fetchTasks() }}
                            onEdit={openEditTask} onDelete={handleDeleteTask} onToggle={handleToggleTask}
                            onViewDetail={setDetailTask} onNew={() => openNewTask()}
                          />
                        </div>
                      )}
                      {takenTab === 'notities' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <NotesWidget userId={user.id} syncTrigger={syncTrigger} fullHeight />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* HABITS */}
                {mobileTab === 'habits' && (
                  <div style={{ height: '100%', overflowY: 'auto', padding: '12px 16px 16px' }}>
                    <HabitsWidget userId={user.id} />
                  </div>
                )}

                {/* TOOLS */}
                {mobileTab === 'tools' && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', overflowX: 'auto', flexShrink: 0 }}>
                      {[['weer','Weer'],['pomodoro','Pomodoro'],['spotify','Spotify'],['magister','Magister']].map(([id, label]) => (
                        <button key={id} style={subTabStyle(toolTab === id)} onClick={() => setToolTab(id)}>{label}</button>
                      ))}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', padding: '12px 16px 16px' }}>
                      <div style={{ height: '100%', overflowY: 'auto' }}>
                        {toolTab === 'weer'     && <WeatherWidget stacked userId={user?.id} onRequestPwaInstall={() => setShowPwaPrompt(true)} />}
                        {toolTab === 'pomodoro' && <PomodoroTimer onModeChange={setIsBreak} onPomodoroActive={setPomodoroActive} userId={user?.id} />}
                        {toolTab === 'spotify'  && <SpotifyWidget />}
                        {toolTab === 'magister' && <MagisterWidget userId={user.id} onSubjectsSync={() => { fetchSubjects(); fetchProfiles(); fetchSubjectLinks() }} />}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Bottom tab bar ─── */}
              <nav style={{
                display: 'flex', flexShrink: 0,
                background: 'rgba(5,10,20,0.95)',
                backdropFilter: 'blur(24px)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                position: 'relative', zIndex: 100,
              }}>
                {TABS.map(({ id, Icon, label }) => (
                  <button key={id} onClick={() => setMobileTab(id)} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 4, padding: '10px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: mobileTab === id ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
                    transition: 'color 0.15s',
                  }}>
                    <Icon size={20} strokeWidth={mobileTab === id ? 2.2 : 1.7} />
                    <span style={{ fontSize: 10, fontWeight: mobileTab === id ? 600 : 400 }}>{label}</span>
                  </button>
                ))}
              </nav>
            </div>
          )
        })()}
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {showThemeSettings && (
        <ThemeSettings
          onClose={() => setShowThemeSettings(false)}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          defaultTime={defaultTime}
          defaultDate={defaultDate}
          subjects={subjects}
          userId={user.id}
          onClose={() => { setShowTaskModal(false); setSelectedTask(null) }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          subjects={subjects}
          subjectLinks={subjectLinks}
          onEdit={(task) => { setDetailTask(null); openEditTask(task) }}
          onDelete={(id) => { setDetailTask(null); handleDeleteTask(id) }}
          onClose={() => setDetailTask(null)}
        />
      )}

      {/* Onboarding tutorial */}
      {showOnboarding && (
        <OnboardingModal user={user} onClose={() => setShowOnboarding(false)} />
      )}

      {/* PWA install prompt */}
      {showPwaPrompt && (
        <div style={{ position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'flex-end',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)',padding:'16px' }}
          onClick={() => setShowPwaPrompt(false)}>
          <div className="glass-card" style={{ width:'100%',maxWidth:'440px',padding:'24px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ color:'white',fontWeight:700,fontSize:'16px',margin:'0 0 8px' }}>App installeren</h3>
            <p style={{ fontSize:13,color:'rgba(255,255,255,0.6)',margin:'0 0 16px',lineHeight:1.5 }}>
              Om meldingen te ontvangen (ook als de pagina gesloten is), installeer de app op je beginscherm:
            </p>
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:12,fontWeight:600,color:'var(--accent)',margin:'0 0 6px' }}>iPhone / iPad (Safari):</p>
              <ol style={{ fontSize:12,color:'rgba(255,255,255,0.6)',paddingLeft:20,margin:0,lineHeight:1.8 }}>
                <li>Tik op het Deel-icoon <span style={{ fontSize:14 }}>⎋</span> onderaan</li>
                <li>Kies <b style={{ color:'white' }}>"Zet op beginscherm"</b></li>
                <li>Tik op <b style={{ color:'white' }}>Voeg toe</b></li>
              </ol>
            </div>
            <div style={{ marginBottom:20 }}>
              <p style={{ fontSize:12,fontWeight:600,color:'var(--accent)',margin:'0 0 6px' }}>Android (Chrome):</p>
              <ol style={{ fontSize:12,color:'rgba(255,255,255,0.6)',paddingLeft:20,margin:0,lineHeight:1.8 }}>
                <li>Tik op het menu <b style={{ color:'white' }}>⋮</b> rechtsboven</li>
                <li>Kies <b style={{ color:'white' }}>"App installeren"</b> of <b style={{ color:'white' }}>"Toevoegen aan beginscherm"</b></li>
              </ol>
            </div>
            <button onClick={() => setShowPwaPrompt(false)}
              style={{ width:'100%',padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'white',cursor:'pointer',fontSize:13 }}>
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  )
}