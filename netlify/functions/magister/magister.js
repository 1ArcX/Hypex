const { Issuer, generators } = require('openid-client')
const fetch = require('node-fetch')

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Magister-Tokens',
  'Content-Type': 'application/json'
}

function ok(data, tokenSet) {
  const headers = { ...HEADERS }
  if (tokenSet?.access_token) {
    try {
      headers['X-Magister-Tokens'] = Buffer.from(JSON.stringify({
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: tokenSet.expires_at
      })).toString('base64')
    } catch {}
  }
  return { statusCode: 200, headers, body: JSON.stringify(data) }
}
function err(msg, status = 400) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }
}

async function refreshTokens(refreshToken) {
  const res = await fetch('https://accounts.magister.net/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'M6LOAPP',
    }).toString()
  })
  if (!res.ok) throw new Error(`Token refresh mislukt: ${res.status}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600)
  }
}
function dateStr(d) {
  if (!d) return null
  try { return new Date(d).toISOString() } catch { return String(d) }
}

function joinCookies(setCookieArray) {
  return (setCookieArray || []).map(c => c.split(';')[0]).join('; ')
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

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
    prompt: 'login'
  })

  // Step 1: Get the login session + cookies
  const r1 = await fetch(authUrl, noRedirects)
  const r1loc = r1.headers.get('location')
  if (!r1loc) throw new Error(`Magister auth stap 1 mislukt (status ${r1.status})`)
  const r2 = await fetch(r1loc, noRedirects)
  const location = r2.headers.get('location')
  if (!location) throw new Error(`Magister auth stap 2 mislukt (status ${r2.status})`)

  const locationUrl = new URL(location.startsWith('http') ? location : issuerUrl + location)
  const sessionId = locationUrl.searchParams.get('sessionId')
  const returnUrl = locationUrl.searchParams.get('returnUrl')
  if (!sessionId || !returnUrl) throw new Error(`Geen sessie ontvangen van Magister`)

  const rawCookies = r2.headers.raw()['set-cookie'] || []
  const cookieStr = joinCookies(rawCookies)
  const xsrfEntry = rawCookies.find(c => c.split('=')[0] === 'XSRF-TOKEN')
  if (!xsrfEntry) throw new Error(`Geen XSRF token van Magister (mogelijk gewijzigd inlogformaat)`)
  const xsrfToken = xsrfEntry.split('=')[1].split(';')[0]

  const challengeHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': UA,
    cookie: cookieStr,
    'X-XSRF-TOKEN': xsrfToken,
    'Origin': issuerUrl,
    'Referer': `${issuerUrl}/account/login`
  }

  // Step 2: Prime session via POST /challenges/current (session is cookie-driven, no authCode needed)
  const curResp = await fetch(`${issuerUrl}/challenges/current`, {
    method: 'POST', timeout: 10000,
    body: JSON.stringify({}),
    headers: challengeHeaders
  })
  const curBody = await curResp.json().catch(() => ({}))
  console.log('challenges/current:', curResp.status, JSON.stringify(curBody).slice(0, 200))

  // Step 3: Username challenge — session tracked via cookies, no authCode required
  const uResp = await fetch(`${issuerUrl}/challenges/username`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, returnUrl, username }),
    headers: challengeHeaders
  })
  const uText = await uResp.text()
  console.log('challenges/username:', uResp.status, uText.slice(0, 300))
  if (uResp.status !== 200) throw new Error(`Gebruikersnaam niet herkend (${uResp.status})`)
  const uBody = JSON.parse(uText)
  if (uBody.error && uBody.error !== 'Unable to load session') throw new Error('Inloggen mislukt')
  if (uBody.action !== 'password') throw new Error('Onbekende gebruikersnaam')

  // Step 4: Password challenge
  const pResp = await fetch(`${issuerUrl}/challenges/password`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, returnUrl, password }),
    headers: challengeHeaders
  })
  const pText = await pResp.text()
  console.log('challenges/password:', pResp.status, pText.slice(0, 300))
  if (pResp.status !== 200) throw new Error(`Wachtwoord geweigerd door Magister (${pResp.status})`)
  const pBody = JSON.parse(pText)
  if (pBody.error) throw new Error('Wachtwoord onjuist')

  const authCookies = joinCookies(pResp.headers.raw()['set-cookie'])

  // Step 5: Get auth code from redirect
  const finalResp = await fetch(`${issuerUrl}${returnUrl}`, {
    redirect: 'manual', follow: 0,
    headers: { cookie: authCookies }
  })
  const finalLoc = finalResp.headers.get('location')
  if (!finalLoc || !finalLoc.includes('code=')) throw new Error(`Auth code ontbreekt${finalLoc ? ` (redirect: ${finalLoc.slice(0, 80)})` : ' (geen redirect)'}`)

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

  const { action, username, password, savedTokens } = body
  const school = 'ichthus'

  if (!action || !username) return err('action en username zijn verplicht')

  let tokenSet
  let m

  // Probeer bestaande tokens te gebruiken (skip volledige OAuth flow)
  if (savedTokens?.access_token && action !== 'login') {
    try {
      const now = Math.floor(Date.now() / 1000)
      if (savedTokens.expires_at && savedTokens.expires_at - now < 120) {
        console.log('Tokens verlopen, refreshen voor', username)
        tokenSet = await refreshTokens(savedTokens.refresh_token)
      } else {
        tokenSet = savedTokens
      }
      const magister = require('magister.js').default
      m = await magister({
        school: { url: `https://${school}.magister.net` },
        username, password: undefined, tokenSet,
      })
      console.log('Auth via cached tokens voor', username)
    } catch (e) {
      console.warn('Token reuse mislukt, fallback naar wachtwoord auth:', e.message)
      tokenSet = null
      m = null
    }
  }

  // Fallback: volledige OAuth login
  if (!m) {
    if (!password) return err('action, username en password zijn verplicht')
    try {
      tokenSet = await authenticate(school, username, password)
      console.log('Auth OK (full) voor', username)
      const magister = require('magister.js').default
      m = await magister({
        school: { url: `https://${school}.magister.net` },
        username, password: undefined, tokenSet,
      })
    } catch (e) {
      console.error('Auth FOUT:', e.message)
      return err(e.message || 'Inloggen mislukt. Controleer je leerlingnummer en wachtwoord.', 401)
    }
  }

  try {
    if (action === 'login') {
      return ok({ success: true }, tokenSet)
    }

    if (action === 'fetchAll') {
      const hwFrom = new Date(body.hwStart || new Date())
      const hwTo   = new Date(body.hwEnd   || (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })())

      const [coursesRes, appointmentsRes, opdrachtenRes, swRes] = await Promise.allSettled([
        m.courses(),
        m.appointments(hwFrom, hwTo),
        m.http.get(`${m._personUrl}/opdrachten?top=50&skip=0`).then(r => r.json()).catch(() => ({ Items: [] })),
        m.http.get(`${m._pupilUrl}/studiewijzers?top=50&skip=0`).then(r => r.text()).catch(() => ''),
      ])

      // Grades
      let grades = []
      if (coursesRes.status === 'fulfilled') {
        const courses = coursesRes.value
        const current = courses.find(c => c.isCurrent) || courses[courses.length - 1]
        if (current) {
          try { grades = await current.grades({ fillGrades: true }) } catch (_) {}
          if (!grades.length) { try { grades = await current.grades({ latest: true, fillGrades: true }) } catch (_) {} }
          grades = grades.slice().sort((a, b) => new Date(b.dateFilledIn || b.testDate) - new Date(a.dateFilledIn || a.testDate)).slice(0, 30)
            .map(g => ({ vak: g.class?.description || g.class?.abbreviation || '', cijfer: g.grade, omschrijving: g.description || g.type?.description || '', datum: dateStr(g.dateFilledIn || g.testDate), weging: g.weight, klaar: g.passed }))
        }
      }

      // Homework
      let homework = []
      if (appointmentsRes.status === 'fulfilled') {
        homework = appointmentsRes.value.filter(a => a.content && a.content.trim())
          .map(a => ({ vak: a.classes?.join(', ') || a.description || '', omschrijving: a.content || '', datum: dateStr(a.start), klaar: a.finished || false }))
      }

      // Opdrachten
      let assignments = []
      if (opdrachtenRes.status === 'fulfilled') {
        const ids = (opdrachtenRes.value.Items || []).map(i => i.Id)
        const details = await Promise.allSettled(ids.map(id => m.http.get(`${m._personUrl}/opdrachten/${id}`).then(r => r.json())))
        assignments = details.filter(r => r.status === 'fulfilled').map(r => r.value).map(raw => ({
          naam: raw.Titel || '', omschrijving: raw.Omschrijving || '',
          vak: raw.Vak?.Omschrijving || raw.Vak?.Afkorting || '',
          deadline: dateStr(raw.InleverenVoor), ingeleverdOp: dateStr(raw.IngeleverdOp),
          beoordeling: raw.Beoordeling || null, beoordeeldOp: dateStr(raw.BeoordeeldOp),
          afgesloten: raw.Afgesloten || false, magInleveren: raw.MagInleveren || false, opnieuwInleveren: raw.OpnieuwInleveren || false
        }))
      }

      // Studiewijzer
      let studiewijzer = []
      if (swRes.status === 'fulfilled') {
        const text = swRes.value
        if (text && text.trim().startsWith('{')) {
          studiewijzer = (JSON.parse(text).Items || []).map(item => ({ id: item.Id, naam: item.Naam || item.Titel || '', vak: item.Vak?.Omschrijving || item.Vak?.Afkorting || '', omschrijving: item.Omschrijving || '' }))
        }
      }

      return ok({ grades, homework, assignments, studiewijzer }, tokenSet)
    }

    if (action === 'grades') {
      const top = body.top || 30
      const courses = await m.courses()
      const current = courses.find(c => c.isCurrent) || courses[courses.length - 1]
      if (!current) return ok([], tokenSet)
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
      })), tokenSet)
    }

    if (action === 'vakken') {
      const courses = await m.courses()
      const current = courses.find(c => c.isCurrent) || courses[courses.length - 1]
      if (!current) return ok([], tokenSet)
      const classes = await current.classes()
      return ok(classes.map(c => ({
        naam: c.description || c.abbreviation || '',
        afkorting: c.abbreviation || ''
      })), tokenSet)
    }

    if (action === 'lesmateriaal') {
      const materials = await m.schoolUtilities()
      return ok(materials.map(u => ({
        naam: u.name || '',
        uitgeverij: u.publisher || '',
        url: u.url || null,
        vak: u.class?.description || u.class?.abbreviation || ''
      })), tokenSet)
    }

    if (action === 'open_book') {
      const { ean } = body
      if (!ean) return err('ean required')
      const fallback = `https://apps.noordhoff.nl/se/deeplink?targetEAN=${ean}`
      try {
        const resp = await m.http.get(`${m._personUrl}/digitaallesmateriaal/Ean/${ean}?redirect_type=body&display=inline`)
        const data = await resp.json()
        const url = data.location || data.Location || data.Url || data.url
        return ok({ url: url || fallback }, tokenSet)
      } catch {
        return ok({ url: fallback }, tokenSet)
      }
    }

    if (action === 'opdrachten') {
      const count = body.count || 50
      const listResp = await m.http.get(`${m._personUrl}/opdrachten?top=${count}&skip=0`)
      const listData = await listResp.json()
      const ids = (listData.Items || []).map(i => i.Id)
      const details = await Promise.allSettled(ids.map(id =>
        m.http.get(`${m._personUrl}/opdrachten/${id}`).then(r => r.json())
      ))
      return ok(details.filter(r => r.status === 'fulfilled').map(r => r.value).map(raw => ({
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
      })), tokenSet)
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
      })), tokenSet)
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
      })), tokenSet)
    }

    if (action === 'studiewijzer') {
      const resp = await m.http.get(`${m._pupilUrl}/studiewijzers?top=50&skip=0`)
      const text = await resp.text()
      console.log('studiewijzers raw:', resp.status, text.slice(0, 300))
      if (!text || !text.trim().startsWith('{')) return ok([], tokenSet)
      const json = JSON.parse(text)
      const items = json.Items || []
      return ok(items.map(item => ({
        id: item.Id,
        naam: item.Naam || item.Titel || '',
        vak: item.Vak?.Omschrijving || item.Vak?.Afkorting || '',
        omschrijving: item.Omschrijving || ''
      })), tokenSet)
    }

    if (action === 'studiewijzer_detail') {
      const { id } = body
      if (!id) return err('id verplicht')

      const toArr = (v) => Array.isArray(v) ? v : []
      const schoolBase = m._pupilUrl.replace(/\/api\/.*/, '')

      const detailResp = await m.http.get(`${m._pupilUrl}/studiewijzers/${id}`)
      const detailText = await detailResp.text()
      if (!detailText || !detailText.trim().startsWith('{')) return ok({ topics: [] }, tokenSet)

      const dj = JSON.parse(detailText)
      const ondrItems = toArr(dj.Onderdelen?.Items || dj.Onderdelen)

      // Fetch each onderdeel detail in parallel to get Bronnen
      const settled = await Promise.allSettled(ondrItems.map(async (t) => {
        const selfLink = (t.Links || []).find(l => l.Rel === 'Self')
        let bronnen = toArr(t.Bronnen)
        if (selfLink && bronnen.length === 0) {
          try {
            const r = await m.http.get(`${schoolBase}${selfLink.Href}`)
            const txt = await r.text()
            if (txt.trim().startsWith('{')) {
              const detail = JSON.parse(txt)
              bronnen = toArr(detail.Bronnen)
              console.log('onderdeel detail keys:', Object.keys(detail))
              console.log('bronnen raw:', JSON.stringify(bronnen).slice(0, 800))
            }
          } catch (_) {}
        }
        return {
          id: t.Id,
          naam: t.Naam || t.Titel || '',
          inhoud: t.Inhoud || t.Omschrijving || '',
          _rawBronnen: bronnen.slice(0, 2),
          bijlagen: bronnen.map(b => {
            const contentsHref = ((b.Links || []).find(l => l.Rel === 'Contents') || {}).Href || null
            return {
              id: b.Id,
              naam: b.Naam || b.Titel || '',
              href: contentsHref,
              url: b.Uri || b.Url || b.ContentUri || null,
              type: b.ContentType || 'application/octet-stream'
            }
          })
        }
      }))

      const topics = settled.filter(r => r.status === 'fulfilled').map(r => r.value)
      return ok({ topics }, tokenSet)
    }

    if (action === 'activiteiten') {
      const resp = await m.http.get(`${m._personUrl}/activiteiten?top=50&skip=0`)
      const json = await resp.json()
      return ok((json.Items || []).map(a => ({
        id: a.Id,
        naam: a.Naam || a.Titel || '',
        omschrijving: a.Omschrijving || '',
        inschrijvenVan: dateStr(a.InschrijvenVan),
        inschrijvenTot: dateStr(a.InschrijvenTot),
        aantalDeelnemers: a.AantalDeelnemers ?? null,
        minDeelnemers: a.MinDeelnemers ?? null,
        maxDeelnemers: a.MaxDeelnemers ?? null,
        isIngeschreven: a.IsIngeschreven || false,
      })), tokenSet)
    }

    if (action === 'activiteiten_detail') {
      const { id } = body
      if (!id) return err('id verplicht')
      const resp = await m.http.get(`${m._personUrl}/activiteiten/${id}`)
      const raw = await resp.json()
      return ok({
        id: raw.Id,
        naam: raw.Naam || raw.Titel || '',
        omschrijving: raw.Omschrijving || '',
        inschrijvenVan: dateStr(raw.InschrijvenVan),
        inschrijvenTot: dateStr(raw.InschrijvenTot),
        aantalDeelnemers: raw.AantalDeelnemers ?? null,
        minDeelnemers: raw.MinDeelnemers ?? null,
        maxDeelnemers: raw.MaxDeelnemers ?? null,
        isIngeschreven: raw.IsIngeschreven || false,
        deelactiviteiten: (raw.Deelactiviteiten?.Items || []).map(d => ({
          id: d.Id,
          naam: d.Naam || '',
          inhoud: d.Inhoud || '',
          beschikbarePlaatsen: d.BeschikbarePlaatsen ?? null,
        }))
      }, tokenSet)
    }

    if (action === 'bron_download') {
      const { href } = body
      if (!href) return err('href verplicht')
      const schoolBase = m._pupilUrl.replace(/\/api\/.*/, '')

      // href is the Contents link, e.g. /api/.../bijlagen/165859
      // Try with /data suffix first, then bare
      let resp = await m.http.get(`${schoolBase}${href}/data`)
      console.log('bijlagen/data status:', resp.status)
      if (resp.status === 404 || resp.status >= 400) {
        resp = await m.http.get(`${schoolBase}${href}`)
        console.log('bijlagen bare status:', resp.status)
      }

      const contentType = resp.headers.get('content-type') || 'application/octet-stream'
      const arrayBuffer = await resp.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      console.log('bytes:', arrayBuffer.byteLength, 'contentType:', contentType)
      return ok({ base64, contentType }, tokenSet)
    }

    return err(`Onbekende actie: ${action}`)

  } catch (e) {
    console.error('Magister API fout:', e)
    return err(`API fout: ${e.message}`, 500)
  }
}
