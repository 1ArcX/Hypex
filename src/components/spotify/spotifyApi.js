// Spotify Web API — OAuth PKCE volledig in de browser (geen server nodig), tokens in localStorage.
// VITE_SPOTIFY_CLIENT_ID en VITE_SPOTIFY_REDIRECT_URI staan in .env.
//
// API-stand feb 2026: opslaan/checken via /me/library (uris), playlist-nummers via /playlists/{id}/items
// (alleen eigen playlists), zoeken max. 10 per type, geen top-tracks per artiest meer.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
const API = 'https://api.spotify.com/v1'

export const SCOPES = [
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'streaming',
  'user-read-recently-played', 'user-library-read', 'user-library-modify',
  'playlist-read-private', 'playlist-read-collaborative',
].join(' ')

export const getToken = () => localStorage.getItem('spotify_token')
export const hasScope = (s) => (localStorage.getItem('spotify_scopes') || '').split(' ').includes(s)
/** Gekoppeld met een oudere set rechten → één keer opnieuw koppelen voor bibliotheek. */
export const needsReconnect = () => !!getToken() && SCOPES.split(' ').some(s => !hasScope(s))

// --- PKCE ---
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
function codeVerifier() { const a = new Uint8Array(64); crypto.getRandomValues(a); return b64url(a) }
async function codeChallenge(v) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)))) }

export async function login() {
  const verifier = codeVerifier()
  localStorage.setItem('spotify_verifier', verifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI, scope: SCOPES,
    code_challenge_method: 'S256', code_challenge: await codeChallenge(verifier),
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

function storeTokens(data, scopes) {
  localStorage.setItem('spotify_token', data.access_token)
  if (data.refresh_token) localStorage.setItem('spotify_refresh', data.refresh_token)
  localStorage.setItem('spotify_expires_at', String(Date.now() + (data.expires_in || 3600) * 1000))
  if (scopes) localStorage.setItem('spotify_scopes', scopes)
}

/** Stap 2 van de login: ?code=… in de URL inwisselen. Eén keer per paginalading. */
let callbackDone = null
export function handleAuthCallback() {
  if (callbackDone) return callbackDone
  const code = new URLSearchParams(window.location.search).get('code')
  const verifier = localStorage.getItem('spotify_verifier')
  if (!code || !verifier) return (callbackDone = Promise.resolve(false))
  window.history.replaceState({}, '', window.location.pathname)
  callbackDone = fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier }),
  }).then(r => r.json()).then(data => {
    if (!data.access_token) return false
    storeTokens(data, data.scope || SCOPES)
    localStorage.removeItem('spotify_verifier')
    return true
  }).catch(() => false)
  return callbackDone
}

// Eén refresh tegelijk, ook als meerdere verzoeken tegelijk een 401 krijgen
let refreshing = null
export function refreshToken() {
  if (refreshing) return refreshing
  const refresh = localStorage.getItem('spotify_refresh')
  if (!refresh) return Promise.resolve(null)
  refreshing = fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: CLIENT_ID }),
  }).then(r => r.json()).then(data => {
    if (!data.access_token) return null
    storeTokens(data)
    return data.access_token
  }).catch(() => null).finally(() => { refreshing = null })
  return refreshing
}

export function logout() {
  for (const k of ['spotify_token', 'spotify_refresh', 'spotify_scopes', 'spotify_expires_at']) localStorage.removeItem(k)
}

// Na een 429 alle verzoeken even pauzeren
let blockedUntil = 0
const wait = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Verzoek naar de Web API. Geeft altijd `{ ok, status, data, reason }` terug (gooit niet).
 * `reason` komt uit Spotify's foutobject, bv. 'NO_ACTIVE_DEVICE' of 'PREMIUM_REQUIRED'.
 */
export async function sp(path, { method = 'GET', query, body } = {}) {
  let token = getToken()
  if (!token) return { ok: false, status: 0, data: null }
  const exp = Number(localStorage.getItem('spotify_expires_at') || 0)
  if (exp && Date.now() > exp - 60000) token = (await refreshToken()) || token
  if (Date.now() < blockedUntil) await wait(blockedUntil - Date.now())

  const url = new URL(path.startsWith('http') ? path : API + path)
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v)
  const send = (tok) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${tok}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })

  try {
    let res = await send(token)
    if (res.status === 401) {
      const fresh = await refreshToken()
      if (!fresh) return { ok: false, status: 401, data: null }
      res = await send(fresh)
    }
    if (res.status === 429) {
      const secs = Number(res.headers.get('Retry-After')) || 2
      blockedUntil = Date.now() + Math.min(secs, 30) * 1000
      return { ok: false, status: 429, data: null, reason: 'RATE_LIMIT' }
    }
    const text = res.status === 204 ? '' : await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    if (!res.ok) return { ok: false, status: res.status, data, reason: data?.error?.reason || data?.error?.message || null }
    return { ok: true, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null, reason: 'NETWORK' }
  }
}

export const artistNames = (t) => (t?.artists || []).map(a => a.name).join(', ')
export const coverOf = (obj, size = 'md') => {
  const imgs = obj?.album?.images || obj?.images || []
  if (!imgs.length) return null
  return (size === 'sm' ? imgs[imgs.length - 1] : size === 'lg' ? imgs[0] : imgs[1] || imgs[0])?.url || null
}
export function formatMs(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
