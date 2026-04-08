const { schedule } = require('@netlify/functions')
const webpush      = require('web-push')
const { createClient } = require('@supabase/supabase-js')
const fetch        = require('node-fetch')

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const rawEmail      = process.env.VAPID_EMAIL || 'admin@example.com'
const VAPID_EMAIL   = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const KC_TOKEN_URL  = 'https://sso.simacan.com/auth/realms/jumbo-sc/protocol/openid-connect/token'
const CONTROL_TOWER = 'https://sct-web-api-prod.simacan.com'
const SHIPPER       = 'jumbo_sc'
const LOCATION_ID   = '7044'

async function refreshToken(refreshTok) {
  const res = await fetch(KC_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: 'frontend', refresh_token: refreshTok }).toString(),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}

async function fetchStops(accessToken, refreshTok) {
  const date = new Date().toISOString()
  const path = `/api/internal/v2/${SHIPPER}/locations/locationStops?locationId=${LOCATION_ID}&timestamp=${encodeURIComponent(date)}`
  let res = await fetch(`${CONTROL_TOWER}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })

  let newTokens = null
  if (res.status === 401 && refreshTok) {
    const tok = await refreshToken(refreshTok)
    newTokens = { accessToken: tok.access_token, refreshToken: tok.refresh_token }
    res = await fetch(`${CONTROL_TOWER}${path}`, { headers: { Authorization: `Bearer ${newTokens.accessToken}` } })
  }
  if (!res.ok) return { stops: [], newTokens }

  const data = await res.json()
  const raw  = data?.locationStops || data?.stops || data?.result
  const stops = raw ? (Array.isArray(raw) ? raw : Object.values(raw))
                    : Object.values(data).filter(v => v && typeof v === 'object' && v.id && v.trip)
  return { stops, newTokens }
}

async function sendPush(subs, title, body, tag) {
  const payload = JSON.stringify({ title, body, tag, url: '/' })
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(sub.subscription, payload)
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

async function simacanCheckHandler() {
  // Skip between 22:00 and 06:00 Amsterdam time — no deliveries active
  const nowAms = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hour12: false })
  const h = parseInt(nowAms, 10)
  if (h >= 22 || h < 6) {
    console.log(`[simacan-check] Nacht (${h}u) — overgeslagen`)
    return { statusCode: 200, body: 'Nacht — overgeslagen' }
  }

  // Get users with vracht notifications enabled
  const { data: rows, error: rowsErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, subscription, vracht_notify_stops')
    .eq('vracht_enabled', true)

  if (rowsErr) { console.error('[simacan-check] Supabase fout:', rowsErr.message); return { statusCode: 500 } }
  console.log(`[simacan-check] Gebruikers met vracht_enabled: ${rows?.length ?? 0}`)

  for (const row of rows || []) {
    const notifyStops = (Array.isArray(row.vracht_notify_stops) ? row.vracht_notify_stops : []).map(String)
    console.log(`[simacan-check] Gebruiker ${row.user_id} — notifyStops:`, notifyStops)
    if (!notifyStops.length) continue

    // Get Simacan tokens from user metadata
    const { data: { user } } = await supabase.auth.admin.getUserById(row.user_id)
    const tokens = user?.user_metadata?.simacan_tokens
    if (!tokens?.accessToken) { console.log(`[simacan-check] Geen Simacan tokens voor ${row.user_id}`); continue }

    // Fetch today's stops
    const { stops, newTokens } = await fetchStops(tokens.accessToken, tokens.refreshToken)
    console.log(`[simacan-check] Stops opgehaald: ${stops.length}`)

    // Update tokens if refreshed
    if (newTokens) {
      await supabase.auth.admin.updateUserById(row.user_id, {
        user_metadata: { ...user.user_metadata, simacan_tokens: newTokens }
      })
    }

    if (!stops.length) continue

    // Load previous state
    const { data: stateRow } = await supabase
      .from('simacan_state')
      .select('stop_states')
      .eq('user_id', row.user_id)
      .maybeSingle()
    const prevStates = stateRow?.stop_states || {}

    const newStates = {}
    const subs = [{ id: row.id, subscription: row.subscription }]

    for (const stop of stops) {
      const stopId = String(stop.id)
      if (!notifyStops.includes(stopId)) {
        // Still track state for all stops, even if not monitored
        newStates[stopId] = { delay: stop.delay, activity: stop.tripStatus?.activity, eta: stop.actualStartTime || stop.eta || stop.plannedStartTime }
        continue
      }

      const eta    = stop.actualStartTime || stop.eta || stop.plannedStartTime
      const etaFmt = eta ? new Date(eta).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : '?'
      const act    = stop.tripStatus?.activity
      const delay  = stop.delay
      const dc     = stop.tripStatus?.startLocation?.name || stop.trip?.tripId || 'Rit'
      const prev   = prevStates[stopId]

      console.log(`[simacan-check] Stop ${stopId} (${dc}) — delay: ${delay}, act: ${act}, prev:`, prev)

      // lastNotifiedDelay bijhouden: alleen updaten als er een push verstuurd is
      const lastNotifiedDelay = prev?.lastNotifiedDelay ?? prev?.delay ?? null

      if (prev) {
        if (delay != null && lastNotifiedDelay != null && Math.abs(delay - lastNotifiedDelay) >= 5) {
          const more = delay > lastNotifiedDelay
          console.log(`[simacan-check] Push: vertraging gewijzigd stop ${stopId} (was ${lastNotifiedDelay}, nu ${delay})`)
          await sendPush(subs, '🚛 Vrachttijden',
            more ? `${dc} loopt meer uit (+${delay} min) — komt nu om ${etaFmt}`
                 : `${dc} loopt in (${delay > 0 ? '+' : ''}${delay} min) — komt om ${etaFmt}`,
            `delay-${stopId}`)
          newStates[stopId] = { delay, activity: act, eta, lastNotifiedDelay: delay }
        } else {
          // Geen push — lastNotifiedDelay ongewijzigd laten zodat vergelijking cumulatief blijft
          newStates[stopId] = { delay, activity: act, eta, lastNotifiedDelay }
        }
        if (prev.activity !== 'AFGEROND' && act === 'AFGEROND') {
          console.log(`[simacan-check] Push: afgerond stop ${stopId}`)
          await sendPush(subs, '✅ Vracht aangekomen',
            `${dc} is aangekomen${stop.actualStartTime ? ' om ' + new Date(stop.actualStartTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : ''}`,
            `arrived-${stopId}`)
        }
      } else {
        console.log(`[simacan-check] Stop ${stopId} — geen vorige staat, eerste run`)
        newStates[stopId] = { delay, activity: act, eta, lastNotifiedDelay: delay }
      }
    }

    // Update stored state
    await supabase.from('simacan_state').upsert({
      user_id: row.user_id,
      stop_states: { ...prevStates, ...newStates },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  return { statusCode: 200 }
}

exports.handler = schedule('* * * * *', simacanCheckHandler)
