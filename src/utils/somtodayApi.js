const ST_CLIENT_ID = 'somtoday-leerling-redirect-web'
const ST_AUTH_BASE = 'https://inloggen.somtoday.nl'

export async function loginWithPopup() {
  // Generate PKCE in browser
  const array = crypto.getRandomValues(new Uint8Array(32))
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const encoded = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  sessionStorage.setItem('somtoday_pkce_verifier', verifier)

  const redirectUri = `${window.location.origin}/oauth/somtoday`
  const authUrl = ST_AUTH_BASE + '/oauth2/authorize?' + new URLSearchParams({
    client_id: ST_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'somtoday-login', 'width=600,height=700,left=200,top=100')
    if (!popup) { reject(new Error('Popup geblokkeerd door browser')); return }

    const onMsg = async (e) => {
      if (e.origin !== window.location.origin || !e.data?.somtodayOAuth) return
      window.removeEventListener('message', onMsg)
      const { code, error } = e.data.somtodayOAuth
      if (error) return reject(new Error(error))
      if (!code) return reject(new Error('Geen code ontvangen'))
      try {
        const codeVerifier = sessionStorage.getItem('somtoday_pkce_verifier')
        sessionStorage.removeItem('somtoday_pkce_verifier')
        const data = await callSomtoday('exchange', { code, codeVerifier, redirectUri })
        resolve(data)
      } catch (err) { reject(err) }
    }
    window.addEventListener('message', onMsg)

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer)
        window.removeEventListener('message', onMsg)
        sessionStorage.removeItem('somtoday_pkce_verifier')
        reject(new Error('Popup gesloten'))
      }
    }, 500)

    setTimeout(() => {
      clearInterval(timer)
      window.removeEventListener('message', onMsg)
      sessionStorage.removeItem('somtoday_pkce_verifier')
      reject(new Error('Timeout'))
    }, 300000)
  })
}

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

// Singleton autologin — meerdere gelijktijdige aanroepen delen dezelfde promise
let _autologinPromise = null
export function ensureSomtodayCreds(userId) {
  // Already have valid creds? Return immediately without a server call
  try {
    const stored = JSON.parse(localStorage.getItem(somtodayKey(userId)))
    if (stored?.accessToken && stored?.expiresAt && Date.now() / 1000 < stored.expiresAt - 60) {
      return Promise.resolve(stored)
    }
  } catch {}

  // Share in-flight autologin promise across all callers
  if (!_autologinPromise) {
    _autologinPromise = callSomtoday('autologin', {})
      .then(tokenData => ({
        somtodayApiUrl: tokenData.somtoday_api_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600),
      }))
      .finally(() => { _autologinPromise = null })
  }

  return _autologinPromise.then(creds => {
    localStorage.setItem(somtodayKey(userId), JSON.stringify(creds))
    return creds
  })
}
