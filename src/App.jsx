import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './components/AuthPage'
import Clock from './components/Clock'
import Timeline from './components/Timeline'
import TaskModal from './components/TaskModal'
import SubjectsWidget from './components/SubjectsWidget'
import NotesWidget from './components/NotesWidget'
import WeatherWidget from './components/WeatherWidget'
import PomodoroTimer from './components/PomodoroTimer'
import { LogOut, GraduationCap, Menu, X } from 'lucide-react'
import SpotifyWidget from './components/SpotifyWidget'
import ThemeSettings from './components/ThemeSettings'
import { Settings } from 'lucide-react'
import ProfileSetup from './components/ProfileSetup'
import AdminPanel from './components/AdminPanel'
import TasksWidget from './components/TasksWidget'
import { Shield } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [subjects, setSubjects] = useState([])
  const [isBreak, setIsBreak] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [defaultTime, setDefaultTime] = useState('09:00')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  const [theme, setTheme] = useState({ accent: '#00FFD1', bg1: '#0a0a1a', bg2: '#0d1117' })
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [profiles, setProfiles] = useState([])

  const ADMIN_EMAIL = 'zhafirfachri@gmail.com'

  const [showAdmin, setShowAdmin] = useState(false)
  const [profileReady, setProfileReady] = useState(false)

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) console.error('Error fetching profiles:', error);
    else setProfiles(data || []);
  };

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load data
useEffect(() => {
  if (session) {
    fetchTasks(); fetchSubjects(); fetchProfiles()
  }
}, [session])

useEffect(() => {
  if (profiles.length > 0) {
    const p = profiles.find(pr => pr.id === session?.user?.id)
    setProfileReady(!!(p?.klas && p?.vakken?.length > 0))
  }
}, [profiles])

  // Effect voor accent kleur:
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', theme.accent)
  }, [theme.accent])

  useEffect(() => {
  const handler = () => fetchTasks()
  window.addEventListener('refreshTasks', handler)
  return () => window.removeEventListener('refreshTasks', handler)
}, [])

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('time', { ascending: true })
    if (data) setTasks(data)
  }

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('created_at', { ascending: true })
    if (data) setSubjects(data)
  }

  const handleSaveTask = async (taskData) => {
    if (taskData.id) {
      await supabase.from('tasks').update({
        title: taskData.title,
        description: taskData.description,
        time: taskData.time,
        subject_id: taskData.subject_id,
        completed: taskData.completed
      }).eq('id', taskData.id)
    } else {
      await supabase.from('tasks').insert({
        title: taskData.title,
        description: taskData.description,
        time: taskData.time,
        subject_id: taskData.subject_id,
        completed: false,
        user_id: session.user.id
      })
    }
    setModalOpen(false); setSelectedTask(null)
    fetchTasks()
  }

  const handleDeleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setModalOpen(false); setSelectedTask(null)
    fetchTasks()
  }

  const handleToggleTask = async (task) => {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  const handleAddSubject = async (subjectData) => {
    await supabase.from('subjects').insert({ ...subjectData, user_id: session.user.id })
    fetchSubjects()
  }

  const handleDeleteSubject = async (id) => {
    await supabase.from('subjects').delete().eq('id', id)
    fetchSubjects()
  }

  const openNewTask = (time) => {
    setSelectedTask(null); setDefaultTime(time); setModalOpen(true)
  }

  const openEditTask = (task) => {
    setSelectedTask(task); setModalOpen(true)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00FFD1', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!session) return (
    <>
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <AuthPage />
    </>
  )

  // user wordt HIER gedeclareerd, NADAT session gecontroleerd is
  const user = session.user
  const isAdmin = user?.email === ADMIN_EMAIL
  const userProfile = profiles.find(p => p.id === user?.id)
  const displayName = userProfile?.full_name || user?.email?.split('@')[0] || 'Student'

  const completedToday = tasks.filter(t => t.completed).length
  const totalToday = tasks.length

  if (!profileReady && profiles.length > 0) return (
    <>
      <div className="mesh-bg"><div className="mesh-blob" /></div>
      <ProfileSetup 
        userId={session.user.id} 
        onComplete={async () => {
          // 1. Haal direct de nieuwste data op uit Supabase
          await fetchProfiles(); 
          // 2. Zet de state handmatig op true voor de zekerheid
          setProfileReady(true); 
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

        {/* Top navbar */}
        <nav className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(0,255,209,0.08)', background: 'rgba(5,10,20,0.6)', backdropFilter: 'blur(20px)' }}>
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
                  style={{ width: `${(completedToday / totalToday) * 100}%`, background: 'linear-gradient(90deg, #00FFD1, #818CF8)', boxShadow: '0 0 8px rgba(0,255,209,0.5)' }} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {session.user.email}
            </span>
            <button onClick={() => supabase.auth.signOut()}
              className="btn-neon flex items-center gap-1.5"
              style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)' }}>
              <LogOut size={13} />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>
            {/* Mobile menu toggle */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Instellingen knop */}
            <button
              onClick={() => setShowThemeSettings(true)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)'
              }}>
              <Settings size={16} />
            </button>
            {isAdmin && (
            <button onClick={() => setShowAdmin(true)}
              title="Admin Paneel"
              style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: '12px', padding: '8px', cursor: 'pointer', color: '#FFB400' }}>
              <Shield size={16} />
            </button>
          )}
          </div>
        </nav>

        {/* Desktop: 3-column grid */}
        <div className="hidden md:grid flex-1 gap-4 p-6" style={{ gridTemplateColumns: '280px 1fr 300px', alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div className="space-y-4 sticky top-6">
            <SubjectsWidget subjects={subjects} onAdd={handleAddSubject} onDelete={handleDeleteSubject} />
            <NotesWidget />
            <TasksWidget
              tasks={tasks}
              subjects={subjects}
              onAdd={async (data) => {
                await supabase.from('tasks').insert({ ...data, completed: false, user_id: session.user.id })
                fetchTasks()
              }}
              onDelete={handleDeleteTask}
              onToggle={handleToggleTask}
            />
          </div>

          {/* MIDDLE COLUMN */}
          <div className="space-y-4">
            <div className="glass-card p-6">
              <Clock isBreak={isBreak} />
              <div className="mt-1 mb-4" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,255,209,0.2), transparent)' }} />
              <div className="overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <Timeline
                userId={session?.user?.id}
                tasks={tasks}
                subjects={subjects}
                onToggleTask={handleToggleTask}
                onEditTask={(task) => { setSelectedTask(task); setShowTaskModal(true) }}
                isAdmin={isAdmin}
              />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 sticky top-6">
            <WeatherWidget />
            {isAdmin && <SpotifyWidget />}
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
            <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
            <Timeline
              userId={session?.user?.id}
              tasks={tasks}
              subjects={subjects}
              onToggleTask={handleToggleTask}
              onEditTask={(task) => { setSelectedTask(task); setShowTaskModal(true) }}
              isAdmin={isAdmin}
            />
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="space-y-4" style={{ animation: 'slideUp 0.3s ease' }}>
              <WeatherWidget />
              <PomodoroTimer onModeChange={setIsBreak} onPomodoroActive={setPomodoroActive} />
              <SubjectsWidget userId={session?.user?.id} />
              <NotesWidget />
            </div>
          )}
        </div>
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* ThemeSettings modal */}
      {showThemeSettings && (
        <ThemeSettings
          onClose={() => setShowThemeSettings(false)}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          subjects={subjects}
          userId={session?.user?.id}
          onClose={() => { setShowTaskModal(false); setSelectedTask(null) }}
          onSave={() => { fetchTasks(); setShowTaskModal(false); setSelectedTask(null) }}
        />
      )}
    </div>
  )
}