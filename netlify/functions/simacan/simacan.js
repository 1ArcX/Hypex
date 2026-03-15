const fetch = require('node-fetch')

const KEYCLOAK_TOKEN_URL = 'https://sso.simacan.com/auth/realms/jumbo-sc/protocol/openid-connect/token'
const CONTROL_TOWER     = 'https://sct-web-api-prod.simacan.com'
const SHIPPER           = 'jumbo_sc'
const LOCATION_ID       = '7044'
const CLIENT_ID         = 'frontend'

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

async function refreshAccessToken(refreshToken) {
  const res = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken
    }).toString(),
    timeout: 10000
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error('Token vernieuwen mislukt: ' + text.slice(0, 80))
  }
  return res.json()
}

async function apiCall(token, path) {
  const res = await fetch(`${CONTROL_TOWER}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    timeout: 12000
  })
  return { status: res.status, data: await res.json() }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid JSON') }

  const { action, token, refreshToken } = body
  if (!action) return err('action is verplicht')

  // Token vernieuwen
  if (action === 'refresh') {
    if (!refreshToken) return err('refreshToken is verplicht')
    try {
      const tokens = await refreshAccessToken(refreshToken)
      return ok({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in })
    } catch (e) {
      return err(e.message, 401)
    }
  }

  if (!token) return err('token is verplicht')

  // Helper: voer API call uit, refresh automatisch bij 401
  async function callApi(path, currentToken, currentRefresh) {
    let { status, data } = await apiCall(currentToken, path)

    // Token verlopen — refresh proberen
    if (status === 401 && currentRefresh) {
      try {
        const newTokens = await refreshAccessToken(currentRefresh)
        const retry = await apiCall(newTokens.access_token, path)
        return {
          status: retry.status,
          data: retry.data,
          newAccessToken: newTokens.access_token,
          newRefreshToken: newTokens.refresh_token
        }
      } catch (_) {}
    }
    return { status, data }
  }

  if (action === 'locationStops') {
    const date = body.date || new Date().toISOString()
    const path = `/api/internal/v2/${SHIPPER}/locations/locationStops?locationId=${LOCATION_ID}&timestamp=${encodeURIComponent(date)}`
    const result = await callApi(path, token, refreshToken)
    if (result.status === 401) return err('Sessie verlopen. Vernieuw je token in de instellingen.', 401)
    if (!result.data || result.status >= 500) return err('Vrachttijden ophalen mislukt', 500)
    // API geeft stops terug als object (keyed by id) of als array — normaliseer naar array
    const raw = result.data?.locationStops || result.data?.stops || result.data?.result
    const locationStops = raw
      ? (Array.isArray(raw) ? raw : Object.values(raw))
      : Object.values(result.data).filter(v => v && typeof v === 'object' && v.id && v.trip)
    return ok({ locationStops, _newTokens: result.newAccessToken ? { accessToken: result.newAccessToken, refreshToken: result.newRefreshToken } : undefined })
  }

  if (action === 'notifications') {
    const path = `/api/internal/v2/${SHIPPER}/client/notification/${LOCATION_ID}`
    const result = await callApi(path, token, refreshToken)
    if (result.status === 401) return err('Sessie verlopen.', 401)
    return ok(result.data)
  }

  if (action === 'tripRoute') {
    const { tripUuid } = body
    if (!tripUuid) return err('tripUuid is verplicht')
    const result = await callApi(`/api/internal/v3/stopAndRoutes/${tripUuid}`, token, refreshToken)
    if (result.status === 401) return err('Sessie verlopen.', 401)
    // Also try v2 locationStops for vehicle position
    const data = result.data || {}
    return ok({ ...data, _newTokens: result.newAccessToken ? { accessToken: result.newAccessToken, refreshToken: result.newRefreshToken } : undefined })
  }

  return err(`Onbekende actie: ${action}`)
}
