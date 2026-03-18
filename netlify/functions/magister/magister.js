const { Issuer, generators } = require('openid-client')
const fetch = require('node-fetch')

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

function ok(data) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) }
}
function err(msg, status = 400) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }
}
function dateStr(d) {
  if (!d) return null
  try { return new Date(d).toISOString() } catch { return String(d) }
}

function joinCookies(setCookieArray) {
  return (setCookieArray || []).map(c => c.split(';')[0]).join('; ')
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// Fetch authCode by scanning the login HTML for inline scripts and the bundle for API endpoint URLs
async function fetchAuthCode(sessionId, loginPageUrl, cookieStr, xsrfToken) {
  const issuerUrl = 'https://accounts.magister.net'
  const baseH = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Encoding': 'identity',
    cookie: cookieStr,
    'Origin': issuerUrl,
  }

  // Fetch the full login HTML
  const htmlRes = await fetch(loginPageUrl, { timeout: 10000, headers: baseH })
  const html = await htmlRes.text()
  console.log('login HTML (2000):', html.slice(0, 2000))

  // Pattern 1: authCode in HTML inline script or data attribute
  const inlineMatch = html.match(/authCode['":\s=]+['"]([0-9a-f]{8,20})['"]/)
  if (inlineMatch) { console.log('authCode from HTML:', inlineMatch[1]); return inlineMatch[1] }

  // Pattern 2: any data-* attribute with hex value
  const dataMatch = html.match(/data-auth[^=]*=["']([0-9a-f]{8,20})["']/)
  if (dataMatch) { console.log('authCode from data attr:', dataMatch[1]); return dataMatch[1] }

  // Fetch the JS bundle and look for fetch() URLs that might give us the authCode
  const bundleUrl = 'https://accounts.magister.net/js/account-7d007d40090e250ebfe8.js'
  const bundleRes = await fetch(bundleUrl, { timeout: 15000, headers: { ...baseH, 'Accept': '*/*', 'Referer': loginPageUrl } })
  const bundle = bundleRes.ok ? await bundleRes.text() : ''
  console.log('bundle len:', bundle.length)

  // Extract unique path strings from the bundle that look like API endpoints
  const paths = [...new Set([...bundle.matchAll(/["'`](\/(?:challenges|account|session|api)[/\w-]*(?:\?[^"'`]*)?)["'`]/g)].map(m => m[1]))]
  console.log('bundle paths:', paths.join(' | '))

  // Try each path as a potential authCode source
  const apiHeaders = { ...baseH, 'Accept': 'application/json', 'X-XSRF-TOKEN': xsrfToken, 'X-Requested-With': 'XMLHttpRequest' }
  for (const path of paths) {
    const url = `${issuerUrl}${path.includes('sessionId') ? path.replace(/sessionId=[^&"']*/, `sessionId=${sessionId}`) : path + (path.includes('?') ? '&' : '?') + `sessionId=${sessionId}`}`
    try {
      const r = await fetch(url, { timeout: 5000, headers: apiHeaders })
      if (!r.ok) continue
      const text = await r.text()
      console.log('API hit', url, text.slice(0, 200))
      try {
        const d = JSON.parse(text)
        const code = d.authCode || d.AuthCode || d.code
        if (code && /^[0-9a-f]{8,20}$/i.test(code)) { console.log('authCode from API:', code, url); return code }
      } catch {}
    } catch {}
  }

  throw new Error(`authCode niet gevonden (${paths.length} bundle-paden geprobeerd)`)
}

async function authenticate(school, username, password) {
  const issuerUrl = 'https://accounts.magister.net'
  const noRedirects = { redirect: 'manual', follow: 0 }

  const issuer = await Issuer.discover(issuerUrl)
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)
  const state = generators.state()
  const nonce = generators.nonce()

  const client = new issuer.Client({
    client_id: 'M6LOAPP',
    redirect_uris: ['m6loapp://oauth2redirect/'],
    response_types: ['code id_token'],
    id_token_signed_response_alg: 'RS256',
    token_endpoint_auth_method: 'none'
  })

  const authUrl = client.authorizationUrl({
    scope: 'openid profile offline_access',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    acr_values: `tenant:${school}.magister.net`,
    client_id: 'M6LOAPP',
    state, nonce,
    prompt: 'select_account'
  })

  // Step 1: Get the login session
  const r1 = await fetch(authUrl, noRedirects)
  const r2 = await fetch(r1.headers.get('location'), noRedirects)
  const location = r2.headers.get('location')

  const locationUrl = new URL(location.startsWith('http') ? location : issuerUrl + location)
  const sessionId = locationUrl.searchParams.get('sessionId')
  const returnUrl = locationUrl.searchParams.get('returnUrl')

  const rawCookies = r2.headers.raw()['set-cookie']
  const cookieStr = joinCookies(rawCookies)
  const xsrfEntry = rawCookies.find(c => c.split('=')[0] === 'XSRF-TOKEN')
  const xsrfToken = xsrfEntry.split('=')[1].split(';')[0]

  // Step 2: Fetch authCode from login HTML or bundle API paths
  const loginPageUrl = location.startsWith('http') ? location : issuerUrl + location
  const authCode = await fetchAuthCode(sessionId, loginPageUrl, cookieStr, xsrfToken)

  const challengeHeaders = {
    'Content-Type': 'application/json',
    cookie: cookieStr,
    'X-XSRF-TOKEN': xsrfToken
  }

  // Step 3: Username challenge
  const uResp = await fetch(`${issuerUrl}/challenges/username`, {
    method: 'POST',
    body: JSON.stringify({ authCode, sessionId, returnUrl, username }),
    headers: challengeHeaders
  })
  if (uResp.status !== 200) {
    const errText = await uResp.text().catch(() => '')
    throw new Error(`Inloggen mislukt (username ${uResp.status}: ${errText})`)
  }
  const uBody = await uResp.json()
  if (uBody.error && uBody.error !== 'Unable to load session') throw new Error('Inloggen mislukt')
  if (uBody.action !== 'password') throw new Error('Onbekende gebruikersnaam')

  // Step 4: Password challenge
  const pResp = await fetch(`${issuerUrl}/challenges/password`, {
    method: 'POST',
    body: JSON.stringify({ authCode, sessionId, returnUrl, password }),
    headers: challengeHeaders
  })
  if (pResp.status !== 200) throw new Error('Inloggen mislukt')
  const pBody = await pResp.json()
  if (pBody.error) throw new Error('Wachtwoord onjuist')

  const authCookies = joinCookies(pResp.headers.raw()['set-cookie'])

  // Step 5: Get auth code from redirect
  const finalResp = await fetch(`${issuerUrl}${returnUrl}`, {
    redirect: 'manual', follow: 0,
    headers: { cookie: authCookies }
  })
  const finalLoc = finalResp.headers.get('location')
  if (!finalLoc || !finalLoc.includes('code=')) throw new Error('Inloggen mislukt')

  const fragment = finalLoc.includes('#') ? finalLoc.split('#')[1] : finalLoc.split('?')[1]
  const params = Object.fromEntries(new URLSearchParams(fragment))
  if (!params.code) throw new Error('Inloggen mislukt')

  // Step 6: Exchange code for token
  const tokenSet = await client.callback('m6loapp://oauth2redirect/', params, {
    code_verifier: codeVerifier, state, nonce
  })

  return tokenSet
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid JSON') }

  const { action, username, password } = body
  const school = 'ichthus'

  if (!action || !username || !password) return err('action, username en password zijn verplicht')

  let tokenSet
  try {
    tokenSet = await authenticate(school, username, password)
    console.log('Auth OK voor', username)
  } catch (e) {
    console.error('Auth FOUT:', e.message)
    return err(e.message || 'Inloggen mislukt. Controleer je leerlingnummer en wachtwoord.', 401)
  }

  let m
  try {
    const magister = require('magister.js').default
    m = await magister({
      school: { url: `https://${school}.magister.net` },
      username, password: undefined, tokenSet,
    })
  } catch (e) {
    console.error('Magister session error:', e.message)
    return err('Sessie aanmaken mislukt', 500)
  }

  try {
    if (action === 'login') {
      return ok({ success: true })
    }

    if (action === 'grades') {
      const top = body.top || 30
      const courses = await m.courses()
      const current = courses.find(c => c.isCurrent) || courses[courses.length - 1]
      if (!current) return ok([])
      let grades = []
      try { grades = await current.grades({ fillGrades: true }) } catch (_) {}
      if (!grades.length) {
        try { grades = await current.grades({ latest: true, fillGrades: true }) } catch (_) {}
      }
      const sorted = grades.slice().sort((a, b) => new Date(b.dateFilledIn || b.testDate) - new Date(a.dateFilledIn || a.testDate)).slice(0, top)
      return ok(sorted.map(g => ({
        vak: g.class?.description || g.class?.abbreviation || '',
        cijfer: g.grade,
        omschrijving: g.description || g.type?.description || '',
        datum: dateStr(g.dateFilledIn || g.testDate),
        weging: g.weight,
        klaar: g.passed
      })))
    }

    if (action === 'vakken') {
      const courses = await m.courses()
      const current = courses.find(c => c.isCurrent) || courses[courses.length - 1]
      if (!current) return ok([])
      const classes = await current.classes()
      return ok(classes.map(c => ({
        naam: c.description || c.abbreviation || '',
        afkorting: c.abbreviation || ''
      })))
    }

    if (action === 'lesmateriaal') {
      const materials = await m.schoolUtilities()
      return ok(materials.map(u => ({
        naam: u.name || '',
        uitgeverij: u.publisher || '',
        url: u.url || null,
        vak: u.class?.description || u.class?.abbreviation || ''
      })))
    }

    if (action === 'opdrachten') {
      const count = body.count || 50
      const listResp = await m.http.get(`${m._personUrl}/opdrachten?top=${count}&skip=0&status=alle`)
      const listData = await listResp.json()
      const ids = (listData.Items || []).map(i => i.Id)
      const results = []
      for (const id of ids) {
        try {
          const resp = await m.http.get(`${m._personUrl}/opdrachten/${id}`)
          const raw = await resp.json()
          results.push({
            naam: raw.Titel || '',
            omschrijving: raw.Omschrijving || '',
            vak: raw.Vak?.Omschrijving || raw.Vak?.Afkorting || '',
            deadline: dateStr(raw.InleverenVoor),
            ingeleverdOp: dateStr(raw.IngeleverdOp),
            beoordeling: raw.Beoordeling || null,
            beoordeeldOp: dateStr(raw.BeoordeeldOp),
            afgesloten: raw.Afgesloten || false,
            magInleveren: raw.MagInleveren || false,
            opnieuwInleveren: raw.OpnieuwInleveren || false
          })
        } catch (_) {}
      }
      return ok(results)
    }

    if (action === 'schedule') {
      const from = new Date(body.start || new Date())
      const to = new Date(body.end || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })())
      const appointments = await m.appointments(from, to)
      return ok(appointments.map(a => ({
        vak: a.classes?.join(', ') || a.description || '',
        start: dateStr(a.start),
        einde: dateStr(a.end),
        lokaal: a.location || '',
        docent: a.teachers?.map(t => t.fullName || t.name).join(', ') || '',
        uitgevallen: a.isCancelled || false,
        huiswerk: a.content || ''
      })))
    }

    if (action === 'homework') {
      const from = new Date(body.start || new Date())
      const to = new Date(body.end || (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })())
      const appointments = await m.appointments(from, to)
      const hw = appointments.filter(a => a.content && a.content.trim())
      return ok(hw.map(a => ({
        vak: a.classes?.join(', ') || a.description || '',
        omschrijving: a.content || '',
        datum: dateStr(a.start),
        klaar: a.finished || false
      })))
    }

    return err(`Onbekende actie: ${action}`)

  } catch (e) {
    console.error('Magister API fout:', e)
    return err(`API fout: ${e.message}`, 500)
  }
}
