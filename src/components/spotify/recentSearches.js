// Recent gezocht (Spotify-zoeken): nummers die je afspeelde/in de wachtrij zette en artiesten, albums
// en playlists die je opende vanuit de zoekresultaten. Per apparaat in localStorage, nieuwste eerst.

const KEY = 'sp_recent_search'
const MAX = 15

const small = (imgs) => (imgs || []).slice(-2) // kleinste afbeeldingen zijn genoeg voor de lijst

/** Alleen wat de lijst en de detailweergave nodig hebben (houdt localStorage klein). */
function slim(item) {
  const base = { type: item.type, id: item.id, uri: item.uri, name: item.name }
  if (item.type === 'track') return { ...base, duration_ms: item.duration_ms, artists: (item.artists || []).map(a => ({ id: a.id, name: a.name })), album: item.album ? { id: item.album.id, name: item.album.name, images: small(item.album.images) } : null }
  if (item.type === 'album') return { ...base, images: small(item.images), artists: (item.artists || []).map(a => ({ id: a.id, name: a.name })) }
  if (item.type === 'playlist') return { ...base, images: small(item.images), owner: { display_name: item.owner?.display_name } }
  return { ...base, images: small(item.images) } // artist
}

export function readRecent() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

export function addRecent(item) {
  if (!item?.uri) return readRecent()
  const list = [slim(item), ...readRecent().filter(x => x.uri !== item.uri)].slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* vol of geblokkeerd */ }
  return list
}

export function removeRecent(uri) {
  const list = readRecent().filter(x => x.uri !== uri)
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* */ }
  return list
}

export function clearRecent() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
  return []
}
