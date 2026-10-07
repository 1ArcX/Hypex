import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer, useLivePosition, player } from './usePlayer'

// Songtekst via LRCLIB (gratis, open, CORS) — Spotify heeft geen publieke lyrics-API.
// Gesynchroniseerde tekst loopt mee; klik op een regel = daarheen spoelen.

const LRCLIB = 'https://lrclib.net/api'
const memo = new Map()

function cacheGet(id) {
  if (memo.has(id)) return memo.get(id)
  try { const v = JSON.parse(sessionStorage.getItem('sp_lyrics_' + id)); if (v) { memo.set(id, v); return v } } catch {}
  return undefined
}
function cacheSet(id, v) {
  memo.set(id, v)
  try { sessionStorage.setItem('sp_lyrics_' + id, JSON.stringify(v)) } catch {}
}

// "Song - Remastered 2011" / "Song (feat. X)" → "Song" voor een tweede poging
const cleanTitle = (s) => s.replace(/\s*[-–]\s*(remaster|live|radio edit|mono|stereo|feat|from).*$/i, '').replace(/\s*\((feat|with|ft)\.?[^)]*\)/i, '').trim()

async function fetchLyrics(track) {
  const artist = track.artists?.[0]?.name || ''
  const base = { track_name: track.name, artist_name: artist, album_name: track.album?.name || '', duration: Math.round((track.duration_ms || 0) / 1000) }
  try {
    const r = await fetch(`${LRCLIB}/get?${new URLSearchParams(base)}`)
    if (r.ok) return await r.json()
    const s = await fetch(`${LRCLIB}/search?${new URLSearchParams({ track_name: cleanTitle(track.name), artist_name: artist })}`)
    if (!s.ok) return null
    const list = await s.json()
    const dur = base.duration
    // Liefst gesynchroniseerd en ongeveer even lang
    return list.find(x => x.syncedLyrics && Math.abs((x.duration || 0) - dur) <= 3) || list.find(x => x.syncedLyrics) || list[0] || null
  } catch { return null }
}

function parseLrc(text) {
  const lines = []
  for (const raw of (text || '').split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    if (!stamps.length) continue
    const words = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of stamps) lines.push({ t: (Number(m[1]) * 60 + Number(m[2])) * 1000, text: words })
  }
  return lines.sort((a, b) => a.t - b.t)
}

export default function LyricsView() {
  const { track } = usePlayer()
  const pos = useLivePosition(250)
  const [lyr, setLyr] = useState(undefined) // undefined = laden, null = niet gevonden
  const boxRef = useRef(null)
  const lastScroll = useRef(0)
  const userScrolledAt = useRef(0)

  useEffect(() => {
    if (!track?.id) { setLyr(null); return }
    const hit = cacheGet(track.id)
    if (hit !== undefined) { setLyr(hit); return }
    setLyr(undefined)
    let live = true
    fetchLyrics(track).then(d => {
      const v = d ? { synced: d.syncedLyrics || null, plain: d.plainLyrics || null, instrumental: !!d.instrumental } : null
      cacheSet(track.id, v)
      if (live) setLyr(v)
    })
    return () => { live = false }
  }, [track?.id])

  const lines = useMemo(() => parseLrc(lyr?.synced), [lyr?.synced])
  let active = -1
  for (let i = 0; i < lines.length; i++) { if (lines[i].t <= pos + 300) active = i; else break }

  // Actieve regel in het midden houden (binnen de kaart scrollen, niet de pagina) — behalve kort na zelf scrollen
  useEffect(() => {
    const box = boxRef.current
    if (!box || active < 0 || active === lastScroll.current) return
    lastScroll.current = active
    if (Date.now() - userScrolledAt.current < 4000) return
    const el = box.querySelector(`[data-line="${active}"]`)
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
  }, [active])

  const markUserScroll = () => { userScrolledAt.current = Date.now() }

  let body
  if (!track) body = <p className="sp-lyrics__msg">Speel iets af om de songtekst te zien.</p>
  else if (lyr === undefined) body = <p className="sp-lyrics__msg">Songtekst zoeken…</p>
  else if (!lyr) body = <p className="sp-lyrics__msg">Geen songtekst gevonden voor dit nummer.</p>
  else if (lyr.instrumental) body = <p className="sp-lyrics__msg">♪ Instrumentaal</p>
  else if (lines.length) body = lines.map((l, i) => (
    <button key={i} type="button" data-line={i} onClick={() => player.seek(l.t)}
      className={`sp-lyrics__line${i === active ? ' is-active' : i < active ? ' is-past' : ''}`}>
      {l.text || '♪'}
    </button>
  ))
  else body = <p className="sp-lyrics__plain">{lyr.plain}</p>

  return (
    <div className="sp-lyrics" ref={boxRef} onWheel={markUserScroll} onTouchMove={markUserScroll} aria-label="Songtekst">
      {body}
      {lyr && <p className="sp-lyrics__credit">Songtekst via LRCLIB</p>}
    </div>
  )
}
