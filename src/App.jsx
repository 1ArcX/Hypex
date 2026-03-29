import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './components/AuthPage'
import Timeline from './components/Timeline'
import TaskModal from './components/TaskModal'
import TaskDetailModal from './components/TaskDetailModal'
import PomodoroTimer from './components/PomodoroTimer'
import { RefreshCw, LogOut } from 'lucide-react'
import ThemeSettings from './components/ThemeSettings'
import AdminPanel from './components/AdminPanel'
import HabitsWidget from './components/HabitsWidget'
import WorkWidget from './components/WorkWidget'
import VrachttijdenWidget from './components/VrachttijdenWidget'
import PasswordResetPage from './components/PasswordResetPage'
import OnboardingModal from './components/OnboardingModal'

import Sidebar from './components/Sidebar'
import VersionChecker from './components/VersionChecker'
import BottomNav from './components/BottomNav'
import DashboardPage from './pages/DashboardPage'
import PomodoroPage from './pages/PomodoroPage'
import AgendaPage from './pages/AgendaPage'
import SchoolPage from './pages/SchoolPage'
import TakenPage from './pages/TakenPage'
import GewoontesPage from './pages/GewoontesPage'
import NotitiesPage from './pages/NotitiesPage'
import JumboPage from './pages/JumboPage'
import StatsPage from './pages/StatsPage'

const ADMIN_EMAIL = 'zhafirfachri@gmail.com'

const VAPID_PUBLIC = 'BCsu1QaHUead0cgQ23qUKIu3_MnSi0s21LaD_c9wBcqdP43A9ojEx-nWZ4_xUDYLVMQn0CqzqdhSuLQr6eOQqh4'
function urlBase64ToUint8Array(b) {
  const pad = '='.repeat((4 - b.length % 4) % 4)
  const base64 = (b + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

const PAGE_NAMES = {
  dashboard: 'Dashboard', agenda: 'Agenda', taken: 'Taken',
  pomodoro: 'Pomodoro', school: 'School',
  gewoontes: 'Gewoontes', notities: 'Notities', statistieken: 'Statistieken', jumbo: 'Jumbo',
}

const PAGE_ORDER = ['dashboard', 'agenda', 'taken', 'pomodoro', 'school', 'gewoontes', 'notities', 'statistieken']

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [tasks, setTasks] = useState([])
  const [subjects, setSubjects] = useState([])
  const [isBreak, setIsBreak] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [defaultTime, setDefaultTime] = useState('09:00')
  const [defaultDate, setDefaultDate] = useState('')
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  const [theme, setTheme] = useState({ accent: '#00FFD1', bg1: '#0f0f0f', bg2: '#171717' })
  const [focusMode, setFocusMode] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [magisterLessons, setMagisterLessons] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [magisterError, setMagisterError] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [subjectLinks, setSubjectLinks] = useState({})
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  const [homeRain, setHomeRain] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [syncTrigger, setSyncTrigger] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  // Swipe between pages
  const swipeTouchStart = useRef(null)

  const handleSwipeTouchStart = (e) => {
    swipeTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleSwipeTouchEnd = (e) => {
    if (!swipeTouchStart.current) return
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current.x
    const dy = e.changedTouches[0].clientY - swipeTouchStart.current.y
    swipeTouchStart.current = null
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 60) return
    const idx = PAGE_ORDER.indexOf(activePage)
    if (dx < 0 && idx < PAGE_ORDER.length - 1) handleSetActivePage(PAGE_ORDER[idx + 1])
    else if (dx > 0 && idx > 0) handleSetActivePage(PAGE_ORDER[idx - 1])
  }

  // Pull-to-refresh
  const pullStartY = useRef(null)
  const pullStartX = useRef(null)
  const [pullProgress, setPullProgress] = useState(0)
  const PULL_THRESHOLD = 65

  const onPullStart = (e) => {
    // Loop omhoog vanaf het aangetikte element; als een scrollbare
    // ancestor al gescrolled is, geen pull-to-refresh starten.
    let el = e.target
    while (el && el !== e.currentTarget) {
      if (el.scrollTop > 0) return
      el = el.parentElement
    }
    pullStartY.current = e.touches[0].clientY
    pullStartX.current = e.touches[0].clientX
  }
  const onPullMove = (e) => {
    if (pullStartY.current === null) return
    const dx = e.touches[0].clientX - pullStartX.current
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy < 0 || Math.abs(dy) < Math.abs(dx)) { pullStartY.current = null; return }
    setPullProgress(Math.min(1, dy / PULL_THRESHOLD))
  }
  const onPullEnd = async () => {
    if (pullProgress >= 1) await doSync()
    pullStartY.current = null
    pullStartX.current = null
    setPullProgress(0)
  }

  // Controleer elke 5 minuten of er een nieuwe deploy beschikbaar is
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now())
        if (!res.ok) return
        const { t } = await res.json()
        if (t > __BUILD_TIME__) setUpdateAvailable(true)
      } catch {}
    }
    check()
    const id = setInterval(check, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch rain data for dashboard
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

  const user = useMemo(() => session?.user || null, [session])
  const isAdmin = user?.email === ADMIN_EMAIL

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) console.error('Error fetching profiles:', error)
    else {
      const rows = data || []
      setProfiles(rows)
      if (user?.id && !rows.find(p => p.id === user.id)) {
        await supabase.from('profiles').upsert({ id: user.id, full_name: user.email?.split('@')[0] || 'Student' })
        fetchProfiles()
      }
    }
  }

  // Onboarding: toon bij elke nieuwe login (eerste keer op dit apparaat)
  useEffect(() => {
    if (!user) return
    const done = localStorage.getItem(`onboarding_done_${user.id}`)
    if (!done) setShowOnboarding(true)
  }, [user])

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

  // Globale push-subscription refresh — draait bij elke app-start als permissie al granted is,
  // ongeacht welke widget meldingen heeft aanstaan (Vracht, Regen, Pomodoro, enz.)
  useEffect(() => {
    if (!user?.id) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    navigator.serviceWorker.ready.then(async (reg) => {
      try {
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) })
        const { data: existing } = await supabase.from('push_subscriptions').select('id').eq('user_id', user.id).maybeSingle()
        if (existing) {
          await supabase.from('push_subscriptions').update({ subscription: sub.toJSON() }).eq('user_id', user.id)
        } else {
          await supabase.from('push_subscriptions').insert({ user_id: user.id, subscription: sub.toJSON() })
        }
      } catch (e) {
        console.error('Global push refresh failed:', e)
      }
    })
  }, [user?.id])

  // Load data
  useEffect(() => {
    if (session && user?.id) {
      fetchTasks(); fetchSubjects(); fetchProfiles(); fetchSubjectLinks()
      supabase.from('calendar_events').select('*').eq('user_id', user.id).then(({ data }) => {
        if (data) setCalendarEvents(data)
      })
    }
  }, [session, user?.id])

  const userProfile = useMemo(() => {
    if (!user?.id) return null
    return profiles.find(p => p.id === user.id) || null
  }, [profiles, user?.id])

  // ── StudieBuddies altijd-aan presence (werkt ook buiten Pomodoro pagina) ──
  const presenceNameRef = useRef('Student')
  useEffect(() => {
    presenceNameRef.current = userProfile?.full_name || user?.email?.split('@')[0] || 'Student'
  }, [userProfile, user])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel('studiebuddies')
    channel.subscribe()
    const iv = setInterval(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('pomodoro_v3'))
        if (saved?.running && saved?.endTime && saved.endTime > Date.now()) {
          channel.track({
            userId: user.id,
            name: presenceNameRef.current,
            mode: saved.mode || 'work',
            endTime: saved.endTime,
          })
          return
        }
      } catch {}
      channel.untrack()
    }, 1000)
    return () => {
      channel.untrack()
      clearInterval(iv)
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Effect voor accent kleur
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', theme.accent)
  }, [theme.accent])

  useEffect(() => {
    const handler = () => { if (user?.id) fetchTasks() }
    window.addEventListener('refreshTasks', handler)
    return () => window.removeEventListener('refreshTasks', handler)
  }, [user?.id])

  useEffect(() => {
    const handler = () => {
      if (user?.id) supabase.from('calendar_events').select('*').eq('user_id', user.id).then(({ data }) => { if (data) setCalendarEvents(data) })
    }
    window.addEventListener('refreshCalendarEvents', handler)
    return () => window.removeEventListener('refreshCalendarEvents', handler)
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
      completed: taskData.completed ?? false,
      priority: taskData.priority ?? 2,
      duration_minutes: taskData.duration_minutes ?? 30,
      due_date: taskData.due_date || null,
    }
    let error
    if (taskData.id) {
      ({ error } = await supabase.from('tasks').update(fields).eq('id', taskData.id).eq('user_id', user.id))
    } else {
      ({ error } = await supabase.from('tasks').insert({ ...fields, completed: false, user_id: user.id }))
    }
    if (error) { console.error('Taak opslaan mislukt:', error); alert('Opslaan mislukt: ' + (error.message || JSON.stringify(error))); return }
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

  const handleSetActivePage = (page) => {
    if (page !== 'pomodoro') setFocusMode(false)
    setActivePage(page)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#00FFD1', borderTopColor: 'transparent' }} />
    </div>
  )

  if (passwordRecovery) return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <PasswordResetPage onDone={() => setPasswordRecovery(false)} />
    </div>
  )

  if (!session) return (
    <div style={{ background: 'var(--bg-base)', height: '100%', overflowY: 'auto' }}>
      <AuthPage />
    </div>
  )

  const displayName = userProfile?.full_name || user?.email?.split('@')[0] || 'Student'

  const handleSubjectsSync = () => { fetchSubjects(); fetchProfiles(); fetchSubjectLinks() }

  const handleTaskAdd = async (data) => {
    if (!user?.id) return
    await supabase.from('tasks').insert({ ...data, completed: false, user_id: user.id })
    fetchTasks()
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', position: 'relative', background: 'var(--bg-base)' }}>
      {/* Blur wrapper voor focus mode */}
      <div style={{
        display: 'flex',
        height: '100%',
        filter: focusMode ? 'blur(4px) brightness(0.4)' : 'none',
        transition: 'filter 0.4s ease',
        pointerEvents: focusMode ? 'none' : 'auto',
      }}>

        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar
            activePage={activePage}
            setActivePage={handleSetActivePage}
            isAdmin={isAdmin}
            user={user}
            onShowSettings={() => setShowThemeSettings(true)}
            onShowAdmin={() => setShowAdmin(true)}
            onLogout={() => supabase.auth.signOut()}
            syncing={syncing}
            syncFlash={syncFlash}
            updateAvailable={updateAvailable}
          />
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
                {PAGE_NAMES[activePage] || 'Hypex'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RefreshCw
                size={12}
                style={{
                  color: syncFlash ? '#1DB954' : 'var(--text-3)',
                  transition: 'color 0.5s',
                  animation: syncing ? 'spin 0.8s linear infinite' : 'none',
                }}
              />
              <button
                onClick={() => setShowThemeSettings(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}
              >
                ⚙️
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Pull-to-refresh indicator */}
          {pullProgress > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: pullProgress * 40, overflow: 'hidden', transition: pullProgress === 0 ? 'height 0.25s ease' : 'none' }}>
              <RefreshCw size={14} style={{ color: 'var(--accent)', opacity: pullProgress, animation: pullProgress >= 1 ? 'spin 0.8s linear infinite' : 'none' }} />
            </div>
          )}
          <div key={activePage} className="page-transition"
            onTouchStart={(e) => { handleSwipeTouchStart(e); onPullStart(e) }}
            onTouchEnd={(e) => { handleSwipeTouchEnd(e); onPullEnd() }}
            onTouchMove={onPullMove}>

            {activePage === 'dashboard' && (
              <DashboardPage
                isBreak={isBreak}
                tasks={tasks}
                subjects={subjects}
                calendarEvents={calendarEvents}
                magisterLessons={magisterLessons}
                magisterError={magisterError}
                displayName={displayName}
                homeRain={homeRain}
                onNavigate={handleSetActivePage}
                setDetailTask={setDetailTask}
                openNewTask={openNewTask}
                onRequestPwaInstall={() => setShowPwaPrompt(true)}
                profiles={profiles}
                userId={user?.id}
              />
            )}

            {activePage === 'pomodoro' && (
              <PomodoroPage
                onModeChange={setIsBreak}
                onFocusModeChange={setFocusMode}
                userId={user?.id}
                profiles={profiles}
              />
            )}

            {activePage === 'agenda' && (
              <AgendaPage
                userId={user.id}
                tasks={tasks}
                subjects={subjects}
                calendarEvents={calendarEvents}
                magisterLessons={magisterLessons}
                onToggleTask={handleToggleTask}
                onEditTask={openEditTask}
                isAdmin={isAdmin}
                onLessonsChange={setMagisterLessons}
                onEventsChange={setCalendarEvents}
                onMagisterError={setMagisterError}
              />
            )}

            {activePage === 'school' && (
              <SchoolPage
                userId={user.id}
                onSubjectsSync={handleSubjectsSync}
              />
            )}

            {activePage === 'taken' && (
              <TakenPage
                tasks={tasks}
                subjects={subjects}
                onAdd={handleTaskAdd}
                onEdit={openEditTask}
                onDelete={handleDeleteTask}
                onToggle={handleToggleTask}
                onViewDetail={setDetailTask}
                onNew={() => openNewTask()}
              />
            )}

            {activePage === 'gewoontes' && (
              <GewoontesPage userId={user.id} syncTrigger={syncTrigger} />
            )}

            {activePage === 'notities' && (
              <NotitiesPage userId={user.id} syncTrigger={syncTrigger} />
            )}

            {activePage === 'statistieken' && (
              <StatsPage tasks={tasks} userId={user.id} />
            )}

            {activePage === 'jumbo' && isAdmin && (
              <JumboPage isAdmin={isAdmin} userId={user?.id} />
            )}

          </div>
          </div>

          {/* Mobile bottom nav */}
          <div className="md:hidden">
            <BottomNav
              activePage={activePage}
              setActivePage={handleSetActivePage}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>

      {/* Modals / Overlays */}
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
          calendarEvents={calendarEvents}
          tasks={tasks}
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

      {showOnboarding && (
        <OnboardingModal user={user} onClose={() => setShowOnboarding(false)} />
      )}

      {showPwaPrompt && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', padding: '16px' }}
          onClick={() => setShowPwaPrompt(false)}
        >
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>App installeren</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Om meldingen te ontvangen (ook als de pagina gesloten is), installeer de app op je beginscherm:
            </p>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', margin: '0 0 6px' }}>iPhone / iPad (Safari):</p>
              <ol style={{ fontSize: 12, color: 'var(--text-2)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                <li>Tik op het Deel-icoon <span style={{ fontSize: 14 }}>⎋</span> onderaan</li>
                <li>Kies <b style={{ color: 'var(--text-1)' }}>"Zet op beginscherm"</b></li>
                <li>Tik op <b style={{ color: 'var(--text-1)' }}>Voeg toe</b></li>
              </ol>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', margin: '0 0 6px' }}>Android (Chrome):</p>
              <ol style={{ fontSize: 12, color: 'var(--text-2)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                <li>Tik op het menu <b style={{ color: 'var(--text-1)' }}>⋮</b> rechtsboven</li>
                <li>Kies <b style={{ color: 'var(--text-1)' }}>"App installeren"</b> of <b style={{ color: 'var(--text-1)' }}>"Toevoegen aan beginscherm"</b></li>
              </ol>
            </div>
            <button onClick={() => setShowPwaPrompt(false)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card-2)', color: 'var(--text-1)', cursor: 'pointer', fontSize: 13 }}>
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
