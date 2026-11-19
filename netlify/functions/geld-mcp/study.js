// Study-tools voor de Hypex-connector: Focus (vakken, toetsdatums, onderwerpen, cijfers, studiesessies) en Recap
// (dag-/weekevaluaties). Lezen én bewerken. Logica volgt de app:
//   Focus → src/focus/store/focusStore.ts (tabellen focus_*, sessies in pomodoro_sessions met mode 'work'),
//           src/focus/lib/stats.ts (streak, per vak/soort/uur), src/focus/lib/grade.ts (benodigd tentamencijfer)
//   Recap → src/recap/store/recapStore.ts (upsert op user_id,kind,day; week = maandag), src/recap/lib/recapStats.ts,
//           src/recap/hooks/useActivity.ts (taken, focusminuten, uitgaven per dag)

const { helpers: H } = require('./planner')
const { WEEKDAYS, localDay, localHM, todayLocal, toUTC, addDays, dow, daysBetween, dayList, mondayOf, isDate, isHM, need, optDate, hours, fmtHours } = H

const KINDS = { reading: 'Lezen', assignment: 'Opdracht', practice: 'Oefenen', review: 'Herhalen' }
const KIND_IN = { lezen: 'reading', opdracht: 'assignment', oefenen: 'practice', herhalen: 'review', reading: 'reading', assignment: 'assignment', practice: 'practice', review: 'review' }
const STATUS = { active: 'Actief', paused: 'Gepauzeerd', completed: 'Afgerond', archived: 'Archief' }
const STATUS_IN = { actief: 'active', gepauzeerd: 'paused', afgerond: 'completed', archief: 'archived', active: 'active', paused: 'paused', completed: 'completed', archived: 'archived' }
const COURSE_COLORS = ['#5B5BD6', '#F0365A', '#22A6B8', '#F58A2C', '#2FB463', '#A855F7', '#E5B30B', '#3B82F6', '#B7794A', '#64748B']
const SESSION_COLS = 'id, completed_at, started_at, duration_minutes, course_id, topic_id, kind, rating, note, timer_kind, task_id'
const r1 = (x) => Math.round(x * 10) / 10
const missing = (e) => !!e && (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(e.code || '') || /does not exist|could not find/i.test(e.message || ''))

// ── Focus: laden ─────────────────────────────────────────────────────────────
async function loadFocus(sb, uid) {
  const get = async (t, order) => {
    const { data, error } = await sb.from(t).select('*').eq('user_id', uid)
    if (error) { if (missing(error)) throw new Error('Focus-tabellen ontbreken (migratie add_focus_app.sql)'); throw new Error(error.message) }
    return (data || []).sort(order || ((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))
  }
  const [courses, dates, topics, parts] = await Promise.all([
    get('focus_courses'), get('focus_course_dates', (a, b) => a.date.localeCompare(b.date)), get('focus_topics'), get('focus_grade_parts'),
  ])
  return { courses, dates, topics, parts }
}
async function loadSessions(sb, uid, from, to) {
  const rows = []
  for (let page = 0; page < 10; page++) {
    const { data, error } = await sb.from('pomodoro_sessions').select(SESSION_COLS).eq('user_id', uid).eq('mode', 'work')
      .gte('completed_at', toUTC(from).toISOString()).lt('completed_at', toUTC(addDays(to, 1)).toISOString())
      .order('completed_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows.map(s => ({ ...s, day: localDay(s.completed_at), min: Number(s.duration_minutes) || 0 }))
}
function findCourse(courses, v) {
  if (v === undefined || v === null || v === '') return null
  const s = String(v).toLowerCase().trim()
  const hit = courses.find(c => c.id === v) || courses.find(c => (c.code || '').toLowerCase() === s) || courses.find(c => c.name.toLowerCase() === s)
    || courses.filter(c => c.name.toLowerCase().includes(s)).sort((a, b) => a.name.length - b.name.length)[0]
  if (!hit) throw new Error(`Vak "${v}" niet gevonden. Vakken: ${courses.map(c => c.name).join(', ') || '(geen)'}`)
  return hit
}
function findTopic(topics, course, v) {
  if (v === undefined || v === null || v === '') return null
  const s = String(v).toLowerCase()
  const list = topics.filter(t => !course || t.course_id === course.id)
  const hit = list.find(t => t.id === v) || list.find(t => t.name.toLowerCase() === s) || list.find(t => t.name.toLowerCase().includes(s))
  if (!hit) throw new Error(`Onderwerp "${v}" niet gevonden${course ? ` bij ${course.name}` : ''}`)
  return hit
}
const sumMin = (list) => list.reduce((a, s) => a + s.min, 0)
function streakOf(days, today) {
  const set = new Set(days)
  let n = 0
  for (let d = set.has(today) ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) n++
  const sorted = [...set].sort()
  let best = 0, run = 0, prev = ''
  for (const d of sorted) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d }
  return { current: n, longest: best, at_risk: n > 0 && !set.has(today) }
}
/** Benodigd tentamencijfer (src/focus/lib/grade.ts). */
function neededFinal(parts, target) {
  const finals = parts.filter(p => p.is_final), others = parts.filter(p => !p.is_final)
  const W = (l) => l.reduce((a, p) => a + (Number(p.weight) || 0), 0)
  const totalW = W(parts), finalW = W(finals)
  const graded = others.filter(p => p.grade != null)
  const earned = graded.reduce((a, p) => a + Number(p.grade) * Number(p.weight), 0)
  const gradedW = W(graded), missingW = W(others.filter(p => p.grade == null))
  const current = gradedW > 0 ? earned / gradedW : null
  if (!totalW || !finalW || target == null) return { current: current == null ? null : r1(current) }
  const needed = (Number(target) * totalW - earned - (current != null ? missingW * current : 0)) / finalW
  return { current: current == null ? null : r1(current), needed_on_final: r1(needed), reachable: needed <= 10 }
}
const slimSession = (s, f) => {
  const c = f.courses.find(x => x.id === s.course_id), t = f.topics.find(x => x.id === s.topic_id)
  return { id: s.id, date: s.day, weekday: WEEKDAYS[dow(s.day)], ...(s.started_at ? { start: localHM(s.started_at) } : {}), end: localHM(s.completed_at), minutes: s.min,
    course: c ? c.name : null, ...(t ? { topic: t.name } : {}), ...(s.kind ? { kind: KINDS[s.kind] || s.kind } : {}),
    ...(s.rating ? { rating: s.rating } : {}), ...(s.note ? { note: s.note } : {}), ...(s.timer_kind ? { timer: s.timer_kind } : {}) }
}
function courseView(c, f, sessions, today, full) {
  const mine = sessions.filter(s => s.course_id === c.id)
  const last = mine[0]?.day || null
  const upcoming = f.dates.filter(d => d.course_id === c.id && d.date >= today)
  const finalDate = c.final_date || upcoming.find(d => d.is_final)?.date || null
  const parts = f.parts.filter(p => p.course_id === c.id)
  const topics = f.topics.filter(t => t.course_id === c.id).map(t => {
    const m = sumMin(mine.filter(s => s.topic_id === t.id))
    return { id: t.id, name: t.name, target_hours: hours(t.target_minutes || 0), studied_hours: hours(m), pct: t.target_minutes ? Math.round((m / t.target_minutes) * 100) : null }
  })
  const kinds = {}
  for (const s of mine) if (s.kind) kinds[KINDS[s.kind] || s.kind] = (kinds[KINDS[s.kind] || s.kind] || 0) + s.min
  const rated = mine.filter(s => s.rating)
  return {
    id: c.id, name: c.name, ...(c.code ? { code: c.code } : {}), status: STATUS[c.status] || c.status, color: c.color,
    ...(c.start_date ? { start_date: c.start_date } : {}), ...(finalDate ? { final_date: finalDate, days_to_final: daysBetween(today, finalDate) } : {}),
    ...(c.target_grade != null ? { target_grade: Number(c.target_grade) } : {}),
    total_hours: hours(sumMin(mine)), last_7_days_hours: hours(sumMin(mine.filter(s => s.day > addDays(today, -7)))),
    last_30_days_hours: hours(sumMin(mine.filter(s => s.day > addDays(today, -30)))), sessions: mine.length,
    last_studied: last, ...(last ? { days_since_studied: daysBetween(last, today) } : {}),
    ...(rated.length ? { avg_rating: r1(rated.reduce((a, s) => a + s.rating, 0) / rated.length) } : {}),
    topics, upcoming_dates: upcoming.map(d => ({ id: d.id, title: d.title, date: d.date, in_days: daysBetween(today, d.date), ...(d.is_final ? { final: true } : {}) })),
    ...(parts.length ? { grades: { parts: parts.map(p => ({ id: p.id, name: p.name, weight: Number(p.weight), grade: p.grade == null ? null : Number(p.grade), ...(p.is_final ? { final: true } : {}) })), ...neededFinal(parts, c.target_grade) } } : {}),
    ...(full ? { by_kind_hours: Object.fromEntries(Object.entries(kinds).map(([k, m]) => [k, hours(m)])), recent_sessions: mine.slice(0, 15).map(s => slimSession(s, f)) } : {}),
  }
}

// ── Recap ────────────────────────────────────────────────────────────────────
const RECAP_FIELDS = ['energy', 'focus', 'mood', 'went_well', 'improve', 'highlight', 'note_next']
const slimRecap = (r) => r && ({
  kind: r.kind, day: r.day, ...(r.kind === 'week' ? { week_of: r.day } : { weekday: WEEKDAYS[dow(r.day)] }),
  energy: r.energy, focus: r.focus, mood: r.mood,
  ...(r.went_well ? { went_well: r.went_well } : {}), ...(r.improve ? { improve: r.improve } : {}), ...(r.highlight ? { highlight: r.highlight } : {}),
  ...(r.note_next ? { note_next: r.note_next } : {}),
  goals_for_next: (Array.isArray(r.goals) ? r.goals : []).filter(g => g && String(g.text || '').trim()),
  updated_at: r.updated_at,
})
const dayScore = (r) => { const xs = [r?.energy, r?.focus, r?.mood].filter(x => x != null); return xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null }
async function loadRecaps(sb, uid, from, to, kind) {
  let q = sb.from('recaps').select('*').eq('user_id', uid).gte('day', from).lte('day', to)
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q.order('day', { ascending: false }).limit(1000)
  if (error) { if (missing(error)) throw new Error('Recap-tabel ontbreekt (migratie add_recap.sql)'); throw new Error(error.message) }
  return data || []
}
const SLEEP_RE = /(slapen|slaap|sleep|nachtrust)/i
const WAKE_MIN = 16 * 60

/**
 * Extra voor de dagrecap (zelfde als Recap → Vandaag in de app, src/recap/hooks/useDayDetails.ts):
 * gepland tegenover gedaan, de dag in uren per type, deadlines van de 3 dagen erna, eerstvolgende toets, geld.
 */
async function dayExtras(sb, uid, day) {
  const types = await H.loadTypes(sb, uid)
  const [tasksRes, agenda, logsRes, focus, exps] = await Promise.all([
    sb.from('tasks').select('*').eq('user_id', uid).limit(5000),
    H.loadAgenda(sb, uid, types, day, day).catch(() => []),
    sb.from('task_completions').select('task_id, title, day, recurring, completed_at').eq('user_id', uid).eq('day', day),
    loadFocus(sb, uid).catch(() => ({ courses: [], dates: [], topics: [], parts: [] })),
    sb.from('expenses').select('date, amount, is_income, is_savings_contribution, is_savings_withdrawal, is_loan_repayment, is_planned, paid_from_savings')
      .eq('user_id', uid).gte('date', day.slice(0, 8) + '01').lte('date', day),
  ])
  const tasks = tasksRes.data || [], logs = logsRes.data || []
  const today = todayLocal()
  const lo = +toUTC(day), hi = +toUTC(addDays(day, 1))
  // Gepland maar blijven liggen: eenmalige taken van die dag (meerdaagse op hun laatste dag) + eigen items die voorbij zijn
  const leftOpen = tasks.filter(t => !t.recurrence && !t.completed && t.date && H.taskOnDay(t, day) && H.taskLast(t) <= day)
    .map(t => ({ id: t.id, title: t.title, ...(t.date < day ? { was_overdue: true } : {}) }))
  const own = agenda.filter(x => x.kind === 'eigen' && !x.hidden && !x.all_day && +x.start >= lo && +x.start < hi)
  const routines = tasks.filter(t => H.routineDueOn(t, day, today, logs))
  // Uren per type (deel binnen de dag, overlap per type één keer; slaap apart en telt niet als bezig)
  const byCat = new Map()
  for (const x of agenda) {
    if (x.hidden || x.all_day) continue
    const s = Math.max(+x.start, lo), e = Math.min(+x.end, hi)
    if (e <= s) continue
    const cat = SLEEP_RE.test(x.title || '') ? 'slaap' : x.cat
    byCat.set(cat, [...(byCat.get(cat) || []), [s, e]])
  }
  const merged = (list) => { let tot = 0, cur = null; for (const [s, e] of list.sort((a, b) => a[0] - b[0])) { if (cur && s <= cur[1]) cur[1] = Math.max(cur[1], e); else { if (cur) tot += cur[1] - cur[0]; cur = [s, e] } } return (cur ? tot + cur[1] - cur[0] : tot) / 60000 }
  const hoursPerType = Object.fromEntries([...byCat.entries()].map(([c, l]) => [c === 'slaap' ? 'Slaap' : types.name(c), fmtHours(Math.round(merged(l)))]))
  const busy = Math.round(merged([...byCat.entries()].filter(([c]) => c !== 'slaap').flatMap(([, l]) => l)))
  // Deadlines in de 3 dagen na deze dag
  const until = addDays(day, 3)
  const courseName = (id) => { const c = focus.courses.find(x => x.id === id); return c ? (c.code || c.name) : null }
  const deadlines = [
    ...tasks.filter(t => !t.completed && t.due_date && t.due_date > day && t.due_date <= until).map(t => ({ title: t.title, date: t.due_date, kind: 'taak' })),
    ...focus.dates.filter(d => d.date > day && d.date <= until).map(d => ({ title: d.title, date: d.date, kind: 'toets', course: courseName(d.course_id) })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const nextDate = focus.dates.filter(d => d.date >= day && focus.courses.some(c => c.id === d.course_id && c.status !== 'archived'))[0]
  // Geld: uitgegeven die dag en geen-uitgaven-dagen deze maand (budget zelf: get_overview)
  const spendRows = (exps.data || []).filter(e => !e.is_income && !e.is_savings_contribution && !e.is_savings_withdrawal && !e.is_loan_repayment && !e.is_planned && !e.paid_from_savings)
  const spentOn = (d) => spendRows.filter(e => e.date === d).reduce((a, e) => a + Number(e.amount), 0)
  let noSpend = 0
  for (let d = day; d >= day.slice(0, 8) + '01'; d = addDays(d, -1)) if (spentOn(d) <= 0) noSpend++
  return {
    planned_vs_done: {
      done: logs.slice().sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at))).map(c => ({ title: c.title, ...(c.recurring ? { routine: true } : {}), time: c.completed_at ? localHM(c.completed_at) : null })),
      left_open: leftOpen,
      own_events: own.map(x => ({ id: x.id, title: x.title, type: types.name(x.cat), start: localHM(x.start), end: localHM(x.end), ...(+x.end < Date.now() ? { past: true } : {}) })),
      routines: { done: routines.filter(t => H.routineDoneOn(t, day, logs)).length, total: routines.length, missed: routines.filter(t => !H.routineDoneOn(t, day, logs)).map(t => t.title) },
      tip: leftOpen.length ? 'Open taken doorschuiven: close_day met apply=true (na akkoord) of update_task.' : undefined,
    },
    hours_per_type: { ...hoursPerType, Vrij: fmtHours(Math.max(0, WAKE_MIN - busy)), note: 'Vrij = 16 wakkere uren min wat er met een tijd in de agenda stond (slaap telt niet mee)' },
    deadlines_next_3_days: deadlines,
    ...(nextDate ? { next_exam: { course: courseName(nextDate.course_id), title: nextDate.title, date: nextDate.date, in_days: daysBetween(day, nextDate.date) } } : {}),
    money: { spent: Math.round(spentOn(day) * 100) / 100, no_spend_days_this_month: noSpend, note: 'Dag- en weekbudget: get_overview' },
  }
}

/** Wat je op die dag(en) deed: taken, focus, agenda/werk, uitgaven (zoals useActivity in de app). */
async function activity(sb, uid, from, to) {
  const [comps, sessions, focus, exps, types] = await Promise.all([
    sb.from('task_completions').select('title, day, recurring').eq('user_id', uid).gte('day', from).lte('day', to).limit(3000),
    loadSessions(sb, uid, from, to),
    loadFocus(sb, uid).catch(() => ({ courses: [], topics: [], dates: [], parts: [] })),
    sb.from('expenses').select('date, amount, category, description, is_income, is_savings_contribution, is_savings_withdrawal, is_loan_repayment, is_planned, paid_from_savings')
      .eq('user_id', uid).gte('date', from).lte('date', to).limit(3000),
    H.loadTypes(sb, uid),
  ])
  const agenda = await H.loadAgenda(sb, uid, types, from, to).catch(() => [])
  const work = H.sumHours(H.workShifts(agenda), from, to)
  const spend = (exps.data || []).filter(e => !e.is_income && !e.is_savings_contribution && !e.is_savings_withdrawal && !e.is_loan_repayment && !e.is_planned)
  const courseName = (id) => focus.courses.find(c => c.id === id)?.name || 'Zonder vak'
  const perCourse = {}
  for (const s of sessions) perCourse[courseName(s.course_id)] = (perCourse[courseName(s.course_id)] || 0) + s.min
  const tasks = (comps.data || [])
  return {
    tasks_done: tasks.filter(c => !c.recurring).map(c => (from === to ? c.title : `${c.day}: ${c.title}`)),
    routines_done: tasks.filter(c => c.recurring).map(c => (from === to ? c.title : `${c.day}: ${c.title}`)),
    focus_minutes: sumMin(sessions), focus: fmtHours(sumMin(sessions)),
    focus_per_course: Object.fromEntries(Object.entries(perCourse).map(([k, m]) => [k, fmtHours(m)])),
    focus_sessions: sessions.slice(0, 30).map(s => slimSession(s, focus)),
    agenda: agenda.filter(x => !x.hidden).slice(0, 40).map(x => ({ title: x.title, type: types.name(x.cat), when: x.all_day ? `${localDay(x.start)} hele dag` : `${localDay(x.start)} ${localHM(x.start)}–${localHM(x.end)}` })),
    work_hours: hours(work.total_min),
    spent: Math.round(spend.reduce((a, e) => a + Number(e.amount), 0) * 100) / 100,
    ...(spend.length ? { spent_items: spend.slice(0, 15).map(e => `${e.description || e.category} €${Number(e.amount).toFixed(2)}${e.paid_from_savings ? ' (spaargeld)' : ''}`) } : {}),
  }
}

// ── tools ────────────────────────────────────────────────────────────────────
const S = (props, required) => ({ type: 'object', properties: props, ...(required ? { required } : {}) })
const str = (description, extra = {}) => ({ type: 'string', description, ...extra })
const num = (description) => ({ type: 'number', description })
const bool = (description) => ({ type: 'boolean', description })
const RO = { readOnlyHint: true }
const DEL = { destructiveHint: true }
const score = (l) => ({ type: 'integer', minimum: 1, maximum: 5, description: `${l} 1–5` })

const TOOLS = [
  // Focus — lezen
  { name: 'get_focus_overview', description: 'Studie-overzicht uit de Focus-tab: vandaag, deze week vs. vorige week, streak, uren per vak en per soort (Lezen/Opdracht/Oefenen/Herhalen), wanneer je studeert (uur/dag), gemiddelde productiviteit (★), vakken die je verwaarloost en komende toetsen. Standaard de laatste 30 dagen.',
    inputSchema: S({ from: str('YYYY-MM-DD (standaard 30 dagen terug)'), to: str('YYYY-MM-DD (standaard vandaag)') }), annotations: RO },
  { name: 'list_focus_courses', description: 'Vakken met status, eindtoets/datums (dagen tot), doelcijfer, gestudeerde uren (totaal, 7 en 30 dagen), laatst gestudeerd, onderwerpen met doeluren en voortgang, cijferonderdelen + benodigd tentamencijfer. Met course = één vak in detail (ook uren per soort en recente sessies).',
    inputSchema: S({ status: str('active (standaard), paused, completed, archived of all'), course: str('Naam, code of id voor detail van één vak') }), annotations: RO },
  { name: 'list_focus_sessions', description: 'Studiesessies (datum, tijd, minuten, vak, onderwerp, soort, ★, notitie). Nieuwste eerst.',
    inputSchema: S({ from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD (standaard vandaag)'), course: str('Vak (naam/code/id)'), limit: num('Max. aantal (standaard 100)') }, ['from']), annotations: RO },
  // Focus — bewerken
  { name: 'log_focus_session', description: 'Studiesessie handmatig loggen (telt mee in Focus, streak en statistieken). Vraag eerst bevestiging.',
    inputSchema: S({ date: str('YYYY-MM-DD (standaard vandaag)'), start: str('Begintijd HH:MM (optioneel)'), minutes: num('Duur in minuten'),
      course: str('Vak'), topic: str('Onderwerp van dat vak'), kind: str('Lezen, Opdracht, Oefenen of Herhalen'), rating: num('Productiviteit 1–5'), note: str('Notitie') }, ['minutes']) },
  { name: 'update_focus_session', description: 'Studiesessie aanpassen (alleen meegegeven velden; null wist vak/onderwerp/soort/★/notitie). Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Sessie-id'), minutes: num('Duur'), course: { type: ['string', 'null'] }, topic: { type: ['string', 'null'] }, kind: { type: ['string', 'null'] },
      rating: { type: ['number', 'null'] }, note: { type: ['string', 'null'] } }, ['id']) },
  { name: 'save_focus_course', description: 'Vak aanmaken (zonder id) of aanpassen: naam, code, kleur, status (Actief/Gepauzeerd/Afgerond/Archief), startdatum, datum eindtoets, doelcijfer. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Vak (naam/code/id) om aan te passen; leeg = nieuw'), name: str('Naam'), code: str('Vakcode, bv. uit de OER'), color: str('Hex-kleur'),
      status: str('active/paused/completed/archived'), start_date: str('YYYY-MM-DD'), final_date: str('Datum eindtoets YYYY-MM-DD'), target_grade: num('Doelcijfer (1–10)') }) },
  { name: 'save_course_date', description: 'Belangrijke datum (toets, deadline, presentatie) toevoegen of aanpassen, met herinneringen (push). Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Id om aan te passen; leeg = nieuw'), course: str('Vak'), title: str('Titel, bv. "Tentamen" of "Inleveren portfolio"'), date: str('YYYY-MM-DD'),
      is_final: bool('Eindtoets'), reminders: { type: 'array', items: { type: 'string' }, description: 'Bv. ["1w","1d"] (w = week, d = dag, h = uur vóór reminder_time)' }, reminder_time: str('HH:MM (standaard 09:00)') }) },
  { name: 'save_topic', description: 'Onderwerp van een vak toevoegen of aanpassen, met doeluren (voortgangsring). Handig om leerdoelen uit de OER als onderwerpen te zetten. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Id om aan te passen; leeg = nieuw'), course: str('Vak'), name: str('Naam'), target_hours: num('Doel in uren') }) },
  { name: 'save_grade_part', description: 'Cijferonderdeel (toets/opdracht met weging en cijfer) toevoegen of aanpassen; is_final = tentamen waarvoor het benodigde cijfer wordt berekend. Vraag eerst bevestiging.',
    inputSchema: S({ id: str('Id om aan te passen; leeg = nieuw'), course: str('Vak'), name: str('Naam'), weight: num('Weging (bv. 30 voor 30%)'),
      grade: { type: ['number', 'null'], description: 'Cijfer (null = nog niet)' }, is_final: bool('Tentamen') }) },
  { name: 'delete_focus_item', description: 'Iets uit Focus verwijderen: een sessie, datum, onderwerp, cijferonderdeel of een heel vak (met al zijn datums/onderwerpen/cijfers; sessies blijven zonder vak). Vraag eerst bevestiging.',
    inputSchema: S({ type: str('session, date, topic, grade_part of course', { enum: ['session', 'date', 'topic', 'grade_part', 'course'] }), id: str('Id (bij course mag ook naam/code)') }, ['type', 'id']), annotations: DEL },
  // Recap
  { name: 'get_recap', description: 'Dag- of weekrecap met alles wat je nodig hebt om er een te schrijven: de recap zelf (als die er is), de doelen die je jezelf voor deze dag/week had gegeven (+ afgevinkt), je bericht van gisteren/vorige week, en wat je echt deed: afgeronde taken en routines, studietijd per vak + sessies, agenda en werkuren, uitgaven. Dag: ook planned_vs_done (afgerond met tijd, blijven liggen, eigen agenda-items, routines), hours_per_type, deadlines_next_3_days, next_exam en money (uitgegeven, geen-uitgaven-dagen). Week: ook scores, taken en focus per dag en gemiddelden.',
    inputSchema: S({ kind: str('day (standaard) of week', { enum: ['day', 'week'] }), date: str('YYYY-MM-DD (standaard vandaag; bij week: een dag in die week)') }), annotations: RO },
  { name: 'list_recaps', description: 'Eerdere recaps (scores, teksten, doelen) met streak en gemiddelde scores. Handig voor patronen ("wanneer heb ik weinig energie?").',
    inputSchema: S({ from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD (standaard vandaag)'), kind: str('day, week of alle', { enum: ['day', 'week', 'alle'] }) }, ['from']), annotations: RO },
  { name: 'save_recap', description: 'Dag- of weekrecap opslaan of aanvullen (alleen meegegeven velden; bestaande blijven). Dag: went_well = wat ging goed, improve = wat kan beter, highlight = hoogtepunt, goals = top 3 doelen voor MORGEN. Week: went_well = grootste winst, improve = lessen, highlight = verder nog, goals = doelen voor VOLGENDE week. note_next = bericht aan jezelf voor morgen/volgende week. Laat scores bij de gebruiker; vraag eerst bevestiging van de tekst.',
    inputSchema: S({ kind: str('day (standaard) of week', { enum: ['day', 'week'] }), date: str('YYYY-MM-DD (standaard vandaag; week: een dag in die week)'),
      energy: score('Energie'), focus: score('Focus'), mood: score('Stemming'),
      went_well: str('Wat ging goed / grootste winst'), improve: str('Wat kan beter / lessen'), highlight: str('Hoogtepunt / verder nog'), note_next: str('Bericht voor morgen / volgende week'),
      goals: { type: 'array', items: { type: ['string', 'object'] }, description: 'Doelen voor de volgende dag/week: ["…", "…"] of [{ text, done, task_id }] (vervangt de lijst). Met task_id (uit list_tasks) vinkt het doel vanzelf af als die taak klaar is.' },
      tick_goals: { type: 'array', items: { type: 'integer' }, description: 'Afvinken van de doelen die je jezelf VOOR deze dag/week gaf (indexen 0,1,2 uit get_recap → goals_for_this)' } }) },
]
const NAMES = new Set(TOOLS.map(t => t.name))
const INSTRUCTIONS = 'Studie (Hypex Dash): Focus-tab (vakken, toetsdatums, onderwerpen, cijfers, studiesessies) en Recap (dag- en weekevaluaties). ' +
  'Gebruik get_focus_overview en list_focus_courses om te zien hoeveel en waaraan gestudeerd is, get_recap om een recap voor te bereiden (echte gegevens van die dag) en save_recap om hem op te slaan. ' +
  'Vakken mag je aanwijzen met naam, code of id. Vraag bevestiging voordat je iets opslaat of verwijdert.'

async function callTool(sb, uid, name, args = {}) {
  const today = todayLocal()

  if (name === 'get_focus_overview') {
    const to = optDate(args.to, 'to') || today, from = optDate(args.from, 'from') || addDays(to, -29)
    const f = await loadFocus(sb, uid)
    const histFrom = addDays(today, -400) < from ? addDays(today, -400) : from
    const all = await loadSessions(sb, uid, histFrom, today > to ? today : to)
    const inRange = all.filter(s => s.day >= from && s.day <= to)
    const wk = mondayOf(today)
    const week = sumMin(all.filter(s => s.day >= wk && s.day <= today))
    const prevWeek = sumMin(all.filter(s => s.day >= addDays(wk, -7) && s.day <= addDays(today, -7)))
    const byCourse = {}, byKind = {}, byWeekday = Array(7).fill(0), byHour = Array(24).fill(0)
    for (const s of inRange) {
      const c = f.courses.find(x => x.id === s.course_id)?.name || 'Zonder vak'
      byCourse[c] = (byCourse[c] || 0) + s.min
      const k = KINDS[s.kind] || 'Geen soort'; byKind[k] = (byKind[k] || 0) + s.min
      byWeekday[dow(s.day)] += s.min
      // minuten verdelen over de uren van de sessie (begin = started_at of einde − duur)
      const end = +new Date(s.completed_at), start = s.started_at ? +new Date(s.started_at) : end - s.min * 60000
      for (let t = start; t < end; t += 60000) byHour[Number(localHM(t).slice(0, 2))]++
    }
    let peak = 0, peakStart = 0
    for (let h = 0; h < 24; h++) { const v = byHour[h] + byHour[(h + 1) % 24]; if (v > peak) { peak = v; peakStart = h } }
    const rated = inRange.filter(s => s.rating)
    const stats = streakOf(all.map(s => s.day), today)
    const active = f.courses.filter(c => c.status === 'active')
    const neglected = active.map(c => {
      const last = all.find(s => s.course_id === c.id)?.day || null
      return { course: c.name, last_studied: last, days_since: last ? daysBetween(last, today) : null }
    }).filter(x => x.days_since == null || x.days_since >= 7).sort((a, b) => (b.days_since ?? 999) - (a.days_since ?? 999))
    const nDays = daysBetween(from, to) + 1
    return {
      from, to, today: fmtHours(sumMin(all.filter(s => s.day === today))), today_minutes: sumMin(all.filter(s => s.day === today)),
      this_week_hours: hours(week), prev_week_same_point_hours: hours(prevWeek), week_delta_pct: prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : null,
      streak_days: stats.current, longest_streak: stats.longest, ...(stats.at_risk ? { streak_at_risk: true } : {}),
      period: { hours: hours(sumMin(inRange)), sessions: inRange.length, avg_per_day_min: Math.round(sumMin(inRange) / nDays), study_days: new Set(inRange.map(s => s.day)).size,
        avg_session_min: inRange.length ? Math.round(sumMin(inRange) / inRange.length) : 0, ...(rated.length ? { avg_rating: r1(rated.reduce((a, s) => a + s.rating, 0) / rated.length) } : {}) },
      by_course_hours: Object.fromEntries(Object.entries(byCourse).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, hours(m)])),
      by_kind_hours: Object.fromEntries(Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, hours(m)])),
      by_weekday_hours: Object.fromEntries([1, 2, 3, 4, 5, 6, 0].map(d => [WEEKDAYS[d], hours(byWeekday[d])])),
      ...(peak ? { peak_window: `${String(peakStart).padStart(2, '0')}:00–${String((peakStart + 2) % 24).padStart(2, '0')}:00` } : {}),
      active_courses: active.length, neglected_courses: neglected,
      upcoming_dates: f.dates.filter(d => d.date >= today && d.date <= addDays(today, 60)).map(d => ({ course: f.courses.find(c => c.id === d.course_id)?.name, title: d.title, date: d.date, in_days: daysBetween(today, d.date), ...(d.is_final ? { final: true } : {}) })),
      recent_sessions: all.slice(0, 8).map(s => slimSession(s, f)),
    }
  }

  if (name === 'list_focus_courses') {
    const f = await loadFocus(sb, uid)
    const sessions = await loadSessions(sb, uid, addDays(today, -400), today)
    if (args.course) return courseView(findCourse(f.courses, args.course), f, sessions, today, true)
    const st = STATUS_IN[String(args.status || 'active').toLowerCase()] || (String(args.status).toLowerCase() === 'all' ? 'all' : 'active')
    const list = f.courses.filter(c => st === 'all' || c.status === st)
    return { count: list.length, courses: list.map(c => courseView(c, f, sessions, today, false)) }
  }

  if (name === 'list_focus_sessions') {
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to') || today
    need(from, 'from ontbreekt')
    const f = await loadFocus(sb, uid)
    let list = await loadSessions(sb, uid, from, to)
    if (args.course) { const c = findCourse(f.courses, args.course); list = list.filter(s => s.course_id === c.id) }
    const limit = Math.min(500, Math.max(1, Number(args.limit) || 100))
    return { from, to, count: list.length, hours: hours(sumMin(list)), items: list.slice(0, limit).map(s => slimSession(s, f)) }
  }

  if (name === 'log_focus_session' || name === 'update_focus_session') {
    const f = await loadFocus(sb, uid)
    const row = {}
    let cur = null
    if (name === 'update_focus_session') {
      need(args.id, 'id ontbreekt')
      const { data } = await sb.from('pomodoro_sessions').select(SESSION_COLS).eq('id', args.id).eq('user_id', uid).maybeSingle()
      need(data, 'Sessie niet gevonden')
      cur = data
    }
    if (args.minutes !== undefined) { need(Number(args.minutes) > 0 && Number(args.minutes) <= 720, 'minutes moet 1–720 zijn'); row.duration_minutes = Math.round(Number(args.minutes)) }
    const course = args.course === null ? null : args.course !== undefined ? findCourse(f.courses, args.course) : undefined
    if (course !== undefined) { row.course_id = course?.id || null; if (!course) row.topic_id = null }
    const courseForTopic = course || (cur?.course_id ? f.courses.find(c => c.id === cur.course_id) : null)
    if (args.topic !== undefined) row.topic_id = args.topic === null ? null : findTopic(f.topics, courseForTopic, args.topic).id
    if (args.kind !== undefined) { if (args.kind === null) row.kind = null; else { row.kind = KIND_IN[String(args.kind).toLowerCase()]; need(row.kind, 'kind: Lezen, Opdracht, Oefenen of Herhalen') } }
    if (args.rating !== undefined) { need(args.rating === null || [1, 2, 3, 4, 5].includes(Number(args.rating)), 'rating 1–5'); row.rating = args.rating === null ? null : Number(args.rating) }
    if (args.note !== undefined) row.note = args.note === null ? null : String(args.note).slice(0, 1000)
    if (cur) {
      need(Object.keys(row).length, 'Geen velden om aan te passen')
      if (row.duration_minutes && cur.started_at) row.completed_at = new Date(+new Date(cur.started_at) + row.duration_minutes * 60000).toISOString()
      const { data, error } = await sb.from('pomodoro_sessions').update(row).eq('id', cur.id).eq('user_id', uid).select(SESSION_COLS).single()
      if (error) throw new Error(error.message)
      const v = (s) => slimSession({ ...s, day: localDay(s.completed_at), min: Number(s.duration_minutes) || 0 }, f)
      return { updated: v(data), before: v(cur) }
    }
    need(row.duration_minutes, 'minutes ontbreekt')
    const date = optDate(args.date, 'date') || today
    need(date <= today, 'Een sessie kan niet in de toekomst liggen')
    if (args.start !== undefined) need(isHM(args.start), 'start moet HH:MM zijn')
    const start = args.start ? toUTC(date, args.start) : null
    const end = start ? new Date(+start + row.duration_minutes * 60000) : (date === today ? new Date() : toUTC(date, '20:00'))
    need(+end <= Date.now() + 60000, 'Deze sessie eindigt in de toekomst')
    const insert = { ...row, user_id: uid, mode: 'work', timer_kind: 'manual', completed_at: end.toISOString(), started_at: (start || new Date(+end - row.duration_minutes * 60000)).toISOString() }
    const { data, error } = await sb.from('pomodoro_sessions').insert(insert).select(SESSION_COLS).single()
    if (error) throw new Error(missing(error) ? 'Focus-kolommen ontbreken (migratie add_focus_app.sql)' : error.message)
    return { logged: slimSession({ ...data, day: localDay(data.completed_at), min: Number(data.duration_minutes) || 0 }, f) }
  }

  if (name === 'save_focus_course') {
    const f = await loadFocus(sb, uid)
    const cur = args.id ? findCourse(f.courses, args.id) : null
    const row = {}
    if (args.name !== undefined) { row.name = String(args.name).trim().slice(0, 80); need(row.name, 'name is leeg') }
    if (args.code !== undefined) row.code = args.code ? String(args.code).trim().slice(0, 30) : null
    if (args.color !== undefined) { need(/^#[0-9a-f]{6}$/i.test(args.color), 'color moet een hex-kleur zijn'); row.color = args.color }
    if (args.status !== undefined) { row.status = STATUS_IN[String(args.status).toLowerCase()]; need(row.status, 'status: active, paused, completed of archived') }
    for (const k of ['start_date', 'final_date']) if (args[k] !== undefined) row[k] = optDate(args[k], k) || null
    if (args.target_grade !== undefined) { need(args.target_grade === null || (args.target_grade >= 1 && args.target_grade <= 10), 'target_grade 1–10'); row.target_grade = args.target_grade }
    if (cur) {
      need(Object.keys(row).length, 'Geen velden om aan te passen')
      const { data, error } = await sb.from('focus_courses').update(row).eq('id', cur.id).eq('user_id', uid).select().single()
      if (error) throw new Error(error.message)
      return { updated: { id: data.id, name: data.name, code: data.code, status: STATUS[data.status], final_date: data.final_date, target_grade: data.target_grade } }
    }
    need(row.name, 'name ontbreekt voor een nieuw vak')
    need(!f.courses.some(c => c.name.toLowerCase() === row.name.toLowerCase()), `Vak "${row.name}" bestaat al (geef id mee om aan te passen)`)
    const { data, error } = await sb.from('focus_courses').insert({ status: 'active', color: COURSE_COLORS[f.courses.length % COURSE_COLORS.length], sort_order: f.courses.length, ...row, user_id: uid }).select().single()
    if (error) throw new Error(error.message)
    return { created: { id: data.id, name: data.name, code: data.code, status: STATUS[data.status], color: data.color } }
  }

  if (name === 'save_course_date' || name === 'save_topic' || name === 'save_grade_part') {
    const f = await loadFocus(sb, uid)
    const table = { save_course_date: 'focus_course_dates', save_topic: 'focus_topics', save_grade_part: 'focus_grade_parts' }[name]
    const pool = { save_course_date: f.dates, save_topic: f.topics, save_grade_part: f.parts }[name]
    const cur = args.id ? pool.find(x => x.id === args.id) : null
    if (args.id) need(cur, 'Id niet gevonden')
    const course = args.course !== undefined ? findCourse(f.courses, args.course) : cur ? f.courses.find(c => c.id === cur.course_id) : null
    need(course, 'course ontbreekt')
    const row = { course_id: course.id }
    if (name === 'save_course_date') {
      if (args.title !== undefined) row.title = String(args.title).trim().slice(0, 80)
      if (args.date !== undefined) row.date = optDate(args.date, 'date')
      if (args.is_final !== undefined) row.is_final = !!args.is_final
      if (args.reminders !== undefined) { need(Array.isArray(args.reminders) && args.reminders.every(r => /^\d{1,2}[hdw]$/.test(r)), 'reminders zoals ["1w","1d","2h"]'); row.reminder_offsets = args.reminders }
      if (args.reminder_time !== undefined) { need(isHM(args.reminder_time), 'reminder_time HH:MM'); row.reminder_time = args.reminder_time }
      if (!cur) { need(row.title && row.date, 'title en date zijn verplicht'); row.reminder_offsets = row.reminder_offsets || ['1w', '1d'] }
      if (row.date || row.reminder_offsets || row.reminder_time) row.sent_offsets = []
    }
    if (name === 'save_topic') {
      if (args.name !== undefined) row.name = String(args.name).trim().slice(0, 80)
      if (args.target_hours !== undefined) { need(Number(args.target_hours) > 0, 'target_hours > 0'); row.target_minutes = Math.round(Number(args.target_hours) * 60) }
      if (!cur) { need(row.name, 'name is verplicht'); row.sort_order = f.topics.filter(t => t.course_id === course.id).length }
    }
    if (name === 'save_grade_part') {
      if (args.name !== undefined) row.name = String(args.name).trim().slice(0, 80)
      if (args.weight !== undefined) { need(Number(args.weight) > 0, 'weight > 0'); row.weight = Number(args.weight) }
      if (args.grade !== undefined) { need(args.grade === null || (args.grade >= 1 && args.grade <= 10), 'grade 1–10 of null'); row.grade = args.grade }
      if (args.is_final !== undefined) row.is_final = !!args.is_final
      if (!cur) { need(row.name, 'name is verplicht'); row.sort_order = f.parts.filter(p => p.course_id === course.id).length }
    }
    const q = cur ? sb.from(table).update(row).eq('id', cur.id).eq('user_id', uid) : sb.from(table).insert({ ...row, user_id: uid })
    const { data, error } = await q.select().single()
    if (error) throw new Error(error.message)
    const fresh = await loadFocus(sb, uid)
    const sessions = await loadSessions(sb, uid, addDays(today, -400), today)
    const view = courseView(fresh.courses.find(c => c.id === course.id), fresh, sessions, today, false)
    return { [cur ? 'updated' : 'created']: { id: data.id, ...row, course_id: undefined, course: course.name }, course: { name: view.name, topics: view.topics, upcoming_dates: view.upcoming_dates, ...(view.grades ? { grades: view.grades } : {}) } }
  }

  if (name === 'delete_focus_item') {
    const table = { session: 'pomodoro_sessions', date: 'focus_course_dates', topic: 'focus_topics', grade_part: 'focus_grade_parts', course: 'focus_courses' }[args.type]
    need(table, 'type: session, date, topic, grade_part of course')
    let id = args.id
    if (args.type === 'course') id = findCourse((await loadFocus(sb, uid)).courses, args.id).id
    const { data, error } = await sb.from(table).delete().eq('id', id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    need(data, 'Niet gevonden')
    return { deleted: { type: args.type, id, ...(data.name || data.title ? { name: data.name || data.title } : {}), ...(data.duration_minutes ? { minutes: data.duration_minutes, date: localDay(data.completed_at) } : {}) } }
  }

  if (name === 'get_recap') {
    const kind = args.kind === 'week' ? 'week' : 'day'
    const date = optDate(args.date, 'date') || today
    if (kind === 'day') {
      const prev = addDays(date, -1)
      const [recs, act, extra] = await Promise.all([loadRecaps(sb, uid, prev, date, 'day'), activity(sb, uid, date, date), dayExtras(sb, uid, date)])
      const mine = recs.find(r => r.day === date), y = recs.find(r => r.day === prev)
      const lastWeek = await loadRecaps(sb, uid, addDays(mondayOf(date), -7), addDays(mondayOf(date), -7), 'week')
      return {
        kind, date, weekday: WEEKDAYS[dow(date)], ...(dow(date) === 0 ? { tip: 'Zondag: ook een weekrecap invullen (kind=week).' } : {}),
        recap: slimRecap(mine) || null,
        goals_for_this: (Array.isArray(y?.goals) ? y.goals : []).filter(g => String(g?.text || '').trim()).map((g, i) => ({ index: i, text: g.text, done: !!g.done, ...(g.task_id ? { task_id: g.task_id } : {}) })),
        message_from_yesterday: y?.note_next || null,
        ...extra,
        week_goals: (Array.isArray(lastWeek[0]?.goals) ? lastWeek[0].goals : []).filter(g => String(g?.text || '').trim()),
        did: act,
      }
    }
    const mon = mondayOf(date), sun = addDays(mon, 6)
    const prevMon = addDays(mon, -7)
    const [days, weeks, act, prevAct] = await Promise.all([
      loadRecaps(sb, uid, addDays(mon, -1), sun, 'day'), loadRecaps(sb, uid, prevMon, mon, 'week'),
      activity(sb, uid, mon, sun < today ? sun : today), activity(sb, uid, prevMon, addDays(mon, -1)),
    ])
    const [weekLogs, weekSessions] = await Promise.all([
      sb.from('task_completions').select('day').eq('user_id', uid).gte('day', mon).lte('day', sun).limit(3000),
      loadSessions(sb, uid, mon, sun),
    ])
    const inWeek = days.filter(r => r.day >= mon)
    const avg = (k) => { const xs = inWeek.map(r => r[k]).filter(x => x != null); return xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null }
    let goalsDone = 0, goalsTotal = 0
    for (const d of dayList(mon, sun)) {
      const g = (days.find(r => r.day === addDays(d, -1))?.goals || []).filter(x => String(x?.text || '').trim())
      goalsDone += g.filter(x => x.done).length; goalsTotal += g.length
    }
    const mine = weeks.find(r => r.day === mon), last = weeks.find(r => r.day === prevMon)
    return {
      kind, week_of: mon, to: sun, recap: slimRecap(mine) || null,
      goals_for_this: (Array.isArray(last?.goals) ? last.goals : []).filter(g => String(g?.text || '').trim()).map((g, i) => ({ index: i, text: g.text, done: !!g.done })),
      message_from_last_week: last?.note_next || null,
      // Per dag ook zonder recap: taken gedaan (logboek) en focustijd
      days: dayList(mon, sun).map(d => { const r = inWeek.find(x => x.day === d); return { date: d, weekday: WEEKDAYS[dow(d)], score: dayScore(r), ...(r?.highlight ? { highlight: r.highlight } : {}), filled: !!r,
        ...(d <= today ? { tasks_done: (weekLogs.data || []).filter(c => c.day === d).length, focus_min: weekSessions.filter(x => x.day === d).reduce((a, x) => a + x.min, 0) } : {}) } }),
      averages: { energy: avg('energy'), focus: avg('focus'), mood: avg('mood'), recaps_filled: inWeek.length },
      daily_goals: { done: goalsDone, total: goalsTotal },
      did: { ...act, focus_sessions: undefined, agenda: undefined },
      vs_prev_week: { focus_hours: [hours(act.focus_minutes), hours(prevAct.focus_minutes)], tasks_done: [act.tasks_done.length, prevAct.tasks_done.length], work_hours: [act.work_hours, prevAct.work_hours], spent: [act.spent, prevAct.spent] },
    }
  }

  if (name === 'list_recaps') {
    const from = optDate(args.from, 'from'), to = optDate(args.to, 'to') || today
    need(from, 'from ontbreekt')
    const kind = args.kind === 'week' || args.kind === 'day' ? args.kind : null
    const list = await loadRecaps(sb, uid, from, to, kind)
    const all = await loadRecaps(sb, uid, addDays(today, -730), today, 'day')
    const st = streakOf(all.map(r => r.day), today)
    const days = list.filter(r => r.kind === 'day')
    const avg = (k) => { const xs = days.map(r => r[k]).filter(x => x != null); return xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null }
    return { from, to, count: list.length, streak_days: st.current, best_streak: st.longest,
      averages: { energy: avg('energy'), focus: avg('focus'), mood: avg('mood') }, items: list.map(slimRecap) }
  }

  if (name === 'save_recap') {
    const kind = args.kind === 'week' ? 'week' : 'day'
    let day = optDate(args.date, 'date') || today
    if (kind === 'week') day = mondayOf(day)
    need(day <= today, 'Een recap kan niet voor de toekomst')
    const { data: cur, error: ce } = await sb.from('recaps').select('*').eq('user_id', uid).eq('kind', kind).eq('day', day).maybeSingle()
    if (ce) throw new Error(missing(ce) ? 'Recap-tabel ontbreekt (migratie add_recap.sql)' : ce.message)
    const row = {}
    for (const k of RECAP_FIELDS) {
      if (args[k] === undefined) continue
      if (['energy', 'focus', 'mood'].includes(k)) { need(args[k] === null || [1, 2, 3, 4, 5].includes(Number(args[k])), `${k} moet 1–5 zijn`); row[k] = args[k] === null ? null : Number(args[k]) }
      else row[k] = args[k] === null ? null : String(args[k]).slice(0, 4000)
    }
    if (args.goals !== undefined) {
      need(Array.isArray(args.goals), 'goals moet een lijst zijn')
      row.goals = args.goals.map(g => (typeof g === 'string' ? { text: g, done: false } : { text: String(g?.text || ''), done: !!g?.done, ...(g?.task_id ? { task_id: String(g.task_id) } : {}) })).filter(g => g.text.trim()).slice(0, 10)
    }
    let ticked = null
    if (args.tick_goals !== undefined) {
      // Doelen voor deze dag/week staan op de recap van de dag/week ervóór
      const prevDay = kind === 'week' ? addDays(day, -7) : addDays(day, -1)
      const { data: prev } = await sb.from('recaps').select('*').eq('user_id', uid).eq('kind', kind).eq('day', prevDay).maybeSingle()
      need(prev && Array.isArray(prev.goals) && prev.goals.length, 'Er staan geen doelen voor deze dag/week')
      const goals = prev.goals.map((g, i) => ({ ...g, done: args.tick_goals.includes(i) ? true : !!g.done }))
      const { error } = await sb.from('recaps').update({ goals, updated_at: new Date().toISOString() }).eq('id', prev.id)
      if (error) throw new Error(error.message)
      ticked = goals
    }
    if (!Object.keys(row).length) { need(ticked, 'Geen velden om op te slaan'); return { goals_for_this: ticked } }
    row.updated_at = new Date().toISOString()
    let res = cur
      ? await sb.from('recaps').update(row).eq('id', cur.id).select().single()
      : await sb.from('recaps').insert({ user_id: uid, kind, day, goals: [], ...row }).select().single()
    if (res.error && /note_next/.test(res.error.message) && 'note_next' in row) {
      delete row.note_next
      res = cur ? await sb.from('recaps').update(row).eq('id', cur.id).select().single() : await sb.from('recaps').insert({ user_id: uid, kind, day, goals: [], ...row }).select().single()
      if (!res.error) return { saved: slimRecap(res.data), warning: 'Bericht voor morgen niet opgeslagen: migratie add_recap_note.sql ontbreekt' }
    }
    if (res.error) throw new Error(res.error.message)
    return { [cur ? 'updated' : 'created']: slimRecap(res.data), ...(cur ? { changed: Object.keys(row).filter(k => k !== 'updated_at') } : {}), ...(ticked ? { goals_for_this: ticked } : {}) }
  }

  throw new Error(`Onbekende tool: ${name}`)
}

module.exports = { TOOLS, NAMES, INSTRUCTIONS, callTool }
