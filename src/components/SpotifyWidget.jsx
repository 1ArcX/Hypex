import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Music, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1 } from 'lucide-react'

// =====================================================
// VITE_SPOTIFY_CLIENT_ID moet in je .env staan:
// VITE_SPOTIFY_CLIENT_ID=jouw_client_id_hier
// VITE_SPOTIFY_REDIRECT_URI=https://hypexdash.netlify.app/callback
// =====================================================

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-recently-played'

// --- PKCE helpers ---
function generateCodeVerifier() {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function nextRepeat(r) {
  return r === 'off' ? 'context' : r === 'context' ? 'track' : 'off'
}

// ── TrackRow: track met "▶ Nu" en "+ Queue" knoppen ─────────────────────────
function TrackRow({ track, onPlayNow, onAddToQueue, compact = false, index }) {
  if (!track) return null
  const imgUrl = track.album?.images?.[compact ? 2 : 1]?.url
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 7 : 10, padding: compact ? '2px 4px' : '5px 8px', borderRadius: 8 }}>
      {imgUrl && (
        <img src={imgUrl} style={{ width: compact ? 22 : 32, height: compact ? 22 : 32, borderRadius: 4, flexShrink: 0 }} alt="" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: compact ? 11 : 12, color: 'rgba(255,255,255,0.75)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {track.name}
        </p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.artists?.map(a => a.name).join(', ')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onPlayNow} title="Nu afspelen"
          style={{ background: 'rgba(29,185,84,0.12)', border: '1px solid rgba(29,185,84,0.25)', borderRadius: 6, color: '#1DB954', cursor: 'pointer', padding: '4px 7px', fontSize: 10, fontWeight: 600 }}>
          ▶
        </button>
        <button onClick={onAddToQueue} title="Aan queue toevoegen"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: '4px 7px', fontSize: 10, fontWeight: 600 }}>
          +
        </button>
      </div>
      {index !== undefined && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginLeft: 2, flexShrink: 0 }}>{index}</span>}
    </div>
  )
}

export default function SpotifyWidget() {
  const [token, setToken] = useState(localStorage.getItem('spotify_token') || null)
  const [track, setTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressMs, setProgressMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [shuffleState, setShuffleState] = useState(false)
  const [repeatState, setRepeatState] = useState('off')
  const [contextUri, setContextUri] = useState(null)
  const [queueTracks, setQueueTracks] = useState([])
  const [recentTracks, setRecentTracks] = useState(null)
  const [recentError, setRecentError] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [tab, setTab] = useState('nu')
  const [trackMenu, setTrackMenu] = useState(null) // { uri, x, y }
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768)
  const [needsReconnect, setNeedsReconnect] = useState(() =>
    !!localStorage.getItem('spotify_token') &&
    !(localStorage.getItem('spotify_scopes') || '').includes('user-read-recently-played')
  )

  const progressIntervalRef = useRef(null)
  const durationMsRef = useRef(0)
  const isPlayingRef = useRef(false)
  const trackRef = useRef(null)

  const getToken = () => localStorage.getItem('spotify_token')

  // --- Login ---
  const handleLogin = async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    localStorage.setItem('spotify_verifier', verifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })

    window.location.href = `https://accounts.spotify.com/authorize?${params}`
  }

  // --- Stap 2: PKCE code-exchange ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const verifier = localStorage.getItem('spotify_verifier')

    if (code && verifier) {
      window.history.replaceState({}, '', window.location.pathname)

      fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('spotify_token', data.access_token)
            if (data.refresh_token) localStorage.setItem('spotify_refresh', data.refresh_token)
            localStorage.setItem('spotify_expires_at', String(Date.now() + (data.expires_in || 3600) * 1000))
            localStorage.setItem('spotify_scopes', SCOPES)
            setToken(data.access_token)
            setNeedsReconnect(false)
            localStorage.removeItem('spotify_verifier')
          }
        })
    }
  }, [])

  // --- Token refresh ---
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('spotify_refresh')
    if (!refreshToken) { localStorage.removeItem('spotify_token'); setToken(null); return null }
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        })
      })
      const data = await res.json()
      if (data.access_token) {
        localStorage.setItem('spotify_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('spotify_refresh', data.refresh_token)
        localStorage.setItem('spotify_expires_at', String(Date.now() + (data.expires_in || 3600) * 1000))
        setToken(data.access_token)
        return data.access_token
      }
    } catch {}
    return null
  }, [])

  // --- Queue ---
  const fetchQueue = useCallback(async () => {
    const res = await fetch('https://api.spotify.com/v1/me/player/queue',
      { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) return
    const data = await res.json()
    setQueueTracks(data.queue?.slice(0, 10) || [])
  }, [])

  // --- Fetch playback (vervangt fetchTrack) ---
  const fetchPlayback = useCallback(async () => {
    let currentToken = getToken()
    if (!currentToken) return
    const expiresAt = Number(localStorage.getItem('spotify_expires_at') || 0)
    if (expiresAt && Date.now() > expiresAt - 120000) {
      currentToken = await refreshAccessToken()
      if (!currentToken) return
    }

    const doFetch = async (tok) => {
      return fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${tok}` }
      })
    }

    let res = await doFetch(currentToken)
    if (res.status === 401) {
      const newToken = await refreshAccessToken()
      if (!newToken) return
      res = await doFetch(newToken)
    }
    if (res.status === 403) { setAuthError(true); return }
    if (res.status === 204 || !res.ok) return

    const data = await res.json()
    if (!data?.item) return

    setAuthError(false)
    const prevTrackId = trackRef.current?.id
    const newTrackId = data.item.id

    setTrack(data.item)
    setIsPlaying(data.is_playing)
    setShuffleState(data.shuffle_state)
    setRepeatState(data.repeat_state)
    setContextUri(data.context?.uri || null)
    setProgressMs(data.progress_ms)
    setDurationMs(data.item.duration_ms)

    durationMsRef.current = data.item.duration_ms
    isPlayingRef.current = data.is_playing
    trackRef.current = data.item

    // Reset en herstart lokale voortgangsinterval
    clearInterval(progressIntervalRef.current)
    if (data.is_playing) {
      progressIntervalRef.current = setInterval(() => {
        setProgressMs(prev => Math.min(prev + 1000, durationMsRef.current))
      }, 1000)
    }

    // Track change → queue opnieuw ophalen
    if (prevTrackId && prevTrackId !== newTrackId) {
      fetchQueue()
    }
  }, [refreshAccessToken, fetchQueue])

  // Poll playback elke 5s
  useEffect(() => {
    fetchPlayback()
    const interval = setInterval(fetchPlayback, 5000)
    return () => {
      clearInterval(interval)
      clearInterval(progressIntervalRef.current)
    }
  }, [fetchPlayback])

  // Queue poll elke 15s
  useEffect(() => {
    if (!token) return
    fetchQueue()
    const interval = setInterval(fetchQueue, 15000)
    return () => clearInterval(interval)
  }, [token, fetchQueue])

  // Recent lazy-load bij tab switch
  const fetchRecent = useCallback(async () => {
    const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10',
      { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.status === 403) { setAuthError(true); setRecentError(true); return }
    if (res.status === 401) { setRecentError(true); return }
    const data = await res.json()
    setRecentTracks(data.items || [])
    setAuthError(false)
  }, [])

  useEffect(() => {
    if (tab === 'recent' && recentTracks === null && !recentError) fetchRecent()
  }, [tab, recentTracks, recentError, fetchRecent])

  // Auto-switch naar Recent als niets speelt en er wel history is
  useEffect(() => {
    if (!track && !authError && recentTracks?.length > 0 && tab === 'nu') setTab('recent')
  }, [track, authError, recentTracks])

  // --- Bediening ---
  const control = async (action) => {
    const endpoints = {
      play:    { method: 'PUT',  url: 'https://api.spotify.com/v1/me/player/play' },
      pause:   { method: 'PUT',  url: 'https://api.spotify.com/v1/me/player/pause' },
      next:    { method: 'POST', url: 'https://api.spotify.com/v1/me/player/next' },
      prev:    { method: 'POST', url: 'https://api.spotify.com/v1/me/player/previous' },
      shuffle: { method: 'PUT',  url: `https://api.spotify.com/v1/me/player/shuffle?state=${!shuffleState}` },
      repeat:  { method: 'PUT',  url: `https://api.spotify.com/v1/me/player/repeat?state=${nextRepeat(repeatState)}` },
    }
    const { method, url } = endpoints[action]
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) console.warn(`Spotify control(${action}) ${res.status}`)

    // Optimistisch bijwerken
    if (action === 'shuffle') setShuffleState(p => !p)
    if (action === 'repeat')  setRepeatState(p => nextRepeat(p))

    if (['play', 'pause', 'next', 'prev'].includes(action)) {
      setTimeout(fetchPlayback, 500)
    }
  }

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Switch tab away from 'queue' when on desktop
  useEffect(() => {
    if (isDesktop && tab === 'queue') setTab('nu')
  }, [isDesktop, tab])

  // Nu afspelen via queue-positie: skip N keer zodat de wachtrij intact blijft
  const playFromQueue = async (queueIndex) => {
    for (let i = 0; i <= queueIndex; i++) {
      await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (i < queueIndex) await new Promise(r => setTimeout(r, 250))
    }
    setTimeout(() => { fetchPlayback(); fetchQueue() }, 700)
  }

  // Nu afspelen voor recent-tab: via URI (geen wachtrij-context om te bewaren)
  const playNow = async (trackUri) => {
    setTrackMenu(null)
    // Gebruik context_uri+offset voor playlist/album/artist; anders losse URI
    const isRegularCtx = contextUri && (
      contextUri.startsWith('spotify:playlist:') ||
      contextUri.startsWith('spotify:album:') ||
      contextUri.startsWith('spotify:artist:')
    )
    const body = isRegularCtx
      ? JSON.stringify({ context_uri: contextUri, offset: { uri: trackUri } })
      : JSON.stringify({ uris: [trackUri] })
    const res = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) console.warn(`Spotify playNow ${res.status}:`, await res.text().catch(() => ''))
    setTimeout(() => { fetchPlayback(); fetchQueue() }, 600)
  }

  // Aan queue toevoegen
  const addToQueue = async (trackUri) => {
    setTrackMenu(null)
    await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    setTimeout(fetchQueue, 800)
  }

  const handleLogout = () => {
    localStorage.removeItem('spotify_token')
    localStorage.removeItem('spotify_refresh')
    localStorage.removeItem('spotify_scopes')
    setToken(null); setTrack(null)
  }

  // --- UI: niet ingelogd ---
  if (!token) return (
    <div className="glass-card p-4 text-center">
      <Music size={24} color="#1DB954" style={{ margin: '0 auto 8px' }} />
      <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Koppel je Spotify account</p>
      <button onClick={handleLogin} className="btn-neon w-full" style={{ background: 'rgba(29,185,84,0.15)', borderColor: 'rgba(29,185,84,0.4)', color: '#1DB954' }}>
        Inloggen met Spotify
      </button>
    </div>
  )

  const btnBase = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }

  return (
    <div className="glass-card p-4" style={{
      borderLeft: '3px solid rgba(29,185,84,0.4)',
      background: 'linear-gradient(135deg, rgba(29,185,84,0.05) 0%, transparent 60%)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(29,185,84,0.15)', border: '1px solid rgba(29,185,84,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Music size={12} color="#1DB954" />
          </div>
          <span style={{ fontSize: 10, color: '#1DB954', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Spotify</span>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
          Uitloggen
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(isDesktop ? ['nu', 'recent'] : ['nu', 'queue', 'recent']).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '4px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
            border: '1px solid',
            borderColor: tab === t ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(255,255,255,0.08)',
            background:  tab === t ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
            color:       tab === t ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
          }}>
            {t === 'nu' ? 'Nu' : t === 'queue' ? 'Queue' : 'Recent'}
          </button>
        ))}
      </div>

      {/* Tab: Nu */}
      {tab === 'nu' && (
        track ? (
          <>
            {/* Album + info */}
            <div className="flex items-center gap-3 mb-3">
              {track.album?.images?.[0] && (
                <img src={track.album.images[0].url} alt="album" style={{ width: 44, height: 44, borderRadius: 8 }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-white">{track.name}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {track.artists?.map(a => a.name).join(', ')}
                </p>
              </div>
            </div>

            {/* Voortgangsbalk */}
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', margin: '8px 0', cursor: 'pointer' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, #1DB954, #22c55e)',
                width: `${durationMs > 0 ? (progressMs / durationMs) * 100 : 0}%`,
                transition: 'width 0.5s linear',
                boxShadow: '0 0 6px rgba(29,185,84,0.4)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{formatMs(progressMs)}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{formatMs(durationMs)}</span>
            </div>

            {/* Controls: shuffle | prev | play/pause | next | repeat */}
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => control('shuffle')} style={{ ...btnBase, color: shuffleState ? '#1DB954' : 'rgba(255,255,255,0.3)' }}>
                <Shuffle size={14} />
              </button>
              <button onClick={() => control('prev')} style={{ ...btnBase, color: 'rgba(255,255,255,0.6)' }}>
                <SkipBack size={18} />
              </button>
              <button onClick={() => control(isPlaying ? 'pause' : 'play')}
                style={{ background: 'rgba(29,185,84,0.2)', border: '1px solid rgba(29,185,84,0.4)', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button onClick={() => control('next')} style={{ ...btnBase, color: 'rgba(255,255,255,0.6)' }}>
                <SkipForward size={18} />
              </button>
              <button onClick={() => control('repeat')} style={{ ...btnBase, color: repeatState !== 'off' ? '#1DB954' : 'rgba(255,255,255,0.3)' }}>
                {repeatState === 'track' ? <Repeat1 size={14} /> : <Repeat size={14} />}
              </button>
            </div>

            {/* Wachtrij inline */}
            {queueTracks.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Wachtrij</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(isDesktop ? queueTracks : queueTracks.slice(0, 3)).map((t, i) => (
                    <TrackRow key={i} track={t} onPlayNow={() => playFromQueue(i)} onAddToQueue={() => addToQueue(t.uri)} compact />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : authError ? (
          <div style={{ textAlign: 'center', padding: '14px 8px' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,100,100,0.85)', marginBottom: 6, lineHeight: 1.5 }}>
              Spotify account niet geautoriseerd.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12, lineHeight: 1.4 }}>
              Vraag de beheerder om je account toe te voegen, of koppel opnieuw.
            </p>
            <button onClick={handleLogout}
              style={{ fontSize: 11, padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(255,100,100,0.3)', background: 'rgba(255,100,100,0.08)', color: 'rgba(255,100,100,0.8)', cursor: 'pointer' }}>
              Ontkoppelen
            </button>
          </div>
        ) : (
          <p className="text-xs text-center py-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Niets aan het afspelen...
          </p>
        )
      )}

      {/* Tab: Queue */}
      {tab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {queueTracks.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Wachtrij is leeg</p>
          ) : queueTracks.map((t, i) => (
            <TrackRow key={i} track={t} onPlayNow={() => playFromQueue(i)} onAddToQueue={() => addToQueue(t.uri)} index={i + 1} />
          ))}
        </div>
      )}

      {/* Tab: Recent */}
      {tab === 'recent' && (
        <div>
          {(recentError || needsReconnect) ? (
            <div className="text-center py-3">
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Herverbind om recent afgespeeld te zien</p>
              <button onClick={handleLogin} style={{ background: 'rgba(29,185,84,0.15)', border: '1px solid rgba(29,185,84,0.4)', borderRadius: 6, color: '#1DB954', fontSize: 11, cursor: 'pointer', padding: '6px 12px' }}>
                Herverbind
              </button>
            </div>
          ) : recentTracks === null ? (
            <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Laden...</p>
          ) : recentTracks.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Geen recent afgespeeld</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentTracks.map((item, i) => (
                <TrackRow key={i} track={item.track} onPlayNow={() => playNow(item.track.uri)} onAddToQueue={() => addToQueue(item.track.uri)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
