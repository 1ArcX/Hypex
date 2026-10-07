import { useFocusStore } from '../store/focusStore'
import { fmtDur, fmtWhen } from '../lib/format'
import { KIND_BY_ID, NO_COURSE } from '../lib/meta'
import { KindIcon, Stars } from './ui'
import type { Session } from '../types'

/** Lijst zoals "Recent Sessions": icoon (soort, in vakkleur), vak, notitie, ★, wanneer, duur */
export function SessionList({ sessions, onOpen, more }: {
  sessions: Session[]
  onOpen: (id: string) => void
  more?: { label: string; onClick: () => void }
}) {
  const courses = useFocusStore(s => s.courses)
  const topics = useFocusStore(s => s.topics)
  return (
    <div className="fx-card fx-list">
      {sessions.map(s => {
        const c = courses.find(x => x.id === s.course_id) || NO_COURSE
        const topic = topics.find(t => t.id === s.topic_id)
        const sub = s.note || [topic?.name, s.kind ? KIND_BY_ID[s.kind]?.label : null].filter(Boolean).join(' · ') || (s.timer_kind === 'manual' ? 'Handmatig toegevoegd' : 'Focussessie')
        return (
          <button key={s.id} type="button" className="fx-session" onClick={() => onOpen(s.id)}>
            <KindIcon kind={s.kind} color={c.color} />
            <div className="fx-session-main">
              <div className="fx-session-top"><span>{c.name}</span><span className="tnum">{fmtDur(s.duration_minutes)}</span></div>
              <div className="fx-session-note">{sub}</div>
              <div className="fx-session-bottom"><Stars value={s.rating} /><span>{fmtWhen(s.completed_at)}</span></div>
            </div>
          </button>
        )
      })}
      {more && <button type="button" className="fx-more" onClick={more.onClick}>{more.label}</button>}
    </div>
  )
}
