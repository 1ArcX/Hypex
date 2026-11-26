// TV-pairing: detecteert ?tv_pair=CODE in de URL en slaat de code op in sessionStorage.
// App.jsx roept captureTvPairCode() bij het laden aan. Als er een code is, toont de app
// een koppelmodal. Na de Spotify-callback (handleTvPairCallback in spotifyApi.js) worden
// de tokens naar het tv-pair endpoint gestuurd en toont de app een bevestiging.
export const TV_PAIR_KEY = 'tv_pair_code'

/** Vang ?tv_pair=CODE op uit de URL. Retourneert de code of null. */
export function captureTvPairCode() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const code = (params.get('tv_pair') || '').trim().toUpperCase()
  if (!code || !/^[A-Z0-9]{4,8}$/.test(code)) return null
  sessionStorage.setItem(TV_PAIR_KEY, code)
  window.history.replaceState(null, '', window.location.pathname)
  return code
}

/** Lees een eerder opgeslagen code uit sessionStorage (voor na de OAuth-redirect). */
export function getTvPairCode() {
  try { return sessionStorage.getItem(TV_PAIR_KEY) } catch { return null }
}

/** Ruim alles op. */
export function clearTvPair() {
  try {
    sessionStorage.removeItem(TV_PAIR_KEY)
    sessionStorage.removeItem('tv_spotify_verifier')
  } catch { /* privémodus */ }
}
