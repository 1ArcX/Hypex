import React, { useEffect, useRef, useState } from 'react'
import { Search, X, Clock, Play, Plus, ChevronRight } from 'lucide-react'
import { sp, artistNames, coverOf } from './spotifyApi'
import { player, usePlayer } from './usePlayer'
import { TrackRow, MediaTile, Empty } from './TrackRow'
import DetailView from './DetailView'
import { readRecent, addRecent, removeRecent, clearRecent } from './recentSearches'

// Zoeken in heel Spotify (max. 10 per soort sinds feb 2026). Album/playlist/artiest opent een detail.
// Een nummer uit de zoekresultaten start een eigen radio (aanbevolen nummers erachteraan).
// Zonder zoekterm: "Recent gezocht" (wat je vanuit zoeken afspeelde of opende).

const TYPE_LABEL = { track: 'Nummer', artist: 'Artiest', album: 'Album', playlist: 'Playlist' }

function RecentRow({ item, active, onPlay, onQueue, onOpen, onRemove }) {
  const img = coverOf(item, 'sm')
  const isTrack = item.type === 'track'
  const sub = isTrack ? `${TYPE_LABEL.track} · ${artistNames(item)}`
    : item.type === 'album' ? `${TYPE_LABEL.album} · ${artistNames(item)}`
    : item.type === 'playlist' ? `${TYPE_LABEL.playlist}${item.owner?.display_name ? ` · ${item.owner.display_name}` : ''}`
    : TYPE_LABEL.artist
  return (
    <div className={`sp-row${active ? ' is-active' : ''}`}>
      <button type="button" className="sp-row__main" onClick={isTrack ? onPlay : onOpen} title={isTrack ? `${item.name} afspelen` : `${item.name} openen`}>
        {img ? <img src={img} alt="" className={`sp-row__img${item.type === 'artist' ? ' is-round' : ''}`} /> : <span className="sp-row__img" />}
        <span className="sp-row__text">
          <span className="sp-row__title">{item.name}</span>
          <span className="sp-row__sub">{sub}</span>
        </span>
        <span className="sp-row__play" aria-hidden="true">{isTrack ? <Play size={13} /> : <ChevronRight size={14} />}</span>
      </button>
      {isTrack && (
        <button type="button" className="sp-row__btn" onClick={onQueue} aria-label={`${item.name} aan wachtrij toevoegen`} title="Aan wachtrij toevoegen"><Plus size={14} /></button>
      )}
      <button type="button" className="sp-row__btn" onClick={onRemove} aria-label={`${item.name} uit recent gezocht halen`} title="Weghalen"><X size={14} /></button>
    </div>
  )
}
export default function SearchView() {
  const st = usePlayer()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stack, setStack] = useState([]) // geopende details (terug = pop)
  const [recent, setRecent] = useState(readRecent)
  const inputRef = useRef(null)
  const remember = (item) => setRecent(addRecent(item))

  // Alleen focussen als je net zelf op de tab klikte (niet bij het laden van het dashboard)
  useEffect(() => { if (document.activeElement?.closest('.sp-tabs')) inputRef.current?.focus({ preventScroll: true }) }, [])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setRes(null); setLoading(false); return }
    setLoading(true)
    let live = true
    const t = setTimeout(async () => {
      const r = await sp('/search', { query: { q: term, type: 'track,album,artist,playlist', limit: 8 } })
      if (!live) return
      setLoading(false)
      setRes(r.ok ? {
        tracks: (r.data?.tracks?.items || []).filter(Boolean),
        albums: (r.data?.albums?.items || []).filter(Boolean),
        artists: (r.data?.artists?.items || []).filter(Boolean),
        playlists: (r.data?.playlists?.items || []).filter(Boolean),
      } : { error: true })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  const open = (item) => setStack(s => [...s, item])
  const openFromSearch = (item) => { remember(item); open(item) }
  const playFromSearch = (t) => { remember(t); player.playRadio(t) }
  const queueFromSearch = (t) => { remember(t); player.addToQueue(t) }
  if (stack.length) return <DetailView item={stack[stack.length - 1]} onBack={() => setStack(s => s.slice(0, -1))} onOpen={open} />

  const empty = res && !res.error && !res.tracks.length && !res.albums.length && !res.artists.length && !res.playlists.length
  return (
    <div className="sp-search">
      <label className="sp-search__field">
        <Search size={15} aria-hidden="true" />
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Nummers, artiesten, albums, playlists"
          aria-label="Zoek in Spotify" onKeyDown={e => { if (e.key === 'Escape') setQ('') }} />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Wissen" className="sp-row__btn"><X size={14} /></button>}
      </label>

      {!q.trim() ? (
        recent.length ? (
          <section>
            <div className="sp-recent-head">
              <p className="sp-list-title" style={{ margin: 0 }}><Clock size={12} aria-hidden="true" /> Recent gezocht</p>
              <button type="button" className="sp-link" onClick={() => setRecent(clearRecent())}>Wis alles</button>
            </div>
            <div className="sp-list">
              {recent.map(it => (
                <RecentRow key={it.uri} item={it} active={st.track?.id === it.id}
                  onPlay={() => playFromSearch(it)} onQueue={() => queueFromSearch(it)}
                  onOpen={() => openFromSearch(it)} onRemove={() => setRecent(removeRecent(it.uri))} />
              ))}
            </div>
          </section>
        ) : <Empty>Zoek iets om af te spelen of aan je wachtrij toe te voegen.</Empty>
      )
        : loading && !res ? <Empty>Zoeken…</Empty>
        : res?.error ? <Empty>Zoeken lukte niet. Probeer het opnieuw.</Empty>
        : empty ? <Empty>Niets gevonden voor "{q}".</Empty>
        : res && (
          <>
            {res.tracks.length > 0 && (
              <section>
                <p className="sp-list-title">Nummers</p>
                <div className="sp-list">
                  {res.tracks.map(t => (
                    <TrackRow key={t.id} track={t} showDuration active={st.track?.id === t.id}
                      onPlay={() => playFromSearch(t)} onQueue={() => queueFromSearch(t)} />
                  ))}
                </div>
              </section>
            )}
            {res.artists.length > 0 && (
              <section>
                <p className="sp-list-title">Artiesten</p>
                <div className="sp-tiles">{res.artists.map(a => <MediaTile key={a.id} item={a} round onOpen={() => openFromSearch(a)} />)}</div>
              </section>
            )}
            {res.albums.length > 0 && (
              <section>
                <p className="sp-list-title">Albums</p>
                <div className="sp-tiles">{res.albums.map(a => <MediaTile key={a.id} item={a} sub={artistNames(a)} onOpen={() => openFromSearch(a)} />)}</div>
              </section>
            )}
            {res.playlists.length > 0 && (
              <section>
                <p className="sp-list-title">Playlists</p>
                <div className="sp-tiles">{res.playlists.map(p => <MediaTile key={p.id} item={p} sub={p.owner?.display_name} onOpen={() => openFromSearch(p)} />)}</div>
              </section>
            )}
          </>
        )}
    </div>
  )
}
