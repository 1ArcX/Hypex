// Agenda-widget-eindpunt: getimede items van vandaag (events + taken/routines)
// voor een tijdlijn-widget. Let op: Magister/SOMtoday-lessen en werkdiensten
// zitten niet in Supabase en staan dus niet in deze data.

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
function todayTZ() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }) }
function dateTZ(iso) { return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) }
function timeTZ(iso) { return new Date(iso).toLocaleTimeString('nl-NL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) }
function nowMinTZ() { const t = timeTZ(new Date().toISOString()); return parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5)) }
function mins(hhmm) { return hhmm ? parseInt(hhmm.slice(0, 2)) * 60 + parseInt(hhmm.slice(3, 5)) : null }

// herhaling routines
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

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token
  if (!TOKEN) return resp(500, { error: 'WIDGET_TOKEN niet ingesteld' })
  if (token !== TOKEN) return resp(401, { error: 'unauthorized' })

  let uid = null
  try {
    const { data } = await supabase.auth.admin.listUsers()
    uid = data?.users?.find(u => (u.email || '').toLowerCase() === USER_EMAIL)?.id
  } catch { /* ignore */ }
  if (!uid) return resp(404, { error: 'gebruiker niet gevonden' })

  const today = todayTZ()
  const [evRes, tkRes] = await Promise.all([
    supabase.from('calendar_events').select('*').eq('user_id', uid),
    supabase.from('tasks').select('*').eq('user_id', uid),
  ])
  const events = evRes.data || []
  const tasks = tkRes.data || []

  const timed = []
  const allDay = []

  for (const ev of events) {
    if ((ev.description || '').startsWith('pmt:')) continue
    if (!eventMatchesDay(ev, today)) continue
    const s = timeTZ(ev.start_time), e = timeTZ(ev.end_time)
    if (s === '00:00' && e === '23:59') { allDay.push({ title: ev.title, color: ev.color || '#818CF8' }); continue }
    timed.push({ title: ev.title, startMin: mins(s), endMin: Math.max(mins(s) + 30, mins(e)), color: ev.color || '#818CF8', kind: 'event' })
  }

  for (const t of tasks) {
    const isRoutine = !!t.recurrence
    const onDay = isRoutine ? routineAppliesOn(t, today) : (t.date === today && !t.completed)
    if (!onDay) continue
    const time = t.start_time || t.time
    const color = t.color || (isRoutine ? '#5EEAD4' : '#818CF8')
    const title = `${isRoutine ? '🔁 ' : ''}${t.title}`
    if (!time) { allDay.push({ title, color }); continue }
    timed.push({ title, startMin: mins(time), endMin: t.end_time ? mins(t.end_time) : mins(time) + 60, color, kind: isRoutine ? 'routine' : 'task' })
  }

  timed.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const d = parseISO(today)
  return resp(200, {
    label: `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`,
    nowMin: nowMinTZ(),
    timed,
    allDay,
    generatedAt: new Date().toISOString(),
  })
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    body: JSON.stringify(obj),
  }
}
