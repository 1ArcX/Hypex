import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Flame, MoreHorizontal, Settings } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { useFocusProgress } from '../../hooks/useFocusProgress'
import { overview, volume, RANGE_LABELS, type Range } from '../lib/stats'
import { fmtDec, fmtDur, fmtHours } from '../lib/format'
import { VolumeArea } from '../charts/charts'
import { ActionMenu, Delta, Dropdown } from '../components/ui'
import { SessionList } from '../components/SessionList'

type VolRange = Exclude<Range, 'all'>
const VOL_OPTIONS: { id: VolRange; label: string }[] = (['7d', '30d', '90d', '1y'] as VolRange[]).map(id => ({ id, label: RANGE_LABELS[id] }))

export function HomeView({ userId, onSettings, onAddSession, onNewCourse, onOpenSession }: {
  userId: string
  onSettings: () => void
  onAddSession: () => void
  onNewCourse: () => void
  onOpenSession: (id: string) => void
}) {
  const sessions = useFocusStore(s => s.sessions)
  const courses = useFocusStore(s => s.courses)
  const progress = useFocusProgress(userId)
  const ov = useMemo(() => overview(sessions, courses), [sessions, courses])
  const [range, setRange] = useState<VolRange>('7d')
  const vol = useMemo(() => volume(sessions, range), [sessions, range])
  const [recentOpen, setRecentOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // Vandaag/week uit de voortgangsstore (telt ook sessies van dit apparaat die nog niet in de DB staan)
  const todayMins = Math.max(progress.todayMins, ov.todayMins)
  const weekMins = Math.max(progress.week, ov.weekMins)

  return (
    <div className="fx-page">
      <div className="fx-top">
        <div className="fx-pillbtns">
          <button type="button" className="fx-iconbtn" onClick={onSettings} aria-label="Instellingen"><Settings size={22} strokeWidth={2.2} /></button>
          <ActionMenu
            trigger={<button type="button" className="fx-iconbtn" aria-label="Meer"><MoreHorizontal size={22} /></button>}
            items={[{ label: 'Sessie toevoegen', onClick: onAddSession }, { label: 'Nieuw vak', onClick: onNewCourse }]} />
        </div>
      </div>

      <h1 className="fx-h1">Overzicht</h1>

      <div className="fx-cols"><div className="fx-col">

      <div className="fx-hero">
        <div>
          <div className="fx-label">Huidige streak</div>
          <div className="fx-streak tnum">
            {progress.streak}
            <Flame color="var(--fx-orange)" fill={progress.streak > 0 ? 'var(--fx-orange)' : 'none'} strokeWidth={1.8} style={{ opacity: progress.streak > 0 ? 1 : 0.5 }} />
          </div>
          <div className="fx-label">Langste: <b style={{ color: 'var(--fx-text-2)' }} className="tnum">{Math.max(progress.longest, progress.streak)} {Math.max(progress.longest, progress.streak) === 1 ? 'dag' : 'dagen'}</b></div>
          {progress.atRisk && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--fx-orange)', fontWeight: 600 }}>Studeer vandaag om je streak te houden</div>}
        </div>
        <div className="fx-hero-right">
          <div className="fx-label">Vandaag</div>
          <div className="fx-big tnum">{fmtDur(todayMins)}</div>
          <div className="fx-label">Deze week: <b style={{ color: 'var(--fx-text-2)' }} className="tnum">{fmtDur(weekMins)}</b></div>
        </div>
      </div>

      <div className="fx-tiles">
        <div className="fx-tile is-pink"><b className="tnum">{fmtHours(ov.totalMins)}</b><span>Studietijd</span></div>
        <div className="fx-tile is-beige"><b className="tnum">{ov.count}</b><span>Sessies</span></div>
        <div className="fx-tile is-lav"><b className="tnum">{ov.avgRating != null ? fmtDec(ov.avgRating) : '–'}</b><span>Gem. productiviteit</span></div>
        <div className="fx-tile is-mint"><b className="tnum">{ov.activeCourses}</b><span>Actieve vakken</span></div>
      </div>

      <div className="fx-section">
        <div className="fx-section-head" style={{ alignItems: 'flex-start', marginBottom: 0 }}>
          <div>
            <div className="fx-label">Studievolume</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
              <span className="tnum" style={{ fontSize: 30, fontWeight: 800 }}>{fmtHours(vol.total)}</span>
              <span style={{ fontSize: 18 }}><Delta value={vol.delta} suffix="t.o.v. de periode ervoor" /></span>
            </div>
          </div>
          <Dropdown value={range} options={VOL_OPTIONS} onChange={setRange} label="Periode studievolume" />
        </div>
        <VolumeArea points={vol.points} />
      </div>

      </div><div className="fx-col">
      <div className="fx-section fx-section--side">
        <button type="button" className="fx-section-head" onClick={() => setRecentOpen(o => !o)}
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }} aria-expanded={recentOpen}>
          <h2 className="fx-h2">Recente sessies</h2>
          {recentOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
        </button>
        {recentOpen && (
          sessions.length === 0
            ? <div className="fx-card fx-empty"><h3>Nog geen sessies</h3>Start de timer rechtsonder of voeg een sessie toe via ⋯.</div>
            : <SessionList sessions={showAll ? sessions.slice(0, 50) : sessions.slice(0, 5)} onOpen={onOpenSession}
                more={sessions.length > 5 ? { label: showAll ? 'Minder tonen' : `Toon meer (${Math.min(50, sessions.length) - 5})`, onClick: () => setShowAll(v => !v) } : undefined} />
        )}
      </div>
      </div></div>
    </div>
  )
}
