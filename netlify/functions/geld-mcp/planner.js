// Planner-tools voor de Hypex-connector (naast de Geld-tools in geld-mcp.js): agenda (eigen items + feeds met jouw
// aanpassingen), werkuren, taken, afgeronde taken en notities — lezen én bewerken.
// Server draait in UTC; alles wordt in Europe/Amsterdam gerekend. Logica volgt de app:
//   agenda/feeds   → src/utils/externalEvents.js (applyOverride) + Timeline.jsx (herhaling eigen items)
//   types          → src/utils/category.js (eventCategory / taskCategory)
//   werkuren       → src/utils/workHours.js (WORK_SINCE, WDK-feed, samenvoegen per begindag)
//   taken          → src/utils/itemSave.js (saveTask), src/utils/recurrence.js, App.jsx handleToggleTask
//   notities       → notes.title = eerste regel, notes.content = de rest (platte tekst, src/notes/noteFormat.js)

const TZ = 'Europe/Amsterdam'
const DAY = 86400000
const WORK_SINCE = '2026-10-12'
const BUILTIN = { school: 'School', werk: 'Werk', persoonlijk: 'Persoonlijk', routine: 'Routine', overig: 'Overig' }
const BUILTIN_COLOR = { school: '#FACC15', werk: '#F43F5E', persoonlijk: '#A78BFA', routine: '#34D399', overig: '#60A5FA' }
const EVENT_COLOR_CATEGORY = { '#ff6b6b': 'werk', '#ff8c42': 'werk', '#facc15': 'school', '#4ade80': 'routine', '#00ffd1': 'overig', '#38bdf8': 'overig', '#818cf8': 'persoonlijk', '#f472b6': 'persoonlijk' }
const DAYPARTS = { ochtend: ['08:00', '12:00'], middag: ['12:00', '17:00'], avond: ['17:00', '22:00'] }
const WEEKDAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']

// ── tijd (Europe/Amsterdam) ──────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function parts(t) {
  const o = {}
  for (const p of fmt.formatToParts(new Date(t))) o[p.type] = p.value
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute }
}
const localDay = (t) => { const p = parts(t); return `${p.y}-${pad(p.m)}-${pad(p.d)}` }
const localHM = (t) => { const p = parts(t); return `${pad(p.h)}:${pad(p.mi)}` }
const localStamp = (t) => `${localDay(t)} ${localHM(t)}`
const minOfDay = (t) => { const p = parts(t); return p.h * 60 + p.mi }
const todayLocal = () => localDay(Date.now())
/** Lokale datum + "HH:MM" → Date (UTC), met zomer-/wintertijd. */
function toUTC(date, hm = '00:00') {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = String(hm).split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const off = (t) => { const p = parts(t); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - t }
  let t = guess - off(guess)
  t = guess - off(t)
  return new Date(t)
}
const addDays = (date, n) => { const t = new Date(date + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const dow = (date) => new Date(date + 'T00:00:00Z').getUTCDay() // 0 = zo
const isoDow = (date) => dow(date) || 7 // 1 = ma … 7 = zo
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)
const dayList = (from, to) => { const out = []; for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d); return out }
const mondayOf = (date) => addDays(date, -(isoDow(date) - 1))
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const isHM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
const hmToMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m }
const minToHM = (n) => `${pad(Math.floor(n / 60) % 24)}:${pad(n % 60)}`
const fmtHours = (min) => { const m = Math.round(Math.abs(min)), h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}u ${r}m` : `${h}u`) : `${r}m` }
const hours = (min) => Math.round(min / 6) / 10
function need(cond, msg) { if (!cond) throw new Error(msg) }
const optDate = (v, name) => { if (v === undefined || v === null || v === '') return v; need(isDate(v), `${name} moet YYYY-MM-DD zijn`); return v }
const optHM = (v, name) => { if (v === undefined || v === null || v === '') return v; need(isHM(v), `${name} moet HH:MM zijn`); return v }

// ── types ────────────────────────────────────────────────────────────────────
async function loadTypes(sb, uid) {
  const { data } = await sb.from('item_types').select('*').eq('user_id', uid).order('sort_order')
  const list = data || []
  const byId = new Map(list.map(t => [t.id, t]))
  const name = (cat) => { const t = list.find(x => (x.key || x.id) === cat); return t?.name || BUILTIN[cat] || cat }
  const catOfId = (id) => { const t = id && byId.get(id); return t ? (t.key || t.id) : null }
  /** Type opzoeken op naam, key of id → { id, cat, color }. */
  const resolve = (v) => {
    if (v === undefined) return undefined
    if (v === null || v === '') return null
    const s = String(v).toLowerCase()
    const t = list.find(x => x.id === v || (x.key || '').toLowerCase() === s || (x.name || '').toLowerCase() === s)
    if (!t) throw new Error(`Onbekend type "${v}". Gebruik list_types.`)
    return { id: t.id, cat: t.key || t.id, color: t.color || BUILTIN_COLOR[t.key] || '#60A5FA' }
  }
  return { list, name, catOfId, resolve }
}

// ── standaard reistijd per locatie (calendar_connections.travel_rules, zelfde als src/utils/externalEvents.js) ──
function travelRule(raw, conn) {
  const rules = Array.isArray(conn?.travel_rules) ? conn.travel_rules : []
  if (!rules.length || raw.all_day) return null
  const text = `${raw.location || ''} ${raw.title || ''}`.toLowerCase()
  const hit = rules.find(r => r?.match && text.includes(String(r.match).toLowerCase()))
  return hit ? { before: Number(hit.before) || 0, after: Number(hit.after) || 0 } : null
}

// ── slim standaardtype op basis van de titel (alleen als er geen type is meegegeven) ──
const TYPE_HINTS = [
  [/sport|gym|fitness|basic.?fit|hardlop|rennen|zwemm|voetbal|tennis|padel|training|workout|krachttraining|wandel/, ['sport']],
  [/tentamen|toets|college|\bles\b|studeren|\bleren\b|huiswerk|opdracht|inleveren|project|\bhan\b|leerblok|oefenen|samenvat/, ['school']],
  [/dienst|\bwerk\b|\bwdk\b|jumbo|\bpmt\b/, ['werk']],
  [/creatine|tanden|medicijn|vitamine|ochtendroutine|avondroutine/, ['routine']],
]
function smartType(title, types) {
  const t = String(title || '').toLowerCase()
  // 1. een eigen type waarvan de naam in de titel staat ("Sport", "Gym"…)
  const named = types.list.filter(x => x.name && x.name.length >= 3).sort((a, b) => b.name.length - a.name.length)
    .find(x => t.includes(x.name.toLowerCase()))
  if (named) return named
  // 2. trefwoorden → een type met die naam of key
  for (const [re, keys] of TYPE_HINTS) {
    if (!re.test(t)) continue
    const hit = types.list.find(x => keys.includes((x.key || '').toLowerCase()) || keys.some(k => (x.name || '').toLowerCase().includes(k)))
    if (hit) return hit
  }
  return null
}

// ── herhaling van taken (src/utils/recurrence.js; recurrence_days = ISO 1=ma … 7=zo) ──
function patternMatch(date, rec, days) {
  const d = isoDow(date)
  if (rec === 'daily' || rec === 'monthly') return true
  if (rec === 'weekdays') return d <= 5
  if (rec === 'weekly') return days && days.length ? days.includes(d) : true
  return false
}
function monthShift(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1)), dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, dim))}`
}
function nextOcc(from, rec, days) {
  if (rec === 'monthly') return monthShift(from, 1)
  let d = addDays(from, 1)
  for (let i = 0; i < 800 && !patternMatch(d, rec, days); i++) d = addDays(d, 1)
  return d
}
function prevOcc(from, rec, days) {
  if (rec === 'monthly') return monthShift(from, -1)
  let d = addDays(from, -1)
  for (let i = 0; i < 800 && !patternMatch(d, rec, days); i++) d = addDays(d, -1)
  return d
}
const snap = (date, rec, days) => (!rec || !date || patternMatch(date, rec, days)) ? date : nextOcc(date, rec, days)
function appliesOn(t, day) {
  if (!t.recurrence || !t.date) return false
  const start = snap(t.date, t.recurrence, t.recurrence_days)
  if (day < start) return false
  if (t.recurrence === 'monthly') return day.slice(8) === start.slice(8)
  return patternMatch(day, t.recurrence, t.recurrence_days)
}
const taskLast = (t) => (t.end_date && t.date && t.end_date > t.date ? t.end_date : t.date)
const taskOnDay = (t, day) => t.recurrence ? appliesOn(t, day) : !!t.date && t.date <= day && taskLast(t) >= day
const isDoneToday = (t, today) => t.last_completed_date === today
// Routinestatus per datum (zelfde regel als src/utils/recurrence.js routineDueOn/routineDoneOn): `date` schuift
// bij afvinken door, dus verleden = het ritme vanaf created_at, gedaan = afvinklogboek (task_completions).
const routineDoneOn = (t, day, logs = []) => t.last_completed_date === day || logs.some(l => l.task_id === t.id && l.day === day)
function routineDueOn(t, day, today, logs = []) {
  if (!t.recurrence) return false
  if (day > today) return appliesOn(t, day)
  if (day === today) return (!!t.date && snap(t.date, t.recurrence, t.recurrence_days) <= today) || t.last_completed_date === today
  if (routineDoneOn(t, day, logs)) return true
  const since = t.created_at ? localDay(t.created_at) : null
  if (since && day < since) return false
  if (t.recurrence === 'monthly') return !!t.date && day.slice(8) === snap(t.date, t.recurrence, t.recurrence_days).slice(8)
  return patternMatch(day, t.recurrence, t.recurrence_days)
}
/** Eerstvolgende keer dat de routine op de planning staat (vandaag als hij vandaag nog open is). */
function routineNextDue(t, today) {
  if (!t.recurrence) return null
  if (t.last_completed_date === today) return nextOcc(today, t.recurrence, t.recurrence_days)
  const due = t.date ? snap(t.date, t.recurrence, t.recurrence_days) : today
  return due <= today ? (patternMatch(today, t.recurrence, t.recurrence_days) ? today : nextOcc(today, t.recurrence, t.recurrence_days)) : due
}

// ── agenda ───────────────────────────────────────────────────────────────────
function ruleCat(title, rules, types) {
  const t = (title || '').toLowerCase()
  for (const r of rules || []) {
    const needle = (r?.contains || '').trim().toLowerCase()
    if (needle && t.includes(needle)) { const c = types.catOfId(r.type_id); if (c) return c }
  }
  return null
}
/** Herhaling eigen items (Timeline.jsx): recurrence_days = 0=zo … 6=za. */
function eventOccursOn(ev, day, startDay, endDay) {
  if (day >= startDay && day <= endDay) return true
  if (day < startDay || !ev.recurrence) return false
  const r = ev.recurrence, wd = dow(day)
  if (r === 'daily') return true
  if (r === 'weekdays') return wd >= 1 && wd <= 5
  if (r === 'weekly') return (ev.recurrence_days || []).includes(wd)
  if (r === 'biweekly') {
    const target = ev.recurrence_days?.length ? ev.recurrence_days : [dow(startDay)]
    if (!target.includes(wd)) return false
    return Math.round(daysBetween(mondayOf(startDay), mondayOf(day)) / 7) % 2 === 0
  }
  return false
}

/**
 * Alle agenda-items die (deels) in [from, to] vallen, met jouw aanpassingen op feed-items toegepast.
 * → [{ id, kind: 'eigen'|'feed', source, connection_id?, title, cat, start (Date), end (Date), all_day, travel_before, travel_after, note, hidden, edited, recurring }]
 */
async function loadAgenda(sb, uid, types, from, to) {
  const fromT = toUTC(from).toISOString(), toT = toUTC(addDays(to, 1)).toISOString()
  const { data: conns } = await sb.from('calendar_connections').select('*').eq('user_id', uid)
  const connMap = new Map((conns || []).map(c => [c.id, c]))
  const [own, ovs] = await Promise.all([
    sb.from('calendar_events').select('*').eq('user_id', uid).lt('start_time', toT).or(`recurrence.not.is.null,end_time.gte.${fromT}`).limit(3000),
    sb.from('external_event_overrides').select('*').eq('user_id', uid),
  ])
  const ext = []
  if (connMap.size) {
    for (let page = 0; page < 20; page++) {
      const { data, error } = await sb.from('external_calendar_events').select('*').in('connection_id', [...connMap.keys()])
        .gte('end_time', fromT).lte('start_time', toT).order('start_time').order('id').range(page * 1000, page * 1000 + 999)
      if (error) throw new Error(error.message)
      ext.push(...(data || []))
      if (!data || data.length < 1000) break
    }
  }
  const ovMap = new Map((ovs.data || []).map(o => [`${o.connection_id}|${o.external_id}`, o]))
  const out = []

  for (const raw of ext) {
    let s = new Date(raw.start_time), e = new Date(raw.end_time)
    if (raw.all_day) { // feeds slaan hele-dag-items op als UTC-middernacht → lokale kalenderdagen
      s = toUTC(raw.start_time.slice(0, 10)); e = toUTC(new Date(raw.end_time).toISOString().slice(0, 10), '23:59')
    }
    const ov = ovMap.get(`${raw.connection_id}|${raw.external_id}`)
    const conn = connMap.get(raw.connection_id)
    const title = ov?.title || raw.title
    const cat = types.catOfId(ov?.type_id) || ruleCat(raw.title, conn?.type_rules, types) || types.catOfId(conn?.default_type_id)
      || (conn?.provider === 'google' ? 'overig' : 'school')
    const rule = travelRule(raw, conn)
    out.push({
      id: `feed:${raw.id}`, kind: 'feed', source: conn?.name || 'Feed', connection_id: raw.connection_id, raw,
      title, cat, start: ov?.start_time ? new Date(ov.start_time) : s, end: ov?.end_time ? new Date(ov.end_time) : e,
      all_day: ov?.all_day ?? !!raw.all_day, location: raw.location || null, description: raw.description || null,
      travel_before: ov?.travel_before || rule?.before || 0, travel_after: ov?.travel_after || rule?.after || 0, note: ov?.note || null,
      ...(!ov?.travel_before && rule?.before ? { travel_from_rule: true } : {}),
      hidden: !!ov?.hidden, edited: !!(ov && (ov.title || ov.start_time || ov.end_time || ov.all_day != null || ov.type_id || ov.note)),
      original: ov ? { title: raw.title, start: localStamp(s), end: localStamp(e) } : undefined, recurring: false,
    })
  }

  for (const ev of own.data || []) {
    const s0 = new Date(ev.start_time), e0 = new Date(ev.end_time)
    const cat = types.catOfId(ev.type_id) || (ev.description?.startsWith('pmt:') ? 'werk' : EVENT_COLOR_CATEGORY[(ev.color || '').toLowerCase()] || 'persoonlijk')
    const allDay = minOfDay(s0) === 0 && (localHM(e0) === '23:59' || e0 - s0 >= DAY)
    const base = { kind: 'eigen', source: ev.description?.startsWith('pmt:') ? 'PMT (Jumbo)' : 'Eigen agenda', title: ev.title, cat, all_day: allDay,
      description: ev.description && !ev.description.startsWith('pmt:') ? ev.description : null,
      travel_before: ev.travel_before || 0, travel_after: ev.travel_after || 0, note: null, hidden: false, edited: false, recurring: !!ev.recurrence, raw: ev }
    if (!ev.recurrence) { out.push({ ...base, id: ev.id, start: s0, end: e0 }); continue }
    const sd = localDay(s0), ed = localDay(e0), sHM = localHM(s0), dur = e0 - s0
    for (const day of dayList(from, to)) {
      if (day < sd || !eventOccursOn(ev, day, sd, ed)) continue
      if (day > sd && day <= ed) continue // zelfde (meerdaagse) eerste keer
      const s = toUTC(day, sHM)
      out.push({ ...base, id: ev.id, occurrence: day, start: s, end: new Date(+s + dur) })
    }
  }
  const lo = +toUTC(from), hi = +toUTC(addDays(to, 1))
  return out.filter(x => +x.end > lo && +x.start < hi).sort((a, b) => a.start - b.start)
}

const slimEvent = (x, types) => ({
  id: x.id, ...(x.occurrence ? { occurrence: x.occurrence } : {}), kind: x.kind, source: x.source, title: x.title, type: types.name(x.cat),
  start: localStamp(x.start), end: localStamp(x.end), all_day: x.all_day, ...(!x.all_day ? { duration_min: Math.round((x.end - x.start) / 60000) } : {}),
  ...(x.travel_before ? { travel_before_min: x.travel_before, leave_at: localHM(+x.start - x.travel_before * 60000), ...(x.travel_from_rule ? { travel_source: 'locatieregel' } : {}) } : {}),
  ...(x.travel_after ? { travel_after_min: x.travel_after } : {}),
  ...(x.location ? { location: x.location } : {}), ...(x.description ? { description: String(x.description).slice(0, 300) } : {}),
  ...(x.note ? { note: x.note } : {}), ...(x.hidden ? { hidden: true } : {}), ...(x.edited ? { edited: true, original: x.original } : {}),
  ...(x.recurring ? { recurring: x.raw.recurrence } : {}),
})

// ── werkuren (src/utils/workHours.js) ────────────────────────────────────────
function workShifts(agenda) {
  const wdk = agenda.find(x => x.kind === 'feed' && /wdk/i.test(x.source || ''))
  return agenda.filter(x => !x.hidden && !x.all_day && x.end > x.start && localDay(x.start) >= WORK_SINCE
    && (wdk ? x.connection_id === wdk.connection_id : x.cat === 'werk'))
}
function sumHours(shifts, from, to, now = Date.now()) {
  const days = dayList(from, to).map(date => ({ date, list: [] }))
  const idx = new Map(days.map((d, i) => [d.date, i]))
  for (const s of shifts) { const i = idx.get(localDay(s.start)); if (i !== undefined) days[i].list.push(s) }
  let total = 0, worked = 0, count = 0
  const outDays = []
  for (const day of days) {
    const merged = []
    for (const s of day.list.sort((a, b) => a.start - b.start)) {
      const top = merged[merged.length - 1]
      if (top && s.start <= top.end) { if (s.end > top.end) top.end = s.end }
      else merged.push({ start: s.start, end: s.end, title: s.title, source: s.source })
    }
    let min = 0, w = 0
    for (const m of merged) {
      const mm = Math.round((m.end - m.start) / 60000)
      min += mm; w += m.end <= now ? mm : m.start >= now ? 0 : Math.round((now - m.start) / 60000)
    }
    total += min; worked += w; count += merged.length
    if (merged.length) outDays.push({ date: day.date, weekday: WEEKDAYS[dow(day.date)], hours: hours(min), shifts: merged.map(m => ({ start: localStamp(m.start), end: localStamp(m.end), title: m.title })) })
  }
  return { total_min: total, worked_min: worked, count, days: outDays }
}
function rangeOf(period, date) {
  if (period === 'month') {
    const from = date.slice(0, 8) + '01'
    return { from, to: addDays(monthShift(from, 1), -1) }
  }
  const from = mondayOf(date)
  return { from, to: addDays(from, 6) }
}

// ── taken ────────────────────────────────────────────────────────────────────
async function loadTasks(sb, uid) {
  const { data, error } = await sb.from('tasks').select('*').eq('user_id', uid).limit(5000)
  if (error) throw new Error(error.message)
  return data || []
}
const taskCat = (t, types) => types.catOfId(t.type_id) || (t.recurrence ? 'routine' : t.subject_id ? 'school' : 'persoonlijk')
const taskStart = (t) => t.start_time || t.time || null
/** ctx.day = de opgevraagde dag (standaard vandaag), ctx.logs = afvinklogboek, voor de routinestatus op die dag. */
function slimTask(t, types, today, ctx = {}) {
  const day = ctx.day || today
  const done = t.recurrence ? routineDoneOn(t, day, ctx.logs || []) : !!t.completed
  const start = taskStart(t)
  const overdue = !t.completed && !t.recurrence && !!t.date && taskLast(t) < today
  return {
    id: t.id, title: t.title, type: types.name(taskCat(t, types)), date: t.date || null,
    ...(t.end_date && t.end_date !== t.date ? { end_date: t.end_date } : {}),
    ...(start ? { time: start, end_time: t.end_time || minToHM(hmToMin(start) + (t.duration_minutes || 30)) } : {}),
    ...(t.daypart ? { daypart: t.daypart } : {}),
    priority: t.priority === 1 ? 'urgent' : t.priority === 3 ? 'later' : 'normaal',
    completed: !!t.completed, ...(overdue ? { overdue_days: daysBetween(taskLast(t), today) } : {}),
    // Routines: done/done_today gelden voor de opgevraagde dag; date = intern ankerpunt (schuift door bij afvinken),
    // next_due = de eerstvolgende keer dat hij op de planning staat.
    ...(t.recurrence ? { recurrence: t.recurrence, ...(t.recurrence_days?.length ? { recurrence_days: t.recurrence_days } : {}), streak: t.streak || 0,
      done, done_today: done, ...(day !== today ? { done_for_date: day } : {}), next_due: routineNextDue(t, today),
      ...(t.last_completed_date ? { last_done: t.last_completed_date } : {}) } : {}),
    ...(t.due_date ? { deadline: t.due_date } : {}), ...(t.description ? { description: String(t.description).slice(0, 300) } : {}),
    ...(start && t.end_time ? { duration_min: ((hmToMin(t.end_time.slice(0, 5)) - hmToMin(start.slice(0, 5)) + 1440) % 1440) || t.duration_minutes || null }
      : t.duration_minutes ? { duration_min: t.duration_minutes } : {}),
    ...(t.travel_before ? { travel_before_min: t.travel_before, ...(start ? { leave_at: minToHM((hmToMin(start.slice(0, 5)) - t.travel_before + 1440) % 1440) } : {}) } : {}),
    ...(t.travel_after ? { travel_after_min: t.travel_after } : {}),
    ...(t.note_id ? { note_id: t.note_id } : {}), ...(t.group_name ? { group: t.group_name } : {}),
  }
}

// ── vrije tijd ───────────────────────────────────────────────────────────────
function busyOnDay(day, agenda, tasks, includeTasks) {
  const lo = +toUTC(day), hi = +toUTC(addDays(day, 1)), dayMin = (hi - lo) / 60000
  const busy = []
  for (const x of agenda) {
    if (x.hidden || x.all_day) continue
    const s = +x.start - (x.travel_before || 0) * 60000, e = +x.end + (x.travel_after || 0) * 60000
    if (e <= lo || s >= hi) continue
    busy.push({ s: Math.max(0, (s - lo) / 60000), e: Math.min(dayMin, (e - lo) / 60000), what: x.title })
  }
  if (includeTasks) {
    for (const t of tasks) {
      const st = taskStart(t)
      if (!st || t.completed || !taskOnDay(t, day) || (t.recurrence && isDoneToday(t, day))) continue
      const s = hmToMin(st), e = t.end_time ? hmToMin(t.end_time) : s + (t.duration_minutes || 30)
      busy.push({ s: Math.max(0, s - (t.travel_before || 0)), e: Math.min(dayMin, (e > s ? e : e + 1440) + (t.travel_after || 0)), what: t.title })
    }
  }
  return busy.sort((a, b) => a.s - b.s)
}
function freeSlots(day, agenda, tasks, { dayStart, dayEnd, duration, includeTasks }) {
  let start = hmToMin(dayStart)
  const end = hmToMin(dayEnd)
  if (day === todayLocal()) start = Math.max(start, Math.ceil(minOfDay(Date.now()) / 15) * 15)
  const slots = []
  let cur = start
  for (const b of busyOnDay(day, agenda, tasks, includeTasks)) {
    if (b.e <= cur) continue
    if (b.s >= end) break
    if (b.s - cur >= duration) slots.push([cur, Math.min(b.s, end)])
    cur = Math.max(cur, b.e)
  }
  if (end - cur >= duration) slots.push([cur, end])
  return slots.map(([s, e]) => ({ from: minToHM(s), to: minToHM(e), minutes: Math.round(e - s) }))
}

// ── tool-definities ──────────────────────────────────────────────────────────
const S = (props, required) => ({ type: 'object', properties: props, ...(required ? { required } : {}) })
const str = (description, extra = {}) => ({ type: 'string', description, ...extra })
const num = (description) => ({ type: 'number', description })
const bool = (description) => ({ type: 'boolean', description })
const RO = { readOnlyHint: true }
const DEL = { destructiveHint: true }
const taskProps = {
  title: str('Titel'), date: str('Datum YYYY-MM-DD (leeg/null = nog in te plannen)'), end_date: str('Laatste dag bij een meerdaagse taak, YYYY-MM-DD'),
  time: str('Begintijd HH:MM (tijdslot); null = geen tijd'), end_time: str('Eindtijd HH:MM'), duration_minutes: num('Duur in minuten (standaard 30)'),
  daypart: str('Dagdeel zonder tijd', { enum: ['ochtend', 'middag', 'avond'] }), priority: str('Prioriteit', { enum: ['urgent', 'normaal', 'later'] }),
  recurrence: str('Herhaling (null = geen)', { enum: ['daily', 'weekdays', 'weekly', 'monthly'] }),
  recurrence_days: { type: 'array', items: { type: 'number' }, description: 'Bij weekly: weekdagen 1=ma … 7=zo' },
  type: str('Type (naam of key, zie list_types)'), deadline: str('Deadline YYYY-MM-DD'), description: str('Beschrijving'),
  travel_before: num('Reistijd heen in minuten (bij een tijdslot)'), travel_after: num('Reistijd terug in minuten'),
}
const eventProps = {
  title: str('Titel'), date: str('Datum YYYY-MM-DD'), start: str('Begintijd HH:MM'), end: str('Eindtijd HH:MM (vóór de begintijd = volgende dag)'),
  end_date: str('Einddatum bij meerdaagse items, YYYY-MM-DD'), all_day: bool('Hele dag'), type: str('Type (naam of key)'), description: str('Beschrijving'),
  recurrence: str('Herhaling (null = geen)', { enum: ['daily', 'weekdays', 'weekly', 'biweekly'] }),
  recurrence_days: { type: 'array', items: { type: 'number' }, description: 'Bij weekly/biweekly: weekdagen 1=ma … 7=zo' },
  travel_before: num('Reistijd heen in minuten'), travel_after: num('Reistijd terug in minuten'),
}

const TOOLS = [
  { name: 'get_today', description: 'Dagoverzicht zoals het dashboard: agenda (eigen items, feeds, werkdiensten, met reistijd/vertrektijd), taken van die dag (urgent, te laat, per dagdeel, routines, nog in te plannen), het eerstvolgende item, werkuren deze week en wat al is afgerond. Zonder date = vandaag.',
    inputSchema: S({ date: str('YYYY-MM-DD') }), annotations: RO },
  { name: 'list_agenda', description: 'Agenda-items in een periode: eigen items (kind eigen; herhalende items per keer met occurrence) en geïmporteerde feeds zoals MijnX/WDK (kind feed, id "feed:…") met jouw aanpassingen toegepast. Tijden lokaal (Europe/Amsterdam).',
    inputSchema: S({ from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD (max. 120 dagen na from)'), type: str('Alleen dit type (naam of key, zie list_types)'), include_hidden: bool('Ook verborgen feed-items'),
      compact: bool('Alleen titel, type, bron, tijden, locatie en vertrektijd (geen beschrijvingen)') }, ['from', 'to']), annotations: RO },
  { name: 'get_work_hours', description: 'Werkuren (diensten uit de WDK-feed, anders alles van het type Werk; telt vanaf 12 okt 2026, pauze doorbetaald): totaal, al gewerkt en nog gepland, per dag met de diensten, en het verschil met de vorige week/maand.',
    inputSchema: S({ period: str('week (ma–zo) of month (kalendermaand)', { enum: ['week', 'month'] }), date: str('Een dag in de gewenste week/maand, YYYY-MM-DD (standaard vandaag)') }), annotations: RO },
  { name: 'get_time_overview', description: 'Waar gaat de tijd heen in een periode: agenda-uren per type en per weekdag, werkuren, afgeronde taken per type, drukste dagen.',
    inputSchema: S({ from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD (max. 120 dagen)') }, ['from', 'to']), annotations: RO },
  { name: 'find_free_time', description: 'Vrije blokken per dag tussen agenda-items (incl. reistijd), werkdiensten en taken met een tijd. Gebruik dit vóór je iets inplant.',
    inputSchema: S({ from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD (max. 31 dagen)'), duration_minutes: num('Minimale lengte van een blok (standaard 30)'),
      day_start: str('Vroegste tijd HH:MM (standaard 08:00)'), day_end: str('Laatste tijd HH:MM (standaard 22:00)'), include_tasks: bool('Taken met een tijd als bezet tellen (standaard true)') }, ['from', 'to']), annotations: RO },
  { name: 'list_tasks', description: 'Taken met datum, tijd/dagdeel, prioriteit, deadline, herhaling + streak, type en gekoppelde notitie. Standaard open taken (incl. routines). Gebruik ids voor wijzigen.',
    inputSchema: S({ status: str('Standaard open', { enum: ['open', 'done', 'all'] }), from: str('Vanaf datum YYYY-MM-DD'), to: str('T/m datum YYYY-MM-DD'),
      search: str('Zoek in titel/beschrijving'), include_routines: bool('Routines (herhalende taken) meenemen, standaard true'), unplanned: bool('Alleen taken zonder datum') }), annotations: RO },
  { name: 'list_completions', description: 'Afgeronde taken per dag (logboek), met totalen, dagen op rij en gemiddelde per dag.',
    inputSchema: S({ from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD (standaard vandaag)') }, ['from']), annotations: RO },
  { name: 'list_types', description: 'Types (categorieën) voor taken en agenda-items, met kleur.', inputSchema: S({}), annotations: RO },
  { name: 'list_notes', description: 'Notities (titel, map, vastgezet, afgevinkt, laatst bewerkt, begin van de tekst). Nieuwste eerst.',
    inputSchema: S({ folder: str('Mapnaam of id'), search: str('Zoek in titel en inhoud'), limit: num('Max. aantal (standaard 50)') }), annotations: RO },
  { name: 'get_note', description: 'Volledige notitie. Inhoud is platte tekst: "# kop", "- [ ] taak", "- [x] gedaan", "- opsomming", "1. genummerd".',
    inputSchema: S({ id: str('Notitie-id') }, ['id']), annotations: RO },
  { name: 'list_note_folders', description: 'Notitiemappen (naam, aantal notities, afvinkbaar).', inputSchema: S({}), annotations: RO },

  { name: 'close_day', description: 'Dag afsluiten: wat is gedaan (taken + routines met tijd), wat bleef liggen (eenmalige taken van die dag + te laat), welke routines niet zijn gedaan, en of de recap al is ingevuld. Met apply=true worden de blijven-liggen taken verplaatst naar move_to (standaard de dag erna); vraag daar eerst bevestiging voor en noem welke taken.',
    inputSchema: S({ date: str('YYYY-MM-DD (standaard vandaag)'), apply: bool('Open taken echt verplaatsen (anders alleen een voorstel)'), move_to: str('Naar welke dag (standaard de dag erna)'),
      task_ids: { type: 'array', items: { type: 'string' }, description: 'Alleen deze taken verplaatsen (standaard alle open taken van die dag)' } }) },
  { name: 'set_feed_travel_rule', description: 'Standaard reistijd per locatie voor een geïmporteerde agenda (bv. MyX: "R29" = 15 min heen en terug). Geldt voor alle items van die feed waarvan de locatie (of titel) de tekst bevat, behalve items met een eigen reistijd. remove=true haalt de regel weg. Zonder argumenten: toon de regels. Vraag eerst bevestiging.',
    inputSchema: S({ feed: str('Naam van de feed (bv. MijnX, HAN), zie list_agenda → source'), match: str('Tekst in de locatie, bv. "R29"'),
      before: num('Reistijd heen (min)'), after: num('Reistijd terug (min, standaard gelijk aan heen)'), remove: bool('Regel verwijderen') }) },
  { name: 'create_task', description: 'Nieuwe taak. Vraag eerst bevestiging (titel, dag, tijd/dagdeel). Geef een type mee (zie list_types, bv. Sport); zonder type kiest de server er een op basis van de titel (type_chosen_automatically). Geeft het volledige item terug.', inputSchema: S(taskProps, ['title']) },
  { name: 'update_task', description: 'Taak aanpassen of verplaatsen (alleen meegegeven velden; null wist een veld). Vraag eerst bevestiging.', inputSchema: S({ id: str('Taak-id'), ...taskProps }, ['id']) },
  { name: 'complete_task', description: 'Taak afvinken (herhalende taak schuift door naar de volgende keer, streak telt mee) of met undo=true weer open zetten. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Taak-id'), undo: bool('Afvinken ongedaan maken') }, ['id']) },
  { name: 'delete_task', description: 'Taak definitief verwijderen. Vraag eerst bevestiging.', inputSchema: S({ id: str('Taak-id') }, ['id']), annotations: DEL },
  { name: 'create_event', description: 'Nieuw eigen agenda-item. Vraag eerst bevestiging. Geef een type mee (zie list_types, bv. Sport); zonder type kiest de server er een op basis van de titel. Geeft het volledige item terug (type, duur, reistijd, vertrektijd).', inputSchema: S(eventProps, ['title', 'date']) },
  { name: 'update_event', description: 'Eigen agenda-item aanpassen (alleen meegegeven velden). Werkt niet op feed-items (gebruik update_feed_event). Bij een herhalend item verandert de hele reeks. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Id van het eigen item'), ...eventProps }, ['id']) },
  { name: 'delete_event', description: 'Eigen agenda-item verwijderen (bij herhaling: de hele reeks). Vraag eerst bevestiging.', inputSchema: S({ id: str('Id van het eigen item') }, ['id']), annotations: DEL },
  { name: 'update_feed_event', description: 'Geïmporteerd item (MijnX/WDK/Google, id "feed:…") aanpassen via een eigen aanpassing die elke sync overleeft: titel, tijden, type, verbergen, notitie, reistijd; reset=true zet alles terug naar de feed. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('"feed:…" id uit list_agenda'), title: str('Titel'), date: str('Nieuwe datum YYYY-MM-DD'), start: str('Begintijd HH:MM'), end: str('Eindtijd HH:MM'),
      all_day: bool('Hele dag'), type: str('Type (naam of key)'), hidden: bool('Verbergen'), note: str('Eigen notitie'), travel_before: num('Reistijd heen (min)'), travel_after: num('Reistijd terug (min)'), reset: bool('Terug naar origineel') }, ['id']) },
  { name: 'create_note', description: 'Nieuwe notitie (inhoud als platte tekst, bv. "- [ ] melk"). Vraag eerst bevestiging.',
    inputSchema: S({ title: str('Titel (eerste regel)'), content: str('Inhoud'), folder: str('Mapnaam of id (leeg = Notities)') }, ['title']) },
  { name: 'update_note', description: 'Notitie aanpassen: titel, inhoud vervangen, of append om regels toe te voegen (bv. aan een boodschappenlijst); map, vastzetten, afvinken. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Notitie-id'), title: str('Titel'), content: str('Nieuwe volledige inhoud'), append: str('Regels om onderaan toe te voegen'), folder: str('Mapnaam of id ("" = geen map)'),
      pinned: bool('Vastzetten'), done: bool('Afgevinkt (alleen in afvinkbare mappen zichtbaar)') }, ['id']) },
  { name: 'delete_note', description: 'Notitie definitief verwijderen. Vraag eerst bevestiging.', inputSchema: S({ id: str('Notitie-id') }, ['id']), annotations: DEL },
]
const NAMES = new Set(TOOLS.map(t => t.name))

const INSTRUCTIONS = 'Planner (Hypex Dash): agenda, werkuren, taken en notities. Tijdzone Europe/Amsterdam, datums YYYY-MM-DD, tijden HH:MM. ' +
  'Begin met get_today voor de dag of list_agenda + list_tasks voor een periode; get_work_hours voor werkuren, get_time_overview voor waar de tijd heen gaat. ' +
  'Gebruik find_free_time voordat je iets inplant, en houd rekening met reistijd, werkdiensten en school. ' +
  'Feed-items (MijnX/WDK, id "feed:…") pas je alleen aan met update_feed_event; eigen items met update_event. ' +
  'Routines: done/done_today gelden voor de gevraagde dag, next_due = eerstvolgende keer; get_today.completed_today = wat al gedaan is (vraag dat niet opnieuw). ' +
  'Geef bij nieuwe items een type mee (list_types). list_agenda met compact=true voor een kort overzicht. close_day om de dag af te sluiten (open taken naar morgen). ' +
  'Vraag altijd eerst bevestiging voordat je iets aanmaakt, wijzigt, afvinkt of verwijdert, en noem daarbij precies wat er verandert.'

// ── handlers ─────────────────────────────────────────────────────────────────
function taskFields(args, types, orig = null) {
  const f = {}
  const has = (k) => args[k] !== undefined
  if (has('title')) { need(String(args.title || '').trim(), 'title mag niet leeg zijn'); f.title = String(args.title).trim().slice(0, 300) }
  if (has('date')) f.date = optDate(args.date, 'date') || null
  if (has('end_date')) f.end_date = optDate(args.end_date, 'end_date') || null
  if (has('time')) { const t = optHM(args.time, 'time') || null; f.start_time = t; f.time = t; if (t) f.daypart = null }
  if (has('end_time')) f.end_time = optHM(args.end_time, 'end_time') || null
  if (has('time') && !args.time && !has('end_time')) f.end_time = null
  if (has('duration_minutes')) { need(args.duration_minutes > 0 && args.duration_minutes <= 1440, 'duration_minutes moet 1–1440 zijn'); f.duration_minutes = Math.round(args.duration_minutes) }
  if (has('daypart')) { need(!args.daypart || DAYPARTS[args.daypart], 'daypart: ochtend, middag of avond'); f.daypart = args.daypart || null; if (args.daypart) { f.start_time = null; f.time = null; f.end_time = null } }
  if (has('priority')) f.priority = args.priority === 'urgent' ? 1 : args.priority === 'later' ? 3 : 2
  if (has('recurrence')) { need(!args.recurrence || ['daily', 'weekdays', 'weekly', 'monthly'].includes(args.recurrence), 'recurrence ongeldig'); f.recurrence = args.recurrence || null }
  if (has('recurrence_days')) { need(!args.recurrence_days || args.recurrence_days.every(d => d >= 1 && d <= 7), 'recurrence_days: 1=ma … 7=zo'); f.recurrence_days = args.recurrence_days?.length ? args.recurrence_days : null }
  if (has('type')) { const t = types.resolve(args.type); f.type_id = t ? t.id : null }
  if (has('deadline')) f.due_date = optDate(args.deadline, 'deadline') || null
  if (has('description')) f.description = args.description ? String(args.description).slice(0, 2000) : null
  for (const k of ['travel_before', 'travel_after']) if (has(k)) { need(!args[k] || (args[k] > 0 && args[k] <= 600), `${k} moet 0–600 minuten zijn`); f[k] = args[k] ? Math.round(args[k]) : null }
  // De agenda (Timeline) leest de eindtijd uit end_time (zonder end_time = 1 uur), net als ItemModal: dus end_time
  // altijd meeschrijven bij een tijdslot. Verschuiven houdt de duur van het blok; alleen duration_minutes past het einde aan.
  const start = f.start_time !== undefined ? f.start_time : (orig?.start_time || orig?.time || null)
  if (start && !has('end_time') && (has('time') || has('duration_minutes'))) {
    const os = orig && (orig.start_time || orig.time), oe = orig?.end_time
    const span = os && oe ? ((hmToMin(oe.slice(0, 5)) - hmToMin(os.slice(0, 5)) + 1440) % 1440) || null : null
    const dur = f.duration_minutes ?? span ?? orig?.duration_minutes ?? 30
    f.end_time = minToHM(hmToMin(start.slice(0, 5)) + dur)
    if (f.duration_minutes === undefined) f.duration_minutes = dur
  }
  const rec = f.recurrence !== undefined ? f.recurrence : orig?.recurrence
  if (rec && (f.date || (!orig && !f.date))) f.date = snap(f.date || todayLocal(), rec, f.recurrence_days !== undefined ? f.recurrence_days : orig?.recurrence_days)
  return f
}

async function eventTimes(args, orig) {
  // Huidige waarden als basis (bij bewerken)
  const s0 = orig ? new Date(orig.start_time) : null, e0 = orig ? new Date(orig.end_time) : null
  const date = optDate(args.date, 'date') || (s0 ? localDay(s0) : null)
  need(date, 'date ontbreekt')
  const allDay = args.all_day !== undefined ? !!args.all_day : orig ? (minOfDay(s0) === 0 && localHM(e0) === '23:59') : !args.start
  const endDate = optDate(args.end_date, 'end_date') || (orig && !args.date ? localDay(e0) : date)
  if (allDay) return { start_time: toUTC(date, '00:00').toISOString(), end_time: toUTC(endDate < date ? date : endDate, '23:59').toISOString() }
  const wasAllDay = orig && minOfDay(s0) === 0 && localHM(e0) === '23:59'
  const start = optHM(args.start, 'start') || (s0 && !wasAllDay ? localHM(s0) : null)
  need(start, 'start (HH:MM) ontbreekt, of zet all_day')
  const end = optHM(args.end, 'end')
  const st = toUTC(date, start)
  let en
  if (end) { // eindtijd gegeven: op de einddatum, of de volgende dag als hij vóór de begintijd ligt (over middernacht)
    en = toUTC(args.end_date ? endDate : hmToMin(end) <= hmToMin(start) ? addDays(date, 1) : date, end)
  } else if (args.end_date) {
    en = toUTC(endDate, orig && !wasAllDay ? localHM(e0) : start)
  } else { // geen eindtijd: duur behouden (verplaatsen), nieuw item = 1 uur
    const dur = orig && !wasAllDay ? e0 - s0 : 60 * 60000
    en = new Date(+st + dur)
  }
  need(en > st, 'Eindtijd moet na de begintijd liggen')
  return { start_time: st.toISOString(), end_time: en.toISOString() }
}

async function folderId(sb, uid, v) {
  if (v === undefined) return undefined
  if (!v) return null
  const { data } = await sb.from('note_folders').select('id,name,kind').eq('user_id', uid)
  const s = String(v).toLowerCase()
  const f = (data || []).find(x => x.kind !== 'divider' && (x.id === v || (x.name || '').toLowerCase() === s))
  if (!f) throw new Error(`Map "${v}" niet gevonden. Gebruik list_note_folders.`)
  return f.id
}
const slimNote = (n, folders, full) => ({
  id: n.id, title: n.title || '(zonder titel)', folder: folders.get(n.folder_id)?.name || 'Notities',
  ...(n.pinned ? { pinned: true } : {}), ...(n.done_at ? { done: true } : {}), updated: n.updated_at ? localStamp(n.updated_at) : null,
  ...(full ? { content: n.content || '' } : { preview: String(n.content || '').replace(/\n+/g, ' · ').slice(0, 140) }),
  ...(n.content && /- \[[ xX]\]/.test(n.content) ? { checklist: `${(n.content.match(/- \[[xX]\]/g) || []).length}/${(n.content.match(/- \[[ xX]\]/g) || []).length}` } : {}),
})

async function callTool(sb, uid, name, args = {}) {
  const types = await loadTypes(sb, uid)
  const today = todayLocal()

  if (name === 'list_types') return { types: types.list.map(t => ({ id: t.id, name: t.name, key: t.key || null, color: t.color })) }

  if (name === 'list_agenda') {
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to')
    need(from && to && to >= from && daysBetween(from, to) <= 120, 'from/to verplicht, max. 120 dagen')
    let list = await loadAgenda(sb, uid, types, from, to)
    if (!args.include_hidden) list = list.filter(x => !x.hidden)
    if (args.type) { const t = types.resolve(args.type); list = list.filter(x => x.cat === t.cat) }
    if (args.compact) {
      return { from, to, count: list.length, compact: true, items: list.map(x => ({ id: x.id, title: x.title, type: types.name(x.cat), source: x.source,
        start: localStamp(x.start), end: localStamp(x.end), ...(x.all_day ? { all_day: true } : {}), ...(x.location ? { location: x.location } : {}),
        ...(x.travel_before ? { leave_at: localHM(+x.start - x.travel_before * 60000) } : {}) })) }
    }
    // Dezelfde lange beschrijving (bv. bij elke WDK-dienst) maar één keer meesturen
    const seen = new Set()
    const items = list.map(x => {
      const e = slimEvent(x, types)
      if (e.description) { const k = `${x.source}|${e.description}`; if (seen.has(k)) { delete e.description; e.description_repeated = true } else seen.add(k) }
      return e
    })
    return { from, to, count: list.length, items }
  }

  if (name === 'get_work_hours') {
    const period = args.period === 'month' ? 'month' : 'week'
    const date = optDate(args.date, 'date') || today
    const cur = rangeOf(period, date)
    const prevR = rangeOf(period, period === 'month' ? monthShift(cur.from, -1) : addDays(cur.from, -7))
    const agenda = await loadAgenda(sb, uid, types, prevR.from, cur.to)
    const shifts = workShifts(agenda)
    const a = sumHours(shifts, cur.from, cur.to), b = sumHours(shifts, prevR.from, prevR.to)
    const src = agenda.find(x => x.kind === 'feed' && /wdk/i.test(x.source || ''))?.source || 'type Werk'
    return {
      period, from: cur.from, to: cur.to, source: src, counts_since: WORK_SINCE,
      total: fmtHours(a.total_min), total_hours: hours(a.total_min), worked_hours: hours(a.worked_min), planned_hours: hours(a.total_min - a.worked_min),
      shifts: a.count, days: a.days,
      previous: { from: prevR.from, to: prevR.to, total_hours: hours(b.total_min), shifts: b.count },
      difference_hours: hours(a.total_min - b.total_min),
    }
  }

  if (name === 'find_free_time') {
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to')
    need(from && to && to >= from && daysBetween(from, to) <= 31, 'from/to verplicht, max. 31 dagen')
    const opts = { dayStart: optHM(args.day_start, 'day_start') || '08:00', dayEnd: optHM(args.day_end, 'day_end') || '22:00',
      duration: Math.max(5, Number(args.duration_minutes) || 30), includeTasks: args.include_tasks !== false }
    const [agenda, tasks] = await Promise.all([loadAgenda(sb, uid, types, from, to), loadTasks(sb, uid)])
    const days = dayList(from, to).filter(d => d >= today).map(d => {
      const slots = freeSlots(d, agenda, tasks, opts)
      return { date: d, weekday: WEEKDAYS[dow(d)], free_hours: hours(slots.reduce((n, s) => n + s.minutes, 0)), slots }
    })
    return { window: `${opts.dayStart}–${opts.dayEnd}`, min_minutes: opts.duration, days }
  }

  if (name === 'get_time_overview') {
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to')
    need(from && to && to >= from && daysBetween(from, to) <= 120, 'from/to verplicht, max. 120 dagen')
    const [agenda, comps] = await Promise.all([loadAgenda(sb, uid, types, from, to),
      sb.from('task_completions').select('*').eq('user_id', uid).gte('day', from).lte('day', to).limit(5000)])
    const perType = {}, perWeekday = {}, perDay = {}
    const lo = +toUTC(from), hi = +toUTC(addDays(to, 1))
    for (const x of agenda) {
      if (x.hidden || x.all_day) continue
      const s = Math.max(+x.start, lo), e = Math.min(+x.end, hi)
      if (e <= s) continue
      const min = (e - s) / 60000, t = types.name(x.cat), d = localDay(s)
      perType[t] = (perType[t] || 0) + min
      perWeekday[WEEKDAYS[dow(d)]] = (perWeekday[WEEKDAYS[dow(d)]] || 0) + min
      perDay[d] = (perDay[d] || 0) + min
    }
    const work = sumHours(workShifts(agenda), from, to)
    const doneByType = {}
    for (const c of comps.data || []) { const t = types.name(types.catOfId(c.type_id) || (c.recurring ? 'routine' : 'persoonlijk')); doneByType[t] = (doneByType[t] || 0) + 1 }
    const h = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, hours(v)]))
    return {
      from, to, agenda_hours_by_type: h(perType), agenda_hours_by_weekday: h(perWeekday),
      busiest_days: Object.entries(perDay).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, m]) => ({ date: d, weekday: WEEKDAYS[dow(d)], hours: hours(m) })),
      work_hours: hours(work.total_min), work_shifts: work.count,
      tasks_completed: (comps.data || []).length, tasks_completed_by_type: Object.fromEntries(Object.entries(doneByType).sort((a, b) => b[1] - a[1])),
      note: 'Agenda-uren = geplande tijd in de agenda (eigen items + feeds, zonder hele-dag-items en verborgen items).',
    }
  }

  if (name === 'list_tasks') {
    let list = await loadTasks(sb, uid)
    const status = args.status || 'open'
    if (status === 'open') list = list.filter(t => !t.completed)
    if (status === 'done') list = list.filter(t => t.completed)
    if (args.include_routines === false) list = list.filter(t => !t.recurrence)
    if (args.unplanned) list = list.filter(t => !t.date)
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to')
    if (from || to) {
      const days = dayList(from || today, to || addDays(from || today, 30))
      list = list.filter(t => t.date && days.some(d => taskOnDay(t, d)))
    }
    if (args.search) { const s = String(args.search).toLowerCase(); list = list.filter(t => `${t.title} ${t.description || ''}`.toLowerCase().includes(s)) }
    list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (taskStart(a) || '99').localeCompare(taskStart(b) || '99') || (a.priority ?? 2) - (b.priority ?? 2))
    return { count: list.length, today, items: list.slice(0, 300).map(t => slimTask(t, types, today)) }
  }

  if (name === 'list_completions') {
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to') || today
    need(from, 'from ontbreekt')
    const { data, error } = await sb.from('task_completions').select('*').eq('user_id', uid).gte('day', from).lte('day', to)
      .order('day', { ascending: false }).order('completed_at', { ascending: false }).limit(3000)
    if (error) throw new Error(/task_completions/.test(error.message) ? 'Logboek ontbreekt (migratie add_task_completions.sql)' : error.message)
    const byDay = new Map()
    for (const c of data || []) {
      const g = byDay.get(c.day) || []
      g.push({ title: c.title, type: types.name(types.catOfId(c.type_id) || (c.recurring ? 'routine' : 'persoonlijk')), ...(c.recurring ? { routine: true } : {}), ...(c.planned_date && c.planned_date !== c.day ? { planned: c.planned_date } : {}) })
      byDay.set(c.day, g)
    }
    let streak = 0
    for (let d = byDay.has(today) ? today : addDays(today, -1); byDay.has(d); d = addDays(d, -1)) streak++
    const nDays = daysBetween(from, to) + 1
    return { from, to, total: (data || []).length, avg_per_day: Math.round(((data || []).length / nDays) * 10) / 10, streak_days: streak,
      days: [...byDay.entries()].map(([date, items]) => ({ date, weekday: WEEKDAYS[dow(date)], count: items.length, items })) }
  }

  if (name === 'get_today') {
    const day = optDate(args.date, 'date') || today
    const week = rangeOf('week', day)
    const [agenda, tasks, comps] = await Promise.all([
      loadAgenda(sb, uid, types, week.from < day ? week.from : day, week.to > addDays(day, 1) ? week.to : addDays(day, 1)),
      loadTasks(sb, uid),
      sb.from('task_completions').select('title, day, recurring, task_id, completed_at').eq('user_id', uid).eq('day', day),
    ])
    const logs = comps.data || []
    const lo = +toUTC(day), hi = +toUTC(addDays(day, 1)), now = Date.now()
    const items = agenda.filter(x => !x.hidden && +x.end > lo && +x.start < hi)
    const next = agenda.filter(x => !x.hidden && !x.all_day && +x.start - (x.travel_before || 0) * 60000 > now)[0]
    const current = agenda.filter(x => !x.hidden && !x.all_day && +x.start <= now && +x.end > now)
    const open = tasks.filter(t => !t.completed)
    const onDay = open.filter(t => taskOnDay(t, day) && !(t.recurrence && isDoneToday(t, day)))
    const overdue = day === today ? open.filter(t => !t.recurrence && t.date && taskLast(t) < today) : []
    const byPart = { ochtend: [], middag: [], avond: [], zonder_tijd: [] }
    for (const t of onDay.filter(t => !t.recurrence)) {
      const st = taskStart(t), part = t.daypart || (st ? (st < '12:00' ? 'ochtend' : st < '17:00' ? 'middag' : 'avond') : 'zonder_tijd')
      byPart[part].push(slimTask(t, types, today))
    }
    const work = sumHours(workShifts(agenda), week.from, week.to)
    return {
      date: day, weekday: WEEKDAYS[dow(day)], now: day === today ? localHM(now) : undefined,
      agenda: items.map(x => slimEvent(x, types)),
      ...(day === today && current.length ? { now_busy: current.map(x => slimEvent(x, types)) } : {}),
      ...(day === today && next ? { next: { ...slimEvent(next, types), starts_in_min: Math.round((+next.start - now) / 60000) } } : {}),
      tasks: {
        urgent: onDay.filter(t => t.priority === 1).map(t => slimTask(t, types, today)),
        overdue: overdue.map(t => slimTask(t, types, today)),
        by_daypart: byPart,
        // Alle routines van die dag, ook de afgevinkte (done: true), zodat "3/4" klopt
        routines: tasks.filter(t => routineDueOn(t, day, today, logs)).map(t => slimTask(t, types, today, { day, logs })),
        unplanned_count: open.filter(t => !t.date).length,
      },
      completed: logs.map(c => c.title),
      // Vandaag (of op de gevraagde dag) afgerond, met tijdstip: taken én routines
      completed_today: logs.slice().sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)))
        .map(c => ({ title: c.title, ...(c.recurring ? { routine: true } : {}), time: c.completed_at ? localHM(c.completed_at) : null })),
      work_hours_this_week: { from: week.from, to: week.to, total_hours: hours(work.total_min), worked_hours: hours(work.worked_min), shifts: work.count },
    }
  }

  if (name === 'list_note_folders') {
    const [f, n] = await Promise.all([sb.from('note_folders').select('*').eq('user_id', uid).order('sort_order'),
      sb.from('notes').select('folder_id').eq('user_id', uid)])
    const count = new Map()
    for (const x of n.data || []) count.set(x.folder_id || null, (count.get(x.folder_id || null) || 0) + 1)
    return { folders: [{ id: null, name: 'Notities', notes: count.get(null) || 0 },
      ...(f.data || []).filter(x => x.kind !== 'divider').map(x => ({ id: x.id, name: x.name, notes: count.get(x.id) || 0, ...(x.checkable ? { checkable: true } : {}) }))] }
  }

  if (name === 'list_notes' || name === 'get_note') {
    const { data: fl } = await sb.from('note_folders').select('id,name').eq('user_id', uid)
    const folders = new Map((fl || []).map(f => [f.id, f]))
    if (name === 'get_note') {
      const { data } = await sb.from('notes').select('*').eq('user_id', uid).eq('id', args.id).maybeSingle()
      need(data, 'Notitie niet gevonden')
      return slimNote(data, folders, true)
    }
    let q = sb.from('notes').select('*').eq('user_id', uid)
    if (args.folder !== undefined) { const fid = await folderId(sb, uid, args.folder); q = fid ? q.eq('folder_id', fid) : q.is('folder_id', null) }
    if (args.search) { const s = String(args.search).replace(/[%_,()]/g, ' ').trim(); if (s) q = q.or(`title.ilike.%${s}%,content.ilike.%${s}%`) }
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(Math.min(200, Math.max(1, Number(args.limit) || 50)))
    if (error) throw new Error(error.message)
    const list = (data || []).filter(n => n.title || n.content)
    return { count: list.length, notes: list.map(n => slimNote(n, folders, false)) }
  }

  // ── bewerken ──
  if (name === 'close_day') {
    const day = optDate(args.date, 'date') || today
    const moveTo = optDate(args.move_to, 'move_to') || addDays(day, 1)
    const [tasks, comps, agenda, recap] = await Promise.all([
      loadTasks(sb, uid),
      sb.from('task_completions').select('title, day, recurring, task_id, completed_at').eq('user_id', uid).eq('day', day),
      loadAgenda(sb, uid, types, day, day),
      sb.from('recaps').select('id').eq('user_id', uid).eq('kind', 'day').eq('day', day).maybeSingle(),
    ])
    const logs = comps.data || []
    const routines = tasks.filter(t => routineDueOn(t, day, today, logs))
    // Blijven liggen: eenmalige taken die die dag gepland stonden (meerdaagse alleen op hun laatste dag) + te laat
    const open = tasks.filter(t => !t.completed && !t.recurrence && t.date && t.date <= day && taskLast(t) <= day)
    const lo = +toUTC(day), hi = +toUTC(addDays(day, 1))
    const ownEvents = agenda.filter(x => x.kind === 'eigen' && !x.hidden && +x.start >= lo && +x.start < hi)
    let moved = []
    if (args.apply) {
      const pick = Array.isArray(args.task_ids) && args.task_ids.length ? open.filter(t => args.task_ids.includes(t.id)) : open
      need(pick.length, 'Geen open taken om te verplaatsen')
      for (const t of pick) {
        const patch = { date: moveTo, updated_at: new Date().toISOString(), ...(t.end_date ? { end_date: null } : {}) }
        const { error } = await sb.from('tasks').update(patch).eq('id', t.id).eq('user_id', uid)
        if (error) throw new Error(error.message)
        moved.push({ id: t.id, title: t.title, from: t.date, to: moveTo })
      }
    }
    return {
      date: day, weekday: WEEKDAYS[dow(day)],
      done: logs.sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at))).map(c => ({ title: c.title, ...(c.recurring ? { routine: true } : {}), time: c.completed_at ? localHM(c.completed_at) : null })),
      routines: { done: routines.filter(t => routineDoneOn(t, day, logs)).length, total: routines.length, missed: routines.filter(t => !routineDoneOn(t, day, logs)).map(t => t.title) },
      left_open: open.map(t => ({ ...slimTask(t, types, today), ...(t.date < day ? { was_overdue: true } : {}) })),
      own_events: ownEvents.map(x => ({ title: x.title, type: types.name(x.cat), start: localHM(x.start), end: localHM(x.end) })),
      recap_filled: !!recap.data, ...(recap.error ? { recap_note: 'Recap-tabel niet gevonden' } : {}),
      ...(args.apply ? { moved } : { suggestion: open.length ? `Verplaats ${open.length} open ${open.length === 1 ? 'taak' : 'taken'} naar ${moveTo} met apply=true (na akkoord).` : 'Niets blijven liggen.' }),
      next_step: recap.data ? null : 'Recap invullen: get_recap + save_recap',
    }
  }

  if (name === 'set_feed_travel_rule') {
    const { data: conns, error } = await sb.from('calendar_connections').select('*').eq('user_id', uid)
    if (error) throw new Error(error.message)
    const list = conns || []
    if (!args.feed && !args.match) return { feeds: list.map(c => ({ feed: c.name, rules: Array.isArray(c.travel_rules) ? c.travel_rules : (c.travel_rules === undefined ? 'migratie add_feed_travel_rules.sql nog niet gedraaid' : []) })) }
    need(args.feed, 'feed ontbreekt')
    const f = String(args.feed).toLowerCase()
    const conn = list.find(c => (c.name || '').toLowerCase() === f) || list.find(c => (c.name || '').toLowerCase().includes(f))
    need(conn, `Feed "${args.feed}" niet gevonden. Feeds: ${list.map(c => c.name).join(', ')}`)
    need(conn.travel_rules !== undefined, 'Draai eerst supabase/migrations/add_feed_travel_rules.sql in Supabase')
    need(args.match && String(args.match).trim(), 'match ontbreekt (tekst in de locatie, bv. "R29")')
    const match = String(args.match).trim()
    let rules = (Array.isArray(conn.travel_rules) ? conn.travel_rules : []).filter(r => String(r.match).toLowerCase() !== match.toLowerCase())
    if (!args.remove) {
      need(Number(args.before) > 0 && Number(args.before) <= 600, 'before moet 1–600 minuten zijn')
      const after = args.after === undefined ? Number(args.before) : Number(args.after)
      need(after >= 0 && after <= 600, 'after moet 0–600 minuten zijn')
      rules = [...rules, { match, before: Math.round(Number(args.before)), after: Math.round(after) }]
    }
    const { error: ue } = await sb.from('calendar_connections').update({ travel_rules: rules }).eq('id', conn.id).eq('user_id', uid)
    if (ue) throw new Error(ue.message)
    return { feed: conn.name, rules, note: 'Geldt meteen voor alle items met deze locatie; items met een eigen reistijd houden die.' }
  }

  if (name === 'create_task') {
    const f = taskFields(args, types)
    let auto = null
    if (args.type === undefined) { auto = smartType(args.title, types); if (auto) f.type_id = auto.id }
    const row = { duration_minutes: 30, priority: 2, ...f, completed: false, user_id: uid }
    const { data, error } = await sb.from('tasks').insert(row).select().single()
    if (error) throw new Error(error.message)
    return { created: slimTask(data, types, today), ...(auto ? { type_chosen_automatically: auto.name } : {}) }
  }
  if (name === 'update_task') {
    const { data: orig } = await sb.from('tasks').select('*').eq('id', args.id).eq('user_id', uid).maybeSingle()
    need(orig, 'Taak niet gevonden')
    const f = taskFields(args, types, orig)
    need(Object.keys(f).length, 'Geen velden om aan te passen')
    const { data, error } = await sb.from('tasks').update({ ...f, updated_at: new Date().toISOString() }).eq('id', orig.id).eq('user_id', uid).select().single()
    if (error) throw new Error(error.message)
    return { updated: slimTask(data, types, today) }
  }
  if (name === 'complete_task') {
    const { data: t } = await sb.from('tasks').select('*').eq('id', args.id).eq('user_id', uid).maybeSingle()
    need(t, 'Taak niet gevonden')
    const stamp = new Date().toISOString()
    const removeLog = async () => {
      const { data: last } = await sb.from('task_completions').select('id').eq('user_id', uid).eq('task_id', t.id).order('completed_at', { ascending: false }).limit(1)
      if (last?.[0]) await sb.from('task_completions').delete().eq('id', last[0].id)
    }
    const log = (plannedDate) => sb.from('task_completions').insert({ user_id: uid, task_id: t.id, title: t.title || 'Taak', type_id: t.type_id || null,
      recurring: !!t.recurrence, day: today, planned_date: t.recurrence ? null : plannedDate })
    if (t.recurrence) {
      let upd
      if (args.undo) {
        need(isDoneToday(t, today), 'Deze routine is vandaag niet afgevinkt')
        const streak = Math.max(0, (t.streak || 0) - 1)
        upd = { streak, best_streak: t.best_streak || 0, last_completed_date: streak > 0 ? prevOcc(today, t.recurrence, t.recurrence_days) : null, date: today, completed: false }
      } else {
        need(!isDoneToday(t, today), 'Al afgevinkt vandaag')
        const continues = t.last_completed_date && t.last_completed_date === prevOcc(today, t.recurrence, t.recurrence_days)
        const streak = continues ? (t.streak || 0) + 1 : 1
        upd = { streak, best_streak: Math.max(t.best_streak || 0, streak), last_completed_date: today, date: nextOcc(today, t.recurrence, t.recurrence_days), completed: false }
      }
      const { data, error } = await sb.from('tasks').update({ ...upd, updated_at: stamp }).eq('id', t.id).select().single()
      if (error) throw new Error(error.message)
      if (args.undo) await removeLog(); else await log(null)
      // Routine: blijft "open" (completed: false) omdat hij doorschuift naar next; done_for zegt voor welke dag hij is afgevinkt
      return { [args.undo ? 'reopened' : 'completed']: slimTask(data, types, today), routine: true,
        status: args.undo ? 'reopened' : 'done', ...(args.undo ? { undone_for: today } : { done_for: today }), next: args.undo ? today : upd.date, streak: upd.streak }
    }
    const completing = !args.undo
    need(completing !== !!t.completed, completing ? 'Taak is al afgerond' : 'Taak staat al open')
    const multi = !!t.end_date && !!t.date && t.end_date > t.date
    const patch = { completed: completing, updated_at: stamp }
    if (completing && !multi && t.date !== today) patch.date = today
    if (!completing && !multi) {
      const { data: last } = await sb.from('task_completions').select('planned_date').eq('user_id', uid).eq('task_id', t.id).order('completed_at', { ascending: false }).limit(1)
      if (last?.[0]) patch.date = last[0].planned_date || null
    }
    const { data, error } = await sb.from('tasks').update(patch).eq('id', t.id).select().single()
    if (error) throw new Error(error.message)
    if (completing) await log(t.date || null); else await removeLog()
    return { [completing ? 'completed' : 'reopened']: slimTask(data, types, today), status: completing ? 'done' : 'reopened', ...(completing ? { done_for: today } : {}) }
  }
  if (name === 'delete_task') {
    const { data, error } = await sb.from('tasks').delete().eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    need(data, 'Taak niet gevonden')
    return { deleted: { id: data.id, title: data.title } }
  }

  if (name === 'create_event' || name === 'update_event') {
    const orig = name === 'update_event' ? (await sb.from('calendar_events').select('*').eq('id', args.id).eq('user_id', uid).maybeSingle()).data : null
    if (name === 'update_event') need(orig, String(args.id || '').startsWith('feed:') ? 'Dit is een feed-item: gebruik update_feed_event' : 'Agenda-item niet gevonden')
    const p = {}
    if (args.title !== undefined) { need(String(args.title || '').trim(), 'title mag niet leeg zijn'); p.title = String(args.title).trim().slice(0, 300) }
    if (args.description !== undefined) p.description = args.description ? String(args.description).slice(0, 2000) : ''
    if (!orig || ['date', 'start', 'end', 'end_date', 'all_day'].some(k => args[k] !== undefined)) Object.assign(p, await eventTimes(args, orig))
    if (args.type !== undefined) { const t = types.resolve(args.type); p.type_id = t ? t.id : null; if (t) p.color = t.color }
    if (args.recurrence !== undefined) { need(!args.recurrence || ['daily', 'weekdays', 'weekly', 'biweekly'].includes(args.recurrence), 'recurrence ongeldig'); p.recurrence = args.recurrence || null }
    if (args.recurrence_days !== undefined) { need(!args.recurrence_days || args.recurrence_days.every(d => d >= 1 && d <= 7), 'recurrence_days: 1=ma … 7=zo'); p.recurrence_days = args.recurrence_days?.length ? args.recurrence_days.map(d => d % 7) : null }
    for (const k of ['travel_before', 'travel_after']) if (args[k] !== undefined) { need(!args[k] || (args[k] > 0 && args[k] <= 600), `${k} moet 0–600 minuten zijn`); p[k] = args[k] ? Math.round(args[k]) : null }
    let res, autoName = null
    if (orig) {
      need(Object.keys(p).length, 'Geen velden om aan te passen')
      res = await sb.from('calendar_events').update(p).eq('id', orig.id).eq('user_id', uid).select().single()
    } else {
      if (args.type === undefined) { const a = smartType(p.title, types); if (a) { p.type_id = a.id; p.color = a.color || BUILTIN_COLOR[a.key] || p.color; p._auto = a.name } }
      if (!p.color) { const t = types.resolve('persoonlijk'); p.color = t?.color || '#A78BFA'; if (!p.type_id && t) p.type_id = t.id }
      autoName = p._auto || null; delete p._auto
      res = await sb.from('calendar_events').insert({ description: '', ...p, user_id: uid }).select().single()
    }
    if (res.error) throw new Error(res.error.message)
    const ev = res.data
    // Volledig item terug (type, duur, reistijd, vertrektijd, beschrijving), zodat je kunt zien wat er is opgeslagen
    const s0 = new Date(ev.start_time), e0 = new Date(ev.end_time)
    const cat = types.catOfId(ev.type_id) || EVENT_COLOR_CATEGORY[(ev.color || '').toLowerCase()] || 'persoonlijk'
    const full = slimEvent({ id: ev.id, kind: 'eigen', source: 'Eigen agenda', title: ev.title, cat, start: s0, end: e0, all_day: !!ev.all_day,
      travel_before: ev.travel_before || 0, travel_after: ev.travel_after || 0, description: ev.description && !ev.description.startsWith('pmt:') ? ev.description : null,
      location: ev.location || null, recurring: !!ev.recurrence, raw: ev }, types)
    return { [orig ? 'updated' : 'created']: full, ...(autoName ? { type_chosen_automatically: autoName } : {}) }
  }
  if (name === 'delete_event') {
    need(!String(args.id || '').startsWith('feed:'), 'Feed-items kun je niet verwijderen; verberg ze met update_feed_event (hidden: true)')
    const { data, error } = await sb.from('calendar_events').delete().eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    need(data, 'Agenda-item niet gevonden')
    return { deleted: { id: data.id, title: data.title, start: localStamp(data.start_time) } }
  }
  if (name === 'update_feed_event') {
    const rawId = String(args.id || '').replace(/^feed:/, '')
    const { data: ev } = await sb.from('external_calendar_events').select('*').eq('id', rawId).maybeSingle()
    need(ev, 'Feed-item niet gevonden')
    const { data: conn } = await sb.from('calendar_connections').select('id').eq('id', ev.connection_id).eq('user_id', uid).maybeSingle()
    need(conn, 'Feed-item niet gevonden')
    const match = (q) => q.eq('connection_id', ev.connection_id).eq('external_id', ev.external_id)
    if (args.reset) {
      const { error } = await match(sb.from('external_event_overrides').delete().eq('user_id', uid))
      if (error) throw new Error(error.message)
      return { reset: { id: args.id, title: ev.title } }
    }
    const { data: ov } = await match(sb.from('external_event_overrides').select('*').eq('user_id', uid)).maybeSingle()
    const row = { user_id: uid, connection_id: ev.connection_id, external_id: ev.external_id, title: null, note: null, start_time: null, end_time: null, all_day: null, type_id: null, hidden: false,
      ...(ov ? { title: ov.title, note: ov.note, start_time: ov.start_time, end_time: ov.end_time, all_day: ov.all_day, type_id: ov.type_id, hidden: !!ov.hidden,
        ...(ov.travel_before ? { travel_before: ov.travel_before } : {}), ...(ov.travel_after ? { travel_after: ov.travel_after } : {}) } : {}) }
    if (args.title !== undefined) row.title = args.title || null
    if (args.note !== undefined) row.note = args.note || null
    if (args.hidden !== undefined) row.hidden = !!args.hidden
    if (args.type !== undefined) { const t = types.resolve(args.type); row.type_id = t ? t.id : null }
    for (const k of ['travel_before', 'travel_after']) if (args[k] !== undefined) row[k] = args[k] ? Math.round(args[k]) : null
    if (['date', 'start', 'end', 'all_day'].some(k => args[k] !== undefined)) {
      const cur = { start_time: row.start_time || ev.start_time, end_time: row.end_time || ev.end_time }
      const t = await eventTimes({ date: args.date, start: args.start, end: args.end, all_day: args.all_day }, cur)
      row.start_time = t.start_time; row.end_time = t.end_time
      if (args.all_day !== undefined) row.all_day = !!args.all_day
    }
    row.updated_at = new Date().toISOString()
    const { error } = await sb.from('external_event_overrides').upsert(row, { onConflict: 'connection_id,external_id' })
    if (error) throw new Error(error.message)
    return { updated: { id: args.id, title: row.title || ev.title, ...(row.start_time ? { start: localStamp(row.start_time), end: localStamp(row.end_time) } : {}), ...(row.hidden ? { hidden: true } : {}) } }
  }

  if (name === 'create_note') {
    need(String(args.title || '').trim(), 'title ontbreekt')
    const fid = await folderId(sb, uid, args.folder)
    const { data, error } = await sb.from('notes').insert({ user_id: uid, title: String(args.title).trim().slice(0, 300), content: String(args.content || ''), folder_id: fid || null }).select().single()
    if (error) throw new Error(error.message)
    return { created: { id: data.id, title: data.title } }
  }
  if (name === 'update_note') {
    const { data: n } = await sb.from('notes').select('*').eq('id', args.id).eq('user_id', uid).maybeSingle()
    need(n, 'Notitie niet gevonden')
    const p = {}
    if (args.title !== undefined) p.title = String(args.title || '').slice(0, 300)
    if (args.content !== undefined) p.content = String(args.content || '')
    if (args.append) { const base = p.content ?? n.content ?? ''; p.content = (base && !base.endsWith('\n') ? base + '\n' : base) + String(args.append).replace(/^\n+/, '') }
    if (args.folder !== undefined) p.folder_id = await folderId(sb, uid, args.folder)
    if (args.pinned !== undefined) p.pinned = !!args.pinned
    if (args.done !== undefined) p.done_at = args.done ? new Date().toISOString() : null
    need(Object.keys(p).length, 'Geen velden om aan te passen')
    p.updated_at = new Date().toISOString()
    const { data, error } = await sb.from('notes').update(p).eq('id', n.id).eq('user_id', uid).select().single()
    if (error) throw new Error(error.message)
    return { updated: { id: data.id, title: data.title, content: data.content } }
  }
  if (name === 'delete_note') {
    const { data, error } = await sb.from('notes').delete().eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    need(data, 'Notitie niet gevonden')
    return { deleted: { id: data.id, title: data.title } }
  }
  throw new Error(`Onbekende tool: ${name}`)
}

module.exports = { TOOLS, NAMES, INSTRUCTIONS, callTool, _t: { toUTC, localStamp, sumHours, workShifts, loadAgenda, freeSlots, nextOcc, prevOcc },
  // gedeeld met study.js (Focus + Recap)
  helpers: { taskOnDay, taskLast, routineDueOn, routineDoneOn, TZ, WEEKDAYS, pad, parts, localDay, localHM, todayLocal, toUTC, addDays, dow, isoDow, daysBetween, dayList, mondayOf, isDate, isHM, hmToMin, fmtHours, hours, need, optDate, optHM, loadTypes, loadAgenda, workShifts, sumHours, slimEvent } }
