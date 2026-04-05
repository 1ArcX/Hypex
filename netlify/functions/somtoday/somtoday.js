// SOMtoday Netlify function — simulates the Wicket web login flow
// Supports native SOMtoday password auth. Schools using Microsoft/Azure SSO
// cannot be automated server-side (returns MICROSOFT_SSO error).
const crypto = require('crypto')

const AUTH_BASE  = 'https://inloggen.somtoday.nl'
const CLIENT_ID  = 'somtoday-leerling-redirect-web'
const REDIR_URI  = 'https://leerling.somtoday.nl/redirect'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
}
function ok(data) { return { statusCode: 200, headers: CORS, body: JSON.stringify(data) } }
function fail(msg, status = 400) { return { statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) } }

// ─── PKCE helpers ──────────────────────────────────────────────────────────────
function genVerifier()    { return crypto.randomBytes(32).toString('base64url') }
function genChallenge(v)  { return crypto.createHash('sha256').update(v).digest('base64url') }

// ─── Cookie jar ────────────────────────────────────────────────────────────────
function updateJar(jar, res) {
  let cookies = []
  try { cookies = res.headers.getSetCookie() } catch {
    const sc = res.headers.get('set-cookie')
    if (sc) cookies = [sc]
  }
  for (const c of cookies) {
    const kv = c.split(';')[0]
    const i  = kv.indexOf('=')
    if (i < 0) continue
    jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim()
  }
}
function jarStr(jar) { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }

async function go(url, opts, jar) {
  const h = { 'User-Agent': UA, 'Origin': AUTH_BASE, 'Referer': AUTH_BASE + '/' }
  if (jar && Object.keys(jar).length) h['Cookie'] = jarStr(jar)
  if (opts?.headers) Object.assign(h, opts.headers)
  const res = await fetch(url, { ...opts, headers: h, redirect: 'manual' })
  if (jar) updateJar(jar, res)
  return res
}

// Follow redirects within AUTH_BASE only, collecting cookies
async function follow(url, jar, maxHops = 8) {
  let res = await go(url, {}, jar)
  while (maxHops-- > 0 && res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location')
    if (!loc) break
    const full = loc.startsWith('http') ? loc : AUTH_BASE + loc
    if (!full.startsWith(AUTH_BASE)) { res = { _external: full, headers: res.headers }; break }
    res = await go(full, {}, jar)
  }
  return res
}

// ─── Step 1: Start OAuth session, get school selection page ───────────────────
async function startSession() {
  const verifier   = genVerifier()
  const challenge  = genChallenge(verifier)
  const jar        = {}
  const authUrl    = AUTH_BASE + '/oauth2/authorize?' + new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIR_URI,
    response_type: 'code', scope: 'openid',
    code_challenge: challenge, code_challenge_method: 'S256',
  })
  const res  = await follow(authUrl, jar)
  const html = await res.text?.() || ''
  const m    = html.match(/action="([^"]*organisatieSelectionForm[^"]*)"/)
  if (!m) throw new Error('School selectie pagina niet gevonden')
  return { verifier, formAction: m[1].replace(/&amp;/g, '&'), jar }
}

// ─── Step 2: Submit school name, get username page ────────────────────────────
async function submitSchool(formAction, schoolName, jar) {
  const url  = AUTH_BASE + '/' + formAction.replace(/^\.\//, '')
  const body = new URLSearchParams({
    'organisatieSearchField--selected-value-1': '',
    'organisatieSearchFieldPanel:organisatieSearchFieldPanel_body:organisatieSearchField': schoolName,
    'nextLink': 'x',
  })
  let res = await go(url, { method: 'POST', body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, jar)

  // Follow redirect to username page
  if (res.status >= 300 && res.status < 400) {
    const loc  = res.headers.get('location')
    const full = loc?.startsWith('http') ? loc : AUTH_BASE + (loc || '')
    res = await go(full, {}, jar)
  }

  const html = await res.text?.() || ''
  const signM = html.match(/action="([^"]*signInForm[^"]*)"/)
  if (!signM) throw new Error('School niet gevonden of naam onjuist')
  return { signAction: signM[1].replace(/&amp;/g, '&'), html }
}

// ─── Step 3: Submit username, detect SSO type ─────────────────────────────────
async function submitUsername(signAction, username, jar) {
  const url  = AUTH_BASE + '/' + signAction.replace(/^\.\//, '')
  const body = new URLSearchParams({
    'usernameFieldPanel:usernameFieldPanel_body:usernameField': username,
    'loginLink': 'x',
  })
  const res = await go(url, { method: 'POST', body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, jar)

  const loc = res.headers.get('location') || ''

  // Microsoft SSO → cannot automate
  if (loc.includes('microsoftonline.com') || loc.includes('microsoft.com') || loc.includes('/oidc?iss=')) {
    throw new Error('MICROSOFT_SSO')
  }

  const full = loc.startsWith('http') ? loc : AUTH_BASE + loc
  const res2 = await go(full, {}, jar)
  const html = await res2.text?.() || ''

  if (html.includes('microsoftonline.com')) throw new Error('MICROSOFT_SSO')

  const pwdM = html.match(/action="([^"]*passwordForm[^"]*|[^"]*signInForm[^"]*)"/)
  if (!pwdM) throw new Error('Gebruikersnaam niet gevonden')
  return { pwdAction: pwdM[1].replace(/&amp;/g, '&'), html }
}

// ─── Step 4: Submit password, get auth code ───────────────────────────────────
async function submitPassword(pwdAction, password, jar) {
  const url  = AUTH_BASE + '/' + pwdAction.replace(/^\.\//, '')
  const body = new URLSearchParams({
    'passwordFieldPanel:passwordFieldPanel_body:passwordField': password,
    'loginLink': 'x',
  })
  let res = await go(url, { method: 'POST', body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, jar)

  // Follow redirects until we reach leerling.somtoday.nl/redirect?code=...
  for (let i = 0; i < 10; i++) {
    if (res.status < 300 || res.status >= 400) break
    const loc  = res.headers.get('location') || ''
    if (!loc) break
    if (loc.includes('code=')) return loc  // got the auth code redirect
    const full = loc.startsWith('http') ? loc : AUTH_BASE + loc
    res = await go(full, {}, jar)
  }

  // Check final URL for code
  const loc = res.headers.get('location') || ''
  if (loc.includes('code=')) return loc

  const html = await res.text?.() || ''
  if (html.includes('error') || html.includes('Onjuist') || html.includes('onjuist')) {
    throw new Error('Wachtwoord onjuist')
  }
  throw new Error('Inloggen mislukt — auth code niet ontvangen')
}

// ─── Step 5: Exchange code for token ─────────────────────────────────────────
async function exchangeCode(code, verifier) {
  const res = await fetch(AUTH_BASE + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIR_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  })
  if (!res.ok) throw new Error(`Token uitwisseling mislukt: ${res.status}`)
  return res.json()
}

// ─── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const action = event.queryStringParameters?.action
  let body = {}
  if (event.body) { try { body = JSON.parse(event.body) } catch {} }

  // ── token: full Wicket login flow ──────────────────────────────────────────
  if (action === 'token') {
    const { schoolName, username, password } = body
    if (!schoolName || !username || !password) return fail('Vul alle velden in')
    try {
      const { verifier, formAction, jar } = await startSession()
      const { signAction }                = await submitSchool(formAction, schoolName, jar)
      const { pwdAction }                 = await submitUsername(signAction, username, jar)
      const codeUrl                       = await submitPassword(pwdAction, password, jar)

      const params    = new URLSearchParams(new URL(codeUrl).search)
      const code      = params.get('code')
      if (!code) return fail('Geen auth code ontvangen')

      const tokenData = await exchangeCode(code, verifier)
      return ok({
        access_token:    tokenData.access_token,
        refresh_token:   tokenData.refresh_token,
        expires_in:      tokenData.expires_in || 3600,
        somtoday_api_url: tokenData.somtoday_api_url || 'https://production.somtoday.nl',
      })
    } catch (e) {
      if (e.message === 'MICROSOFT_SSO') {
        return fail('Jouw school gebruikt Microsoft-aanmelding. Gebruik de SOMtoday-app of leerling.somtoday.nl om in te loggen.', 403)
      }
      return fail(e.message || 'Inloggen mislukt')
    }
  }

  // ── refresh: refresh_token grant ──────────────────────────────────────────
  if (action === 'refresh') {
    const { refreshToken } = body
    if (!refreshToken) return fail('Geen refresh token')
    try {
      const res = await fetch(AUTH_BASE + '/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: new URLSearchParams({
          grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID,
        }).toString(),
      })
      if (!res.ok) return fail(`Token refresh mislukt: ${res.status}`, 401)
      const data = await res.json()
      return ok({
        access_token:  data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_in:    data.expires_in || 3600,
      })
    } catch (e) { return fail(e.message) }
  }

  // ── me: fetch leerling info ────────────────────────────────────────────────
  if (action === 'me') {
    const { accessToken, somtodayApiUrl } = body
    if (!accessToken || !somtodayApiUrl) return fail('Ontbrekende velden')
    try {
      const res = await fetch(`${somtodayApiUrl}/rest/v1/leerlingen`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': UA },
      })
      if (!res.ok) return fail(`Leerlinginfo mislukt: ${res.status}`, res.status)
      const data = await res.json()
      const l    = data.items?.[0]
      if (!l) return fail('Geen leerling gevonden')
      return ok({ id: l.links?.[0]?.id, roepnaam: l.roepnaam, achternaam: l.achternaam, leerlingNummer: l.leerlingnummer })
    } catch (e) { return fail(e.message) }
  }

  // ── schedule: fetch afspraken ─────────────────────────────────────────────
  if (action === 'schedule') {
    const { accessToken, somtodayApiUrl, from, to } = body
    if (!accessToken || !somtodayApiUrl || !from || !to) return fail('Ontbrekende velden')
    try {
      const url = `${somtodayApiUrl}/rest/v1/afspraken?begindatum=${from}&einddatum=${to}&additional=vak,docentAfkortingen,locatie`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': UA },
      })
      if (!res.ok) return fail(`Rooster mislukt: ${res.status}`, res.status)
      const data = await res.json()
      const lessons = (data.items || []).map(a => ({
        id: a.links?.[0]?.id, start: a.beginDatumTijd, end: a.eindDatumTijd,
        title: a.vak?.afkorting || a.omschrijving || '?',
        description: a.vak?.naam || '', location: a.locatie || '',
        teachers: a.docentAfkortingen || [],
        cancelled: a.afspraakStatus === 'GEANNULEERD', lessonHour: a.lesuurVanaf,
        _source: 'somtoday',
      }))
      return ok(lessons)
    } catch (e) { return fail(e.message) }
  }

  return fail('Onbekende actie', 404)
}
