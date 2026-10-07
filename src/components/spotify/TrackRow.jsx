import React from 'react'
import { Play, Plus, ListMusic } from 'lucide-react'
import { artistNames, coverOf, formatMs } from './spotifyApi'

/** Nummer-rij: klik = afspelen, + = aan wachtrij. `active` = speelt nu. */
export function TrackRow({ track, onPlay, onQueue, active = false, index, showCover = true, showDuration = false }) {
  if (!track) return null
  const img = showCover ? coverOf(track, 'sm') : null
  return (
    <div className={`sp-row${active ? ' is-active' : ''}`}>
      <button type="button" className="sp-row__main" onClick={onPlay} title={`${track.name} afspelen`}>
        {index != null && <span className="sp-row__idx tnum">{index}</span>}
        {showCover && (img ? <img src={img} alt="" className="sp-row__img" /> : <span className="sp-row__img" />)}
        <span className="sp-row__text">
          <span className="sp-row__title">{track.name}</span>
          <span className="sp-row__sub">{artistNames(track)}</span>
        </span>
        <span className="sp-row__play" aria-hidden="true"><Play size={13} /></span>
      </button>
      {showDuration && <span className="sp-row__dur tnum">{formatMs(track.duration_ms)}</span>}
      {onQueue && (
        <button type="button" className="sp-row__btn" onClick={onQueue} aria-label={`${track.name} aan wachtrij toevoegen`} title="Aan wachtrij toevoegen">
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}

/** Tegel voor album / playlist / artiest. */
export function MediaTile({ item, sub, onOpen, round = false }) {
  if (!item) return null
  const img = coverOf(item)
  return (
    <button type="button" className="sp-tile" onClick={onOpen} title={item.name}>
      {img ? <img src={img} alt="" className={`sp-tile__img${round ? ' is-round' : ''}`} />
        : <span className={`sp-tile__img sp-tile__img--empty${round ? ' is-round' : ''}`}><ListMusic size={20} /></span>}
      <span className="sp-tile__name">{item.name}</span>
      {sub && <span className="sp-tile__sub">{sub}</span>}
    </button>
  )
}

export function Empty({ children }) {
  return <p className="t-meta" style={{ margin: 0, padding: '18px 4px', textAlign: 'center' }}>{children}</p>
}
