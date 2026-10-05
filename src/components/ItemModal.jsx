import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Trash2, Save, Repeat, Clock, Copy, CalendarDays, CheckSquare } from 'lucide-react'
import { RECURRENCE, recurrenceLabel, snapToPattern, toISO } from '../utils/recurrence'
import { DAYPARTS } from '../utils/daypart'
import { taskCategory, eventCategory, typeIdOf, categoryHex, categoryColor, CATEGORIES, CATEGORY_ORDER } from '../utils/category'
import { parseQuickAdd, removeToken } from '../utils/quickAdd'
import { saveTask, deleteTask, saveEvent, deleteEvent } from '../utils/itemSave'
import { getFreeSlots, suggestFreeSlots, getConflicts, formatDutchDate, timeStrToMins, minsToTimeStr } from './tasks/slotPlanning'
import { TypeSelect } from './ui'
import { useIsDesktop } from '../hooks/useIsDesktop'
import TravelTimeField from './agenda/TravelTimeField'

// Eén modal voor taken én eigen agenda-items (Event | Taak). Gedeelde velden: titel (met quick-add),
// type, datum t/m datum, hele dag of tijdslot. Taak voegt dagdeel, prioriteit, herhaling, deadline,
// vak en groep toe; Event voegt beschrijving, reistijd en event-herhaling toe. Het type bepaalt de kleur.
// `chooseKind`: eerst Event of Taak kiezen (rest vervaagd). `preview` op desktop: paneel rechts (split-screen).

const DURATION_CHIPS = [30, 60, 90, 120]
// Tijdvak per dagdeel voor events (quick-add "vanavond etentje" → 19:00–22:00)
const DAYPART_WINDOW = { ochtend: ['09:00', '12:00'], middag: ['13:00', '17:00'], avond: ['19:00', '22:00'] }
const TASK_RECURRENCE = [
  { value: RECURRENCE.NONE,     label: 'Eenmalig' },
  { value: RECURRENCE.DAILY,    label: 'Elke dag' },
  { value: RECURRENCE.WEEKDAYS, label: 'Ma–Vr' },
  { value: RECURRENCE.WEEKLY,   label: 'Weekdagen' },
  { value: RECURRENCE.MONTHLY,  label: 'Maandelijks' },
]
const EVENT_RECURRENCE = [
  { value: '', label: 'Geen herhaling' }, { value: 'daily', label: 'Dagelijks' },
  { value: 'weekdays', label: 'Elke werkdag (ma–vr)' }, { value: 'weekly', label: 'Wekelijks' },
  { value: 'biweekly', label: 'Om de week' }, { value: 'monthly', label: 'Maandelijks' }, { value: 'yearly', label: 'Jaarlijks' },
]
// Taak: ISO-weekdagen 1–7. Event: JS-weekdagen 0–6 (bestaande data in calendar_events).
const WEEKDAY_PILLS = [
  { iso: 1, js: 1, label: 'Ma' }, { iso: 2, js: 2, label: 'Di' }, { iso: 3, js: 3, label: 'Wo' },
  { iso: 4, js: 4, label: 'Do' }, { iso: 5, js: 5, label: 'Vr' }, { iso: 6, js: 6, label: 'Za' }, { iso: 7, js: 0, label: 'Zo' },
]
const PRIORITY_CFG = {
  1: { label: 'Urgent',  color: 'var(--c-danger)', tint: 'color-mix(in srgb, var(--c-danger) 12%, transparent)', border: 'color-mix(in srgb, var(--c-danger) 35%, transparent)' },
  2: { label: 'Normaal', color: 'var(--c-text-2)', tint: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.18)' },
  3: { label: 'Later',   color: 'var(--c-text-3)', tint: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)' },
}

const pad = n => String(n).padStart(2, '0')
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d) }
const isoDow = iso => { const x = new Date(iso + 'T00:00:00').getDay(); return x === 0 ? 7 : x }
const fmtDur = m => m < 60 ? `${m}m` : `${Math.floor(m / 60)}u${m % 60 ? pad(m % 60) : ''}`

function blankForm(defaults = {}) {
  const today = toISO(new Date())
  const start = defaults.startTime || '09:00'
  return {
    title: '', description: '', cat: defaults.cat || 'persoonlijk', catTouched: false,
    date: defaults.date || today, endDate: defaults.endDate || '', noDate: false,
    allDay: defaults.allDay ?? !defaults.startTime,
    startTime: start, endTime: defaults.endTime || minsToTimeStr(timeStrToMins(start) + 60),
    // taak
    subjectId: '', priority: 2, dueDate: '', groupName: '', recurrence: RECURRENCE.NONE, recurrenceDays: [], daypart: defaults.daypart || null, completed: false,
    // event
    evRecurrence: '', evRecurrenceDays: [], travelBefore: 0, travelAfter: 0,
  }
}

function formFromTask(t) {
  const f = blankForm()
  const timed = !!(t.start_time || t.time)
  return {
    ...f, title: t.title || '', description: t.description || '', cat: taskCategory(t),
    date: t.date || f.date, endDate: t.end_date && t.end_date > t.date ? t.end_date : '', noDate: !t.date,
    allDay: !timed, startTime: t.start_time || t.time || '09:00', endTime: t.end_time || minsToTimeStr(timeStrToMins(t.start_time || t.time || '09:00') + (t.duration_minutes || 60)),
    subjectId: t.subject_id || '', priority: t.priority ?? 2, dueDate: t.due_date || '', groupName: t.group_name || '',
    recurrence: t.recurrence || RECURRENCE.NONE, recurrenceDays: t.recurrence_days || [], daypart: t.daypart || null, completed: !!t.completed,
    travelBefore: timed ? t.travel_before || 0 : 0, travelAfter: timed ? t.travel_after || 0 : 0,
  }
}

function formFromEvent(ev) {
  const f = blankForm()
  const s = new Date(ev.start_time), e = new Date(ev.end_time)
  const allDay = s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59
  const sd = toISO(s), ed = toISO(e)
  return {
    ...f, title: ev.title || '', description: ev.description || '', cat: eventCategory(ev),
    date: sd, endDate: ed !== sd ? ed : '', allDay,
    startTime: allDay ? '09:00' : `${pad(s.getHours())}:${pad(s.getMinutes())}`,
    endTime: allDay ? '10:00' : `${pad(e.getHours())}:${pad(e.getMinutes())}`,
    evRecurrence: ev.recurrence || '', evRecurrenceDays: ev.recurrence_days || [],
    travelBefore: ev.travel_before || 0, travelAfter: ev.travel_after || 0,
  }
}

/** Tijdvak van het formulier als echte Date-objecten (voor events en de live preview). */
function formRange(f) {
  const endDs = f.endDate || f.date
  if (f.allDay) return { start: new Date(`${f.date}T00:00`), end: new Date(`${endDs}T23:59`) }
  const start = new Date(`${f.date}T${f.startTime}`)
  let end = new Date(`${endDs}T${f.endTime}`)
  if (end <= start) end = new Date(start.getTime() + 3600000)
  return { start, end }
}

/**
 * @param kind      'task' | 'event' — beginsoort bij een nieuw item
 * @param task      te bewerken taak, of event: te bewerken agenda-item
 * @param defaults  { date, endDate, startTime, endTime, allDay } voor een nieuw item
 * @param onDraftChange  live preview: ({ kind, start, end, allDay, color, dateFromUser, travelBefore, travelAfter } | null)
 * @param chooseKind  nieuw item: eerst Event of Taak kiezen
 * @param pick      { date, startTime, endTime, seq } — klik in het rooster terwijl het paneel open is
 */
export default function ItemModal({
  kind: initialKind = 'task', task, event, defaults, userId,
  subjects = [], calendarEvents, tasks, allTasks,
  onClose, onDraftChange, preview = false, chooseKind = false, pick,
}) {
  const isDesktop = useIsDesktop()
  const [kind, setKind] = useState(task ? 'task' : event ? 'event' : chooseKind ? null : initialKind)
  const [pending, setPending] = useState('event') // keuzestap: welke knop toetsenbord-focus heeft
  const choosing = kind === null
  // Heb je zelf een datum gekozen (chip, datumveld, quick-add)? Dan springt de agenda naar die dag.
  const [dateFromUser, setDateFromUser] = useState(false)
  const [editing, setEditing] = useState(task || event || null) // null = nieuw (ook na Dupliceer)
  const [f, setF] = useState(() => task ? formFromTask(task) : event ? formFromEvent(event) : blankForm(defaults))
  const [rawTitle, setRawTitle] = useState(f.title)
  const [showMore, setShowMore] = useState(() => !!task && !!(task.description || task.subject_id || task.due_date || task.group_name))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [closing, setClosing] = useState(false)
  const [duplicated, setDuplicated] = useState(false)
  const lastParse = useRef({})
  // Startwaarden: daar gaan velden naar terug als je een herkend stukje weer weghaalt.
  const base = useRef(f)
  // Bij bewerken: wat al in de titel stond (bv. "Tentamen 19 okt") niet als datum lezen,
  // alleen wat je nieuw typt.
  const ignore = useRef(task || event
    ? parseQuickAdd(f.title, { types: CATEGORY_ORDER.map(cat => ({ cat, label: CATEGORIES[cat].label })) }).tokens.map(t => t.text)
    : [])
  const mouseDownOnOverlay = useRef(false)
  const titleRef = useRef(null)
  const isNew = !editing
  const set = (patch) => setF(prev => ({ ...prev, ...patch }))
  const isTask = kind === 'task'
  const isRecurring = isTask && !!f.recurrence
  const duration = Math.max(15, timeStrToMins(f.endTime) - timeStrToMins(f.startTime))

  const close = () => {
    onDraftChange?.(null)
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 180)
  }

  // Focus op de titel zodra de soort gekozen is (bij de keuzestap pas daarna)
  useEffect(() => { if (!choosing) titleRef.current?.focus() }, [choosing])
  const choose = (k) => { setKind(k); setPending(k) }

  // Klik in het rooster terwijl het paneel open is: dat tijdslot overnemen
  useEffect(() => {
    if (!pick) return
    set({ date: pick.date, endDate: '', noDate: false, ...(pick.startTime ? { allDay: false, startTime: pick.startTime, endTime: pick.endTime } : {}) })
  }, [pick?.seq]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quick-add (nieuw én bewerken). Velden volgen de invoer; wat je daarna zelf
  // aanpast blijft staan zolang dat stukje in de invoer niet verandert.
  const types = useMemo(() => CATEGORY_ORDER.map(cat => ({ cat, label: CATEGORIES[cat].label })), [CATEGORIES])
  const parsed = useMemo(() => parseQuickAdd(rawTitle, { types, ignore: ignore.current }), [rawTitle, types])
  const onTitleChange = (value) => {
    setRawTitle(value)
    const p = parseQuickAdd(value, { types, ignore: ignore.current })
    const patch = { title: p.title }
    for (const [k, v] of Object.entries(p.fields)) if (lastParse.current[k] !== v) patch[k] = v
    // Weggehaalde stukjes: terug naar de startwaarde (alleen wat eerder uit de invoer kwam)
    const was = lastParse.current, now = p.fields, b = base.current
    if (was.endDate && !now.endDate) patch.endDate = now.date ? '' : b.endDate
    if (was.date && !now.date) { patch.date = b.date; patch.endDate = b.endDate; patch.noDate = b.noDate }
    if ((was.startTime && !now.startTime && !now.allDay) || (was.allDay && !now.allDay && !now.startTime)) {
      patch.allDay = b.allDay; patch.startTime = b.startTime; patch.endTime = b.endTime
    }
    if (was.cat && !now.cat) { patch.cat = b.cat; patch.catTouched = false }
    if (was.priority && !now.priority) patch.priority = b.priority
    // Dagdeel: taak → dagdeel (hele dag); event heeft een tijd nodig → tijdvak van dat dagdeel
    if (now.daypart && 'daypart' in patch) {
      if (isTask) { if (!now.startTime) patch.allDay = true }
      else {
        delete patch.daypart
        if (!now.startTime) { const [s, e] = DAYPART_WINDOW[now.daypart]; Object.assign(patch, { allDay: false, startTime: s, endTime: e }) }
      }
    }
    if (was.daypart && !now.daypart) {
      patch.daypart = b.daypart
      if (!now.startTime) Object.assign(patch, { allDay: b.allDay, startTime: b.startTime, endTime: b.endTime })
    }
    // Duur zonder begintijd ("gym 1.5u"): eindtijd = huidige begintijd + duur, en een tijdslot
    if (now.duration && 'duration' in patch && !now.startTime) {
      Object.assign(patch, { allDay: false, endTime: minsToTimeStr(timeStrToMins(f.startTime) + now.duration) })
    }
    if (was.duration && !now.duration && !now.startTime) Object.assign(patch, { allDay: b.allDay, endTime: b.endTime })
    delete patch.duration
    // Reistijd ("reis 20m", "terug 15m")
    if (was.travelBefore && !now.travelBefore) patch.travelBefore = b.travelBefore
    if (was.travelAfter && !now.travelAfter) patch.travelAfter = b.travelAfter
    if ((now.travelBefore || now.travelAfter) && !now.startTime && f.allDay && !('allDay' in patch)) patch.allDay = false
    if (now.cat && 'cat' in patch) patch.catTouched = true
    if (patch.date) { patch.noDate = false; setDateFromUser(true) }
    lastParse.current = p.fields
    set(patch)
  }
  const dropToken = (tok) => onTitleChange(removeToken(rawTitle, tok))

  // ── Afgeleide waarden ──
  const suggestedSlots = useMemo(() => (!isTask || f.noDate || f.allDay || !f.date) ? [] : getFreeSlots(f.date, duration, tasks, calendarEvents),
    [isTask, f.date, duration, f.noDate, f.allDay, tasks, calendarEvents])
  const [showSuggestCount, setShowSuggestCount] = useState(2)
  const daySuggestions = useMemo(() => (isTask && f.noDate) ? suggestFreeSlots(duration, tasks, calendarEvents) : [],
    [isTask, f.noDate, duration, tasks, calendarEvents])
  const conflicts = useMemo(() => (f.noDate || f.allDay || !f.date) ? [] :
    getConflicts(f.date, timeStrToMins(f.startTime), timeStrToMins(f.endTime), tasks, calendarEvents, editing?.id),
    [f.date, f.startTime, f.endTime, f.noDate, f.allDay, tasks, calendarEvents, editing?.id])

  // ── Live preview in de agenda ──
  useEffect(() => {
    if (!onDraftChange) return
    if (f.noDate || !f.date) { onDraftChange(null); return }
    const { start, end } = formRange(f)
    onDraftChange({
      kind: kind || 'event', start, end, allDay: f.allDay, color: categoryColor(f.cat), title: f.title || (isTask ? 'Nieuwe taak' : 'Nieuw event'), id: editing?.id,
      dateFromUser, multiDay: !!f.endDate && f.endDate > f.date,
      travelBefore: !f.allDay ? f.travelBefore : 0, travelAfter: !f.allDay ? f.travelAfter : 0,
    })
  }, [kind, f.date, f.endDate, f.allDay, f.startTime, f.endTime, f.cat, f.title, f.noDate, f.travelBefore, f.travelAfter, dateFromUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Opslaan ──
  const save = async () => {
    const title = (f.title || rawTitle).trim()
    if (!title || saving || choosing) return
    setSaving(true); setError(null)
    let res
    if (isTask) {
      const noDate = isRecurring ? false : f.noDate
      const timed = !noDate && !f.allDay
      const recDays = (f.recurrence === RECURRENCE.WEEKLY && f.recurrenceDays.length) ? f.recurrenceDays : null
      const date = noDate ? null : (f.recurrence ? snapToPattern(f.date, f.recurrence, recDays) : f.date)
      res = await saveTask(userId, {
        id: editing && kind === 'task' ? editing.id : undefined,
        title, description: f.description,
        date, end_date: !noDate && !isRecurring && f.endDate > f.date ? f.endDate : null,
        start_time: timed ? f.startTime : null, end_time: timed ? f.endTime : null, time: timed ? f.startTime : null,
        subject_id: f.subjectId || null, completed: f.completed, priority: f.priority,
        duration_minutes: timed ? duration : 30, due_date: f.dueDate || null, group_name: f.groupName.trim() || null,
        recurrence: f.recurrence || null, recurrence_days: recDays, daypart: f.daypart || null,
        type_id: typeIdOf(f.cat),
        travel_before: timed ? f.travelBefore : 0, travel_after: timed ? f.travelAfter : 0,
      }, editing && kind === 'task' ? editing : null)
    } else {
      const { start, end } = formRange(f)
      res = await saveEvent(userId, {
        id: editing && kind === 'event' ? editing.id : undefined, hadType: !!editing?.type_id,
        title, description: f.description, start_time: start.toISOString(), end_time: end.toISOString(),
        color: categoryHex(f.cat), type_id: typeIdOf(f.cat),
        recurrence: f.evRecurrence || null, recurrence_days: (f.evRecurrence === 'weekly' || f.evRecurrence === 'biweekly') ? f.evRecurrenceDays : null,
        travel_before: f.allDay ? 0 : f.travelBefore, travel_after: f.allDay ? 0 : f.travelAfter,
        hadTravel: !!(editing?.travel_before || editing?.travel_after),
      })
    }
    setSaving(false)
    if (res?.error) {
      const msg = res.error.message || String(res.error)
      setError(msg.includes('travel_') ? `Reistijd opslaan kan pas na de database-migratie (${isTask ? 'add_task_travel_time.sql' : 'add_travel_time.sql'}).` : `Opslaan mislukt: ${msg}`)
      return
    }
    close()
  }

  const remove = async () => {
    if (!editing) return
    navigator.vibrate?.([30, 40, 30])
    const res = kind === 'task' ? await deleteTask(editing.id) : await deleteEvent(editing.id)
    if (res?.error) { setError(`Verwijderen mislukt: ${res.error.message}`); return }
    close()
  }

  const duplicate = () => {
    setEditing(null); setDuplicated(true)
    set({ title: `${f.title} (kopie)`, completed: false })
    setRawTitle(`${f.title} (kopie)`)
    lastParse.current = {}
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select() }, 0)
  }

  // Toetsenbord: Esc sluit, Ctrl/⌘+Enter slaat op (ook vanuit een textarea)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close(); return }
      // Keuzestap: E = event, T = taak, ←/→ + Enter
      if (choosing) {
        const k = e.key.toLowerCase()
        if (k === 'e' || k === 't') { e.preventDefault(); choose(k === 'e' ? 'event' : 'task') }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setPending(p => p === 'event' ? 'task' : 'event') }
        else if (e.key === 'Enter') { e.preventDefault(); choose(pending) }
        return
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── Snelle datum/tijd ──
  const today = toISO(new Date())
  const tomorrow = addDays(today, 1)
  const dow = isoDow(today)
  const weekStart = dow <= 5 ? today : addDays(today, 8 - dow) // werkdag: vanaf vandaag; weekend: volgende maandag
  const weekEnd = addDays(weekStart, 5 - isoDow(weekStart))
  const nextMonday = addDays(today, 8 - dow)
  const dateChips = [
    { label: 'Vandaag', active: !f.noDate && f.date === today && !f.endDate, apply: { date: today, endDate: '', noDate: false } },
    { label: 'Morgen', active: !f.noDate && f.date === tomorrow && !f.endDate, apply: { date: tomorrow, endDate: '', noDate: false } },
    ...(!isRecurring ? [{ label: dow <= 5 ? 'Rest week (ma–vr)' : 'Ma–Vr', active: !f.noDate && f.date === weekStart && f.endDate === weekEnd, apply: { date: weekStart, endDate: weekEnd, noDate: false } }] : []),
    { label: 'Volgende week', active: !f.noDate && f.date === nextMonday && !f.endDate, apply: { date: nextMonday, endDate: '', noDate: false } },
    ...(isTask && !isRecurring ? [{ label: 'Geen datum', active: f.noDate, apply: { noDate: true, endDate: '' }, tone: 'var(--cat-school)' }] : []),
  ]
  const setStart = (v) => set({ startTime: v, endTime: minsToTimeStr(timeStrToMins(v) + duration) })

  // ── Stijl ──
  const chip = (active, tone) => ({
    padding: '6px 11px', borderRadius: 9, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? `color-mix(in srgb, ${tone || 'var(--accent)'} 50%, transparent)` : 'rgba(255,255,255,0.1)'}`,
    background: active ? `color-mix(in srgb, ${tone || 'var(--accent)'} 12%, transparent)` : 'transparent',
    color: active ? (tone || 'var(--accent)') : 'var(--c-text-3)',
  })
  const label = { color: 'var(--c-text-3)', fontSize: 11, display: 'block', marginBottom: 6 }
  const side = preview && isDesktop

  // Event | Taak-schakelaar; `big` = keuzestap (groot, met gloed, toetsenbord-focus op `pending`)
  const kindSwitch = (big) => (
    <div role="tablist" aria-label="Soort item" id={big ? undefined : 'item-modal-title'} className={big ? 'kind-choose' : undefined}
      style={{ display: 'inline-flex', padding: big ? 4 : 3, gap: big ? 4 : 2, borderRadius: big ? 14 : 10, background: 'var(--c-surface-2)', border: `1px solid ${big ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--c-border)'}` }}>
      {[['event', 'Event', CalendarDays, 'E'], ['task', 'Taak', CheckSquare, 'T']].map(([k, l, Icon, key]) => {
        const on = big ? pending === k : kind === k
        return (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => choose(k)}
            onMouseEnter={big ? () => setPending(k) : undefined} autoFocus={big && k === 'event'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: big ? 8 : 6, padding: big ? '12px 26px' : '6px 14px', borderRadius: big ? 11 : 8, border: 'none', cursor: 'pointer', fontSize: big ? 15 : 13, fontWeight: 600, transition: 'background 0.15s, color 0.15s',
              background: on ? (big ? 'color-mix(in srgb, var(--accent) 16%, var(--c-surface-3))' : 'var(--c-surface-3)') : 'transparent', color: on ? 'var(--c-text)' : 'var(--c-text-3)' }}>
            <Icon size={big ? 17 : 14} aria-hidden="true" style={{ color: on ? 'var(--accent)' : undefined }} /> {l}
            {big && isDesktop && <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--c-border-strong)', color: 'var(--c-text-3)', fontFamily: 'inherit' }}>{key}</kbd>}
          </button>
        )
      })}
    </div>
  )

  // Portal naar <body>: anders valt de modal binnen de stacking context van de pagina (onder de BottomNav)
  return createPortal(
    <div className={`modal-overlay${side ? ' item-panel' : ''}${closing ? ' modal-closing' : ''}`}
      style={side ? undefined : { padding: 16 }}
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget }}
      onMouseUp={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) close(); mouseDownOnOverlay.current = false }}>
      <div className={`glass-card modal-content${closing ? ' modal-closing' : ''}`} role="dialog" aria-modal={side ? undefined : 'true'} aria-labelledby={choosing ? 'item-modal-choose' : 'item-modal-title'}
        style={side ? { padding: '22px 28px', overflowY: 'auto' } : { width: '100%', maxWidth: 460, padding: 22, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Keuzestap: eerst Event of Taak, de rest is nog vervaagd */}
        {choosing && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '14px 0 18px' }}>
            <button type="button" aria-label="Sluiten" onClick={close} style={{ position: 'absolute', top: -6, right: -6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex' }}><X size={18} /></button>
            <h2 id="item-modal-choose" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--c-text-2)' }}>Wat wil je toevoegen?</h2>
            {kindSwitch(true)}
            {isDesktop && <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>Klik, of druk E / T · ←/→ + Enter</span>}
          </div>
        )}

        <div {...(choosing ? { inert: '', 'aria-hidden': true } : {})}
          style={{ transition: 'filter 0.25s, opacity 0.25s', ...(choosing ? { filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none' } : {}) }}>
        {/* Kop: Event | Taak (alleen bij nieuw) of titel bij bewerken */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          {isNew ? (
            choosing ? <span /> : kindSwitch(false)
          ) : (
            <h2 id="item-modal-title" style={{ color: 'white', fontWeight: 700, fontSize: 16, margin: 0 }}>
              {isTask ? 'Taak bewerken' : 'Event bewerken'}
            </h2>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {duplicated && <span className="hx-chip" style={{ color: 'var(--accent)' }}>Kopie</span>}
            {!isNew && (
              <button type="button" onClick={duplicate} title="Dupliceer" aria-label="Dupliceer"
                className="ui-icon-btn ui-icon-btn--ghost" style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid transparent', background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer' }}>
                <Copy size={15} />
              </button>
            )}
            <button type="button" aria-label="Sluiten" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex' }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Titel + quick-add */}
          <div>
            <input ref={titleRef} className="glass-input" value={rawTitle} onChange={e => onTitleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); save() } }}
              placeholder={isNew ? (isTask ? 'Bv. 19 t/m 25 okt stage #werk of morgen 14:00 wiskunde !urgent' : 'Bv. vrijdag 19u etentje 2u reis 20m #persoonlijk') : 'Titel — typ bv. "morgen 14:00" om te verplaatsen'}
              aria-label="Titel" style={{ fontSize: 16, width: '100%' }} />
            {parsed?.tokens.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>Herkend:</span>
                {parsed.tokens.map((tok, i) => (
                  <button key={i} type="button" onClick={() => dropToken(tok)} title="Weghalen"
                    className="hx-chip" style={{ cursor: 'pointer', color: tok.key === 'type' ? categoryColor(f.cat) : 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>
                    {tok.label} <X size={10} aria-hidden="true" />
                  </button>
                ))}
                {parsed.title && parsed.title !== rawTitle.trim() && <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>→ titel: <b style={{ color: 'var(--c-text-2)' }}>{parsed.title}</b></span>}
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <span style={label}>Type</span>
            <TypeSelect value={f.cat} onChange={cat => set({ cat, catTouched: true })} />
          </div>

          {/* Wanneer */}
          <div>
            <span style={label}>Wanneer</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dateChips.map(c => <button key={c.label} type="button" onClick={() => { set(c.apply); if (!c.apply.noDate) setDateFromUser(true) }} style={chip(c.active, c.tone)}>{c.label}</button>)}
            </div>
            {!(isTask && f.noDate) && (
              <div style={{ display: 'grid', gridTemplateColumns: isRecurring ? '1fr' : '1fr 1fr', gap: 8, marginTop: 8 }}>
                <label style={{ minWidth: 0 }}>
                  <span style={{ ...label, fontSize: 10, marginBottom: 3 }}>{isRecurring ? 'Vanaf' : 'Van'}</span>
                  <input type="date" className="glass-input" value={f.date} style={{ colorScheme: 'dark', width: '100%' }}
                    onChange={e => { const v = e.target.value; set({ date: v, noDate: false, endDate: f.endDate && f.endDate <= v ? '' : f.endDate }); setDateFromUser(true) }} />
                </label>
                {!isRecurring && (
                  <label style={{ minWidth: 0 }}>
                    <span style={{ ...label, fontSize: 10, marginBottom: 3 }}>Tot en met</span>
                    <input type="date" className="glass-input" value={f.endDate || f.date} min={f.date} style={{ colorScheme: 'dark', width: '100%' }}
                      onChange={e => { const v = e.target.value; set({ endDate: v > f.date ? v : '' }); setDateFromUser(true) }} />
                  </label>
                )}
              </div>
            )}
            {isTask && f.endDate && !isRecurring && !f.noDate && (
              <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: '6px 0 0' }}>
                Staat op elke dag t/m {formatDutchDate(new Date(f.endDate + 'T00:00:00'))}; één keer afvinken rondt de hele taak af.
              </p>
            )}

            {/* Hele dag / tijdslot */}
            {!(isTask && f.noDate) && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" onClick={() => set({ allDay: true })} style={chip(f.allDay)}>Hele dag</button>
                  <button type="button" onClick={() => set({ allDay: false })} style={{ ...chip(!f.allDay), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} aria-hidden="true" /> Tijdslot
                  </button>
                  {f.endDate && !f.allDay && <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{isTask ? 'elke dag' : 'van begin tot eind'}</span>}
                </div>
                {!f.allDay && (<>
                  {suggestedSlots.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {suggestedSlots.map((slot, i) => (
                        <button key={i} type="button" onClick={() => set({ startTime: slot.startStr, endTime: slot.endStr })}
                          style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--cat-school) 30%, transparent)', background: 'color-mix(in srgb, var(--cat-school) 7%, transparent)', color: 'var(--cat-school)', fontSize: 12, cursor: 'pointer' }}>
                          ⚡ {slot.startStr}–{slot.endStr}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" className="glass-input" aria-label="Begintijd" value={f.startTime} style={{ colorScheme: 'dark', flex: 1, minWidth: 0 }}
                      onChange={e => setStart(e.target.value)} />
                    <span style={{ color: 'var(--c-text-3)', fontSize: 13 }}>–</span>
                    <input type="time" className="glass-input" aria-label="Eindtijd" value={f.endTime} style={{ colorScheme: 'dark', flex: 1, minWidth: 0 }}
                      onChange={e => set({ endTime: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {DURATION_CHIPS.map(d => (
                      <button key={d} type="button" onClick={() => set({ endTime: minsToTimeStr(timeStrToMins(f.startTime) + d) })}
                        style={{ ...chip(duration === d), padding: '4px 9px', fontSize: 11 }}>{fmtDur(d)}</button>
                    ))}
                    {!DURATION_CHIPS.includes(duration) && <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{fmtDur(duration)}</span>}
                  </div>
                  {conflicts.length > 0 && (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 9, background: 'color-mix(in srgb, var(--c-warning) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--c-warning) 22%, transparent)' }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true">⚠️</span>
                      <span style={{ fontSize: 12, color: 'var(--c-warning)', lineHeight: 1.4 }}>Overlapt met: <strong>{conflicts.join(', ')}</strong></span>
                    </div>
                  )}
                </>)}
              </div>
            )}

            {/* Dagdeel (taak) */}
            {isTask && !f.noDate && f.allDay && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                {DAYPARTS.map(dp => {
                  const active = f.daypart === dp.id
                  return (
                    <button key={dp.id} type="button" onClick={() => set({ daypart: active ? null : dp.id })}
                      style={{ ...chip(active), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span aria-hidden="true">{dp.emoji}</span> {dp.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Event: beschrijving + herhaling */}
          {/* Reistijd (event én taak met tijdslot) */}
          {!f.allDay && !(isTask && f.noDate) && (
            <TravelTimeField before={f.travelBefore} after={f.travelAfter}
              onChange={({ before, after }) => set({ travelBefore: before, travelAfter: after })} />
          )}

          {!isTask && (<>
            <textarea className="glass-input" placeholder="Beschrijving" value={f.description}
              onChange={e => set({ description: e.target.value })} style={{ resize: 'vertical', minHeight: 56 }} />
            <div>
              <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 5 }}><Repeat size={11} aria-hidden="true" /> Herhaling</span>
              <select className="glass-input" value={f.evRecurrence} style={{ colorScheme: 'dark', width: '100%' }}
                onChange={e => set({ evRecurrence: e.target.value, evRecurrenceDays: [] })}>
                {EVENT_RECURRENCE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {(f.evRecurrence === 'weekly' || f.evRecurrence === 'biweekly') && (
                <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                  {WEEKDAY_PILLS.map(d => {
                    const active = f.evRecurrenceDays.includes(d.js)
                    return <button key={d.js} type="button" onClick={() => set({ evRecurrenceDays: active ? f.evRecurrenceDays.filter(x => x !== d.js) : [...f.evRecurrenceDays, d.js] })}
                      style={{ ...chip(active), flex: 1, padding: '7px 0', fontSize: 11 }}>{d.label}</button>
                  })}
                </div>
              )}
            </div>
          </>)}

          {/* Taak: prioriteit, herhaling, meer opties */}
          {isTask && (<>
            <div>
              <span style={label}>Prioriteit</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3].map(p => {
                  const cfg = PRIORITY_CFG[p], active = f.priority === p
                  return (
                    <button key={p} type="button" onClick={() => set({ priority: p })}
                      style={{ flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                        border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.08)'}`, background: active ? cfg.tint : 'transparent', color: active ? cfg.color : 'var(--c-text-3)' }}>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 5 }}><Repeat size={11} aria-hidden="true" /> Herhaling</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TASK_RECURRENCE.map(opt => (
                  <button key={opt.label} type="button" style={chip(f.recurrence === opt.value)}
                    onClick={() => set({
                      recurrence: opt.value, noDate: opt.value ? false : f.noDate, endDate: opt.value ? '' : f.endDate,
                      recurrenceDays: opt.value === RECURRENCE.WEEKLY && !f.recurrenceDays.length ? [isoDow(f.date)] : f.recurrenceDays,
                    })}>{opt.label}</button>
                ))}
              </div>
              {f.recurrence === RECURRENCE.WEEKLY && (
                <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                  {WEEKDAY_PILLS.map(d => {
                    const active = f.recurrenceDays.includes(d.iso)
                    return <button key={d.iso} type="button" style={{ ...chip(active), flex: 1, padding: '7px 0', fontSize: 11 }}
                      onClick={() => set({ recurrenceDays: active ? f.recurrenceDays.filter(x => x !== d.iso) : [...f.recurrenceDays, d.iso].sort((a, b) => a - b) })}>{d.label}</button>
                  })}
                </div>
              )}
              {isRecurring && (
                <p style={{ fontSize: 11, color: 'color-mix(in srgb, var(--accent) 70%, white)', margin: '8px 0 0' }}>
                  🔁 {recurrenceLabel(f.recurrence, f.recurrenceDays)} · vanaf {new Date(f.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} · bouwt een streak op 🔥
                </p>
              )}
            </div>

            <button type="button" onClick={() => setShowMore(v => !v)} aria-expanded={showMore}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, padding: '2px 0', width: 'fit-content' }}>
              <span aria-hidden="true" style={{ fontSize: 12, transition: 'transform 0.2s', transform: showMore ? 'rotate(90deg)' : 'none' }}>▸</span>
              {showMore ? 'Minder opties' : 'Meer opties'}
            </button>

            {showMore && (<>
              <textarea className="glass-input" placeholder="Beschrijving (optioneel)" value={f.description}
                onChange={e => set({ description: e.target.value })} style={{ resize: 'vertical', minHeight: 60 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ minWidth: 0 }}>
                  <span style={{ ...label, marginBottom: 4 }}>Vak</span>
                  <select className="glass-input" value={f.subjectId} style={{ colorScheme: 'dark', width: '100%' }}
                    onChange={e => { const v = e.target.value; set({ subjectId: v, ...(v && !f.catTouched ? { cat: 'school' } : {}) }) }}>
                    <option value="">Geen vak</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label style={{ minWidth: 0 }}>
                  <span style={{ ...label, marginBottom: 4 }}>Deadline</span>
                  <input type="date" className="glass-input" value={f.dueDate} style={{ colorScheme: 'dark', width: '100%' }}
                    onChange={e => set({ dueDate: e.target.value })} />
                </label>
              </div>
              {(() => {
                const groups = [...new Set((allTasks || tasks || []).map(t => t.group_name).filter(Boolean))]
                return (
                  <label>
                    <span style={{ ...label, marginBottom: 4 }}>Groep (optioneel)</span>
                    <input className="glass-input" list="item-groups-list" placeholder="Bijv. Trading, School..." value={f.groupName}
                      onChange={e => set({ groupName: e.target.value })} style={{ fontSize: 13, width: '100%' }} />
                    {groups.length > 0 && <datalist id="item-groups-list">{groups.map(g => <option key={g} value={g} />)}</datalist>}
                  </label>
                )
              })()}
            </>)}

            {/* Beschikbare momenten bij "Geen datum" */}
            {!isRecurring && f.noDate && daySuggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--c-text-3)', fontSize: 11 }}>📅 Beschikbare momenten</span>
                {daySuggestions.slice(0, showSuggestCount).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--cat-school) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--cat-school) 18%, transparent)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--cat-school)', fontWeight: 600 }}>{formatDutchDate(s.d)}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 1 }}>{s.slot.startStr}–{s.slot.endStr} · geen overlap</div>
                    </div>
                    <button type="button" onClick={() => set({ date: s.dateStr, startTime: s.slot.startStr, endTime: s.slot.endStr, noDate: false, allDay: false })}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--cat-school) 40%, transparent)', background: 'color-mix(in srgb, var(--cat-school) 12%, transparent)', color: 'var(--cat-school)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Inplannen
                    </button>
                  </div>
                ))}
                {showSuggestCount < daySuggestions.length && (
                  <button type="button" onClick={() => setShowSuggestCount(v => v + 2)}
                    style={{ fontSize: 11, color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}>
                    + Laad meer momenten
                  </button>
                )}
              </div>
            )}

            {!isNew && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: f.completed ? 'var(--accent)' : 'var(--c-text-3)', fontSize: 13 }}>
                <input type="checkbox" checked={f.completed} onChange={e => set({ completed: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                Afgerond
              </label>
            )}
          </>)}
        </div>

        {error && <div role="alert" style={{ fontSize: 12, color: 'var(--c-danger)', marginTop: 12 }}>{error}</div>}

        {/* Acties */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' }}>
          {!isNew && (
            <button type="button" onClick={remove} title="Verwijderen" aria-label="Verwijderen"
              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--c-danger) 30%, transparent)', background: 'color-mix(in srgb, var(--c-danger) 8%, transparent)', color: 'var(--c-danger)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={13} />
            </button>
          )}
          <button type="button" onClick={close}
            style={{ flex: 1, padding: 9, borderRadius: 10, border: '1px solid var(--c-border-strong)', background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer', fontSize: 12 }}>
            Annuleer
          </button>
          <button type="button" onClick={save} disabled={!(f.title || rawTitle).trim() || saving} title="Opslaan (Ctrl+Enter)"
            style={{ flex: 2, padding: 9, borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: (f.title || rawTitle).trim() ? 1 : 0.45 }}>
            <Save size={13} /> {saving ? 'Opslaan…' : isNew ? (isTask ? 'Taak opslaan' : 'Event opslaan') : 'Opslaan'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 10, color: 'var(--c-text-3)', textAlign: 'center' }}>Ctrl+Enter opslaan · Esc sluiten</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
