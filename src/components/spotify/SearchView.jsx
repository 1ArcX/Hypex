import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { sp, artistNames } from './spotifyApi'
import { player, usePlayer } from './usePlayer'
import { TrackRow, MediaTile, Empty } from './TrackRow'
import DetailView from './DetailView'

// Zoeken in heel Spotify (max. 10 per soort sinds feb 2026). Album/playlist/artiest opent een detail.
export default function SearchView() {
  const st = usePlayer()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stack, setStack] = useState([]) // geopende details (terug = pop)
  const inputRef = useRef(null)

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

      {!q.trim() ? <Empty>Zoek iets om af te spelen of aan je wachtrij toe te voegen.</Empty>
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
                      onPlay={() => player.playTrack(t)} onQueue={() => player.addToQueue(t)} />
                  ))}
                </div>
              </section>
            )}
            {res.artists.length > 0 && (
              <section>
                <p className="sp-list-title">Artiesten</p>
                <div className="sp-tiles">{res.artists.map(a => <MediaTile key={a.id} item={a} round onOpen={() => open(a)} />)}</div>
              </section>
            )}
            {res.albums.length > 0 && (
              <section>
                <p className="sp-list-title">Albums</p>
                <div className="sp-tiles">{res.albums.map(a => <MediaTile key={a.id} item={a} sub={artistNames(a)} onOpen={() => open(a)} />)}</div>
              </section>
            )}
            {res.playlists.length > 0 && (
              <section>
                <p className="sp-list-title">Playlists</p>
                <div className="sp-tiles">{res.playlists.map(p => <MediaTile key={p.id} item={p} sub={p.owner?.display_name} onOpen={() => open(p)} />)}</div>
              </section>
            )}
          </>
        )}
    </div>
  )
}
