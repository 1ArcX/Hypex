const { schedule } = require('@netlify/functions')
const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const rawEmail      = process.env.VAPID_EMAIL || 'admin@example.com'
const VAPID_EMAIL   = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function getBuienalarm(lat, lon) {
  try {
    // Eerst via eigen proxy proberen (omzeilt eventuele blokkade)
    const proxyUrl = `${process.env.URL}/.netlify/functions/buienalarm?lat=${lat}&lon=${lon}`
    const res = await fetch(proxyUrl)
    if (!res.ok) throw new Error(`proxy ${res.status}`)
    const json = await res.json()
    if (!json?.precip?.length) return []
    return json.precip.map(v => isNaN(v) ? 0 : v)
  } catch {
    // Fallback: direct buienalarm
    try {
      const res = await fetch(
        `https://cdn-secure.buienalarm.nl/api/3.4/forecast.php?lat=${lat}&lon=${lon}&region=nl&unit=mm/u`
      )
      if (!res.ok) return []
      const json = await res.json()
      if (!json?.precip?.length) return []
      return json.precip.map(v => isNaN(v) ? 0 : v)
    } catch {
      return []
    }
  }
}

async function rainCheckHandler() {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('rain_enabled', true)

  if (error) {
    console.error('Could not load subscriptions:', error.message)
    return { statusCode: 500 }
  }

  if (!subs?.length) {
    console.log('Geen rain-enabled subscriptions gevonden')
    return { statusCode: 200 }
  }

  for (const sub of subs) {
    try {
      if (!sub.lat || !sub.lon) {
        console.warn('Sub', sub.id, 'heeft geen lat/lon — skip')
        continue
      }

      const precipValues = await getBuienalarm(sub.lat, sub.lon)
      if (!precipValues.length) {
        console.warn('Geen neerslag data voor sub', sub.id)
        continue
      }

      // Komende 30 minuten (6 entries × 5 min)
      const upcoming  = precipValues.slice(0, 6)
      const maxPrecip = Math.max(...upcoming)
      if (maxPrecip < 0.1) continue

      // Anti-spam: max 1x per interval
      const intervalMinutes = sub.rain_interval_minutes || 60
      if (sub.last_notified_at) {
        const diffMin = (Date.now() - new Date(sub.last_notified_at)) / 60000
        if (diffMin < intervalMinutes) continue
      }

      const intensity =
        maxPrecip < 0.5 ? 'lichte regen' :
        maxPrecip < 2   ? 'matige regen'  :
                          'zware regen'

      const payload = JSON.stringify({
        title: '🌧 Regen op komst!',
        body: `Er komt ${intensity} aan in de komende 30 minuten.`,
        tag: 'rain',
        url: '/',
      })

      await webpush.sendNotification(sub.subscription, payload)
      console.log('Push verstuurd voor sub', sub.id)

      await supabase
        .from('push_subscriptions')
        .update({ last_notified_at: new Date().toISOString() })
        .eq('id', sub.id)

    } catch (e) {
      console.error('Push failed for sub', sub.id, e.statusCode, e.message)
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return { statusCode: 200 }
}

exports.handler = schedule('*/15 * * * *', rainCheckHandler)
