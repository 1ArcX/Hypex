import React, { useState, useMemo, useEffect } from 'react'
import {
  Search, Flame, Clock3, CheckCircle2, CalendarDays, AlertTriangle, CalendarClock,
  ChevronLeft, ChevronRight, ArrowRight, MapPin, Plus, CloudRain, ListTodo, Inbox, X,
} from 'lucide-react'
import Clock from '../components/Clock'
import WeatherWidget from '../components/WeatherWidget'
import SpotifyWidget from '../components/SpotifyWidget'
import GeldMiniWidget from '../components/dashboard/GeldMiniWidget'
import PomodoroMiniWidget from '../components/dashboard/PomodoroMiniWidget'
import TodayWidget from '../components/dashboard/TodayWidget'
import { Card, CardHeader, CardLink, KpiTile, ListRow, CheckButton, Pill, IconButton, FilterTabs, EmptyState } from '../components/ui'
import { taskCategory, eventCategory, categoryColor } from '../utils/category'
import { isOverdue, isUrgent, daysLate, shortDate } from '../utils/taskStatus'
import { eventDisplay } from '../utils/eventTitle'
import { buildUpcoming, countdownLabel } from '../utils/upcoming'


// ── Helpers ──────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0') }
function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'
}

function longDate(d = new Date()) {
  const s = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// ── Vandaag-strip: haal alle geplande items van vandaag op ─────────────────────
function useTodayItems(tasks, magisterLessons, calendarEvents) {
  return useMemo(() => {
    const today = todayDateStr()
    const items = []

    // Magister lessen
    const now = new Date()
    const weekStart = (() => { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0); return d })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const cacheKey = `magister_sched_${weekStart.toISOString().slice(0,10)}_${weekEnd.toISOString().slice(0,10)}`
    const lessons = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey)) || [] } catch { return [] } })()
    const allLessons = lessons.length ? lessons : (magisterLessons || [])
    for (const l of allLessons) {
      if (!l.start || l.uitgevallen) continue
      if (new Date(l.start).toISOString().slice(0,10) !== today) continue
      const s = new Date(l.start)
      const e = l.einde ? new Date(l.einde) : null
      items.push({
        sortMins: s.getHours()*60 + s.getMinutes(),
        time: hhmm(s),
        label: l.vak || 'Les',
        color: categoryColor('school'),
        type: 'lesson',
        end: e ? hhmm(e) : null,
        highlightKey: `lesson:${l.start}`,
      })
    }

    // Taken met tijd
    for (const t of tasks) {
      if (t.date !== today || t.completed) continue
      const ts = t.start_time || t.time
      if (!ts) continue
      const [h, m] = ts.split(':').map(Number)
      items.push({
        sortMins: h*60 + m,
        time: ts.slice(0,5),
        label: t.title,
        color: categoryColor(taskCategory(t)),
        type: 'task',
        raw: t,
        end: t.end_time?.slice(0,5) || null,
      })
    }

    // Agenda-items (eigen + geïmporteerd), niet hele-dag
    for (const ev of calendarEvents || []) {
      if (!ev.start_time || ev.all_day) continue
      const s = new Date(ev.start_time)
      const d = `${s.getFullYear()}-${pad2(s.getMonth()+1)}-${pad2(s.getDate())}`
      if (d !== today) continue
      const e = ev.end_time ? new Date(ev.end_time) : null
      items.push({
        sortMins: s.getHours()*60 + s.getMinutes(),
        time: hhmm(s),
        label: eventDisplay(ev).title,
        color: categoryColor(eventCategory(ev)),
        type: 'event',
        end: e ? hhmm(e) : null,
        highlightKey: `event:${ev.id}`,
      })
    }

    // Werkdiensten
    try {
      const shifts = JSON.parse(localStorage.getItem('pmt_work_shifts')) || []
      for (const s of shifts) {
        if (s.date?.slice(0,10) !== today) continue
        if (!s.start_time) continue
        const [h, m] = s.start_time.split(':').map(Number)
        items.push({
          sortMins: h*60 + m,
          time: s.start_time.slice(0,5),
          label: 'Werk',
          color: categoryColor('werk'),
          type: 'work',
          end: s.end_time?.slice(0,5) || null,
          highlightKey: `work:${today}:${s.start_time}`,
        })
      }
    } catch {}

    return items.sort((a, b) => a.sortMins - b.sortMins)
  }, [tasks, magisterLessons, calendarEvents])
}

// ── Next event hook (bronnen: utils/upcoming.js) ─────────────────────────────
function useNextEvent({ tasks, calendarEvents, magisterLessons, skip, typeFilter }) {
  return useMemo(() => {
    let items = buildUpcoming({ tasks, calendarEvents, magisterLessons })
    if (typeFilter && typeFilter !== 'alle') {
      const typeMap = { school: 'lesson', event: 'event', werk: 'work', taak: 'task' }
      items = items.filter(i => i.type === (typeMap[typeFilter] || typeFilter))
    }
    const idx = Math.min(skip, items.length - 1)
    const next = items[Math.max(0, idx)] || null
    if (!next) return { item: null, hasMore: false }
    return { item: next, hasMore: idx < items.length - 1 }
  }, [tasks, calendarEvents, magisterLessons, skip, typeFilter])
}

// ── Nu bezig: loopt er op dit moment iets (les, taak met tijd, dienst)? ─────────
function useCurrentItem(todayItems) {
  return useMemo(() => {
    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const current = todayItems.find(item => {
      if (!item.end) return false
      const [eh, em] = item.end.split(':').map(Number)
      return item.sortMins <= nowMins && (eh * 60 + em) >= nowMins
    })
    if (!current) return null
    const [eh, em] = current.end.split(':').map(Number)
    return { ...current, minsLeft: Math.max(1, (eh * 60 + em) - nowMins) }
  }, [todayItems])
}

// Minuutticker zodat countdowns ("Over 14 min") actueel blijven
function useMinuteTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setT(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])
}

const NEXT_FILTERS = [
  { value: 'alle',  label: 'Alle' },
  { value: 'event', label: 'Agenda' },
  { value: 'werk',  label: 'Werk' },
  { value: 'taak',  label: 'Taken' },
]

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage({
  isBreak, tasks, subjects, calendarEvents, magisterLessons,
  displayName, homeRain, onNavigate, onNavigateToTasks,
  setDetailTask, openNewTask, onRequestPwaInstall, userId,
  onNavigateToAgenda, onToggleTask, isAdmin, onOpenSearch,
}) {
  useMinuteTick()
  const [skip, setSkip] = useState(0)
  const [nextEventFilter, setNextEventFilter] = useState(() => localStorage.getItem('nextEventFilter') || 'alle')
  const setFilter = (f) => { setNextEventFilter(f); setSkip(0); localStorage.setItem('nextEventFilter', f) }
  const { item: ev, hasMore } = useNextEvent({ tasks, calendarEvents, magisterLessons, skip, typeFilter: nextEventFilter })
  const todayItems = useTodayItems(tasks, magisterLessons, calendarEvents)
  const current = useCurrentItem(todayItems)

  const today = todayDateStr()
  const subjectName = id => subjects?.find(s => s.id === id)?.name

  const checkRainHidden = () => {
    const t = localStorage.getItem('rain_hidden')
    return !!t && Date.now() - Number(t) < 4 * 3600 * 1000
  }
  const [rainHidden, setRainHiddenState] = useState(checkRainHidden)
  const dismissRain = () => { localStorage.setItem('rain_hidden', Date.now()); setRainHiddenState(true); window.dispatchEvent(new Event('rainHiddenChanged')) }
  useEffect(() => {
    const handler = () => setRainHiddenState(checkRainHidden())
    window.addEventListener('rainHiddenChanged', handler)
    return () => window.removeEventListener('rainHiddenChanged', handler)
  }, [])

  // ── KPI's (één definitie: utils/taskStatus) ──
  const overdueTasks = tasks.filter(t => isOverdue(t, today)).sort((a, b) => a.date.localeCompare(b.date))
  const urgentTasks  = tasks.filter(isUrgent)
  const openCount    = tasks.filter(t => !t.completed).length
  const todayOpen    = tasks.filter(t => !t.completed && t.date === today).length

  // Werkruimte: eerst te laat, daarna urgent (zonder dubbelingen)
  const overdueIds = new Set(overdueTasks.map(t => t.id))
  const attention = [...overdueTasks, ...urgentTasks.filter(t => !overdueIds.has(t.id))]
  const attentionTitle = overdueTasks.length && attention.length > overdueTasks.length ? 'Te laat & urgent'
    : overdueTasks.length ? 'Te laat' : 'Urgent'

  // Naderende deadlines (vandaag t/m +3 dagen)
  const in3 = new Date(); in3.setDate(in3.getDate() + 3)
  const in3Str = `${in3.getFullYear()}-${pad2(in3.getMonth()+1)}-${pad2(in3.getDate())}`
  const deadlines = tasks
    .filter(t => !t.completed && t.due_date && t.due_date >= today && t.due_date <= in3Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 4)
  const unplanned = tasks.filter(t => !t.completed && !t.date)

  const showRain = homeRain && !rainHidden && Math.max(...homeRain.map(d => d.precip)) > 0.1
  const widgetCount = isAdmin ? 4 : 3

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div className="dash">

        {/* ── RIJ 1: header — begroeting, zoeken, tijd, weer ── */}
        <header className="dash-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="t-page" style={{ margin: 0, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getGreeting()}{displayName ? `, ${displayName}` : ''}
            </h1>
            <p className="t-meta" style={{ margin: '2px 0 0', fontSize: 12 }}>{longDate()}</p>
          </div>
          <button type="button" onClick={onOpenSearch} className="dash-search" aria-label="Zoek in Hypex (Ctrl K)">
            <Search size={14} aria-hidden="true" />
            <span style={{ flex: 1, textAlign: 'left' }}>Zoek in Hypex…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="dash-clock"><Clock isBreak={isBreak} variant="inline" /></div>
          <div className="dash-weather">
            <WeatherWidget compact userId={userId} onRequestPwaInstall={onRequestPwaInstall} />
          </div>
        </header>

        {/* ── RIJ 2: KPI's ── */}
        <section className="dash-kpis" aria-label="Overzicht taken">
          <KpiTile icon={Flame} value={urgentTasks.length} label="Urgent" tone="danger" onClick={() => onNavigateToTasks?.('urgent')} />
          <KpiTile icon={Clock3} value={overdueTasks.length} label="Te laat" tone="warning" onClick={() => onNavigateToTasks?.('telaat')} />
          <KpiTile icon={CheckCircle2} value={openCount} label="Open" tone="success" onClick={() => onNavigateToTasks?.('open')} />
          <KpiTile icon={CalendarDays} value={todayOpen} label="Vandaag" tone="persoonlijk" onClick={() => onNavigateToTasks?.('vandaag')} />
        </section>

        {/* ── RIJ 3: werkruimte — aandacht nodig + volgende afspraak ── */}
        <section className="dash-work">
          <Card urgent={overdueTasks.length > 0} tone={!overdueTasks.length && attention.length ? 'danger' : undefined} style={{ minWidth: 0 }}>
            {attention.length > 0 ? (
              <>
                <CardHeader icon={AlertTriangle} title={attentionTitle} count={attention.length} tone="danger"
                  action={<CardLink onClick={() => onNavigateToTasks?.(overdueTasks.length ? 'telaat' : 'urgent')}>Bekijk alles <ArrowRight size={13} /></CardLink>} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attention.slice(0, 4).map(t => {
                    const late = overdueIds.has(t.id)
                    const n = late ? daysLate(t, today) : 0
                    const subj = subjectName(t.subject_id)
                    return (
                      <ListRow key={t.id}
                        dot={categoryColor(taskCategory(t))}
                        title={t.title}
                        subtitle={[late ? `${n} ${n === 1 ? 'dag' : 'dagen'} te laat` : (t.date ? null : 'Nog niet ingepland'), subj].filter(Boolean).join(' · ') || null}
                        trailing={<>
                          {!late && <Pill tone="danger">Urgent</Pill>}
                          {t.date && <Pill tone={late ? 'danger' : 'neutral'}>{shortDate(t.date, today)}</Pill>}
                        </>}
                        action={<CheckButton checked={false} onChange={() => onToggleTask?.(t)} label={`Markeer "${t.title}" als gedaan`} tone="success" />}
                        onClick={() => setDetailTask(t)}
                      />
                    )
                  })}
                  {attention.length > 4 && (
                    <button type="button" onClick={() => onNavigateToTasks?.('telaat')} className="t-meta"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 10px' }}>
                      +{attention.length - 4} meer
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <CardHeader icon={CheckCircle2} title="Niets te laat" tone="success"
                  action={<CardLink onClick={() => onNavigateToTasks?.('open')}>Naar taken <ArrowRight size={13} /></CardLink>} />
                <EmptyState compact title={openCount ? 'Geen achterstallige of urgente taken.' : 'Alles gedaan!'}
                  text={openCount ? `${openCount} open ${openCount === 1 ? 'taak' : 'taken'} op schema.` : 'Geen openstaande taken.'} />
              </>
            )}
          </Card>

          {/* Volgende afspraak */}
          <Card style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <CardHeader icon={CalendarClock} title="Volgende afspraak"
              action={
                <div style={{ display: 'flex', gap: 2 }}>
                  <IconButton icon={ChevronLeft} label="Vorige afspraak" size={26} disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - 1))} />
                  <IconButton icon={ChevronRight} label="Volgende afspraak" size={26} disabled={!ev || !hasMore} onClick={() => setSkip(s => s + 1)} />
                </div>
              } />
            <FilterTabs variant="segmented" items={NEXT_FILTERS} value={nextEventFilter} onChange={setFilter} label="Soort afspraak" style={{ marginBottom: 12, alignSelf: 'flex-start' }} />

            {current && skip === 0 && nextEventFilter === 'alle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)' }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Nu bezig</span>
                <span style={{ fontSize: 12, color: 'var(--c-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.label}</span>
                <span className="t-meta tnum">nog {current.minsLeft} min</span>
              </div>
            )}

            {ev ? (
              <>
                {(() => {
                  const cd = countdownLabel(ev.ts)
                  const soon = ev.ts - new Date() < 3600000
                  return (
                    <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: soon ? 'var(--c-warning)' : 'var(--accent)' }}>
                      <Clock3 size={14} aria-hidden="true" /> {cd}
                    </p>
                  )
                })()}
                <button type="button"
                  onClick={() => { if (ev.type === 'task' && ev.raw) setDetailTask(ev.raw); else onNavigateToAgenda?.(ev.ts, ev.highlightKey) }}
                  style={{ display: 'flex', gap: 10, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: categoryColor(ev.cat), flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label}</span>
                    <span className="t-meta tnum" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                      {ev.ts.toDateString() !== new Date().toDateString() && `${ev.ts.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })} · `}
                      {hhmm(ev.ts)}{ev.end ? ` – ${hhmm(ev.end)}` : ''}
                    </span>
                    {ev.code && <span className="t-meta" style={{ display: 'block', fontSize: 11, marginTop: 2, letterSpacing: '0.02em' }}>{ev.code}</span>}
                    {ev.location && (
                      <span className="t-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 2 }}>
                        <MapPin size={11} aria-hidden="true" /> {ev.location}
                      </span>
                    )}
                  </span>
                </button>
              </>
            ) : (
              <EmptyState compact text="Niets meer gepland." />
            )}
            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
              <button type="button" className="btn-ghost"
                onClick={() => onNavigateToAgenda?.(ev?.ts || new Date(), ev?.highlightKey)}>
                Bekijk agenda <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </Card>
        </section>

        {/* ── RIJ 4: compacte widgets ── */}
        <section className="dash-widgets" style={{ '--cols': widgetCount }} aria-label="Widgets">
          <TodayWidget tasks={tasks} today={today} onToggleTask={t => onToggleTask?.(t)} onOpenTask={setDetailTask}
            onNewTask={() => openNewTask()} onOpenList={() => onNavigateToTasks?.('vandaag')} />
          <PomodoroMiniWidget onOpen={() => onNavigate('pomodoro')} />
          {isAdmin && <GeldMiniWidget userId={userId} onOpen={() => onNavigate('geld')} />}
          <SpotifyWidget compact />
        </section>

        {/* ── RIJ 5 (Level 2/3): schema, deadlines, ongepland, regen ── */}
        {(todayItems.length > 0 || deadlines.length > 0 || unplanned.length > 0 || showRain) && (
          <section className="dash-extra">
            {todayItems.length > 0 && (
              <Card pad={14} style={{ minWidth: 0 }}>
                <CardHeader icon={ListTodo} title="Schema vandaag" count={todayItems.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {todayItems.slice(0, 5).map((item, i) => {
                    const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
                    const endMins = item.end ? (() => { const [eh, em] = item.end.split(':').map(Number); return eh * 60 + em })() : 0
                    const isNow = item.sortMins <= nowMins && item.end && endMins >= nowMins
                    const past = item.end ? endMins < nowMins : item.sortMins < nowMins
                    return (
                      <ListRow key={i} dot={item.color} title={item.label} done={past && !isNow}
                        trailing={<>
                          {isNow && <Pill tone="accent">Nu</Pill>}
                          <span className="t-meta tnum">{item.time}{item.end ? `–${item.end}` : ''}</span>
                        </>}
                        onClick={() => {
                          if (item.type === 'task' && item.raw) setDetailTask(item.raw)
                          else onNavigateToAgenda?.(new Date(), item.highlightKey)
                        }} />
                    )
                  })}
                  {todayItems.length > 5 && <p className="t-meta" style={{ margin: '2px 10px 0' }}>+{todayItems.length - 5} meer</p>}
                </div>
              </Card>
            )}

            {deadlines.length > 0 && (
              <Card pad={14} style={{ minWidth: 0 }}>
                <CardHeader icon={Flame} title="Deadlines" count={deadlines.length} tone="danger" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {deadlines.map(t => (
                    <ListRow key={t.id} dot={categoryColor(taskCategory(t))} title={t.title}
                      subtitle={subjectName(t.subject_id)}
                      trailing={<Pill tone={t.due_date === today ? 'danger' : 'warning'}>{shortDate(t.due_date, today)}</Pill>}
                      onClick={() => setDetailTask(t)} />
                  ))}
                </div>
              </Card>
            )}

            {unplanned.length > 0 && (
              <Card pad={14} style={{ minWidth: 0 }}>
                <CardHeader icon={Inbox} title="Nog in te plannen" count={unplanned.length}
                  action={<CardLink onClick={() => onNavigateToTasks?.('open')}>Alle <ArrowRight size={13} /></CardLink>} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {unplanned.slice(0, 4).map(t => (
                    <ListRow key={t.id} dot={categoryColor(taskCategory(t))} title={t.title}
                      trailing={subjectName(t.subject_id) && <span className="t-meta">{subjectName(t.subject_id)}</span>}
                      onClick={() => setDetailTask(t)} />
                  ))}
                  {unplanned.length > 4 && <p className="t-meta" style={{ margin: '2px 10px 0' }}>+{unplanned.length - 4} meer</p>}
                </div>
              </Card>
            )}

            {showRain && <RainCard data={homeRain} onDismiss={dismissRain} />}
          </section>
        )}

        {/* Mobiel: snelle actie onderaan (desktop heeft + in de Vandaag-widget en Ctrl K) */}
        <button className="btn-primary md:hidden" onClick={() => openNewTask()} style={{ width: '100%', padding: 12 }}>
          <Plus size={16} aria-hidden="true" /> Taak toevoegen
        </button>

        {/* Padding voor bottom nav */}
        <div className="md:hidden" style={{ height: 80 }} />
      </div>
    </div>
  )
}

// ── Regen-grafiek (komende 2 uur) ─────────────────────────────────────────────
function RainCard({ data, onDismiss }) {
  const maxP = Math.max(...data.map(d => d.precip), 0.5)
  const W = 260, H = 56, PL = 4, PB = 8, PR = 4, PT = 4
  const iW = W - PL - PR, iH = H - PT - PB
  const xOf = i => PL + (i / (data.length - 1 || 1)) * iW
  const yOf = v => PT + iH - (v / maxP) * iH
  const pts = data.map((d, i) => [xOf(i), yOf(d.precip)])
  const lineD = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaD = `${lineD} L${pts[pts.length-1][0].toFixed(1)},${(PT+iH).toFixed(1)} L${PL},${(PT+iH).toFixed(1)} Z`
  const maxLabel = maxP < 0.5 ? 'Lichte regen' : maxP < 2 ? 'Matige regen' : 'Zware regen'
  const rainIdxs = data.map((d, i) => d.precip > 0.1 ? i : -1).filter(i => i !== -1)
  const startTime = data[rainIdxs[0]]?.time
  const endTime = data[rainIdxs[rainIdxs.length - 1]]?.time
  const timeLabel = startTime === endTime || !endTime ? `vanaf ${startTime}` : `${startTime}–${endTime}`
  return (
    <Card pad={14} tone="info" style={{ minWidth: 0 }}>
      <CardHeader icon={CloudRain} title={`${maxLabel} ${timeLabel}`} tone="info"
        action={<IconButton icon={X} label="Regengrafiek verbergen" size={24} iconSize={13} onClick={onDismiss} />} />
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} role="img" aria-label={`${maxLabel} ${timeLabel}`}>
        <defs>
          <linearGradient id="dRainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-info)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--c-info)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#dRainGrad)" />
        <path d={lineD} fill="none" stroke="var(--c-info)" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1={PL} y1={PT+iH} x2={W-PR} y2={PT+iH} stroke="var(--c-border)" strokeWidth="1" />
      </svg>
    </Card>
  )
}
