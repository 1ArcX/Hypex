import React, { useState, useEffect, useCallback } from 'react'
import { Music, Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react'

// =====================================================
// VITE_SPOTIFY_CLIENT_ID moet in je .env staan:
// VITE_SPOTIFY_CLIENT_ID=jouw_client_id_hier
// VITE_SPOTIFY_REDIRECT_URI=https://hypexdash.netlify.app/callback
// =====================================================

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing streaming'

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

export default function SpotifyWidget() {
  const [token, setToken] = useState(localStorage.getItem('spotify_token') || null)
  const [track, setTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  // --- Stap 1: Login knop → stuur gebruiker naar Spotify ---
  const handleLogin = async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    localStorage.setItem('spotify_verifier', verifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',         // ← PKCE gebruikt 'code'
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })

    window.location.href = `https://accounts.spotify.com/authorize?${params}`
  }

  // --- Stap 2: Na terugkeer van Spotify, wissel 'code' in voor token ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const verifier = localStorage.getItem('spotify_verifier')

    if (code && verifier) {
      // Verwijder de code uit de URL zodat het niet opnieuw triggert
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
            setToken(data.access_token)
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

  // --- Stap 3: Haal huidig afspelende track op ---
  const fetchTrack = useCallback(async () => {
    let currentToken = localStorage.getItem('spotify_token')
    if (!currentToken) return
    // Proactively refresh if token expires within 2 minutes
    const expiresAt = Number(localStorage.getItem('spotify_expires_at') || 0)
    if (expiresAt && Date.now() > expiresAt - 120000) {
      currentToken = await refreshAccessToken()
      if (!currentToken) return
    }
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${currentToken}` }
    })
    if (res.status === 401) {
      const newToken = await refreshAccessToken()
      if (!newToken) return
      const retry = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${newToken}` }
      })
      if (!retry.ok || retry.status === 204) return
      const data = await retry.json()
      if (data?.item) { setTrack(data.item); setIsPlaying(data.is_playing) }
      return
    }
    if (res.status === 204) return
    if (!res.ok) return
    const data = await res.json()
    if (data?.item) { setTrack(data.item); setIsPlaying(data.is_playing) }
  }, [refreshAccessToken])

  useEffect(() => {
    fetchTrack()
    const interval = setInterval(fetchTrack, 5000)
    return () => clearInterval(interval)
  }, [fetchTrack])

  // --- Bediening ---
  const control = async (action) => {
    const endpoints = {
      play:    { method: 'PUT',  url: 'https://api.spotify.com/v1/me/player/play' },
      pause:   { method: 'PUT',  url: 'https://api.spotify.com/v1/me/player/pause' },
      next:    { method: 'POST', url: 'https://api.spotify.com/v1/me/player/next' },
      prev:    { method: 'POST', url: 'https://api.spotify.com/v1/me/player/previous' },
    }
    const { method, url } = endpoints[action]
    await fetch(url, { method, headers: { Authorization: `Bearer ${localStorage.getItem('spotify_token')}` } })
    setTimeout(fetchTrack, 500)
  }

  const handleLogout = () => {
    localStorage.removeItem('spotify_token')
    localStorage.removeItem('spotify_refresh')
    setToken(null); setTrack(null)
  }

  // --- UI ---
  if (!token) return (
    <div className="glass-card p-4 text-center">
      <Music size={24} color="#1DB954" style={{ margin: '0 auto 8px' }} />
      <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Koppel je Spotify account</p>
      <button onClick={handleLogin} className="btn-neon w-full" style={{ background: 'rgba(29,185,84,0.15)', borderColor: 'rgba(29,185,84,0.4)', color: '#1DB954' }}>
        Inloggen met Spotify
      </button>
    </div>
  )

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music size={14} color="#1DB954" />
          <span className="text-xs font-semibold text-white">Spotify</span>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
          Uitloggen
        </button>
      </div>

      {track ? (
        <>
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
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => control('prev')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
              <SkipBack size={18} />
            </button>
            <button onClick={() => control(isPlaying ? 'pause' : 'play')}
              style={{ background: 'rgba(29,185,84,0.2)', border: '1px solid rgba(29,185,84,0.4)', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={() => control('next')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
              <SkipForward size={18} />
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-center py-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Niets aan het afspelen...
        </p>
      )}
    </div>
  )
}