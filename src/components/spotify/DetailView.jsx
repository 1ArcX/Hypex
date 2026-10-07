import React, { useEffect, useState } from 'react'
import { ArrowLeft, Play, Shuffle } from 'lucide-react'
import { sp, coverOf, artistNames } from './spotifyApi'
import { player, usePlayer } from './usePlayer'
import { TrackRow, MediaTile, Empty } from './TrackRow'

/**
 * Album, playlist of artiest openen: kop met hoes + Afspelen/Shuffle, daaronder de nummers.
 * Let op (API feb 2026): nummers van playlists alleen voor je eigen playlists; geen top-tracks
 * per artiest meer → nummers via zoeken op artiest.
 */
export default function DetailView({ item, onBack, onOpen }) {
  const st = usePlayer()
  const [tracks, setTracks] = useState(null)
  const [albums, setAlbums] = useState([])
  const [limited, setLimited] = useState(false)

  useEffect(() => {
    let live = true
    setTracks(null); setAlbums([]); setLimited(false)
    ;(async () => {
      if (item.type === 'album') {
        const r = await sp(`/albums/${item.id}`)
        const album = r.data
        if (live) setTracks((album?.tracks?.items || []).map(t => ({ ...t, album: { id: album.id, name: album.name, images: album.images } })))
      } else if (item.type === 'playlist') {
        const r = await sp(`/playlists/${item.id}/items`, { query: { limit: 50 } })
        const list = (r.data?.items || []).map(x => x.item || x.track).filter(t => t && t.type === 'track')
        if (live) { setTracks(list); setLimited(!r.ok || list.length === 0) }
      } else if (item.type === 'artist') {
        const [t, a] = await Promise.all([
          sp('/search', { query: { q: `artist:"${item.name}"`, type: 'track', limit: 10 } }),
          sp(`/artists/${item.id}/albums`, { query: { include_groups: 'album,single', limit: 10 } }),
        ])
        if (!live) return
        setTracks((t.data?.tracks?.items || []).filter(x => x && x.artists?.some(ar => ar.id === item.id)))
        setAlbums((a.data?.items || []).filter(Boolean))
      }
    })()
    return () => { live = false }
  }, [item.type, item.id, item.name])

  const img = coverOf(item, 'lg')
  const playTrack = (t) => item.type === 'artist'
    ? player.playUris(tracks.map(x => x.uri), t.uri)
    : player.playContext(item.uri, { offsetUri: t.uri })
  const sub = item.type === 'album' ? artistNames(item) : item.type === 'playlist' ? (item.owner?.display_name || 'Playlist') : 'Artiest'

  return (
    <div className="sp-detail">
      <button type="button" className="sp-back" onClick={onBack}><ArrowLeft size={14} /> Terug</button>
      <div className="sp-detail__head">
        {img ? <img src={img} alt="" className={`sp-detail__img${item.type === 'artist' ? ' is-round' : ''}`} /> : <span className="sp-detail__img" />}
        <div style={{ minWidth: 0 }}>
          <span className="t-overline" style={{ color: 'var(--c-text-3)' }}>{item.type === 'album' ? 'Album' : item.type === 'playlist' ? 'Playlist' : 'Artiest'}</span>
          <p className="sp-detail__name">{item.name}</p>
          <p className="sp-hero-sub" style={{ fontSize: 12 }}>{sub}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn-primary sp-pill" onClick={() => player.playContext(item.uri, { shuffle: false })}><Play size={14} /> Afspelen</button>
            <button type="button" className="btn-ghost sp-pill" onClick={() => player.playContext(item.uri, { shuffle: true })}><Shuffle size={14} /> Shuffle</button>
          </div>
        </div>
      </div>

      {tracks === null ? <Empty>Laden…</Empty>
        : limited ? <Empty>Spotify laat alleen de nummers van je eigen playlists zien. Afspelen werkt wel.</Empty>
        : tracks.length === 0 ? <Empty>Geen nummers gevonden.</Empty>
        : (
          <div className="sp-list">
            {item.type === 'artist' && <p className="sp-list-title">Nummers</p>}
            {tracks.map((t, i) => (
              <TrackRow key={t.id || i} track={t} index={item.type === 'album' ? i + 1 : undefined}
                showCover={item.type !== 'album'} showDuration active={st.track?.id === t.id}
                onPlay={() => playTrack(t)} onQueue={() => player.addToQueue(t)} />
            ))}
          </div>
        )}

      {albums.length > 0 && (
        <>
          <p className="sp-list-title" style={{ marginTop: 14 }}>Albums &amp; singles</p>
          <div className="sp-tiles">
            {albums.map(a => <MediaTile key={a.id} item={a} sub={a.release_date?.slice(0, 4)} onOpen={() => onOpen(a)} />)}
          </div>
        </>
      )}
    </div>
  )
}
