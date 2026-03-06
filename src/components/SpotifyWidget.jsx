import React, { useState, useEffect } from 'react'
import { Music, SkipBack, SkipForward, Play, Pause, Volume2, ExternalLink } from 'lucide-react'

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || window.location.origin
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing streaming'

function getSpotifyToken() {
  return localStorage.getItem('spotify_token')
}

function SpotifyLogin() {
  const login = () => {
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'token',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
    })
    window.location.href = `https://accounts.spotify.com/authorize?${params}`
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Music size={16} style={{ color: '#1DB954' }} />
        <h3 className="text-sm font-semibold text-white">Spotify</h3>
      </div>
      <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Verbind je Spotify account om muziek te bedienen vanuit je dashboard.
      </p>
      <button onClick={login} className="btn-neon w-full flex items-center justify-center gap-2"
        style={{ borderColor: '#1DB954', color: '#1DB954', background: 'rgba(29,185,84,0.1)' }}>
        <Music size={14} /> Verbinden met Spotify
      </button>
      <p className="text-xs mt-2 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Vereist Spotify Premium
      </p>
    </div>
  )
}

export default function SpotifyWidget() {
  const [token, setToken] = useState(getSpotifyToken())
  const [track, setTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(50)

  // Haal token op uit URL hash na redirect
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const t = params.get('access_token')
      if (t) {
        localStorage.setItem('spotify_token', t)
        setToken(t)
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [])

  const spotifyFetch = async (endpoint, method = 'GET', body = null) => {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    })
    if (res.status === 401) { localStorage.removeItem('spotify_token'); setToken(null) }
    if (res.status === 204 || res.status === 202) return null
    if (res.ok) return res.json()
    return null
  }

  const fetchCurrentTrack = async () => {
    const data = await spotifyFetch('/me/player/currently-playing')
    if (data?.item) {
      setTrack(data.item)
      setPlaying(data.is_playing)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchCurrentTrack()
    const interval = setInterval(fetchCurrentTrack, 5000)
    return () => clearInterval(interval)
  }, [token])

  const togglePlay = async () => {
    await spotifyFetch(`/me/player/${playing ? 'pause' : 'play'}`, 'PUT')
    setPlaying(!playing)
  }

  const skip = async (dir) => {
    await spotifyFetch(`/me/player/${dir === 'next' ? 'next' : 'previous'}`, 'POST')
    setTimeout(fetchCurrentTrack, 500)
  }

  const setVolumeLevel = async (v) => {
    setVolume(v)
    await spotifyFetch(`/me/player/volume?volume_percent=${v}`, 'PUT')
  }

  if (!token) return <SpotifyLogin />

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music size={16} style={{ color: '#1DB954' }} />
          <h3 className="text-sm font-semibold text-white">Spotify</h3>
        </div>
        <button onClick={() => { localStorage.removeItem('spotify_token'); setToken(null) }}
          style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Uitloggen
        </button>
      </div>

      {track ? (
        <div>
          {/* Album art + info */}
          <div className="flex items-center gap-3 mb-3">
            {track.album?.images?.[0]?.url && (
              <img src={track.album.images[0].url} alt="album"
                style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <p className="text-sm font-medium truncate text-white">{track.name}</p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {track.artists?.map(a => a.name).join(', ')}
              </p>
              <a href={track.external_urls?.spotify} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '10px', color: '#1DB954', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                Open in Spotify <ExternalLink size={9} />
              </a>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button onClick={() => skip('prev')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
              <SkipBack size={20} />
            </button>
            <button onClick={togglePlay}
              style={{
                width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#1DB954', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 15px rgba(29,185,84,0.4)'
              }}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={() => skip('next')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
              <SkipForward size={20} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 size={12} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <input type="range" min="0" max="100" value={volume}
              onChange={e => setVolumeLevel(+e.target.value)}
              style={{ flex: 1, accentColor: '#1DB954' }} />
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Geen muziek actief.<br />Open Spotify op een apparaat om te beginnen.
          </p>
        </div>
      )}
    </div>
  )
}