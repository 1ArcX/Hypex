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

async function pomodoroCheckHandler() {
  // Find all expired timer sessions
  const { data: sessions, error } = await supabase
    .from('timer_sessions')
    .select('*')
    .lte('end_time', new Date().toISOString())

  if (error) {
    console.error('timer_sessions fetch error:', error.message)
    return { statusCode: 500 }
  }

  for (const session of sessions || []) {
    const { user_id, mode, sessions_in_cycle, sessions_per_long } = session

    // Derive notification text from mode
    let title, body
    if (mode === 'work') {
      const newSIC    = (sessions_in_cycle || 0) + 1
      const nextMode  = newSIC >= (sessions_per_long || 4) ? 'longBreak' : 'break'
      title = 'Focus sessie klaar! 🎯'
      body  = nextMode === 'longBreak' ? 'Tijd voor een lange pauze.' : 'Neem een pauze.'
    } else {
      title = 'Pauze voorbij!'
      body  = 'Tijd om te focussen!'
    }

    // Fetch push subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', user_id)

    const payload = JSON.stringify({ title, body, tag: 'pomodoro', url: '/' })

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(sub.subscription, payload)
      } catch (e) {
        console.error('Push failed for sub', sub.id, e.statusCode, e.message)
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    // Remove the session — prevents double notification on next cron tick
    await supabase.from('timer_sessions').delete().eq('user_id', user_id)
  }

  return { statusCode: 200 }
}

exports.handler = schedule('* * * * *', pomodoroCheckHandler)
