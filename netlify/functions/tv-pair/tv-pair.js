// Spotify TV-pairing endpoint — koppelt de projector aan Spotify zonder typen.
// Opslag: @netlify/blobs (ingebouwd, geen SQL nodig, werkt direct na deploy).
//
// Flow:
//   1. Projector POST { action:"init", code:"ABCDEF" }     → pending entry (5 min TTL)
//   2. Dash browser POST { action:"complete", code, tokens } → tokens opgeslagen (30s TTL)
//   3. Projector GET ?code=ABCDEF                            → { status:"ready", tokens } + direct verwijderd
//
// Auth: Authorization: Bearer <WIDGET_TOKEN> of ?token=<WIDGET_TOKEN>

const { connectLambda, getStore } = require('@netlify/blobs')

const TOKEN = process.env.WIDGET_TOKEN
const STORE_NAME = 'tv-pair'
const INIT_TTL = 5 * 60 * 1000     // 5 minuten voor de hele flow
const COMPLETE_TTL = 30 * 1000     // 30 seconden nadat tokens zijn gezet

function extractToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return (event.queryStringParameters || {}).token || null
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '')

  const token = extractToken(event)
  if (!TOKEN) return resp(500, { error: 'WIDGET_TOKEN niet ingesteld' })

  // POST complete mag zonder token (de kortstondige paircode is zelf het geheim; de browser kent geen WIDGET_TOKEN).
  // Alle andere acties (init, GET poll) vereisen het WIDGET_TOKEN.
  const isComplete = event.httpMethod === 'POST' && (() => { try { return JSON.parse(event.body || '{}').action === 'complete' } catch { return false } })()
  if (!isComplete && token !== TOKEN) return resp(401, { error: 'unauthorized' })

  connectLambda(event)
  const store = getStore(STORE_NAME)

  // ── GET: projector pollt op status ────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const code = (event.queryStringParameters || {}).code
    if (!code || !/^[A-Z0-9]{4,8}$/.test(code)) return resp(400, { error: 'Ongeldige code' })

    const raw = await store.get(code)
    if (!raw) return resp(404, { status: 'expired' })

    let entry
    try { entry = JSON.parse(raw) } catch { return resp(404, { status: 'expired' }) }

    if (Date.now() > entry.expires_at) {
      await store.delete(code).catch(() => {})
      return resp(404, { status: 'expired' })
    }

    if (entry.status === 'pending') return resp(200, { status: 'pending' })

    if (entry.status === 'ready') {
      // Atomisch: stuur tokens en verwijder direct
      await store.delete(code).catch(() => {})
      return resp(200, {
        status: 'ready',
        tokens: entry.tokens,
      })
    }

    return resp(404, { status: 'expired' })
  }

  // ── POST: init of complete ────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch { return resp(400, { error: 'Ongeldige JSON' }) }

    const { action, code } = body
    if (!code || !/^[A-Z0-9]{4,8}$/.test(code)) return resp(400, { error: 'Code moet 4-8 hoofdletters/cijfers zijn' })

    // ── INIT: projector maakt een pending entry ─────────────────────────────
    if (action === 'init') {
      await store.set(code, JSON.stringify({
        status: 'pending',
        created_at: Date.now(),
        expires_at: Date.now() + INIT_TTL,
      }))
      return resp(200, { ok: true, code })
    }

    // ── COMPLETE: browser stuurt de Spotify-tokens ──────────────────────────
    if (action === 'complete') {
      const { tokens } = body
      if (!tokens?.access_token || !tokens?.refresh_token) {
        return resp(400, { error: 'tokens.access_token en tokens.refresh_token zijn vereist' })
      }

      // Check of de code bestaat en pending is
      const raw = await store.get(code)
      if (!raw) return resp(404, { error: 'Code niet gevonden of verlopen' })
      let entry
      try { entry = JSON.parse(raw) } catch { return resp(404, { error: 'Code niet gevonden of verlopen' }) }
      if (entry.status !== 'pending' || Date.now() > entry.expires_at) {
        await store.delete(code).catch(() => {})
        return resp(410, { error: 'Code verlopen' })
      }

      // Sla tokens op met korte TTL
      await store.set(code, JSON.stringify({
        status: 'ready',
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in || 3600,
        },
        created_at: entry.created_at,
        expires_at: Date.now() + COMPLETE_TTL,
      }))
      return resp(200, { ok: true })
    }

    return resp(400, { error: 'Onbekende actie. Gebruik "init" of "complete".' })
  }

  return resp(405, { error: 'Method not allowed' })
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
    body: typeof obj === 'string' ? obj : JSON.stringify(obj),
  }
}
