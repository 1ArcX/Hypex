import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Music, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, Volume2, VolumeX, History, ListMusic, Heart, Search, Library, Mic2, Disc3 } from 'lucide-react'
import { login, artistNames, coverOf, formatMs } from './spotify/spotifyApi'
import { player, usePlayer, useLivePosition, fetchRecent } from './spotify/usePlayer'
import { TrackRow, Empty } from './spotify/TrackRow'
import SearchView from './spotify/SearchView'
import LibraryView from './spotify/LibraryView'
import LyricsView from './spotify/LyricsView'

// Spotify-widget. Alle instanties delen één speler-store (spotify/usePlayer.js).
//  - compact: kleine kaart (mobiel dashboard, Focus playlist)
//  - variant="hero": "mini Spotify" op het desktop-dashboard — Nu / Zoeken / Bibliotheek,
//    met songtekst rechts als de kaart breed genoeg is (anders als 4e tab).

const GREEN = '#1DB954'
const ctrlStyle = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', color: 'var(--c-text-2)' }

function LoginPrompt({ text = 'Koppel je Spotify account om hier te zien wat er speelt.' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '12px 0' }}>
      <p className="t-meta" style={{ margin: 0 }}>{text}</p>
      <button onClick={login} className="btn-ghost" style={{ color: GREEN, borderColor: 'rgba(29,185,84,0.35)' }}>Inloggen met Spotify</button>
    </div>
  )
}

function Seek() {
  const st = usePlayer()
  const live = useLivePosition(1000)
  const [drag, setDrag] = useState(null)
  const dur = st.track?.duration_ms || 0
  const pos = drag ?? live
  const commit = (v) => { setDrag(null); player.seek(v) }
  return (
    <div className="sp-seek">
      <input type="range" min={0} max={dur || 1} step={1000} value={Math.min(pos, dur || 1)} aria-label="Positie in nummer"
        style={{ '--p': `${dur > 0 ? (pos / dur) * 100 : 0}%` }}
        onChange={e => setDrag(Number(e.target.value))}
        onPointerUp={e => commit(Number(e.currentTarget.value))}
        onKeyUp={e => commit(Number(e.currentTarget.value))} />
      <div className="sp-times tnum"><span>{formatMs(pos)}</span><span>{formatMs(dur)}</span></div>
    </div>
  )
}

function Controls({ big = true }) {
  const st = usePlayer()
  const canVolume = st.device && st.device.supports_volume !== false && st.volume !== null
  const s = big ? 20 : 16
  return (
    <div className="sp-controls">
      <button onClick={player.toggleShuffle} style={{ ...ctrlStyle, color: st.shuffle ? GREEN : 'var(--c-text-3)' }} aria-label="Shuffle" aria-pressed={st.shuffle} title="Shuffle"><Shuffle size={16} /></button>
      <button onClick={player.prev} style={ctrlStyle} aria-label="Vorige" title="Vorige"><SkipBack size={s} /></button>
      <button onClick={player.togglePlay} aria-label={st.isPlaying ? 'Pauzeren' : 'Afspelen'} title={st.isPlaying ? 'Pauzeren' : 'Afspelen'}
        className="btn-primary" style={{ width: big ? 48 : 40, height: big ? 48 : 40, padding: 0, borderRadius: '50%' }}>
        {st.isPlaying ? <Pause size={s} /> : <Play size={s} style={{ marginLeft: 2 }} />}
      </button>
      <button onClick={player.next} style={ctrlStyle} aria-label="Volgende" title="Volgende"><SkipForward size={s} /></button>
      <button onClick={player.cycleRepeat} style={{ ...ctrlStyle, color: st.repeat !== 'off' ? GREEN : 'var(--c-text-3)' }} aria-label={`Herhalen: ${st.repeat}`} title="Herhalen">
        {st.repeat === 'track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
      </button>
      {canVolume && (
        <div className="sp-volume">
          <button onClick={() => player.volume(st.volume > 0 ? 0 : 50)} style={{ ...ctrlStyle, width: 28, height: 28 }} aria-label={st.volume > 0 ? 'Dempen' : 'Geluid aan'} title={st.volume > 0 ? 'Dempen' : 'Geluid aan'}>
            {st.volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <input type="range" min={0} max={100} value={st.volume} aria-label="Volume" style={{ '--p': `${st.volume}%` }} onChange={e => player.volume(Number(e.target.value))} />
        </div>
      )}
    </div>
  )
}

function NowView({ queueLimit }) {
  const st = usePlayer()
  const { track } = st
  const lastPlayed = st.recent?.find(it => it.track?.id && it.track.id !== track?.id)?.track || null
  const shown = track || lastPlayed
  if (!shown) return <Empty>Niets aan het afspelen… Zoek iets of open je bibliotheek.</Empty>
  const cover = coverOf(shown, 'lg')
  const liked = track ? st.liked[track.id] : undefined
  const recent = (st.recent || []).map(it => it.track).filter((t, i, a) => t && t.id !== track?.id && a.findIndex(x => x?.id === t.id) === i).slice(0, 4)
  return (
    <>
      <div className="sp-hero-main">
        {cover ? <img className="sp-hero-cover" src={cover} alt="" /> : <div className="sp-hero-cover" style={{ background: 'var(--c-surface-2)' }} />}
        <div className="sp-hero-info">
          <span className="t-overline" style={{ color: track && st.isPlaying ? GREEN : 'var(--c-text-3)' }}>
            {track ? (st.isPlaying ? 'Nu aan het spelen' : 'Gepauzeerd') : 'Laatst afgespeeld'}
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
            <p className="sp-hero-title" style={{ flex: 1 }}>{shown.name}</p>
            {track && liked !== undefined && (
              <button type="button" onClick={() => player.toggleLike(track)} className="sp-like" aria-pressed={liked}
                aria-label={liked ? 'Uit Gelikte nummers halen' : 'Toevoegen aan Gelikte nummers'} title={liked ? 'Geliket' : 'Liken'}>
                <Heart size={18} fill={liked ? GREEN : 'none'} color={liked ? GREEN : 'currentColor'} />
              </button>
            )}
          </div>
          <p className="sp-hero-sub">{artistNames(shown)}</p>
          {shown.album?.name && <p className="sp-hero-sub" style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{shown.album.name}</p>}
          {track ? (<><Seek /><Controls /></>) : (
            <div style={{ marginTop: 14 }}>
              <button onClick={() => player.playTrack(shown)} className="btn-primary"><Play size={15} /> Afspelen</button>
            </div>
          )}
        </div>
      </div>

      <div className="sp-hero-lists">
        {track && st.queue.length > 0 && (
          <div style={{ minWidth: 0 }}>
            <p className="sp-list-title"><ListMusic size={12} aria-hidden="true" /> Wachtrij</p>
            <div className="sp-list">
              {st.queue.slice(0, queueLimit).map((t, i) => (
                <TrackRow key={`${t.id}-${i}`} track={t} index={i + 1} onPlay={() => player.playFromQueue(i)} onQueue={() => player.addToQueue(t)} />
              ))}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div style={{ minWidth: 0 }}>
            <p className="sp-list-title"><History size={12} aria-hidden="true" /> Laatst afgespeeld</p>
            <div className="sp-list">
              {recent.map(t => <TrackRow key={t.id} track={t} onPlay={() => player.playTrack(t)} onQueue={() => player.addToQueue(t)} />)}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/** Breedte van een element (voor de keuze songtekst naast de speler of als tab). */
function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

const TABS = [
  { id: 'nu', label: 'Nu', icon: Disc3 },
  { id: 'zoeken', label: 'Zoeken', icon: Search },
  { id: 'bieb', label: 'Bibliotheek', icon: Library },
  { id: 'tekst', label: 'Songtekst', icon: Mic2 },
]

function Hero({ title, className, queueLimit, style }) {
  const st = usePlayer()
  const ref = useRef(null)
  const wide = useWidth(ref) >= 760
  const [tab, setTabState] = useState(() => localStorage.getItem('sp_tab') || 'nu')
  const setTab = (t) => { setTabState(t); try { localStorage.setItem('sp_tab', t) } catch {} }
  const shownTab = wide && tab === 'tekst' ? 'nu' : tab

  // Laatst afgespeeld: bij laden en bij elk nieuw nummer
  const trackId = st.track?.id
  useEffect(() => { if (st.token) fetchRecent() }, [st.token, trackId])

  const cover = coverOf(st.track || st.recent?.[0]?.track, 'lg')
  return (
    <div ref={ref} className={`card sp-hero is-mini ${className}`} style={style}>
      {cover && <div className="sp-hero-bg" style={{ backgroundImage: `url(${cover})` }} aria-hidden="true" />}
      <div className="sp-hero-head">
        <Music size={15} style={{ color: GREEN }} aria-hidden="true" />
        <h3 className="t-card" style={{ margin: 0 }}>{title}</h3>
        {st.token && (
          <div className="sp-tabs" role="tablist" aria-label="Spotify">
            {TABS.filter(t => !(wide && t.id === 'tekst')).map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={shownTab === t.id} className={shownTab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
                <t.icon size={13} aria-hidden="true" /> <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}
        <span style={{ flex: 1 }} />
        {st.device?.name && <span className="t-meta sp-device">op {st.device.name}</span>}
        {st.token && <button onClick={player.logout} className="sp-link">Ontkoppelen</button>}
      </div>

      {st.notice && <p className="sp-notice" role="status">{st.notice}</p>}
      {st.token && st.reconnect && (
        <p className="sp-notice">Nieuw: zoeken in je bibliotheek en liken. <button className="sp-link" style={{ color: GREEN }} onClick={login}>Koppel opnieuw</button></p>
      )}

      {!st.token ? <LoginPrompt /> : st.authError && !st.track ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--c-danger)', flex: 1 }}>Spotify account niet geautoriseerd.</p>
          <button onClick={player.logout} className="btn-ghost">Ontkoppelen</button>
        </div>
      ) : (
        <div className={`sp-hero-body${wide ? ' is-wide' : ''}`}>
          <div className="sp-hero-pane">
            {shownTab === 'nu' && <NowView queueLimit={queueLimit} />}
            {shownTab === 'zoeken' && <SearchView />}
            {shownTab === 'bieb' && <LibraryView />}
            {shownTab === 'tekst' && <LyricsView />}
          </div>
          {wide && (
            <aside className="sp-hero-side" aria-label="Songtekst">
              <p className="sp-list-title"><Mic2 size={12} aria-hidden="true" /> Songtekst</p>
              <LyricsView />
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

function Compact({ title, className }) {
  const st = usePlayer()
  const pos = useLivePosition(1000)
  const { track } = st
  const dur = track?.duration_ms || 0
  const ctrl = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, color: 'var(--c-text-2)' }
  const img = coverOf(track)
  return (
    <div className={`card ${className}`} style={{ padding: 14, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Music size={15} style={{ color: GREEN }} aria-hidden="true" />
        <h3 className="t-card" style={{ margin: 0, flex: 1 }}>{title}</h3>
      </div>
      {st.notice && <p className="sp-notice" role="status" style={{ marginBottom: 8 }}>{st.notice}</p>}
      {!st.token ? <LoginPrompt text="Koppel je Spotify account" /> : track ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {img ? <img src={img} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--c-surface-2)', flexShrink: 0 }} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
              <p className="t-meta" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artistNames(track)}</p>
            </div>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'var(--c-surface-3)', margin: '12px 0 8px' }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'var(--c-text-2)', width: `${dur > 0 ? (pos / dur) * 100 : 0}%`, transition: 'width 1s linear' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 'auto' }}>
            <button onClick={player.prev} style={ctrl} aria-label="Vorige" title="Vorige"><SkipBack size={16} /></button>
            <button onClick={player.togglePlay} aria-label={st.isPlaying ? 'Pauzeren' : 'Afspelen'} title={st.isPlaying ? 'Pauzeren' : 'Afspelen'}
              className="btn-primary" style={{ width: 36, height: 36, padding: 0, borderRadius: '50%' }}>
              {st.isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
            </button>
            <button onClick={player.next} style={ctrl} aria-label="Volgende" title="Volgende"><SkipForward size={16} /></button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          {st.authError ? (
            <>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--c-danger)' }}>Spotify account niet geautoriseerd.</p>
              <button onClick={player.logout} className="btn-ghost">Ontkoppelen</button>
            </>
          ) : <p className="t-meta" style={{ margin: 0 }}>Niets aan het afspelen...</p>}
        </div>
      )}
    </div>
  )
}

export default function SpotifyWidget({ variant, compact = false, title = 'Spotify', className = '', queueLimit = 6, style }) {
  if (variant === 'hero') return <Hero title={title} className={className} queueLimit={queueLimit} style={style} />
  return <Compact title={title} className={className} />
}
