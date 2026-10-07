import React, { useState, useMemo, useEffect } from 'react'
import {
  Search, Flame, Clock3, CheckCircle2, CalendarDays,
  ArrowRight, Plus, CloudRain, Inbox, X,
} from 'lucide-react'
import Clock from '../components/Clock'
import WeatherWidget from '../components/WeatherWidget'
import SpotifyWidget from '../components/SpotifyWidget'
import GeldMiniWidget from '../components/dashboard/GeldMiniWidget'
import PomodoroMiniWidget from '../components/dashboard/PomodoroMiniWidget'
import { usePomodoroState } from '../components/dashboard/PomodoroBanner'
import TodayFocusCard from '../components/dashboard/TodayFocusCard'
import { useTodayItems, useNextEvent, useCurrentItem, useMinuteTick } from '../components/dashboard/useToday'
import { Card, CardHeader, CardLink, ListRow, Pill, IconButton } from '../components/ui'
import { taskCategory, categoryColor } from '../utils/category'
import { isOverdue, isUrgent, shortDate } from '../utils/taskStatus'
import { buildUpcoming } from '../utils/upcoming'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useViewport } from '../hooks/useViewport'
import { greeting } from '../utils/greeting'


// ── Helpers ──────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0') }
function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}

function longDate(d = new Date()) {
  const s = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// ── Main ─────────────────────────────────────────────────────────────────────
// Volgorde: Pomodoro-banner (als die loopt) → kop met KPI-chips → Vandaag + Volgende (focus) →
// widgets → deadlines/ongepland/regen → (hoog scherm) Komende dagen.
export default function DashboardPage({
  isBreak, tasks, subjects, calendarEvents, magisterLessons,
  displayName, homeRain, onNavigate, onNavigateToTasks,
  setDetailTask, openNewTask, onRequestPwaInstall, userId,
  onNavigateToAgenda, onToggleTask, isAdmin, onOpenSearch,
}) {
  useMinuteTick()
  const isDesktop = useIsDesktop()
  const vp = useViewport()
  // Hoog scherm (bv. verticale monitor): langere lijsten, Spotify-kaart hoger, "Komende dagen"
  const tall = isDesktop && vp.h >= 1100
  const lim = tall
    ? { attention: 6, schedule: 10, tasks: 6, deadlines: 6, unplanned: 8 }
    : { attention: 4, schedule: 6, tasks: 4, deadlines: 4, unplanned: 4 }
  const [skip, setSkip] = useState(0)
  const [nextEventFilter, setNextEventFilter] = useState(() => localStorage.getItem('nextEventFilter') || 'alle')
  const setFilter = (f) => { setNextEventFilter(f); setSkip(0); localStorage.setItem('nextEventFilter', f) }
  const { item: ev, hasMore } = useNextEvent({ tasks, calendarEvents, magisterLessons, skip, typeFilter: nextEventFilter })
  const todayItems = useTodayItems(tasks, magisterLessons, calendarEvents)
  const current = useCurrentItem(todayItems)
  const pomo = usePomodoroState()
  const pomoActive = pomo.running || pomo.paused

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

  // "Eerst dit": eerst te laat, daarna urgent (zonder dubbelingen)
  const overdueIds = new Set(overdueTasks.map(t => t.id))
  const attention = [...overdueTasks, ...urgentTasks.filter(t => !overdueIds.has(t.id))]

  // Naderende deadlines (vandaag t/m +3 dagen)
  const in3 = new Date(); in3.setDate(in3.getDate() + 3)
  const in3Str = `${in3.getFullYear()}-${pad2(in3.getMonth()+1)}-${pad2(in3.getDate())}`
  const deadlines = tasks
    .filter(t => !t.completed && t.due_date && t.due_date >= today && t.due_date <= in3Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, lim.deadlines)
  const unplanned = tasks.filter(t => !t.completed && !t.date)

  // Hoog scherm: komende 6 dagen (vanaf morgen), per dag gegroepeerd
  const weekAhead = useMemo(() => {
    if (!tall) return []
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + 1)
    const days = Array.from({ length: 6 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { date: d, items: [] } })
    for (const it of buildUpcoming({ tasks, calendarEvents: (calendarEvents || []).filter(e => !e.hidden), magisterLessons })) {
      const idx = Math.floor((new Date(it.ts).setHours(0, 0, 0, 0) - start) / 86400000)
      if (idx >= 0 && idx < 6) days[idx].items.push(it)
    }
    return days
  }, [tall, tasks, calendarEvents, magisterLessons])

  const showRain = homeRain && !rainHidden && Math.max(...homeRain.map(d => d.precip)) > 0.1
  const widgetCount = (pomoActive ? 0 : 1) + (isAdmin ? 1 : 0) // Spotify staat los (desktop: groot rechts, mobiel: onderaan)

  const openItem = (item) => {
    if (!item) return onNavigateToAgenda?.(new Date())
    if (item.type === 'task' && item.raw) setDetailTask(item.raw)
    else onNavigateToAgenda?.(item.ts || new Date(), item.highlightKey)
  }

  const chip = (icon, n, label, tone, filter) => {
    const Icon = icon
    return (
      <button type="button" className={`dash-chip${n > 0 && tone ? ` is-${tone}` : ''}`} onClick={() => onNavigateToTasks?.(filter)}
        aria-label={`${n} ${label} — naar taken`}>
        <Icon size={12} aria-hidden="true" /> <span className="tnum">{n}</span> {label}
      </button>
    )
  }

  return (
    <div className="dash-scroll">
      <div className={`dash${tall ? ' is-tall' : ''}`}>

        {/* Loopt er een Pomodoro, dan staat de PomodoroBanner erboven (App.jsx, op elke tab) */}

        {/* ── Kop: begroeting + KPI-chips, zoeken, tijd, weer ── */}
        <header className="dash-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="t-page" style={{ margin: 0, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {greeting()}{displayName ? `, ${displayName}` : ''}
            </h1>
            <p className="t-meta" style={{ margin: '2px 0 0', fontSize: 12 }}>{longDate()}</p>
            <div className="dash-chips" aria-label="Overzicht taken">
              {chip(Flame, urgentTasks.length, 'urgent', 'danger', 'urgent')}
              {chip(Clock3, overdueTasks.length, 'te laat', 'warning', 'telaat')}
              {chip(CheckCircle2, openCount, 'open', null, 'overzicht')}
            </div>
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

        {/* ── Focus: Vandaag + Volgende ── */}
        <TodayFocusCard
          today={{
            tasks, subjects, today, todayItems, attention, overdueIds, lim,
            onToggleTask: t => onToggleTask?.(t), onOpenTask: setDetailTask, onOpenItem: openItem,
            onNewTask: () => openNewTask(), onOpenList: () => onNavigateToTasks?.('overzicht'),
          }}
          next={{
            ev, hasMore, skip, setSkip, filter: nextEventFilter, setFilter, current,
            onOpen: openItem, onOpenAgenda: e => onNavigateToAgenda?.(e?.ts || new Date(), e?.highlightKey),
          }}
        />

        {/* ── Widgets ── */}
        {/* Desktop: Pomodoro + Geld gestapeld links, Spotify ("mini Spotify" met songtekst) groot rechts.
            Verticaal scherm: Pomodoro + Geld naast elkaar, Spotify over de volle breedte eronder. */}
        {isDesktop ? (
          <section className={`dash-media${widgetCount ? '' : ' is-solo'}${vp.portrait ? ' is-column' : ''}`} aria-label="Widgets">
            {widgetCount > 0 && (
              <div className="dash-media__stack">
                {!pomoActive && <PomodoroMiniWidget st={pomo} userId={userId} onOpen={() => onNavigate('focus')} />}
                {isAdmin && <GeldMiniWidget userId={userId} onOpen={() => onNavigate('geld')} />}
              </div>
            )}
            <SpotifyWidget variant="hero" queueLimit={vp.h >= 1600 ? 8 : 5} />
          </section>
        ) : widgetCount > 0 && (
          <section className="dash-widgets" style={{ '--cols': widgetCount, '--cols-md': Math.min(widgetCount, 3) }} aria-label="Widgets">
            {!pomoActive && <PomodoroMiniWidget st={pomo} userId={userId} onOpen={() => onNavigate('focus')} />}
            {isAdmin && <GeldMiniWidget userId={userId} onOpen={() => onNavigate('geld')} />}
          </section>
        )}

        {/* ── Deadlines, ongepland, regen ── */}
        {(deadlines.length > 0 || unplanned.length > 0 || showRain) && (
          <section className="dash-extra">
            {deadlines.length > 0 && (
              <Card pad={14} glow="danger" style={{ minWidth: 0 }}>
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
              <Card pad={14} glow="var(--cat-school)" style={{ minWidth: 0 }}>
                <CardHeader icon={Inbox} title="Nog in te plannen" count={unplanned.length}
                  action={<CardLink onClick={() => onNavigateToTasks?.('ongepland')}>Alle <ArrowRight size={13} /></CardLink>} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {unplanned.slice(0, lim.unplanned).map(t => (
                    <ListRow key={t.id} dot={categoryColor(taskCategory(t))} title={t.title}
                      trailing={subjectName(t.subject_id) && <span className="t-meta">{subjectName(t.subject_id)}</span>}
                      onClick={() => setDetailTask(t)} />
                  ))}
                  {unplanned.length > lim.unplanned && <p className="t-meta" style={{ margin: '2px 10px 0' }}>+{unplanned.length - lim.unplanned} meer</p>}
                </div>
              </Card>
            )}

            {showRain && <RainCard data={homeRain} onDismiss={dismissRain} />}
          </section>
        )}

        {/* Hoog scherm: vooruitblik op de komende dagen vult de rest van de hoogte */}
        {tall && (
          <Card pad={14} glow="var(--cat-persoonlijk)" className="dash-week" style={{ minWidth: 0 }}>
            <CardHeader icon={CalendarDays} title="Komende dagen"
              action={<CardLink onClick={() => onNavigateToAgenda?.(weekAhead[0]?.date || new Date())}>Agenda <ArrowRight size={13} /></CardLink>} />
            <div className="dash-week-grid">
              {weekAhead.map(({ date, items }) => (
                <div key={date.toDateString()} className="dash-week-day">
                  <p className="t-overline" style={{ margin: '0 0 6px', color: 'var(--c-text-3)' }}>
                    {date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {items.length === 0 ? (
                    <p className="t-meta" style={{ margin: 0, opacity: 0.6 }}>Niets gepland</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.slice(0, 8).map((it, i) => (
                        <ListRow key={i} dot={categoryColor(it.cat)} title={it.label}
                          trailing={<span className="t-meta tnum">{it.travelBefore ? `🚗 ${hhmm(new Date(it.ts - it.travelBefore * 60000))} · ` : ''}{hhmm(it.ts)}</span>}
                          onClick={() => openItem(it)} />
                      ))}
                      {items.length > 8 && <p className="t-meta" style={{ margin: '2px 10px 0' }}>+{items.length - 8} meer</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isDesktop && <SpotifyWidget compact />}

        {/* Mobiel: snelle actie onderaan (desktop heeft + in Vandaag en Ctrl K) */}
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
    <Card pad={14} tone="info" glow="info" style={{ minWidth: 0 }}>
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
