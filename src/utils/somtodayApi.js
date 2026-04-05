export async function callSomtoday(action, body = {}) {
  const res = await fetch(`/.netlify/functions/somtoday?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `SOMtoday ${action} mislukt`)
  return data
}

// Fetched directly from browser — SOMtoday's public endpoint has CORS headers
export async function searchSchools(q) {
  const query = (q || '').toLowerCase().trim()
  const urls = [
    'https://servers.somtoday.nl/organisaties.json',
    'https://inloggen.somtoday.nl/organisaties.json',
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const json = await res.json()
      const orgs = Array.isArray(json)
        ? (json[0]?.instellingen || json.flatMap(x => x.instellingen || []))
        : (json.instellingen || [])
      if (!orgs.length) continue
      const filtered = query
        ? orgs.filter(o => (o.naam || '').toLowerCase().includes(query))
        : orgs
      return filtered.slice(0, 25).map(o => ({ name: o.naam, uuid: o.uuid }))
    } catch { /* try next */ }
  }
  throw new Error('Kan scholen niet laden')
}

export const somtodayKey = (userId) => `somtoday_credentials_${userId}`

// Returns valid creds (refreshing token if needed), or null
export async function getSomtodayCreds(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(somtodayKey(userId)))
    if (!stored?.accessToken) return null
    // Still valid (with 60s buffer)?
    if (stored.expiresAt && Date.now() / 1000 < stored.expiresAt - 60) return stored
    // Refresh
    const data = await callSomtoday('refresh', { refreshToken: stored.refreshToken })
    const updated = {
      ...stored,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    }
    localStorage.setItem(somtodayKey(userId), JSON.stringify(updated))
    return updated
  } catch {
    return null
  }
}
