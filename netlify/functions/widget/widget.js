// Widget-eindpunt voor een iOS home-screen widget (via Scriptable o.i.d.).
// Geeft de taken/routines + agenda-events van vandaag als JSON terug.
// Beveiligd met een geheime token (?token=...). Tijd in Europe/Amsterdam.
//
// Vereiste Netlify env-vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY  (bestaan al voor andere functions)
//   WIDGET_TOKEN                        (zelf instellen: lange random string)
//   WIDGET_USER_EMAIL                   (optioneel; default = admin-mail)

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const TOKEN = process.env.WIDGET_TOKEN
const USER_EMAIL = (process.env.WIDGET_USER_EMAIL || 'zhafirfachri@gmail.com').toLowerCase()

const TZ = 'Europe/Amsterdam'
const NL_DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function pad(n) { return String(n).padStart(2, '0') }
function parseISO(s) { return new Date(s + 'T00:00:00') }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function isoDow(d) { const x = d.getDay(); return x === 0 ? 7 : x }
function todayTZ() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }) } // YYYY-MM-DD
function dateTZ(iso) { return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) }
function timeTZ(iso) { return new Date(iso).toLocaleTimeString('nl-NL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) }

// ── herhaling (spiegelt src/utils/recurrence.js) ──
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
function matchesISO(dateStr, rec, days) { return patternMatch(parseISO(dateStr), rec, days) }
function routineDue(task, today) {
  if (!task.recurrence || !task.date) return false
  const due = matchesISO(task.date, task.recurrence, task.recurrence_days)
    ? task.date : nextOccurrence(task.date, task.recurrence, task.recurrence_days)
  return due <= today
}
function daypartFromTime(t) {
  if (!t) return null
  const h = parseInt(String(t).slice(0, 2), 10)
  if (Number.isNaN(h)) return null
  return h < 12 ? 'ochtend' : h < 17 ? 'middag' : 'avond'
}

// ── agenda-event valt op dag? (spiegelt Timeline) ──
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

const timeVal = x => x.time ? parseInt(x.time.slice(0, 2)) * 60 + parseInt(x.time.slice(3, 5)) : -1

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token
  if (!TOKEN) return resp(500, { error: 'WIDGET_TOKEN niet ingesteld' })
  if (token !== TOKEN) return resp(401, { error: 'unauthorized' })

  // gebruiker opzoeken op e-mail
  let uid = null
  try {
    const { data } = await supabase.auth.admin.listUsers()
    uid = data?.users?.find(u => (u.email || '').toLowerCase() === USER_EMAIL)?.id
  } catch { /* ignore */ }
  if (!uid) return resp(404, { error: 'gebruiker niet gevonden' })

  const today = todayTZ()
  const [tasksRes, eventsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', uid),
    supabase.from('calendar_events').select('*').eq('user_id', uid),
  ])
  const tasks = tasksRes.data || []
  const events = eventsRes.data || []

  // routines van vandaag (open + vandaag al gedaan, voor het vinkje)
  const routines = tasks
    .filter(t => t.recurrence && (routineDue(t, today) || t.last_completed_date === today))
    .map(t => ({
      kind: 'routine', title: t.title, time: t.start_time || t.time || null,
      daypart: t.daypart || daypartFromTime(t.start_time || t.time),
      done: t.last_completed_date === today, streak: t.streak || 0,
    }))
    .sort((a, b) => (a.done - b.done) || (b.streak - a.streak))

  // eenmalige taken van vandaag + aantal te laat
  const dayTasks = tasks
    .filter(t => !t.recurrence && !t.completed && t.date === today)
    .map(t => ({
      kind: 'task', title: t.title, time: t.start_time || t.time || null,
      daypart: t.daypart || daypartFromTime(t.start_time || t.time), done: false,
    }))
    .sort((a, b) => timeVal(a) - timeVal(b))
  const overdue = tasks.filter(t => !t.recurrence && !t.completed && t.date && t.date < today).length

  // agenda-events van vandaag (geen werk-events met pmt:-prefix)
  const dayEvents = []
  for (const ev of events) {
    if ((ev.description || '').startsWith('pmt:')) continue
    if (!eventMatchesDay(ev, today)) continue
    const startT = timeTZ(ev.start_time), endT = timeTZ(ev.end_time)
    const allDay = startT === '00:00' && endT === '23:59'
    dayEvents.push({ kind: 'event', title: ev.title, time: allDay ? null : startT, done: false })
  }
  dayEvents.sort((a, b) => timeVal(a) - timeVal(b))

  const d = parseISO(today)
  return resp(200, {
    date: today,
    label: `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`,
    routinesDone: routines.filter(r => r.done).length,
    routinesTotal: routines.length,
    overdue,
    items: [...dayEvents, ...routines, ...dayTasks],
    generatedAt: new Date().toISOString(),
  })
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(obj),
  }
}
