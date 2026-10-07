import React, { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { sp, hasScope, login, artistNames } from './spotifyApi'
import { player, usePlayer } from './usePlayer'
import { TrackRow, MediaTile, Empty } from './TrackRow'
import DetailView from './DetailView'

const KINDS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'albums', label: 'Albums' },
  { id: 'liked', label: 'Gelikt' },
]
// Per paginalading bewaren, zodat wisselen tussen tabs niet steeds opnieuw laadt
const cache = {}

export default function LibraryView() {
  const st = usePlayer()
  const [kind, setKind] = useState(() => sessionStorage.getItem('sp_lib_kind') || 'playlists')
  const [data, setData] = useState(() => cache[kind] || null)
  const [stack, setStack] = useState([])
  const allowed = hasScope('user-library-read') && hasScope('playlist-read-private')

  useEffect(() => {
    try { sessionStorage.setItem('sp_lib_kind', kind) } catch {}
    if (!allowed) return
    if (cache[kind]) { setData(cache[kind]); return }
    setData(null)
    let live = true
    ;(async () => {
      let list = []
      if (kind === 'playlists') list = ((await sp('/me/playlists', { query: { limit: 50 } })).data?.items || []).filter(Boolean)
      if (kind === 'albums') list = ((await sp('/me/albums', { query: { limit: 50 } })).data?.items || []).map(x => x.album).filter(Boolean)
      if (kind === 'liked') list = ((await sp('/me/tracks', { query: { limit: 50 } })).data?.items || []).map(x => x.track).filter(Boolean)
      cache[kind] = list
      if (live) setData(list)
    })()
    return () => { live = false }
  }, [kind, allowed])

  const open = (item) => setStack(s => [...s, item])
  if (stack.length) return <DetailView item={stack[stack.length - 1]} onBack={() => setStack(s => s.slice(0, -1))} onOpen={open} />

  if (!allowed) return (
    <div style={{ padding: '18px 4px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <p className="t-meta" style={{ margin: 0 }}>Koppel Spotify één keer opnieuw om je playlists, albums en gelikte nummers hier te zien.</p>
      <button type="button" className="btn-ghost" onClick={login} style={{ color: '#1DB954', borderColor: 'rgba(29,185,84,0.35)' }}>Opnieuw koppelen</button>
    </div>
  )

  return (
    <div className="sp-library">
      <div className="sp-seg" role="tablist" aria-label="Bibliotheek">
        {KINDS.map(k => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'is-on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
        ))}
      </div>

      {data === null ? <Empty>Laden…</Empty>
        : data.length === 0 ? <Empty>Nog niets in je bibliotheek.</Empty>
        : kind === 'liked' ? (
          <div className="sp-list">
            <button type="button" className="btn-primary sp-pill" style={{ alignSelf: 'flex-start', marginBottom: 6 }}
              onClick={() => player.playUris(data.map(t => t.uri))}><Heart size={14} /> Speel gelikte nummers</button>
            {data.map(t => (
              <TrackRow key={t.id} track={t} showDuration active={st.track?.id === t.id}
                onPlay={() => player.playUris(data.map(x => x.uri), t.uri)} onQueue={() => player.addToQueue(t)} />
            ))}
          </div>
        ) : (
          <div className="sp-tiles sp-tiles--grid">
            {data.map(item => (
              <MediaTile key={item.id} item={item} onOpen={() => open(item)}
                sub={kind === 'albums' ? artistNames(item) : item.owner?.display_name} />
            ))}
          </div>
        )}
    </div>
  )
}
