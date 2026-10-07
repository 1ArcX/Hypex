import { useEffect, useState, useSyncExternalStore } from 'react'
import { sp, getToken, handleAuthCallback, logout as apiLogout, hasScope, needsReconnect } from './spotifyApi'

// Gedeelde Spotify-speler voor alle widgets op de pagina: één poller, één bron van waarheid.
// Knoppen werken optimistisch (direct zichtbaar) en worden daarna met een korte burst-poll bevestigd.
//
// Status: { token, track, isPlaying, progressMs, at (ms waarop progressMs gold), shuffle, repeat,
//           contextUri, device, volume, queue, recent, liked, authError, notice, reconnect }

let state = {
  token: getToken(), track: null, isPlaying: false, progressMs: 0, at: Date.now(),
  shuffle: false, repeat: 'off', contextUri: null, device: null, volume: null,
  queue: [], recent: null, liked: {}, authError: false, notice: null, reconnect: needsReconnect(),
}
const listeners = new Set()
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach(l => l()) }
const subscribe = (l) => { listeners.add(l); start(); return () => { listeners.delete(l); if (!listeners.size) stop() } }

/** Huidige positie in het nummer, doorgerekend vanaf de laatste meting. */
export function livePosition(st = state, now = Date.now()) {
  const dur = st.track?.duration_ms || 0
  const pos = st.isPlaying ? st.progressMs + (now - st.at) : st.progressMs
  return Math.max(0, Math.min(pos, dur || pos))
}

// ── Pollen ──────────────────────────────────────────────────────────────────
let timer = null, running = false, lastQueueAt = 0
// Na een actie: verwachte uitkomst. Afwijkende pollresultaten worden genegeerd tot `until`,
// zodat de UI niet even terugspringt naar het oude nummer terwijl Spotify nog bijwerkt.
let expect = null
let volumeHoldUntil = 0

function schedule(ms) {
  clearTimeout(timer)
  if (!running) return
  timer = setTimeout(tick, ms)
}
function nextDelay() {
  if (document.hidden) return null
  if (!state.isPlaying) return 10000
  const left = (state.track?.duration_ms || 0) - livePosition()
  return left > 0 && left < 3000 ? left + 400 : 3000 // vlak na het einde van het nummer meteen kijken
}
async function tick() {
  await fetchPlayback()
  const d = nextDelay()
  if (d != null) schedule(d)
}
function onVisible() { if (!document.hidden) { schedule(0) } else clearTimeout(timer) }

function start() {
  if (running) return
  running = true
  handleAuthCallback().then(ok => { if (ok) set({ token: getToken(), reconnect: needsReconnect(), authError: false }) ; schedule(0) })
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
}
function stop() {
  running = false
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('focus', onVisible)
}

async function fetchPlayback() {
  if (!getToken()) { if (state.token) set({ token: null, track: null }); return }
  const r = await sp('/me/player', { query: { additional_types: 'episode' } })
  if (r.status === 401) { set({ token: getToken() }); return }
  if (r.status === 403) { set({ authError: true }); return }
  if (!r.ok) return
  const d = r.data
  if (!d?.item) {
    if (r.status === 204 && state.track && !expect) set({ track: null, isPlaying: false, device: null })
    return
  }
  const now = Date.now()
  if (expect && now < expect.until) {
    const trackOk = !expect.trackId || d.item.id === expect.trackId
    const playOk = expect.playing == null || d.is_playing === expect.playing
    if (!(trackOk && playOk)) return // Spotify loopt nog achter
  }
  expect = null
  const prevId = state.track?.id
  set({
    token: getToken(), authError: false,
    track: d.item, isPlaying: d.is_playing, progressMs: d.progress_ms || 0, at: now,
    shuffle: d.shuffle_state, repeat: d.repeat_state, contextUri: d.context?.uri || null,
    device: d.device || null,
    ...(now > volumeHoldUntil && typeof d.device?.volume_percent === 'number' ? { volume: d.device.volume_percent } : {}),
  })
  if (prevId !== d.item.id || now - lastQueueAt > 15000) queueSoon(150)
  if (prevId !== d.item.id) checkLiked(d.item)
}

let queueTimer = null
const queueSoon = (ms) => { clearTimeout(queueTimer); queueTimer = setTimeout(fetchQueue, ms) }
async function fetchQueue() {
  clearTimeout(queueTimer)
  lastQueueAt = Date.now()
  const r = await sp('/me/player/queue')
  if (r.ok) set({ queue: (r.data?.queue || []).slice(0, 20) })
}

export async function fetchRecent() {
  const r = await sp('/me/player/recently-played', { query: { limit: 20 } })
  if (r.ok) set({ recent: r.data?.items || [] })
  else if (r.status === 403) set({ recent: [] })
}

async function checkLiked(track) {
  if (!track?.uri || !track.uri.startsWith('spotify:track:') || !hasScope('user-library-read')) return
  if (state.liked[track.id] != null) return
  const r = await sp('/me/library/contains', { query: { uris: track.uri } })
  if (r.ok && Array.isArray(r.data)) set({ liked: { ...state.liked, [track.id]: !!r.data[0] } })
}

/** Na een actie een paar keer snel pollen tot Spotify de verwachte toestand meldt. */
let burst = []
function confirm(exp) {
  expect = exp ? { ...exp, until: Date.now() + 3000 } : null
  burst.forEach(clearTimeout) // nieuwe actie vervangt de vorige burst (3× skippen ≠ 15 polls)
  burst = [300, 800, 1600, 3200].map(ms => setTimeout(() => { if (running) fetchPlayback() }, ms))
}

// ── Radio ───────────────────────────────────────────────────────────────────
// Spotify's aanbevelingen-API bestaat niet meer voor deze app, en bij afspelen van losse nummers
// (uris) start Spotify's eigen autoplay niet. Daarom een eigen "radio": nummers van dezelfde artiest(en)
// + nummers uit hun genres, gemengd. Zoeken geeft max. 10 per verzoek (API feb 2026), dus een paar pagina's.
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

async function buildRadio(seed, size = 25) {
  const artists = (seed.artists || []).filter(a => a?.id).slice(0, 2)
  const searchTracks = async (q, offset = 0) => ((await sp('/search', { query: { q, type: 'track', limit: 10, offset } })).data?.tracks?.items || []).filter(Boolean)
  const [infos, ...artistPages] = await Promise.all([
    Promise.all(artists.map(a => sp(`/artists/${a.id}`).then(r => r.data).catch(() => null))),
    ...artists.flatMap(a => [searchTracks(`artist:"${a.name}"`), searchTracks(`artist:"${a.name}"`, 10)]),
  ])
  const genres = [...new Set(infos.flatMap(i => i?.genres || []))].slice(0, 3)
  const genrePages = await Promise.all(genres.flatMap(g => [searchTracks(`genre:"${g}"`), searchTracks(`genre:"${g}"`, 10)]))

  const seen = new Set([seed.id, `${seed.name}|${seed.artists?.[0]?.name}`.toLowerCase()])
  const take = (list) => list.filter(t => {
    const k = `${t.name}|${t.artists?.[0]?.name}`.toLowerCase()
    if (!t.uri || seen.has(t.id) || seen.has(k)) return false
    seen.add(t.id); seen.add(k); return true
  })
  const sameArtist = shuffle(take(artistPages.flat())).slice(0, genres.length ? 10 : size)
  const similar = shuffle(take(genrePages.flat()))
  // Afwisselen: 1 van de artiest, 2 vergelijkbare — zoals een Spotify-radio aanvoelt
  const out = []
  while (out.length < size && (sameArtist.length || similar.length)) {
    if (sameArtist.length) out.push(sameArtist.shift())
    for (let i = 0; i < 2 && similar.length; i++) out.push(similar.shift())
  }
  return out.slice(0, size)
}

// ── Acties ──────────────────────────────────────────────────────────────────
// Acties lopen na elkaar (snel 3× skippen = 3 nette requests, geen race).
let chain = Promise.resolve()
const queueAction = (fn) => (chain = chain.then(fn).catch(() => {}))

let noticeTimer = null
function notice(text) {
  clearTimeout(noticeTimer)
  set({ notice: text })
  noticeTimer = setTimeout(() => set({ notice: null }), 5000)
}

/** Geen actief apparaat → afspelen overzetten naar het laatst gebruikte apparaat. */
async function activateDevice() {
  const r = await sp('/me/player/devices')
  const devices = (r.data?.devices || []).filter(d => !d.is_restricted)
  const target = devices.find(d => d.is_active) || devices[0]
  if (!target) { notice('Open Spotify op een apparaat om af te spelen.'); return null }
  const t = await sp('/me/player', { method: 'PUT', body: { device_ids: [target.id], play: false } })
  if (!t.ok) return null
  await new Promise(res => setTimeout(res, 400))
  return target.id
}

/** Verzoek met terugval bij NO_ACTIVE_DEVICE en nette meldingen. */
async function command(path, opts = {}) {
  let r = await sp(path, opts)
  if (!r.ok && (r.status === 404 || r.reason === 'NO_ACTIVE_DEVICE')) {
    const id = await activateDevice()
    if (id) r = await sp(path, { ...opts, query: { ...(opts.query || {}), device_id: id } })
  }
  if (!r.ok) {
    if (r.reason === 'PREMIUM_REQUIRED' || r.status === 403) notice('Bedienen kan alleen met Spotify Premium (of deze actie mag nu niet).')
    else if (r.status === 429) notice('Even rustig aan — Spotify vraagt om te wachten.')
    else if (r.status === 404) {/* melding al getoond door activateDevice */}
    else if (r.status) notice('Spotify reageerde niet zoals verwacht.')
  }
  return r
}

export const player = {
  togglePlay() {
    const playing = !state.isPlaying
    set({ isPlaying: playing, progressMs: livePosition(), at: Date.now() })
    return queueAction(async () => {
      const r = await command(playing ? '/me/player/play' : '/me/player/pause', { method: 'PUT' })
      if (!r.ok) set({ isPlaying: !playing })
      confirm({ playing })
    })
  },
  next() {
    const [up, ...rest] = state.queue
    if (up) set({ track: up, queue: rest, progressMs: 0, at: Date.now(), isPlaying: true })
    return queueAction(async () => {
      await command('/me/player/next', { method: 'POST' })
      confirm(up ? { trackId: up.id } : null)
      queueSoon(900)
    })
  },
  prev() {
    // Spotify: >3s gespeeld = terug naar begin, anders vorig nummer
    if (livePosition() > 3000) set({ progressMs: 0, at: Date.now() })
    return queueAction(async () => {
      await command('/me/player/previous', { method: 'POST' })
      confirm(null)
    })
  },
  toggleShuffle() {
    const v = !state.shuffle
    set({ shuffle: v })
    return queueAction(async () => { await command('/me/player/shuffle', { method: 'PUT', query: { state: v } }); queueSoon(800) })
  },
  cycleRepeat() {
    const v = state.repeat === 'off' ? 'context' : state.repeat === 'context' ? 'track' : 'off'
    set({ repeat: v })
    return queueAction(() => command('/me/player/repeat', { method: 'PUT', query: { state: v } }))
  },
  seek(ms) {
    set({ progressMs: ms, at: Date.now() })
    return queueAction(async () => { await command('/me/player/seek', { method: 'PUT', query: { position_ms: Math.round(ms) } }); confirm(null) })
  },
  volume: (() => {
    let t = null
    return (v) => {
      set({ volume: v })
      volumeHoldUntil = Date.now() + 2500
      clearTimeout(t)
      t = setTimeout(() => queueAction(() => command('/me/player/volume', { method: 'PUT', query: { volume_percent: v } })), 200)
    }
  })(),
  /** Speel een context (album/playlist/artiest), optioneel vanaf een nummer. */
  playContext(contextUri, { offsetUri, shuffle } = {}) {
    return queueAction(async () => {
      if (shuffle != null && shuffle !== state.shuffle) { await command('/me/player/shuffle', { method: 'PUT', query: { state: shuffle } }); set({ shuffle }) }
      const body = { context_uri: contextUri, ...(offsetUri ? { offset: { uri: offsetUri } } : {}) }
      await command('/me/player/play', { method: 'PUT', body })
      set({ isPlaying: true })
      confirm(null)
      queueSoon(1200)
    })
  },
  /** Speel losse nummers (zoekresultaten, gelikte nummers). */
  playUris(uris, offsetUri) {
    return queueAction(async () => {
      const body = { uris: uris.slice(0, 100), ...(offsetUri ? { offset: { uri: offsetUri } } : {}) }
      await command('/me/player/play', { method: 'PUT', body })
      set({ isPlaying: true })
      confirm(null)
      queueSoon(1200)
    })
  },
  /** Nummer afspelen: binnen de huidige playlist/album als het daarin zit, anders los. */
  playTrack(track) {
    const ctx = state.contextUri && /^spotify:(playlist|album):/.test(state.contextUri) ? state.contextUri : null
    set({ track, progressMs: 0, at: Date.now(), isPlaying: true })
    return queueAction(async () => {
      // Zit het nummer niet in de huidige context, dan geeft Spotify een fout → los afspelen
      const r = ctx ? await sp('/me/player/play', { method: 'PUT', body: { context_uri: ctx, offset: { uri: track.uri } } }) : { ok: false }
      if (!r.ok) await command('/me/player/play', { method: 'PUT', body: { uris: [track.uri] } })
      confirm({ trackId: track.id })
      queueSoon(1200)
    })
  },
  /**
   * Nummer uit zoekresultaten afspelen met daarna aanbevolen nummers (eigen radio),
   * zodat de muziek niet stopt na dit ene nummer — zoals in de Spotify-app.
   */
  playRadio(track) {
    set({ track, progressMs: 0, at: Date.now(), isPlaying: true })
    return queueAction(async () => {
      let radio = []
      try { radio = await buildRadio(track) } catch { radio = [] }
      // offset = het gezochte nummer eerst (anders kiest Spotify bij shuffle een willekeurig nummer uit de lijst)
      await command('/me/player/play', { method: 'PUT', body: { uris: [track.uri, ...radio.map(t => t.uri)], offset: { uri: track.uri }, position_ms: 0 } })
      if (radio.length) notice(`Radio op basis van "${track.name}" · ${radio.length} nummers`)
      confirm({ trackId: track.id })
      queueSoon(1200)
    })
  },
  /** Nummer uit de wachtrij nu spelen: zo vaak skippen dat de rest van de wachtrij blijft staan. */
  playFromQueue(index) {
    const target = state.queue[index]
    if (!target) return
    set({ track: target, queue: state.queue.slice(index + 1), progressMs: 0, at: Date.now(), isPlaying: true })
    return queueAction(async () => {
      for (let i = 0; i <= index; i++) {
        await command('/me/player/next', { method: 'POST' })
        if (i < index) await new Promise(r => setTimeout(r, 200))
      }
      confirm({ trackId: target.id })
      queueSoon(1200)
    })
  },
  addToQueue(track) {
    return queueAction(async () => {
      const r = await command('/me/player/queue', { method: 'POST', query: { uri: track.uri } })
      if (r.ok) { notice(`"${track.name}" staat in de wachtrij`); queueSoon(700) }
    })
  },
  toggleLike(track) {
    if (!track?.uri) return
    if (!hasScope('user-library-modify')) { notice('Koppel Spotify opnieuw om nummers te kunnen liken.'); return }
    const now = !state.liked[track.id]
    set({ liked: { ...state.liked, [track.id]: now } })
    return queueAction(async () => {
      const r = await sp('/me/library', { method: now ? 'PUT' : 'DELETE', query: { uris: track.uri } })
      if (!r.ok) { set({ liked: { ...state.liked, [track.id]: !now } }); notice('Liken lukte niet.') }
    })
  },
  refresh() { schedule(0) },
  logout() { apiLogout(); set({ token: null, track: null, queue: [], recent: null, reconnect: false }) },
}

export function usePlayer() {
  return useSyncExternalStore(subscribe, () => state)
}

/** Live positie, ververst elke `ms` (lyrics: 250ms, seekbalk: 1000ms). */
export function useLivePosition(ms = 1000) {
  const st = usePlayer()
  const [, force] = useState(0)
  useEffect(() => {
    if (!st.isPlaying) return
    const iv = setInterval(() => force(n => n + 1), ms)
    return () => clearInterval(iv)
  }, [st.isPlaying, ms])
  return livePosition(st)
}
