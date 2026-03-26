const API = '/.netlify/functions/magister'

const tokenKey = (username) => `magister_tokens_${username}`

function getStoredTokens(username) {
  if (!username) return null
  try { return JSON.parse(localStorage.getItem(tokenKey(username))) || null } catch { return null }
}

function storeTokens(username, tokens) {
  if (!username || !tokens?.access_token) return
  try { localStorage.setItem(tokenKey(username), JSON.stringify(tokens)) } catch {}
}

export function clearStoredTokens(username) {
  if (!username) return
  localStorage.removeItem(tokenKey(username))
}

export async function callMagister(creds, action, extra = {}) {
  const savedTokens = getStoredTokens(creds.username)
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, action, savedTokens, ...extra })
  })
  // Update opgeslagen tokens als server nieuwe geeft
  const tokenHeader = res.headers.get('X-Magister-Tokens')
  if (tokenHeader) {
    try { storeTokens(creds.username, JSON.parse(atob(tokenHeader))) } catch {}
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Serverfout')
  return data
}
