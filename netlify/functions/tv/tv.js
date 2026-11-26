// Unified TV / projector endpoint — één GET-call voor het Android TV-startscherm.
// Combineert taken, routines, agenda (eigen + feeds), focus, werkuren en optioneel budget.
// Auth: Authorization: Bearer <WIDGET_TOKEN> of ?token=<WIDGET_TOKEN>.
// Sections filter: ?sections=today,next_event,agenda,tasks,overdue,routines,focus,work_hours,budget
// Budget is standaard UIT (privacy); andere secties standaard AAN.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const TOKEN = process.env.WIDGET_TOKEN
const USER_EMAIL = (process.env.WIDGET_USER_EMAIL || 'zhafirfachri@gmail.com').toLowerCase()

const TZ = 'Europe/Amsterdam'
const NL_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const BUILTIN_COLOR = { school: '#FACC15', werk: '#F43F5E', persoonlijk: '#A78BFA', routine: '#34D399', overig: '#60A5FA' }
const EVENT_COLOR_CATEGORY = { '#facc15': 'school', '#f43f5e': 'werk', '#a78bfa': 'persoonlijk', '#34d399': 'routine', '#60a5fa': 'overig' }
const DEFAULT_SECTIONS = ['today', 'next_event', 'agenda', 'tasks', 'overdue', 'routines', 'focus', 'work_hours']
const WORK_SINCE = '2026-10-12'

// ── date helpers (Europe/Amsterdam) ─────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const todayTZ = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const nowTZ = () => new Date().toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') + '+01:00'
const timeTZ = (iso) => new Date(iso).toLocaleTimeString('nl-NL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const dateTZ = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const hourTZ = () => Number(new Date().toLocaleTimeString('nl-NL', { timeZone: TZ, hour: '2-digit', hour12: false }))
const nowMinTZ = () => { const t = timeTZ(new Date().toISOString()); return parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5)) }
const parseISO = (s) => new Date(s + 'T00:00:00')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const addDaysStr = (s, n) => toISO(addDays(parseISO(s), n))
const isoDow = (d) => { const x = d.getDay(); return x === 0 ? 7 : x }
const hm = (s) => s ? parseInt(s.slice(0, 2)) * 60 + parseInt(s.slice(3, 5)) : null

function greeting() {
  const h = hourTZ()
  if (h < 6) return 'Goedenacht'
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'
}

// ── recurrence (mirrors src/utils/recurrence.js) ────────────────────────────
function patternMatch(d, rec, days) {
  const dow = isoDow(d)
  if (rec === 'daily') return true
  if (rec === 'weekdays') return dow >= 1 && dow <= 5
  if (rec === 'weekly') return days && days.length ? days.includes(dow) : true
  if (rec === 'monthly') return true
  return false
}
function nextOccurrence(fromISO, rec, days) {
  if (rec === 'monthly') {
    const d = parseISO(fromISO), dom = d.getDate()
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
    x.setDate(Math.min(dom, dim)); return toISO(x)
  }
  let d = addDays(parseISO(fromISO), 1)
  for (let i = 0; i < 800; i++) { if (patternMatch(d, rec, days)) return toISO(d); d = addDays(d, 1) }
  return toISO(d)
}
function snapToPattern(s, rec, days) { return patternMatch(parseISO(s), rec, days) ? s : nextOccurrence(s, rec, days) }
function routineAppliesOn(t, ds) {
  if (!t.recurrence || !t.date) return false
  const start = snapToPattern(t.date, t.recurrence, t.recurrence_days)
  if (ds < start) return false
  if (t.recurrence === 'monthly') return parseISO(ds).getDate() === parseISO(start).getDate()
  return patternMatch(parseISO(ds), t.recurrence, t.recurrence_days)
}
function routineDue(task, today) {
  if (!task.recurrence || !task.date) return false
  const due = patternMatch(parseISO(task.date), task.recurrence, task.recurrence_days)
    ? task.date : nextOccurrence(task.date, task.recurrence, task.recurrence_days)
  return due <= today
}
function eventMatchesDay(ev, todayStr) {
  const sStr = dateTZ(ev.start_time), eStr = dateTZ(ev.end_time)
  if (todayStr >= sStr && todayStr <= eStr) return true
  if (todayStr < sStr) return false
  const d = parseISO(todayStr), sd = parseISO(sStr), r = ev.recurrence
  if (r === 'daily') return true
  if (r === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5
  if (r === 'weekly') return ev.recurrence_days?.includes(d.getDay())
  if (r === 'monthly') return sd.getDate() === d.getDate()
  if (r === 'yearly') return sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate()
  return false
}
function daypartFromTime(t) {
  if (!t) return null
  const h = parseInt(String(t).slice(0, 2), 10)
  if (Number.isNaN(h)) return null
  return h < 12 ? 'ochtend' : h < 17 ? 'middag' : 'avond'
}

// ── types ────────────────────────────────────────────────────────────────────
async function loadTypes(uid) {
  const { data } = await supabase.from('item_types').select('*').eq('user_id', uid).order('sort_order')
  const list = data || []
  const byId = new Map(list.map(t => [t.id, t]))
  return {
    catOfId(id) { const t = id && byId.get(id); return t ? (t.key || t.id) : null },
    colorOf(cat) {
      const t = list.find(x => (x.key || x.id) === cat)
      return t?.color || BUILTIN_COLOR[cat] || '#60A5FA'
    },
    nameOf(cat) {
      const t = list.find(x => (x.key || x.id) === cat)
      return t?.name || cat
    },
  }
}

// ── auth ─────────────────────────────────────────────────────────────────────
function extractToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return (event.queryStringParameters || {}).token || null
}

// ── handler ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '')
  const token = extractToken(event)
  if (!TOKEN) return resp(500, { error: 'WIDGET_TOKEN niet ingesteld' })
  if (token !== TOKEN) return resp(401, { error: 'unauthorized' })

  // User
  let uid = null
  try {
    const { data } = await supabase.auth.admin.listUsers()
    uid = data?.users?.find(u => (u.email || '').toLowerCase() === USER_EMAIL)?.id
  } catch { /* ignore */ }
  if (!uid) return resp(404, { error: 'gebruiker niet gevonden' })

  // Parse sections
  const sectionsParam = (event.queryStringParameters || {}).sections
  const sections = new Set(sectionsParam ? sectionsParam.split(',').map(s => s.trim()) : DEFAULT_SECTIONS)

  const today = todayTZ()
  const types = await loadTypes(uid)

  // Parallel data fetch
  const needTasks = sections.has('today') || sections.has('tasks') || sections.has('overdue') || sections.has('routines')
  const needEvents = sections.has('agenda') || sections.has('next_event')
  const needFocus = sections.has('focus')
  const needWork = sections.has('work_hours')
  const needBudget = sections.has('budget')

  const promises = {}
  if (needTasks) promises.tasks = supabase.from('tasks').select('*').eq('user_id', uid)
  if (needEvents) {
    const fromT = new Date(today + 'T00:00:00').toISOString()
    const toT = new Date(addDaysStr(today, 7) + 'T23:59:59').toISOString()
    promises.events = supabase.from('calendar_events').select('*').eq('user_id', uid)
    promises.conns = supabase.from('calendar_connections').select('*').eq('user_id', uid)
    promises.overrides = supabase.from('external_event_overrides').select('*').eq('user_id', uid)
    promises.external = supabase.from('external_calendar_events')
      .select('*').gte('end_time', fromT).lte('start_time', toT).order('start_time').limit(1000)
  }
  if (needFocus) {
    const from30d = new Date(Date.now() - 400 * 86400000).toISOString()
    promises.sessions = supabase.from('pomodoro_sessions').select('completed_at,duration_minutes')
      .eq('user_id', uid).eq('mode', 'work').gte('completed_at', from30d)
  }
  if (needBudget) {
    const monthStart = `${today.slice(0, 7)}-01`
    const monthEnd = today
    promises.expenses = supabase.from('expenses').select('*').eq('user_id', uid).gte('date', monthStart).lte('date', monthEnd)
    promises.config = supabase.from('budget_config').select('*').eq('user_id', uid).maybeSingle()
  }

  // Await all in parallel
  const keys = Object.keys(promises)
  const results = await Promise.all(keys.map(k => promises[k]))
  const data = {}
  keys.forEach((k, i) => { data[k] = results[i].data })

  // Filter external events by connection
  if (needEvents) {
    const connIds = new Set((data.conns || []).map(c => c.id))
    data.external = (data.external || []).filter(e => connIds.has(e.connection_id))
  }

  const result = {
    date: today,
    label: formatDateLabel(today),
    greeting: greeting(),
  }

  // ── Build sections ────────────────────────────────────────────────────────

  if (sections.has('today') || sections.has('tasks') || sections.has('overdue') || sections.has('routines')) {
    const tasks = data.tasks || []
    const routines = tasks.filter(t => t.recurrence)
    const oneOffs = tasks.filter(t => !t.recurrence)

    // Today summary
    if (sections.has('today')) {
      const todayTasks = oneOffs.filter(t => !t.completed && t.date === today)
      const doneTasks = oneOffs.filter(t => t.completed && t.date === today)
      const routinesDue = routines.filter(t => routineDue(t, today) || t.last_completed_date === today)
      const routinesDone = routinesDue.filter(t => t.last_completed_date === today)
      const overdue = oneOffs.filter(t => !t.completed && t.date && t.date < today)
      result.today = {
        tasks_done: doneTasks.length,
        tasks_total: todayTasks.length + doneTasks.length,
        routines_done: routinesDone.length,
        routines_total: routinesDue.length,
        overdue_count: overdue.length,
      }
    }

    // Tasks (today, not done, not routine)
    if (sections.has('tasks')) {
      result.tasks = oneOffs
        .filter(t => !t.completed && t.date === today)
        .map(t => {
          const cat = types.catOfId(t.type_id) || (t.recurrence ? 'routine' : 'persoonlijk')
          return {
            title: t.title,
            time: t.start_time || t.time || null,
            daypart: t.daypart || daypartFromTime(t.start_time || t.time),
            done: false,
            urgent: !!t.priority,
            color: types.colorOf(cat),
          }
        })
        .sort((a, b) => (hm(a.time) ?? 9999) - (hm(b.time) ?? 9999))
    }

    // Overdue
    if (sections.has('overdue')) {
      result.overdue = oneOffs
        .filter(t => !t.completed && t.date && t.date < today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(t => ({
          title: t.title,
          days_late: Math.round((Date.parse(today) - Date.parse(t.date)) / 86400000),
        }))
    }

    // Routines
    if (sections.has('routines')) {
      result.routines = routines
        .filter(t => routineDue(t, today) || t.last_completed_date === today)
        .map(t => ({
          title: t.title,
          done: t.last_completed_date === today,
          streak: t.streak || 0,
        }))
        .sort((a, b) => (a.done - b.done) || (b.streak - a.streak))
    }
  }

  // ── Agenda + next_event ───────────────────────────────────────────────────
  if (needEvents) {
    const ownEvents = data.events || []
    const extEvents = data.external || []
    const conns = data.conns || []
    const ovMap = new Map((data.overrides || []).map(o => [`${o.connection_id}|${o.external_id}`, o]))
    const connMap = new Map(conns.map(c => [c.id, c]))

    // Build today's agenda items
    const agendaItems = []
    const nowMin = nowMinTZ()
    const nowMs = Date.now()

    // Own events
    for (const ev of ownEvents) {
      if ((ev.description || '').startsWith('pmt:') && !sections.has('work_hours')) continue
      if (!eventMatchesDay(ev, today)) continue
      const startT = timeTZ(ev.start_time), endT = timeTZ(ev.end_time)
      const allDay = startT === '00:00' && endT === '23:59'
      if (allDay) continue // skip hele-dag items for the TV grid
      const cat = types.catOfId(ev.type_id) || EVENT_COLOR_CATEGORY[(ev.color || '').toLowerCase()] || 'persoonlijk'
      const startMin = hm(startT), endMin = hm(endT)
      agendaItems.push({
        title: ev.title,
        time: startT, end_time: endT,
        type: types.nameOf(cat), color: types.colorOf(cat),
        is_now: startMin <= nowMin && endMin > nowMin,
        location: null,
        travel_before: ev.travel_before || 0,
        _startMin: startMin, _endMs: new Date(ev.end_time).getTime(),
        _startMs: new Date(ev.start_time).getTime(),
      })
    }

    // External/feed events
    for (const raw of extEvents) {
      const conn = connMap.get(raw.connection_id)
      if (!conn) continue
      const ov = ovMap.get(`${raw.connection_id}|${raw.external_id}`)
      if (ov?.hidden) continue

      let sStr = dateTZ(raw.start_time), eStr = dateTZ(raw.end_time)
      if (today < sStr || today > eStr) continue // not on today

      const startT = ov?.start_time ? timeTZ(ov.start_time) : timeTZ(raw.start_time)
      const endT = ov?.end_time ? timeTZ(ov.end_time) : timeTZ(raw.end_time)
      const allDay = !!raw.all_day
      if (allDay) continue

      const title = ov?.title || raw.title
      const cat = types.catOfId(ov?.type_id) || types.catOfId(conn?.default_type_id)
        || (conn?.provider === 'google' ? 'overig' : 'school')
      const startMin = hm(startT), endMin = hm(endT)
      const travelRule = (conn?.travel_rules || []).find(r => raw.location && r.match && raw.location.toLowerCase().includes(r.match.toLowerCase()))

      agendaItems.push({
        title, time: startT, end_time: endT,
        type: types.nameOf(cat), color: types.colorOf(cat),
        is_now: startMin <= nowMin && endMin > nowMin,
        location: raw.location || null,
        travel_before: ov?.travel_before || travelRule?.before || 0,
        _startMin: startMin, _endMs: new Date(raw.end_time).getTime(),
        _startMs: ov?.start_time ? new Date(ov.start_time).getTime() : new Date(raw.start_time).getTime(),
      })
    }

    agendaItems.sort((a, b) => a._startMin - b._startMin)

    if (sections.has('agenda')) {
      result.agenda = agendaItems.map(({ _startMin, _endMs, _startMs, ...rest }) => rest)
    }

    if (sections.has('next_event')) {
      // Find next upcoming event (not yet ended)
      const upcoming = agendaItems.filter(x => x._endMs > nowMs)
      const next = upcoming[0]
      if (next) {
        const minsUntil = Math.max(0, Math.round((next._startMs - nowMs) / 60000))
        const travelMin = next.travel_before || 0
        const leaveMs = next._startMs - travelMin * 60000
        const leaveMin = Math.max(0, Math.round((leaveMs - nowMs) / 60000))
        result.next_event = {
          title: next.title,
          time: next.time,
          end_time: next.end_time,
          type: next.type,
          color: next.color,
          minutes_until: minsUntil,
          location: next.location || '',
          travel_minutes: travelMin,
          leave_at: travelMin > 0 ? timeTZ(new Date(leaveMs).toISOString()) : '',
        }
      } else {
        result.next_event = null
      }
    }
  }

  // ── Focus ─────────────────────────────────────────────────────────────────
  if (needFocus) {
    const sessions = data.sessions || []
    const days = {}
    for (const s of sessions) {
      if (!s.completed_at) continue
      const d = dateTZ(s.completed_at)
      days[d] = (days[d] || 0) + (s.duration_minutes || 0)
    }
    const todayMins = days[today] || 0

    // Streak
    let streak = 0
    let cur = todayMins > 0 ? today : addDaysStr(today, -1)
    while ((days[cur] || 0) > 0) { streak++; cur = addDaysStr(cur, -1) }

    result.focus = {
      today_minutes: todayMins,
      goal_minutes: 120, // DEFAULT_GOAL from useFocusProgress
      streak,
    }
  }

  // ── Work hours ────────────────────────────────────────────────────────────
  if (needWork && needEvents) {
    const ownEvents = data.events || []
    const extEvents = data.external || []
    const conns = data.conns || []
    const connMap = new Map(conns.map(c => [c.id, c]))

    // Find work shifts: WDK feed or type Werk
    const wdkConn = conns.find(c => /wdk/i.test(c.name || ''))
    const allShifts = []

    // External work events
    for (const raw of extEvents) {
      const conn = connMap.get(raw.connection_id)
      if (!conn) continue
      if (wdkConn ? raw.connection_id !== wdkConn.id : false) continue
      if (!wdkConn) {
        const cat = types.catOfId(conn?.default_type_id) || 'overig'
        if (cat !== 'werk') continue
      }
      if (raw.all_day) continue
      const day = dateTZ(raw.start_time)
      if (day < WORK_SINCE) continue
      allShifts.push({ start: new Date(raw.start_time), end: new Date(raw.end_time), title: raw.title, day })
    }

    // Own work events
    for (const ev of ownEvents) {
      if (ev.recurrence) continue // skip recurring for simplicity
      const cat = types.catOfId(ev.type_id) || EVENT_COLOR_CATEGORY[(ev.color || '').toLowerCase()] || 'persoonlijk'
      const isWork = wdkConn ? false : cat === 'werk'
      if (!isWork) continue
      const startT = timeTZ(ev.start_time), endT = timeTZ(ev.end_time)
      if (startT === '00:00' && endT === '23:59') continue
      const day = dateTZ(ev.start_time)
      if (day < WORK_SINCE) continue
      allShifts.push({ start: new Date(ev.start_time), end: new Date(ev.end_time), title: ev.title, day })
    }

    // This week hours (ma–zo)
    const todayD = parseISO(today)
    const dow = (todayD.getDay() + 6) % 7 // 0=ma
    const monday = addDaysStr(today, -dow)
    const sunday = addDaysStr(today, 6 - dow)

    let weekHours = 0
    for (const s of allShifts) {
      if (s.day >= monday && s.day <= sunday) {
        weekHours += (s.end - s.start) / 3600000
      }
    }

    // Next shift (from now)
    const futureShifts = allShifts.filter(s => s.start.getTime() > Date.now()).sort((a, b) => a.start - b.start)
    const nextShift = futureShifts[0]

    result.work_hours = {
      this_week_hours: Math.round(weekHours * 10) / 10,
      next_shift: nextShift ? {
        day: nextShift.day,
        time: timeTZ(nextShift.start.toISOString()),
        end_time: timeTZ(nextShift.end.toISOString()),
      } : null,
    }
  } else if (needWork) {
    result.work_hours = { this_week_hours: 0, next_shift: null }
  }

  // ── Budget (privacy: only when explicitly requested) ──────────────────────
  if (needBudget) {
    const expenses = (data.expenses || []).filter(e => !e.is_income && !e.is_savings_withdrawal && !e.is_savings_contribution && !e.is_loan_repayment)
    const config = data.config || {}
    const monthBudget = config.monthly_budget || 400
    const spent = expenses.reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0)
    const remaining = monthBudget - spent
    const daysInMonth = new Date(parseISO(today).getFullYear(), parseISO(today).getMonth() + 1, 0).getDate()
    const dayOfMonth = parseISO(today).getDate()
    const daysLeft = daysInMonth - dayOfMonth + 1
    const dayBudget = daysLeft > 0 ? Math.round(remaining / daysLeft * 100) / 100 : 0

    // Today's spending
    const daySpent = expenses.filter(e => e.date === today).reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0)

    result.budget = {
      month_budget: monthBudget,
      month_spent: Math.round(spent * 100) / 100,
      day_budget: dayBudget,
      day_spent: Math.round(daySpent * 100) / 100,
      pct_used: monthBudget > 0 ? Math.round((spent / monthBudget) * 100) : 0,
    }
  }

  result.generated_at = nowTZ()
  return resp(200, result)
}

// ── helpers ─────────────────────────────────────────────────────────────────
function formatDateLabel(isoDate) {
  const d = parseISO(isoDate)
  return `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, OPTIONS',
    },
    body: typeof obj === 'string' ? obj : JSON.stringify(obj),
  }
}
