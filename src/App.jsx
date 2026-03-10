import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './components/AuthPage'
import Clock from './components/Clock'
import Timeline from './components/Timeline'
import TaskModal from './components/TaskModal'
import SubjectsWidget from './components/SubjectsWidget'
import NotesWidget from './components/NotesWidget'
import WeatherWidget from './components/WeatherWidget'
import PomodoroTimer from './components/PomodoroTimer'
import { LogOut, GraduationCap } from 'lucide-react'
import SpotifyWidget from './components/SpotifyWidget'
import ThemeSettings from './components/ThemeSettings'
import { Settings } from 'lucide-react'
import ProfileSetup from './components/ProfileSetup'
import AdminPanel from './components/AdminPanel'
import TasksWidget from './components/TasksWidget'
import MagisterWidget from './components/MagisterWidget'
import PasswordResetPage from './components/PasswordResetPage'
import { Shield } from 'lucide-react'

const ADMIN_EMAIL = 'zhafirfachri@gmail.com'

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

  // ✅ FIX: user vroeg beschikbaar via useMemo (geen undefined bij vakken/kalender)
  const user = useMemo(() => session?.user || null, [session])
  const isAdmin = user?.email === ADMIN_EMAIL

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) console.error('Error fetching profiles:', error)
    else setProfiles(data || [])
  }

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
      fetchTasks(); fetchSubjects(); fetchProfiles()
    }
  }, [session, user?.id])

  // ✅ FIX: useMemo voor userProfile (geen stale closure)
  const userProfile = useMemo(() => {
    if (!user?.id) return null
    return profiles.find(p => p.id === user.id) || null
  }, [profiles, user?.id])

  // ✅ FIX: profileReady als computed value, niet als aparte state
  const profileReady = !!(userProfile?.klas && (userProfile?.vakken?.length || 0) > 0)

  // Auto-sync profiel vakken naar subjects tabel zodat FK werkt
  useEffect(() => {
    if (!userProfile?.vakken?.length || !user?.id) return
    const sync = async () => {
      const { data: existing } = await supabase.from('subjects').select('name').eq('user_id', user.id)
      const existingNames = new Set((existing || []).map(s => s.name))
      const missing = userProfile.vakken.filter(v => !existingNames.has(v))
      if (missing.length > 0) {
        await supabase.from('subjects').insert(missing.map(name => ({ name, user_id: user.id })))
      }
      fetchSubjects()
    }
    sync()
  }, [userProfile?.vakken, user?.id])

  // Effect voor accent kleur
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', theme.accent)
  }, [theme.accent])

  useEffect(() => {
    const handler = () => { if (user?.id) fetchTasks() }
    window.addEventListener('refreshTasks', handler)
    return () => window.removeEventListener('refreshTasks', handler)
  }, [user?.id])

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
    setSubjects(data || [])
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

  const handleAddSubject = async (subjectData) => {
    if (!user?.id) return
    await supabase.from('subjects').insert({ ...subjectData, user_id: user.id })
    fetchSubjects()
  }

  const handleDeleteSubject = async (id) => {
    await supabase.from('subjects').delete().eq('id', id)
    fetchSubjects()
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

  const displayName = userProfile?.full_name || user?.email?.split('@')[0] || 'Student'
  const completedToday = tasks.filter(t => t.completed).length
  const totalToday = tasks.length

  // ✅ FIX: profiles.length > 0 check + profileReady als computed value
  if (!profileReady && profiles.length > 0) return (
    <>
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <ProfileSetup
        userId={user.id}
        onComplete={async () => {
          await fetchProfiles()
        }}
      />
    </>
  )

  return (
    <div className="min-h-screen relative">
      {/* Animated background */}
      <div className="mesh-bg"><div className="mesh-blob" /></div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">

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
              style={{ background: 'rgba(0,255,209,0.15)', border: '1px solid rgba(0,255,209,0.3)' }}>
              <GraduationCap size={16} color="#00FFD1" />
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
                    background: 'linear-gradient(90deg, #00FFD1, #818CF8)',
                    boxShadow: '0 0 8px rgba(0,255,209,0.5)'
                  }} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {user?.email}
            </span>
            <button onClick={() => supabase.auth.signOut()}
              className="btn-neon flex items-center gap-1.5"
              style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)' }}>
              <LogOut size={13} />
              <span className="hidden sm:inline">Uitloggen</span>
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
        <div className="hidden md:grid flex-1 gap-4 p-6"
          style={{ gridTemplateColumns: '280px 1fr 300px', alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div className="space-y-4 sticky top-20">
            <SubjectsWidget
              subjects={subjects}
              userId={user.id}
              onAdd={handleAddSubject}
              onDelete={handleDeleteSubject}
              isAdmin={isAdmin}
            />
            <NotesWidget userId={user.id} />
            <TasksWidget
              tasks={tasks}
              subjects={subjects}
              onAdd={async (data) => {
                if (!user?.id) return
                await supabase.from('tasks').insert({ ...data, completed: false, user_id: user.id })
                fetchTasks()
              }}
              onEdit={openEditTask}
              onDelete={handleDeleteTask}
              onToggle={handleToggleTask}
            />
          </div>

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
                />
              </div>
            </div>
            <MagisterWidget />
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 sticky top-20">
            <WeatherWidget />
            <SpotifyWidget />
            <PomodoroTimer onModeChange={setIsBreak} />
          </div>
        </div>

        {/* MOBILE LAYOUT */}
        <div className="md:hidden flex-1 p-4 space-y-4">
          <div className="glass-card p-4">
            <Clock isBreak={isBreak} />
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Dag Tijdlijn</h3>
            <div style={{ height: '50vh' }}>
              <Timeline
                userId={user.id}
                tasks={tasks}
                subjects={subjects}
                onToggleTask={handleToggleTask}
                onEditTask={openEditTask}
                isAdmin={isAdmin}
              />
            </div>
          </div>
          <MagisterWidget />
          <WeatherWidget />
          <SpotifyWidget />
          <PomodoroTimer onModeChange={setIsBreak} onPomodoroActive={setPomodoroActive} />
          <TasksWidget
            tasks={tasks}
            subjects={subjects}
            onAdd={async (data) => {
              if (!user?.id) return
              await supabase.from('tasks').insert({ ...data, completed: false, user_id: user.id })
              fetchTasks()
            }}
            onEdit={openEditTask}
            onDelete={handleDeleteTask}
            onToggle={handleToggleTask}
          />
          <SubjectsWidget
            subjects={subjects}
            userId={user.id}
            onAdd={handleAddSubject}
            onDelete={handleDeleteSubject}
            isAdmin={isAdmin}
          />
          <NotesWidget userId={user.id} />
        </div>
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
    </div>
  )
}