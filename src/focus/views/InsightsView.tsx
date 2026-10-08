import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { dayPart, hourDistribution, inRange, peakWindow, ratingInsights, streamByCourse, RANGE_LABELS, type Range } from '../lib/stats'
import { DAYS_LONG, fmtDec, fmtHours } from '../lib/format'
import { StreamByCourse } from '../charts/charts'
import { RadialClock } from '../charts/svgCharts'
import { Dropdown } from '../components/ui'

const RANGES: { id: Range; label: string }[] = (['all', '7d', '30d', '90d', '1y'] as Range[]).map(id => ({ id, label: RANGE_LABELS[id] }))

export function InsightsView() {
  const sessions = useFocusStore(s => s.sessions)
  const courses = useFocusStore(s => s.courses)
  const [r1, setR1] = useState<Range>('all')
  const [r2, setR2] = useState<Range>('all')
  const [info, setInfo] = useState<string | null>(null)

  const stream = useMemo(() => streamByCourse(sessions, courses, r1), [sessions, courses, r1])
  const whenSessions = useMemo(() => inRange(sessions, r2), [sessions, r2])
  const hist = useMemo(() => hourDistribution(whenSessions), [whenSessions])
  const peak = useMemo(() => peakWindow(hist), [hist])
  const rating = useMemo(() => ratingInsights(inRange(sessions, r2)), [sessions, r2])
  const top = stream.series[0]

  if (sessions.length === 0) {
    return (
      <div className="fx-page">
        <div className="fx-top" />
        <h1 className="fx-h1">Inzichten</h1>
        <div className="fx-card fx-empty"><h3>Nog niets te zien</h3>Rond een paar sessies af; dan zie je hier waar je tijd heen gaat en wanneer je het best studeert.</div>
      </div>
    )
  }

  return (
    <div className="fx-page">
      <div className="fx-top" />
      <h1 className="fx-h1">Inzichten</h1>

      {/* Waar je tijd heen ging */}
      <div className="fx-cols"><div className="fx-col">
      <section className="fx-section" style={{ marginTop: 8 }}>
        <div className="fx-section-head" style={{ alignItems: 'flex-start', marginBottom: 0 }}>
          <div style={{ minWidth: 0 }}>
            <InfoLabel text="Waar je tijd heen ging" onInfo={() => setInfo(info === 'where' ? null : 'where')} />
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, marginTop: 2 }}>{top?.name || '–'}</div>
            {top && <div className="fx-label tnum">{Math.round(top.share * 100)}% van {fmtHours(stream.total)}</div>}
          </div>
          <Dropdown value={r1} options={RANGES} onChange={setR1} label="Periode" />
        </div>
        {info === 'where' && <p className="fx-banner">Je studietijd per vak over de tijd. Hoe dikker de laag, hoe meer tijd je in die periode aan dat vak besteedde.</p>}
        {stream.series.length > 0 && <StreamByCourse buckets={stream.buckets} series={stream.series} />}
        <div className="fx-legend-inline">
          {stream.series.map(s => (
            <span key={s.id}><i style={{ background: s.color }} />{s.name} <span className="fx-faint tnum">{Math.round(s.share * 100)}%</span></span>
          ))}
        </div>
      </section>

      {/* Wanneer je studeert */}
      </div><div className="fx-col">
      <section className="fx-section fx-section--side" style={{ marginTop: 40 }}>
        <div className="fx-section-head" style={{ alignItems: 'flex-start', marginBottom: 0 }}>
          <div>
            <InfoLabel text="Wanneer je studeert" onInfo={() => setInfo(info === 'when' ? null : 'when')} />
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, marginTop: 2 }}>{peak.total ? dayPart(hist) : '–'}</div>
            <div className="fx-label tnum">{fmtHours(peak.total)} gelogd</div>
          </div>
          <Dropdown value={r2} options={RANGES} onChange={setR2} label="Periode" />
        </div>
        {info === 'when' && <p className="fx-banner">Elke balk is een uur van de dag; hoe langer, hoe meer je dan studeerde. In het midden staat je drukste blok van 2 uur.</p>}
        <div style={{ marginTop: 6 }}><RadialClock hist={hist} peak={peak} /></div>
      </section>

      {/* Piekdagen en -uren (op basis van ★) */}
      </div></div>
      <section className="fx-section" style={{ marginTop: 34 }}>
        <h2 className="fx-h2" style={{ marginBottom: 12 }}>Wanneer je het best focust</h2>
        {rating.rated < 3 ? (
          <div className="fx-card is-pad fx-muted">Geef je sessies een score (★) na het studeren. Na een paar sessies zie je hier je beste dag en uren.</div>
        ) : (
          <div className="fx-tiles is-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="fx-tile is-lav">
              <span>Beste dag</span>
              <b style={{ textTransform: 'capitalize' }}>{rating.bestDay ? DAYS_LONG[rating.bestDay.key] : '–'}</b>
              {rating.bestDay && <span className="tnum">★ {fmtDec(rating.bestDay.avg)} gemiddeld</span>}
            </div>
            <div className="fx-tile is-mint">
              <span>Beste uren</span>
              <b className="tnum">{rating.bestHours ? `${rating.bestHours.key}–${rating.bestHours.key + 2}u` : '–'}</b>
              {rating.bestHours && <span className="tnum">★ {fmtDec(rating.bestHours.avg)} gemiddeld</span>}
            </div>
          </div>
        )}
        {rating.days.length > 1 && (
          <div className="fx-card is-pad" style={{ marginTop: 12 }}>
            {[1, 2, 3, 4, 5, 6, 0].map(d => {
              const row = rating.days.find(x => x.key === d)
              return (
                <div key={d} className="fx-dayrate">
                  <span>{DAYS_LONG[d].slice(0, 2)}</span>
                  <span className="fx-dayrate-bar"><i style={{ width: `${row ? (row.avg / 5) * 100 : 0}%` }} /></span>
                  <span className="tnum fx-muted">{row ? fmtDec(row.avg) : '–'}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoLabel({ text, onInfo }: { text: string; onInfo: () => void }) {
  return (
    <button type="button" onClick={onInfo} className="fx-label" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {text} <Info size={16} />
    </button>
  )
}
