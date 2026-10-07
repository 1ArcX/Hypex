// Herinneringen voor toetsdatums uit de Focus-tab (focus_course_dates).
// Draait elk kwartier. Offsets: "1d"/"2d"/"1w"/"2w" = dagen/weken ervoor op reminder_time,
// "2h" = uren vóór reminder_time op de dag zelf. Zelfde regels als src/focus/lib/reminders.ts.
const { schedule } = require('@netlify/functions')
const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const rawEmail      = process.env.VAPID_EMAIL || 'admin@example.com'
const VAPID_EMAIL   = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const STALE_MS = 6 * 3600 * 1000 // te laat ontdekt (bijv. net opgeslagen) → niet meer sturen

// "Wandklok"-tijd in Amsterdam als naïeve Date, zodat hij vergelijkbaar is met reminderAt()
function amsterdamNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function reminderAt(date, time, offset) {
  const [hh, mm] = String(time || '09:00').split(':').map(Number)
  const d = new Date(`${date}T00:00:00`)
  d.setHours(hh || 0, mm || 0, 0, 0)
  const n = parseInt(offset, 10) || 0
  const u = String(offset).slice(-1)
  if (u === 'h') d.setHours(d.getHours() - n)
  if (u === 'd') d.setDate(d.getDate() - n)
  if (u === 'w') d.setDate(d.getDate() - 7 * n)
  return d
}

function body(title, date, offset) {
  const u = String(offset).slice(-1)
  const n = parseInt(offset, 10)
  const when = u === 'h' ? 'vandaag' : u === 'w' ? `over ${n === 1 ? '1 week' : `${n} weken`}` : n === 1 ? 'morgen' : `over ${n} dagen`
  const d = new Date(`${date}T12:00:00`)
  return `${title} is ${when} (${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}).`
}

async function handler() {
  const now = amsterdamNow()
  const from = iso(now)
  const until = new Date(now); until.setDate(until.getDate() + 15)

  const { data: dates, error } = await supabase
    .from('focus_course_dates')
    .select('id, user_id, course_id, title, date, reminder_offsets, reminder_time, sent_offsets')
    .gte('date', from).lte('date', iso(until))
  if (error) { console.error('focus dates:', error.message); return { statusCode: 500 } }

  const due = []
  for (const d of dates || []) {
    const sent = Array.isArray(d.sent_offsets) ? d.sent_offsets : []
    for (const o of Array.isArray(d.reminder_offsets) ? d.reminder_offsets : []) {
      if (sent.includes(o)) continue
      const at = reminderAt(d.date, d.reminder_time, o)
      const diff = now - at
      if (diff >= 0 && diff < STALE_MS) due.push({ d, o })
    }
  }
  if (!due.length) return { statusCode: 200 }

  const userIds = [...new Set(due.map(x => x.d.user_id))]
  const courseIds = [...new Set(due.map(x => x.d.course_id))]
  const [{ data: subs }, { data: courses }] = await Promise.all([
    supabase.from('push_subscriptions').select('id, user_id, subscription').in('user_id', userIds),
    supabase.from('focus_courses').select('id, name').in('id', courseIds),
  ])
  const courseName = Object.fromEntries((courses || []).map(c => [c.id, c.name]))

  const sentById = {}
  for (const { d, o } of due) {
    const payload = JSON.stringify({ title: courseName[d.course_id] || 'Focus', body: body(d.title, d.date, o), tag: `focus-${d.id}-${o}`, url: '/' })
    for (const sub of (subs || []).filter(s => s.user_id === d.user_id)) {
      try {
        await webpush.sendNotification(sub.subscription, payload)
      } catch (e) {
        console.error('Push failed', sub.id, e.statusCode, e.message)
        if (e.statusCode === 410 || e.statusCode === 404) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
    // Ook zonder abonnement als verstuurd markeren, anders blijft hij elk kwartier proberen
    sentById[d.id] = [...(sentById[d.id] || (Array.isArray(d.sent_offsets) ? d.sent_offsets : [])), o]
  }
  for (const [id, sent] of Object.entries(sentById)) {
    await supabase.from('focus_course_dates').update({ sent_offsets: sent }).eq('id', id)
  }
  return { statusCode: 200 }
}

exports.handler = schedule('*/15 * * * *', handler)
