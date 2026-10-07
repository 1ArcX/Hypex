import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './components/AuthPage'
import ItemModal from './components/ItemModal'
import TaskDetailModal from './components/TaskDetailModal'
import { RefreshCw, Settings } from 'lucide-react'
import ThemeSettings from './components/ThemeSettings'
import AdminPanel from './components/AdminPanel'
import PasswordResetPage from './components/PasswordResetPage'
import OnboardingModal from './components/OnboardingModal'

import Sidebar from './components/Sidebar'
import { useNavLayout } from './hooks/useNavLayout'
import VersionChecker from './components/VersionChecker'
import { callMagister } from './utils/magisterApi'
import { ensureSomtodayCreds } from './utils/somtodayApi'
import { awardXP, XP_TASK } from './utils/xp'
import { advanceOnComplete, revertOnUncomplete, isDoneToday, todayISO } from './utils/recurrence'
import { isOverdue } from './utils/taskStatus'
import { fetchLatestVersion } from './utils/version'
import { autoSyncCalendars } from './utils/calendarSync'
import { loadItemTypes, useItemTypes } from './hooks/useItemTypes'
import { loadExternalEvents, loadUnseenChanges, markChangesSeen } from './utils/externalEvents'
import { FeedChangesToast, FeedChangesSheet } from './components/FeedChanges'
import { VAPID_PUBLIC, urlBase64ToUint8Array } from './utils/push'
import XPToast from './components/XPToast'
import BottomNav from './components/BottomNav'
import DashboardPage from './pages/DashboardPage'
import PomodoroPage from './pages/PomodoroPage'
import AgendaPage from './pages/AgendaPage'
import TakenPage from './pages/TakenPage'
import NotitiesPage from './pages/NotitiesPage'
import CommandPalette from './components/CommandPalette'
import PomodoroBanner, { usePomodoroState } from './components/dashboard/PomodoroBanner'

// Minder gebruikte / zware pagina's (Geld → recharts, Jumbo → maplibre) pas laden bij openen
const SchoolPage = lazy(() => import('./pages/SchoolPage'))
const GewoontesPage = lazy(() => import('./pages/GewoontesPage'))
const GymPage = lazy(() => import('./pages/GymPage'))
const JumboPage = lazy(() => import('./pages/JumboPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const GeldPage = lazy(() => import('./pages/GeldPage'))
const HypexAIPage = lazy(() => import('./pages/HypexAIPage'))
const FocusPage = lazy(() => import('./focus/FocusPage'))

const ADMIN_EMAIL = 'zhafirfachri@gmail.com'

const PAGE_NAMES = {
  dashboard: 'Home', agenda: 'Agenda', taken: 'Taken',
  focus: 'Focus', pomodoro: 'Pomodoro', school: 'School',
  gewoontes: 'Gewoontes', gym: 'Gym', notities: 'Notities', statistieken: 'Statistieken', jumbo: 'Jumbo', geld: 'Geld', hypexai: 'Hypex AI',
}

const PAGE_ORDER = ['dashboard', 'agenda', 'taken', 'focus', 'school', 'gewoontes', 'notities', 'statistieken']

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [tasks, setTasks] = useState([])
  const [groupOrder, setGroupOrder] = useState([])
  const [subjects, setSubjects] = useState([])
  const [isBreak, setIsBreak] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [defaultTime, setDefaultTime] = useState('09:00')
  const [defaultDate, setDefaultDate] = useState('')
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('app_theme'))
      if (saved?.accent) return saved
    } catch {}
    return { accent: '#00FFD1', bg1: '#0f0f0f', bg2: '#171717' }
  })
  const [focusMode, setFocusMode] = useState(false)
  const [meerOpen, setMeerOpen] = useState(false) // mobiele "Meer"-sheet open → Taken-FAB verbergen
  const [profiles, setProfiles] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)
  const [activePage, setActivePage] = useState(() => { const p = localStorage.getItem('activePage') || 'dashboard'; return p === 'pomodoro' ? 'focus' : p })
  const [taskHighlight, setTaskHighlight] = useState(null)
  const [agendaJump, setAgendaJump] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false) // "Zoek in Hypex" (Ctrl/⌘K)
  const [noteJump, setNoteJump] = useState(null)
  const [magisterLessons, setMagisterLessons] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  // Geïmporteerde agenda's (MyX/Google) — alleen-lezen, voor Dashboard "Volgende afspraak" en zoeken.
  // Los van calendarEvents zodat de Timeline haar eigen (bewerkbare) lijst houdt.
  const [externalEvents, setExternalEvents] = useState([])
  const [feedChanges, setFeedChanges] = useState([]) // niet-geziene wijzigingen in gekoppelde agenda's
  const [feedSheetOpen, setFeedSheetOpen] = useState(false)
  const [magisterError, setMagisterError] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [pomodoroSeedTask, setPomodoroSeedTask] = useState(null)
  const [subjectLinks, setSubjectLinks] = useState({})
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  const [homeRain, setHomeRain] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [syncTrigger, setSyncTrigger] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [xpToast, setXpToast] = useState(null) // { xp, icon }
  const [hasLevelUp, setHasLevelUp] = useState(() => !!localStorage.getItem('levelup_pending'))
  const [hasActiveGymWorkout, setHasActiveGymWorkout] = useState(() => !!localStorage.getItem('gym_active_workout'))
  const [hasActivePomo, setHasActivePomo] = useState(false)
  const pomo = usePomodoroState() // timer-balk bovenaan elke tab (behalve Focus zelf)
  useItemTypes() // types veranderd (naam/kleur) → hele app opnieuw renderen met de nieuwe kleuren

  // Listen for level-up events dispatched by awardXP utility
  useEffect(() => {
    const handler = () => setHasLevelUp(true)
    window.addEventListener('levelup', handler)
    return () => window.removeEventListener('levelup', handler)
  }, [])

  // Listen for gym workout start/stop events
  useEffect(() => {
    const handler = (e) => setHasActiveGymWorkout(e.detail.active)
    window.addEventListener('gymWorkoutChange', handler)
    return () => window.removeEventListener('gymWorkoutChange', handler)
  }, [])

  // Track keyboard height via visualViewport → CSS variable --keyboard-height
  // (gebruikt door modals/sheets om boven het toetsenbord te blijven).
  // Geen window.scrollTo-tegenscroll meer: die vocht tegen iOS' eigen
  // scroll-naar-invoer (scroll-lock tijdens typen) en liet na het sluiten een
  // rest-offset achter (app bleef omhoog gesprongen). De app krimpt nu netjes
  // mee via --app-height, dus scrollen werkt en alles veert terug.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      // Zelf-aanpassend: bij resizes-content krimpt de layout (window.innerHeight)
      // mee → verschil ≈ 0, dus geen extra verschuiving. Bij resizes-visual blijft
      // innerHeight vol en krimpt alleen de visual viewport → verschil = toetsen-
      // bordhoogte, zodat modals/sheets boven het toetsenbord blijven.
      const kh = Math.max(0, window.innerHeight - vv.height)
      document.documentElement.style.setProperty('--keyboard-height', `${kh}px`)
    }
    vv.addEventListener('resize', onResize)
    return () => {
      vv.removeEventListener('resize', onResize)
      document.documentElement.style.setProperty('--keyboard-height', '0px')
    }
  }, [])

  // Scroll het gefocuste invoerveld in beeld (boven het toetsenbord). visualViewport
  // is op deze iOS-PWA onbetrouwbaar voor toetsenbordhoogte, dus we vertrouwen op
  // scrollIntoView binnen de scroll-container i.p.v. op de viewport-hoogte.
  useEffect(() => {
    const onFocusIn = (e) => {
      const t = e.target
      if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable)) return
      // Wacht tot het toetsenbord is opgekomen, scroll dan het veld naar het midden
      setTimeout(() => {
        try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch {}
      }, 300)
    }
    window.addEventListener('focusin', onFocusIn)
    return () => window.removeEventListener('focusin', onFocusIn)
  }, [])

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
      const t = await fetchLatestVersion()
      if (t && t > __BUILD_TIME__) setUpdateAvailable(true)
    }
    check()
    const id = setInterval(check, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Achtergrond-sync: Magister rooster + PMT diensten bij opstarten
  useEffect(() => {
    if (!session) return
    const uid = session.user?.id
    if (!uid) return

    const pad = n => String(n).padStart(2, '0')
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

    const syncMagister = async () => {
      try {
        const creds = JSON.parse(localStorage.getItem(`magister_credentials_${uid}`))
        if (!creds) return
        const now = new Date()
        const day = now.getDay()
        const ws = new Date(now); ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); ws.setHours(0,0,0,0)
        const we = new Date(ws); we.setDate(ws.getDate() + 6)
        for (let i = 0; i < 2; i++) {
          const start = new Date(ws.getTime() + i * 7 * 86400000)
          const end   = new Date(we.getTime() + i * 7 * 86400000)
          const key = `magister_sched_${fmt(start)}_${fmt(end)}`
          if (sessionStorage.getItem(key)) continue
          try {
            const lessons = await callMagister(creds, 'schedule', { start: start.toISOString(), end: end.toISOString() })
            if (Array.isArray(lessons)) sessionStorage.setItem(key, JSON.stringify(lessons))
          } catch {}
        }
      } catch {}
    }

    const syncPMT = async () => {
      try {
        const pmtCreds = JSON.parse(localStorage.getItem('pmt_credentials'))
        if (!pmtCreds) return
        const cached = JSON.parse(localStorage.getItem('pmt_work_shifts')) || []
        const todayStr = todayISO()
        if (cached.some(s => s.date >= todayStr)) return // al vers
        const isoWeek = (d = new Date()) => {
          const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
          const day = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - day)
          const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
          return { week: Math.ceil((((dt - ys) / 86400000) + 1) / 7), year: dt.getUTCFullYear() }
        }
        const weeksInYear = y => { const d = new Date(y,11,28); const j = new Date(y,0,4); return Math.ceil(((d-j)/86400000+j.getDay()+1)/7) }
        let { week: w, year: y } = isoWeek()
        const allShifts = []
        for (let i = 0; i < 3; i++) {
          try {
            const res = await fetch('/.netlify/functions/pmt', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...pmtCreds, action:'schedule', week:w, year:y }) })
            const data = await res.json()
            if (data.shifts) allShifts.push(...data.shifts)
          } catch {}
          w++; if (w > weeksInYear(y)) { y++; w = 1 }
        }
        if (allShifts.length) localStorage.setItem('pmt_work_shifts', JSON.stringify(allShifts))
      } catch {}
    }

    if (session?.user?.email !== 'jbrugman.prive@gmail.com') syncMagister()
    syncPMT()
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (user?.id) {
        const existing = rows.find(p => p.id === user.id)
        if (!existing) {
          await supabase.from('profiles').upsert({ id: user.id, full_name: user.email?.split('@')[0] || 'Student', email: user.email })
          fetchProfiles()
        } else if (!existing.email && user.email) {
          await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
          fetchProfiles()
        }
        if (existing?.group_order?.length) setGroupOrder(existing.group_order)
      }
    }
  }

  // Realtime: herlaad profiel als admin werk_tab toggled
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel('my-profile')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${user.id}`
      }, () => fetchProfiles())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  // Onboarding: toon bij elke nieuwe login (eerste keer op dit apparaat)
  useEffect(() => {
    if (!user) return
    const done = localStorage.getItem(`onboarding_done_${user.id}`)
    if (!done) setShowOnboarding(true)
  }, [user])

  // SOMtoday: zorg dat creds in localStorage staan bij elke app-start (singleton)
  useEffect(() => {
    if (!user?.id) return
    ensureSomtodayCreds(user.id).catch(() => {})
  }, [user?.id])

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

  // Global push-subscription refresh on every app start when permission is already granted.
  // Only writes to Supabase when the endpoint actually changed (avoids unnecessary updates).
  useEffect(() => {
    if (!user?.id) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    navigator.serviceWorker.ready.then(async (reg) => {
      try {
        // Get existing subscription — subscribe() is idempotent and returns the
        // current one if still valid. Only creates a new one if iOS revoked it.
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          })
        }
        const subJson = sub.toJSON()

        const { data: rows } = await supabase
          .from('push_subscriptions')
          .select('id, subscription, vracht_enabled, vracht_notify_stops')
          .eq('user_id', user.id)

        if (rows && rows.length > 0) {
          const row = rows[0]
          const update = { subscription: subJson }
          if (row.vracht_notify_stops?.length) update.vracht_enabled = true
          // Only write to DB if endpoint changed
          if (row.subscription?.endpoint !== subJson.endpoint) {
            await supabase.from('push_subscriptions').update(update).eq('id', row.id)
          }
          if (rows.length > 1) {
            await supabase.from('push_subscriptions').delete().in('id', rows.slice(1).map(r => r.id))
          }
        } else {
          await supabase.from('push_subscriptions').insert({ user_id: user.id, subscription: subJson })
        }
      } catch (e) {
        console.error('Global push refresh failed:', e)
      }
    })
  }, [user?.id])

  const fetchExternalEvents = useCallback(async () => {
    const since = new Date(Date.now() - 86400000).toISOString()
    const data = await loadExternalEvents({ since, limit: 500 })
    if (!data) return
    setExternalEvents(data.filter(ev => !ev.hidden))
    setFeedChanges(await loadUnseenChanges())
  }, [])

  const markFeedChangesSeen = useCallback(() => {
    const ids = feedChanges.map(c => c.id)
    setFeedChanges([]); setFeedSheetOpen(false)
    markChangesSeen(ids)
  }, [feedChanges])

  // Load data
  useEffect(() => {
    if (session && user?.id) {
      fetchTasks(); fetchSubjects(); fetchProfiles(); fetchSubjectLinks(); fetchExternalEvents()
      loadItemTypes(user.id)
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
  const [studieBuddiesOnline, setStudieBuddiesOnline] = useState([])
  useEffect(() => {
    presenceNameRef.current = userProfile?.full_name || user?.email?.split('@')[0] || 'Student'
  }, [userProfile, user])

  useEffect(() => {
    if (!user?.id) return
    // Use userId as presence key → prevents duplicates when refreshing / multiple tabs
    const channel = supabase.channel('studiebuddies', {
      config: { presence: { key: user.id } },
    })
    const syncUsers = () => {
      const seen = new Set()
      const users = []
      for (const entries of Object.values(channel.presenceState())) {
        for (const entry of entries) {
          if (!seen.has(entry.userId)) {
            seen.add(entry.userId)
            users.push(entry)
          }
        }
      }
      setStudieBuddiesOnline(users)
    }
    const trackNow = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('pomodoro_v3'))
        if (saved?.running && ((saved?.endTime && saved.endTime > Date.now()) || (saved?.timerKind === 'stopwatch' && saved?.swStart))) {
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
    }
    channel
      .on('presence', { event: 'sync' },  syncUsers)
      .on('presence', { event: 'join' },  syncUsers)
      .on('presence', { event: 'leave' }, syncUsers)
      .subscribe(status => { if (status === 'SUBSCRIBED') trackNow() })
    const iv = setInterval(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('pomodoro_v3'))
        if (saved?.running && ((saved?.endTime && saved.endTime > Date.now()) || (saved?.timerKind === 'stopwatch' && saved?.swStart))) {
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

  // Effect voor accent kleur + persistentie
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', theme.accent)
    if (theme.bg1) document.documentElement.style.setProperty('--bg1', theme.bg1)
    if (theme.bg2) document.documentElement.style.setProperty('--bg2', theme.bg2)
    try { localStorage.setItem('app_theme', JSON.stringify(theme)) } catch {}
  }, [theme.accent, theme.bg1, theme.bg2])

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

  // Timeline zet via onEventsChange ook geïmporteerde items in calendarEvents → ontdubbelen
  const allEvents = useMemo(() => [...calendarEvents.filter(e => !e.external), ...externalEvents], [calendarEvents, externalEvents])

  // Auto-sync elke 30 seconden
  const doSync = useCallback(async () => {
    if (!user?.id) return
    setSyncing(true)
    await Promise.all([
      fetchTasks(),
      fetchSubjects(),
      fetchExternalEvents(),
      supabase.from('calendar_events').select('*').eq('user_id', user.id).then(({ data }) => {
        if (data) setCalendarEvents(data)
      }),
    ])
    setSyncTrigger(t => t + 1)
    setSyncing(false)
    setSyncFlash(true)
    setTimeout(() => setSyncFlash(false), 2000)
    // Gekoppelde agenda's (Google/MijnX) bij de bron bijwerken — hooguit elke 5 min, op de achtergrond
    autoSyncCalendars().then(ran => {
      if (!ran) return
      fetchExternalEvents()
      window.dispatchEvent(new Event('refreshExternalCalendarEvents'))
    })
  }, [user?.id])

  useEffect(() => {
    if (!session || !user?.id) return
    const interval = setInterval(doSync, 30000)
    // Terug naar de app/tab: meteen bijwerken
    const onVisible = () => { if (document.visibilityState === 'visible') doSync() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [session, user?.id, doSync])

  const fetchTasks = async () => {
    if (!user?.id) return
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('sort_order', { ascending: true, nullsFirst: false }).order('date', { ascending: true })
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

  const handleMoveToGroup = async (taskId, groupName) => {
    await supabase.from('tasks').update({ group_name: groupName || null }).eq('id', taskId).eq('user_id', user.id)
    fetchTasks()
  }

  const handleReorder = async (sourceId, targetId, position) => {
    const src = tasks.find(t => String(t.id) === String(sourceId))
    const tgt = tasks.find(t => String(t.id) === String(targetId))
    if (!src || !tgt) return
    const destGroup = tgt.group_name || null
    // Build new ordered list for destination group, remove source first
    const destTasks = tasks
      .filter(t => !t.completed && (t.group_name || null) === destGroup && String(t.id) !== String(sourceId))
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
    const tgtIdx = destTasks.findIndex(t => String(t.id) === String(targetId))
    destTasks.splice(position === 'before' ? tgtIdx : tgtIdx + 1, 0, { ...src, group_name: destGroup })
    const updates = destTasks.map((t, i) => ({ id: t.id, sort_order: i * 10, group_name: destGroup }))
    // Optimistic update
    setTasks(prev => {
      const map = Object.fromEntries(updates.map(u => [u.id, u]))
      return prev.map(t => map[t.id] ? { ...t, ...map[t.id] } : t)
    })
    // Persist
    await Promise.all(updates.map(u =>
      supabase.from('tasks').update({ sort_order: u.sort_order, group_name: u.group_name }).eq('id', u.id).eq('user_id', user.id)
    ))
  }

  const handleReorderGroups = async (srcGroup, tgtGroup, position) => {
    const allGroupNames = [...new Set(tasks.filter(t => t.group_name).map(t => t.group_name))]
    const current = [...groupOrder.filter(g => allGroupNames.includes(g)), ...allGroupNames.filter(g => !groupOrder.includes(g))]
    const withoutSrc = current.filter(g => g !== srcGroup)
    const tgtIdx = withoutSrc.indexOf(tgtGroup)
    withoutSrc.splice(position === 'before' ? tgtIdx : tgtIdx + 1, 0, srcGroup)
    setGroupOrder(withoutSrc)
    await supabase.from('profiles').update({ group_order: withoutSrc }).eq('id', user.id)
  }

  const handleDeleteTask = async (id) => {
    navigator.vibrate?.([30, 40, 30])
    await supabase.from('tasks').delete().eq('id', id)
    setShowTaskModal(false)
    setSelectedTask(null)
    fetchTasks()
  }

  const handleToggleTask = async (task) => {
    // Herhalende taak: afvinken schuift door naar de volgende keer + streak,
    // i.p.v. permanent op "afgerond" te zetten.
    if (task.recurrence) {
      const today = todayISO()
      if (isDoneToday(task, today)) {
        // Ongedaan maken (misklik): streak en datum terugdraaien
        const upd = revertOnUncomplete(task, today)
        navigator.vibrate?.(20)
        await supabase.from('tasks').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', task.id)
        awardXP(user?.id, -XP_TASK)
      } else {
        const upd = advanceOnComplete(task, today)
        if (!upd) return
        navigator.vibrate?.(40)
        await supabase.from('tasks').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', task.id)
        awardXP(user?.id, XP_TASK)
        setXpToast({ xp: XP_TASK, icon: upd.streak > 1 ? '🔥' : '✓' })
      }
      fetchTasks()
      return
    }

    const completing = !task.completed
    navigator.vibrate?.(completing ? 40 : 20)
    await supabase.from('tasks').update({ completed: completing, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (completing) {
      awardXP(user?.id, XP_TASK)
      setXpToast({ xp: XP_TASK, icon: '✓' })
    } else {
      awardXP(user?.id, -XP_TASK)
    }
    fetchTasks()
  }

  const openNewTask = (time) => {
    setSelectedTask(null)
    // null = generieke nieuwe taak (standaard hele dag); een echte tijd = vanuit een tijdslot
    setDefaultTime(time || null)
    setShowTaskModal(true)
  }

  const openEditTask = (task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const handleSetActivePage = (page) => {
    if (page !== 'pomodoro' && page !== 'focus') setFocusMode(false)
    setActivePage(page)
    localStorage.setItem('activePage', page)
  }

  // Aantal te late (open, datum < vandaag) taken — sidebar-badge
  const overdueCount = useMemo(() => {
    const t = todayISO()
    return tasks.filter(x => isOverdue(x, t)).length
  }, [tasks])

  // Desktop-navigatie: positie (links/boven) + automatisch verbergen (per apparaat)
  const [navLayout] = useNavLayout()
  const navTop = navLayout.position === 'top'
  const [navShown, setNavShown] = useState(false)
  const navHideTimer = useRef(null)
  const showNav = useCallback(() => { clearTimeout(navHideTimer.current); setNavShown(true) }, [])
  const hideNavSoon = useCallback(() => {
    clearTimeout(navHideTimer.current)
    navHideTimer.current = setTimeout(() => setNavShown(false), 400)
  }, [])
  useEffect(() => () => clearTimeout(navHideTimer.current), [])
  // Na navigeren via de verborgen balk: direct inklappen
  useEffect(() => { if (navLayout.autoHide) setNavShown(false) }, [activePage, navLayout.autoHide])

  // Ctrl/⌘K opent de zoekpalette (alleen ingelogd)
  useEffect(() => {
    if (!session) return
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (passwordRecovery) return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <PasswordResetPage onDone={() => setPasswordRecovery(false)} />
    </div>
  )

  if (!session) return (
    <div style={{ background: 'var(--bg-base)', height: 'var(--app-height, 100dvh)', overflowY: 'auto' }}>
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
    <div style={{
      height: '100dvh', position: 'relative',
      overflow: 'hidden', background: 'var(--bg-base)',
    }}>
      {/* Blur wrapper voor focus mode */}
      <div style={{
        display: 'flex',
        flexDirection: navTop ? 'column' : 'row',
        height: '100%',
        filter: focusMode ? 'blur(4px) brightness(0.4)' : 'none',
        transition: 'filter 0.4s ease',
        pointerEvents: focusMode ? 'none' : 'auto',
      }}>

        {/* Desktop navigatie — zijbalk links of balk boven, optioneel automatisch verbergen */}
        {navLayout.autoHide && (
          <div className={`hidden md:block hx-nav-hotzone ${navTop ? 'is-top' : 'is-left'}${overdueCount > 0 ? ' has-alert' : ''}`}
            onMouseEnter={showNav} aria-hidden="true" />
        )}
        <div className={`hidden md:block hx-nav-wrap ${navTop ? 'is-top' : 'is-left'}${navLayout.autoHide ? ' is-auto' : ''}${navShown ? ' is-shown' : ''}`}
          onMouseEnter={navLayout.autoHide ? showNav : undefined}
          onMouseLeave={navLayout.autoHide ? hideNavSoon : undefined}>
          <Sidebar
            orientation={navTop ? 'horizontal' : 'vertical'}
            activePage={activePage}
            setActivePage={handleSetActivePage}
            isAdmin={isAdmin}
            showJumbo={isAdmin || !!userProfile?.werk_tab}
            user={user}
            onShowSettings={() => setShowThemeSettings(true)}
            onShowAdmin={() => setShowAdmin(true)}
            onLogout={() => supabase.auth.signOut({ scope: 'local' })}
            onOpenSearch={() => setPaletteOpen(true)}
            overdueCount={overdueCount}
            syncing={syncing}
            syncFlash={syncFlash}
            updateAvailable={updateAvailable}
            hasLevelUp={hasLevelUp}
            hasActiveGymWorkout={hasActiveGymWorkout}
            hasActivePomo={hasActivePomo}
          />
        </div>

        {/* Main area — position:relative zodat de zwevende navbar hieraan ankert
            (zelfde --app-height-referentie als de inhoud, geen verspringende band) */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Mobile header — iOS navigation bar: titel gecentreerd.
              Statusbalk is 'black-translucent' (viewport-fit=cover): de app loopt door onder klok/notch/
              Dynamic Island, dus de header krijgt de safe-area erbij en zet de inhoud eronder. */}
          <div className="md:hidden flex items-center justify-between px-4"
            style={{ height: 'calc(52px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)', boxSizing: 'border-box', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', flexShrink: 0, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, lineHeight: '52px', textAlign: 'center', pointerEvents: 'none',
              fontWeight: 600, fontSize: 17, color: 'var(--text-1)', letterSpacing: '-0.02em',
            }}>
              {PAGE_NAMES[activePage] || 'Hypex'}
            </span>
            <span />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Sync dot — tap to sync manually */}
              <button
                onClick={() => { if (!syncing) doSync() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
                title="Handmatig synchroniseren"
              >
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: syncFlash ? '#1DB954' : syncing ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                  boxShadow: syncing ? '0 0 6px var(--accent)' : 'none',
                  transition: 'background 0.4s, box-shadow 0.4s',
                }} />
              </button>
              <button
                onClick={() => setShowThemeSettings(true)}
                aria-label="Instellingen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 8 }}
              >
                <Settings size={17} />
              </button>
            </div>
          </div>

          {/* Pomodoro / stopwatch loopt: balk bovenaan elke tab, behalve Focus (daar staat de timer zelf) */}
          {(pomo.running || pomo.paused) && activePage !== 'focus' && (
            <div className="app-pomo-banner">
              <PomodoroBanner st={pomo} onOpen={() => handleSetActivePage('focus')} />
            </div>
          )}

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Pull-to-refresh indicator */}
          {pullProgress > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: pullProgress * 40, overflow: 'hidden', transition: pullProgress === 0 ? 'height 0.25s ease' : 'none' }}>
              <RefreshCw size={14} style={{ color: 'var(--accent)', opacity: pullProgress, animation: pullProgress >= 1 ? 'spin 0.8s linear infinite' : 'none' }} />
            </div>
          )}
          <div key={activePage} className="page-transition"
            onTouchStart={onPullStart}
            onTouchEnd={onPullEnd}
            onTouchMove={onPullMove}>

            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><RefreshCw size={18} className="animate-spin" style={{ color: 'var(--c-text-3)' }} /></div>}>

            {activePage === 'dashboard' && (
              <DashboardPage
                isBreak={isBreak}
                tasks={tasks}
                subjects={subjects}
                calendarEvents={allEvents}
                magisterLessons={magisterLessons}
                magisterError={magisterError}
                displayName={displayName}
                homeRain={homeRain}
                onNavigate={handleSetActivePage}
                onNavigateToTasks={(filter) => { setTaskHighlight(filter); setActivePage('taken') }}
                onNavigateToAgenda={(date, highlightKey) => { setAgendaJump({ date, highlightKey }); handleSetActivePage('agenda') }}
                setDetailTask={setDetailTask}
                openNewTask={openNewTask}
                onRequestPwaInstall={() => setShowPwaPrompt(true)}
                profiles={profiles}
                userId={user?.id}
                onToggleTask={handleToggleTask}
                isAdmin={isAdmin}
                onOpenSearch={() => setPaletteOpen(true)}
              />
            )}

            {activePage === 'focus' && user && (
              <FocusPage
                userId={user.id}
                onModeChange={setIsBreak}
                onFocusModeChange={setFocusMode}
                onPomodoroActive={setHasActivePomo}
                seedTask={pomodoroSeedTask}
                onSeedConsumed={() => setPomodoroSeedTask(null)}
                onHome={() => handleSetActivePage('dashboard')}
              />
            )}

            {/* INACTIVE: vervangen door Focus (niet meer in de navigatie) */}
            {activePage === 'pomodoro' && (
              <PomodoroPage
                onModeChange={setIsBreak}
                onFocusModeChange={setFocusMode}
                onPomodoroActive={setHasActivePomo}
                userId={user?.id}
                profiles={profiles}
                onlineUsers={studieBuddiesOnline}
                onXPEarned={(xp) => setXpToast({ xp, icon: '🍅' })}
                tasks={tasks}
                onToggleTask={handleToggleTask}
                seedTask={pomodoroSeedTask}
                onSeedConsumed={() => setPomodoroSeedTask(null)}
              />
            )}

            {activePage === 'agenda' && (
              <AgendaPage
                userId={user.id}
                userEmail={user.email}
                tasks={tasks}
                subjects={subjects}
                calendarEvents={calendarEvents}
                magisterLessons={magisterLessons}
                onToggleTask={handleToggleTask}
                onEditTask={openEditTask}
                onViewDetail={setDetailTask}
                isAdmin={isAdmin}
                onLessonsChange={setMagisterLessons}
                onEventsChange={setCalendarEvents}
                onMagisterError={setMagisterError}
                jumpTo={agendaJump}
                onJumpHandled={() => setAgendaJump(null)}
              />
            )}

            {activePage === 'school' && (
              <SchoolPage
                userId={user.id}
                userEmail={user.email}
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
                onMoveToGroup={handleMoveToGroup}
                onReorder={handleReorder}
                onReorderGroups={handleReorderGroups}
                groupOrder={groupOrder}
                highlightFilter={taskHighlight}
                onClearHighlight={() => setTaskHighlight(null)}
                hideFab={meerOpen}
              />
            )}

            {activePage === 'gewoontes' && (
              <GewoontesPage userId={user.id} syncTrigger={syncTrigger} />
            )}

            {activePage === 'gym' && (
              <GymPage userId={user.id} onXPEarned={(xp) => setXpToast({ xp, icon: '🏋️' })} />
            )}

            {activePage === 'notities' && (
              <NotitiesPage userId={user.id} syncTrigger={syncTrigger} openNoteId={noteJump} />
            )}

            {activePage === 'statistieken' && (
              <StatsPage tasks={tasks} userId={user.id} profiles={profiles} onLevelUpSeen={() => setHasLevelUp(false)} />
            )}

            {activePage === 'jumbo' && (isAdmin || userProfile?.werk_tab) && (
              <JumboPage isAdmin={isAdmin || !!userProfile?.werk_tab} userId={user?.id} />
            )}

            {activePage === 'geld' && isAdmin && (
              <GeldPage userId={user.id} onClose={() => handleSetActivePage('dashboard')} />
            )}

            {activePage === 'hypexai' && isAdmin && (
              <HypexAIPage userId={user.id} tasks={tasks} subjects={subjects} displayName={displayName}
                calendarEvents={allEvents} magisterLessons={magisterLessons}
                onNavigate={handleSetActivePage}
                onNavigateToTasks={(filter) => { setTaskHighlight(filter); setActivePage('taken') }}
                onNavigateToAgenda={(date, highlightKey) => { setAgendaJump({ date, highlightKey }); handleSetActivePage('agenda') }} />
            )}

            </Suspense>

          </div>
          </div>

          {/* Mobile bottom nav — fixed, spacer holds its height in the flex column.
              Niet in Focus/Geld: die hebben hun eigen balk met een ✕ terug naar Home. */}
          {!(activePage === 'focus' || (activePage === 'geld' && isAdmin)) && <div className="md:hidden" style={{ height: 'calc(72px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
            <BottomNav
              activePage={activePage}
              setActivePage={handleSetActivePage}
              isAdmin={isAdmin}
              showJumbo={isAdmin || !!userProfile?.werk_tab}
              hasLevelUp={hasLevelUp}
              hasActiveGymWorkout={hasActiveGymWorkout}
              hasActivePomo={hasActivePomo}
              onSheetChange={setMeerOpen}
            />
          </div>}
        </div>
      </div>

      {/* Modals / Overlays */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        userId={user?.id}
        tasks={tasks}
        calendarEvents={allEvents}
        isAdmin={isAdmin}
        showJumbo={isAdmin || !!userProfile?.werk_tab}
        onNavigate={handleSetActivePage}
        onOpenTask={t => setDetailTask(t)}
        onOpenEvent={ev => { setAgendaJump({ date: new Date(ev.start_time), highlightKey: `event:${ev.id}` }); handleSetActivePage('agenda') }}
        onOpenNote={n => { setNoteJump(n.id); handleSetActivePage('notities') }}
        onNewTask={() => openNewTask()}
      />
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} profiles={profiles} onProfilesChange={fetchProfiles} />}

      {showThemeSettings && (
        <ThemeSettings
          onClose={() => setShowThemeSettings(false)}
          theme={theme}
          setTheme={setTheme}
          onLogout={() => supabase.auth.signOut({ scope: 'local' })}
          userEmail={user?.email}
          userId={user?.id}
        />
      )}

      {showTaskModal && (
        <ItemModal
          kind="task"
          task={selectedTask}
          defaults={{ date: defaultDate || undefined, startTime: defaultTime || undefined }}
          userId={user?.id}
          subjects={subjects}
          calendarEvents={allEvents}
          tasks={tasks}
          allTasks={tasks}
          onClose={() => { setShowTaskModal(false); setSelectedTask(null) }}
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
          onStartPomodoro={() => { setPomodoroSeedTask(detailTask); setDetailTask(null); setActivePage('focus') }}
          onSaveDescription={async (id, description) => {
            await supabase.from('tasks').update({ description }).eq('id', id)
            fetchTasks()
          }}
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

      {feedChanges.length > 0 && !feedSheetOpen && (
        <FeedChangesToast changes={feedChanges} onOpen={() => setFeedSheetOpen(true)} onDismiss={markFeedChangesSeen} />
      )}
      {feedSheetOpen && (
        <FeedChangesSheet
          changes={feedChanges}
          editedKeys={new Set(externalEvents.filter(ev => ev._override).map(ev => `${ev.connection_id}|${ev.external_id}`))}
          onClose={() => setFeedSheetOpen(false)}
          onSeen={markFeedChangesSeen}
          onJump={c => {
            const ev = externalEvents.find(e => e.connection_id === c.connection_id && e.external_id === c.external_id)
            const when = (c.after || c.before)?.start_time
            setFeedSheetOpen(false)
            setAgendaJump({ date: new Date(ev?.start_time || when), highlightKey: ev ? `event:${ev.id}` : null })
            handleSetActivePage('agenda')
          }} />
      )}
      {xpToast && (
        <XPToast
          xp={xpToast.xp}
          icon={xpToast.icon}
          onDone={() => setXpToast(null)}
        />
      )}
    </div>
  )
}
