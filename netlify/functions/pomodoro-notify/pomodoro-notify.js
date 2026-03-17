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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, headers: CORS, body: '{"error":"Invalid JSON"}' }
  }

  const { userId, title, body: msgBody, tag = 'pomodoro' } = body
  if (!userId || !title) return { statusCode: 400, headers: CORS, body: '{"error":"userId and title required"}' }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  if (error) {
    console.error('Supabase fetch error:', error.message)
    return { statusCode: 500, headers: CORS, body: '{"error":"db error"}' }
  }

  const payload = JSON.stringify({ title, body: msgBody || '', tag, url: '/' })
  let sent = 0

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(sub.subscription, payload)
      sent++
    } catch (e) {
      console.error('Push failed for sub', sub.id, e.statusCode, e.message)
      // Remove expired/invalid subscriptions
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent }) }
}
