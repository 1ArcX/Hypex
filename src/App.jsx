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

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [subjects, setSubjects] = useState([])
  const [isBreak, setIsBreak] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [defaultTime, setDefaultTime] = useState('09:00')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  const [theme, setTheme] = useState({ accent: '#00FFD1', bg1: '#0a0a1a', bg2: '#0d1117' })
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [profiles, setProfiles] = useState([])

  const ADMIN_EMAIL = 'zhafirfachri@gmail.com'

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name')
    if (data) setProfiles(data)
  }

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
    if (session) { fetchTasks(); fetchSubjects(); fetchProfiles() }
  }, [session])

  // Effect voor accent kleur:
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', theme.accent)
  }, [theme.accent])

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

  return (
    <div className="min-h-screen relative">
      {/* Animated background */}
      <div className="mesh-bg"><div className="mesh-blob" /></div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">

        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Hoi, {displayName} 👋
        </span>

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
          </div>
        </nav>

        {/* Desktop: 3-column grid */}
        <div className="hidden md:grid flex-1 gap-4 p-6" style={{ gridTemplateColumns: '280px 1fr 300px', alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div className="space-y-4 sticky top-6">
            <SubjectsWidget subjects={subjects} onAdd={handleAddSubject} onDelete={handleDeleteSubject} />
            <NotesWidget />
          </div>

          {/* MIDDLE COLUMN */}
          <div className="glass-card p-6">
            <Clock isBreak={isBreak} />
            <div className="mt-1 mb-4" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,255,209,0.2), transparent)' }} />
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              <Timeline
                tasks={tasks}
                subjects={subjects}
                onSlotClick={openNewTask}
                onTaskClick={openEditTask}
                onToggleTask={handleToggleTask}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 sticky top-6">
            <WeatherWidget />
            {isAdmin && <SpotifyWidget />}
            <PomodoroTimer onModeChange={setIsBreak} />
            {/* Upcoming tasks summary */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span style={{ color: '#00FFD1' }}>📋</span> Schoolopdrachten
              </h3>
              {tasks.filter(t => !t.completed).length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Alle taken afgerond! 🎉
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.filter(t => !t.completed).slice(0, 5).map(task => {
                    const subject = subjects.find(s => s.id === task.subject_id)
                    return (
                      <div key={task.id}
                        onClick={() => openEditTask(task)}
                        className="flex items-start gap-2 px-2 py-2 rounded-xl cursor-pointer transition-all duration-200"
                        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,209,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: subject?.color || '#00FFD1', marginTop: '5px', flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{task.title}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {task.time}{subject ? ` · ${subject.name}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {tasks.filter(t => !t.completed).length > 5 && (
                    <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      +{tasks.filter(t => !t.completed).length - 5} meer in de tijdlijn
                    </p>
                  )}
                </div>
              )}
            </div>
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
                tasks={tasks}
                subjects={subjects}
                onSlotClick={openNewTask}
                onTaskClick={openEditTask}
                onToggleTask={handleToggleTask}
              />
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="space-y-4" style={{ animation: 'slideUp 0.3s ease' }}>
              <WeatherWidget />
              <PomodoroTimer onModeChange={setIsBreak} onPomodoroActive={setPomodoroActive} />
              <SubjectsWidget subjects={subjects} onAdd={handleAddSubject} onDelete={handleDeleteSubject} />
              <NotesWidget />
            </div>
          )}
        </div>
      </div>

      {/* ThemeSettings modal */}
      {showThemeSettings && (
        <ThemeSettings
          onClose={() => setShowThemeSettings(false)}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      {/* Task Modal */}
      {modalOpen && (
        <TaskModal
          task={selectedTask}
          defaultTime={defaultTime}
          subjects={subjects}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => { setModalOpen(false); setSelectedTask(null) }}
        />
      )}
    </div>
  )
}