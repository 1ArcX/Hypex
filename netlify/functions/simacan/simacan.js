const fetch = require('node-fetch')

const KEYCLOAK_URL = 'https://sso.simacan.com/auth/realms/jumbo-sc/protocol/openid-connect/token'
const AUTH_SERVICE  = 'https://auth-service.services.simacan.com'
const CONTROL_TOWER = 'https://sct-web-api-prod.simacan.com'
const SHIPPER       = 'jumbo_sc'
const REALM         = 'jumbo-sc'
const LOCATION_ID   = '7044'
const CLIENT_ID     = 'arrival-display'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

function ok(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) }
}
function err(msg, status = 400) {
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify({ error: msg }) }
}

async function loginSimacan(username, password) {
  // Stap 1: Keycloak password grant
  const res = await fetch(KEYCLOAK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username, password, client_id: CLIENT_ID }).toString(),
    timeout: 12000
  })

  if (!res.ok) {
    const text = await res.text()
    let msg = 'Simacan login mislukt'
    try {
      const json = JSON.parse(text)
      msg = json.error_description || json.error || msg
    } catch {}
    throw new Error(msg)
  }

  const { access_token } = await res.json()

  // Stap 2: Wissel Keycloak token in voor Simacan-specifieke token
  try {
    const authRes = await fetch(`${AUTH_SERVICE}/api/v1/auth/${SHIPPER}/${REALM}`, {
      headers: { 'Authorization': `Bearer ${access_token}` },
      timeout: 10000
    })
    if (authRes.ok) {
      const authData = await authRes.json()
      const simToken = authData.token || authData.access_token
      if (simToken) return simToken
    }
  } catch (_) {}

  // Fallback: gebruik Keycloak token direct
  return access_token
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid JSON') }

  const { action, username, password } = body
  if (!action || !username || !password) return err('action, username en password zijn verplicht')

  let token
  try {
    token = await loginSimacan(username, password)
  } catch (e) {
    return err(e.message || 'Simacan login mislukt', 401)
  }

  if (action === 'login') {
    return ok({ success: true })
  }

  if (action === 'locationStops') {
    const date = body.date || new Date().toISOString()
    const qs = new URLSearchParams({ locationId: LOCATION_ID, timestamp: date }).toString()
    const res = await fetch(`${CONTROL_TOWER}/api/internal/v2/${SHIPPER}/locations/locationStops?${qs}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 12000
    })
    const data = await res.json()
    if (!res.ok) return err(data?.message || 'Vrachttijden ophalen mislukt', 500)
    return ok(data)
  }

  if (action === 'notifications') {
    const res = await fetch(`${CONTROL_TOWER}/api/internal/v2/${SHIPPER}/client/notification/${LOCATION_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000
    })
    const data = await res.json()
    return ok(data)
  }

  if (action === 'tripRoute') {
    const { tripUuid } = body
    if (!tripUuid) return err('tripUuid is verplicht')
    const res = await fetch(`${CONTROL_TOWER}/api/internal/v3/stopAndRoutes/${tripUuid}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000
    })
    const data = await res.json()
    return ok(data)
  }

  return err(`Onbekende actie: ${action}`)
}
