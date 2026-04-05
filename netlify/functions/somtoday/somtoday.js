const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
}

function ok(data) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) }
}
function fail(msg, status = 400) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' }

  const action = event.queryStringParameters?.action
  let body = {}
  if (event.body) {
    try { body = JSON.parse(event.body) } catch {}
  }

  // ── schools: search organisaties.json ────────────────────────────────────────
  if (action === 'schools') {
    const q = (event.queryStringParameters?.q || '').toLowerCase().trim()
    const ORGS_URL = 'https://servers.somtoday.nl/organisaties.json'
    const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    const attempts = [
      // 1. Direct with browser-like headers
      () => fetch(ORGS_URL, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'application/json, */*',
          'Accept-Language': 'nl-NL,nl;q=0.9',
          'Referer': 'https://leerling.somtoday.nl/',
          'Origin': 'https://leerling.somtoday.nl',
        },
      }),
      // 2. Via allorigins proxy (adds CORS headers, works from any IP)
      () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(ORGS_URL)}`),
      // 3. Via corsproxy.io
      () => fetch(`https://corsproxy.io/?${encodeURIComponent(ORGS_URL)}`),
    ]
    for (const attempt of attempts) {
      try {
        const res = await attempt()
        if (!res.ok) continue
        const json = await res.json()
        const orgs = Array.isArray(json)
          ? (json[0]?.instellingen || json.flatMap(x => x.instellingen || []))
          : (json.instellingen || [])
        if (!orgs.length) continue
        const filtered = q ? orgs.filter(o => (o.naam || '').toLowerCase().includes(q)) : orgs
        return ok(filtered.slice(0, 25).map(o => ({ name: o.naam, uuid: o.uuid })))
      } catch { /* try next */ }
    }
    return fail('Kan scholen niet laden — SOMtoday API onbereikbaar')
  }

  // ── token: password grant ─────────────────────────────────────────────────────
  if (action === 'token') {
    const { username, password, schoolUuid } = body
    if (!username || !password || !schoolUuid) return fail('Ontbrekende velden')
    try {
      const res = await fetch('https://inloggen.somtoday.nl/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          username,
          password,
          scope: 'openid',
          client_id: 'somtoday-leerling-native',
          tenant_uuid: schoolUuid,
        }).toString(),
      })
      if (!res.ok) {
        const text = await res.text()
        return fail(`Inloggen mislukt (${res.status}): ${text}`, 401)
      }
      const data = await res.json()
      return ok({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600,
        somtoday_api_url: data.somtoday_api_url,
      })
    } catch (e) {
      return fail('Verbindingsfout: ' + e.message)
    }
  }

  // ── refresh: refresh_token grant ─────────────────────────────────────────────
  if (action === 'refresh') {
    const { refreshToken } = body
    if (!refreshToken) return fail('Geen refresh token')
    try {
      const res = await fetch('https://inloggen.somtoday.nl/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: 'somtoday-leerling-native',
        }).toString(),
      })
      if (!res.ok) return fail(`Token refresh mislukt: ${res.status}`, 401)
      const data = await res.json()
      return ok({
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_in: data.expires_in || 3600,
      })
    } catch (e) {
      return fail('Verbindingsfout: ' + e.message)
    }
  }

  // ── me: fetch leerling info ───────────────────────────────────────────────────
  if (action === 'me') {
    const { accessToken, somtodayApiUrl } = body
    if (!accessToken || !somtodayApiUrl) return fail('Ontbrekende velden')
    try {
      const res = await fetch(`${somtodayApiUrl}/rest/v1/leerlingen`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (!res.ok) return fail(`Leerlinginfo mislukt: ${res.status}`, res.status)
      const data = await res.json()
      const l = data.items?.[0]
      if (!l) return fail('Geen leerling gevonden')
      return ok({
        id: l.links?.[0]?.id,
        roepnaam: l.roepnaam,
        achternaam: l.achternaam,
        leerlingNummer: l.leerlingnummer,
      })
    } catch (e) {
      return fail('Verbindingsfout: ' + e.message)
    }
  }

  // ── schedule: fetch afspraken ─────────────────────────────────────────────────
  if (action === 'schedule') {
    const { accessToken, somtodayApiUrl, from, to } = body
    if (!accessToken || !somtodayApiUrl || !from || !to) return fail('Ontbrekende velden')
    try {
      const url = `${somtodayApiUrl}/rest/v1/afspraken?begindatum=${from}&einddatum=${to}&additional=vak,docentAfkortingen,locatie`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (!res.ok) return fail(`Rooster mislukt: ${res.status}`, res.status)
      const data = await res.json()
      const lessons = (data.items || []).map(a => ({
        id: a.links?.[0]?.id,
        start: a.beginDatumTijd,
        end: a.eindDatumTijd,
        title: a.vak?.afkorting || a.omschrijving || '?',
        description: a.vak?.naam || '',
        location: a.locatie || '',
        teachers: a.docentAfkortingen || [],
        cancelled: a.afspraakStatus === 'GEANNULEERD',
        lessonHour: a.lesuurVanaf,
        _source: 'somtoday',
      }))
      return ok(lessons)
    } catch (e) {
      return fail('Verbindingsfout: ' + e.message)
    }
  }

  return fail('Onbekende actie', 404)
}
