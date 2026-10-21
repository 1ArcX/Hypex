import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card, CardHeader, FilterTabs, IconButton, Pill } from '../ui'
import { supabase } from '../../supabaseClient'
import { loadExternalEvents } from '../../utils/externalEvents'
import { periodOf, shiftPeriod, weekOf, shiftWeek, isoWeek, workShifts, sumHours, fmtHours } from '../../utils/workHours'

// Dashboard-kaart "Werkuren": uren per week (ma–zo) en per periode (25e t/m 24e, zie utils/workHours.js).
// Diensten komen uit de agenda: alles van het type Werk (bv. de WDK-feed met standaardtype Werk),
// of één gekozen feed. Laadt zelf de items van de vorige periode t/m de getoonde, want het dashboard
// heeft alleen items vanaf gisteren.

const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
const read = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch { /* privémodus */ } }
const iso = (d) => d.toISOString()
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Data + bediening van de kaart; DashboardPage gebruikt `visible` om de kaart wel/niet te tonen. */
export function useWorkHours(userId) {
  const [view, setViewState] = useState(() => read('work_hours_view', 'week'))
  const [source, setSourceState] = useState(() => read('work_hours_source', 'type'))
  const [dismissed, setDismissed] = useState(() => read('work_hours_hint_hidden', '') === '1')
  const [anchor, setAnchor] = useState(() => new Date())
  const [win, setWin] = useState(null) // { from, to, events }
  const winRef = useRef(null)

  const range = view === 'week' ? weekOf(anchor) : periodOf(anchor)
  const prev = view === 'week' ? shiftWeek(range, -1) : shiftPeriod(range, -1)

  const load = useCallback(async (from, to) => {
    const [ext, own] = await Promise.all([
      loadExternalEvents({ since: iso(from), until: iso(to) }),
      userId ? supabase.from('calendar_events').select('*').eq('user_id', userId).gte('start_time', iso(from)).lte('start_time', iso(to)) : { data: [] },
    ])
    const next = { from, to, events: [...(own?.data || []), ...(ext || [])] }
    winRef.current = next
    setWin(next)
  }, [userId])

  // Venster: vorige periode t/m eind van de huidige (+ een week marge); groter maken bij bladeren
  useEffect(() => {
    const today = periodOf(new Date())
    const want = {
      from: new Date(Math.min(+prev.from, +shiftPeriod(today, -1).from) - 7 * 86400000),
      to: new Date(Math.max(+range.to, +today.to) + 8 * 86400000),
    }
    const cur = winRef.current
    if (cur && cur.from <= want.from && cur.to >= want.to) return
    load(cur ? new Date(Math.min(+cur.from, +want.from)) : want.from, cur ? new Date(Math.max(+cur.to, +want.to)) : want.to)
  }, [+prev.from, +range.to, load]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reload = () => { const c = winRef.current; if (c) load(c.from, c.to) }
    window.addEventListener('refreshExternalCalendarEvents', reload)
    window.addEventListener('refreshCalendarEvents', reload)
    return () => {
      window.removeEventListener('refreshExternalCalendarEvents', reload)
      window.removeEventListener('refreshCalendarEvents', reload)
    }
  }, [load])

  const shifts = useMemo(() => workShifts(win?.events, source), [win, source])
  const feeds = useMemo(() => {
    const m = new Map()
    for (const ev of win?.events || []) if (ev.connection?.id) m.set(ev.connection.id, ev.connection)
    return [...m.values()]
  }, [win])
  const now = new Date()
  const cur = useMemo(() => sumHours(shifts, range.from, range.to, now), [shifts, +range.from, view]) // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => sumHours(shifts, prev.from, prev.to, now), [shifts, +prev.from, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasWork = shifts.length > 0
  return {
    ready: !!win, visible: !!win && (hasWork || (!dismissed && feeds.length > 0)), hasWork,
    view, range, cur, before, source, feeds,
    setView: (v) => { setViewState(v); write('work_hours_view', v) },
    setSource: (v) => { setSourceState(v); write('work_hours_source', v) },
    step: (n) => setAnchor(view === 'week' ? shiftWeek(range, n).from : shiftPeriod(range, n).from),
    toToday: () => setAnchor(new Date()),
    dismiss: () => { setDismissed(true); write('work_hours_hint_hidden', '1') },
  }
}

export default function WorkHoursCard({ work, onOpenAgenda }) {
  const { view, range, cur, before, hasWork, feeds, source } = work
  const isWeek = view === 'week'
  const today = new Date()
  const isCurrent = today >= range.from && today < new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1)
  const delta = cur.totalMin - before.totalMin

  // Staven: per dag (week) of per week (periode)
  const bars = useMemo(() => {
    if (isWeek) return cur.days.map((d, i) => ({ key: i, label: DAYS[i], date: d.date, min: d.min, worked: d.workedMin, today: isSameDay(d.date, today) }))
    const weeks = []
    for (const d of cur.days) {
      const w = isoWeek(d.date)
      let b = weeks[weeks.length - 1]
      if (!b || b.week !== w) weeks.push(b = { key: w, week: w, label: `wk ${w}`, date: d.date, min: 0, worked: 0, today: false })
      b.min += d.min; b.worked += d.workedMin
      if (isSameDay(d.date, today)) b.today = true
    }
    return weeks
  }, [cur, isWeek]) // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(60, ...bars.map(b => b.min))

  return (
    <Card pad={14} glow="var(--cat-werk)" style={{ minWidth: 0 }}>
      <CardHeader icon={Briefcase} title="Werkuren" tone="var(--cat-werk)"
        action={<FilterTabs variant="segmented" label="Weergave werkuren" value={view} onChange={work.setView}
          items={[{ value: 'week', label: 'Week' }, { value: 'period', label: 'Periode' }]} />} />

      {/* Navigatie */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <IconButton icon={ChevronLeft} label={isWeek ? 'Vorige week' : 'Vorige periode'} size={26} onClick={() => work.step(-1)} />
        <button type="button" onClick={work.toToday} title="Naar vandaag" className="t-meta tnum"
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isCurrent ? 'var(--c-text)' : 'var(--c-text-2)', fontWeight: 600, fontSize: 12, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {range.label}{isCurrent ? '' : ' · naar nu'}
        </button>
        <IconButton icon={ChevronRight} label={isWeek ? 'Volgende week' : 'Volgende periode'} size={26} onClick={() => work.step(1)} />
      </div>

      {!hasWork ? (
        // Nog geen werk-items: uitleg + bron kiezen
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="t-meta" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
            Geen diensten gevonden. Zet bij <b>Agenda's koppelen</b> het standaardtype van je WDK-feed op <b>Werk</b>, of kies hier de feed met je rooster.
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select className="glass-input" aria-label="Bron van je rooster" value={source} onChange={e => work.setSource(e.target.value)}
              style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '6px 8px', colorScheme: 'dark' }}>
              <option value="type">Alles van het type Werk</option>
              {feeds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <IconButton icon={X} label="Kaart verbergen" size={28} onClick={work.dismiss} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="t-kpi tnum" style={{ color: 'var(--c-text)' }}>{fmtHours(cur.totalMin)}</span>
            {(cur.totalMin || before.totalMin) ? (
              <Pill tone={delta > 0 ? 'success' : delta < 0 ? 'warning' : 'neutral'}
                title={`${isWeek ? 'Vorige week' : 'Vorige periode'}: ${fmtHours(before.totalMin)}`}>
                {delta === 0 ? 'gelijk' : `${delta > 0 ? '↑' : '↓'} ${fmtHours(delta)}`} t.o.v. vorige {isWeek ? 'week' : 'periode'}
              </Pill>
            ) : null}
          </div>
          <p className="t-meta tnum" style={{ margin: '2px 0 10px', fontSize: 12 }}>
            {cur.count} {cur.count === 1 ? 'dienst' : 'diensten'}
            {cur.workedMin > 0 && cur.plannedMin > 0 ? ` · ${fmtHours(cur.workedMin)} gewerkt · ${fmtHours(cur.plannedMin)} nog gepland` : cur.plannedMin > 0 && cur.totalMin ? ' · gepland' : ''}
          </p>

          {/* Staven: gewerkt = vol, nog gepland = licht */}
          <div role="list" aria-label={isWeek ? 'Uren per dag' : 'Uren per week'}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 96 }}>
            {bars.map(b => {
              const h = (b.min / max) * 64
              const workedH = b.min ? (b.worked / b.min) * h : 0
              return (
                <button key={b.key} type="button" role="listitem" onClick={() => onOpenAgenda?.(b.date)}
                  title={`${isWeek ? b.date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }) : `Week ${b.week}`}: ${b.min ? fmtHours(b.min) : 'vrij'}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%', minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <span className="tnum" style={{ fontSize: 10, fontWeight: 600, color: b.min ? 'var(--c-text-2)' : 'transparent', whiteSpace: 'nowrap' }}>
                    {b.min ? fmtHours(b.min).replace(/ 00m$/, '') : '·'}
                  </span>
                  <span aria-hidden="true" style={{ position: 'relative', width: '100%', maxWidth: 30, height: Math.max(3, h), borderRadius: 5, overflow: 'hidden',
                    background: b.min ? 'color-mix(in srgb, var(--cat-werk) 28%, transparent)' : 'var(--c-surface-3)',
                    outline: b.today ? '1.5px solid color-mix(in srgb, var(--cat-werk) 70%, white)' : 'none', outlineOffset: 1 }}>
                    <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: workedH, background: 'var(--cat-werk)' }} />
                  </span>
                  <span style={{ fontSize: 10, fontWeight: b.today ? 700 : 500, color: b.today ? 'var(--cat-werk)' : 'var(--c-text-3)', whiteSpace: 'nowrap' }}>{b.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
