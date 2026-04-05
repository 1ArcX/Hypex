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

// Route through Netlify function (avoids browser CORS block)
export async function searchSchools(q) {
  return callSomtoday_GET(`action=schools&q=${encodeURIComponent(q || '')}`)
}

async function callSomtoday_GET(queryString) {
  const res = await fetch(`/.netlify/functions/somtoday?${queryString}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'SOMtoday fout')
  return data
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
