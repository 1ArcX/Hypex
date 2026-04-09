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

const MESSAGES = {
  ochtend: [
    'Begin de dag sterk! 💪',
    'Vandaag is een nieuwe kans — zet hem op! 🌟',
    'Een goede ochtend start met goede gewoontes! ☀️',
    'Je streak staat te wachten — doe het! 🔥',
    'Goedemorgen! Kleine stappen, groot resultaat. 🌱',
  ],
  middag: [
    'Halverwege de dag — nog even volhouden! ⚡',
    'Kleine moeite, groot resultaat! 🎯',
    'Nog niet gedaan? Nu is het perfecte moment! 💪',
    'Elke dag telt — dit ook! 🌤',
    'Middag check-in: ben jij al bezig? 🚀',
  ],
  avond: [
    'Sluit de dag sterk af! 🌙',
    'Nog even en je hebt weer een dag volgehouden! 🌟',
    'Maak er een perfecte dag van! ⭐',
    'Einde van de dag — doe het nog even! 💪',
    'Laatste kans van vandaag — jij kan dit! 🔥',
  ],
}

function randomMsg(slot) {
  const msgs = MESSAGES[slot] || MESSAGES.avond
  return msgs[Math.floor(Math.random() * msgs.length)]
}

function getAmsterdamHour() {
  return parseInt(
    new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hour12: false }),
    10
  )
}

function getAmsterdamFreqDay() {
  const nowNL = new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  const jsDay = new Date(nowNL).getDay()
  return (jsDay + 6) % 7 // 0=ma, 6=zo
}

async function habitReminderHandler() {
  const hour    = getAmsterdamHour()
  const timeStr = String(hour).padStart(2, '0') + ':00'
  const freqDay = getAmsterdamFreqDay()

  // Haal alle actieve habits op met een remind_times object
  const { data: habits, error } = await supabase
    .from('habits')
    .select('id, name, icon, user_id, frequency, remind_times')
    .eq('archived', false)
    .not('remind_times', 'is', null)

  if (error) {
    console.error('habit fetch error:', error.message)
    return { statusCode: 500 }
  }

  // Filter: remind_times heeft een waarde gelijk aan het huidige tijdstip
  // en de habit staat ingepland voor vandaag
  const toNotify = (habits || []).filter(habit => {
    if (!habit.remind_times || typeof habit.remind_times !== 'object' || Array.isArray(habit.remind_times)) return false
    const freq = habit.frequency ?? [0, 1, 2, 3, 4, 5, 6]
    if (!freq.includes(freqDay)) return false
    return Object.values(habit.remind_times).includes(timeStr)
  })

  if (!toNotify.length) return { statusCode: 200 }

  // Groepeer per gebruiker
  const userHabits = {}
  for (const habit of toNotify) {
    if (!userHabits[habit.user_id]) userHabits[habit.user_id] = []
    userHabits[habit.user_id].push(habit)
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, id, subscription')
    .in('user_id', Object.keys(userHabits))

  const subsByUser = {}
  for (const sub of subs || []) {
    if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = []
    subsByUser[sub.user_id].push(sub)
  }

  for (const [userId, habits] of Object.entries(userHabits)) {
    const userSubs = subsByUser[userId] || []
    if (!userSubs.length) continue

    for (const habit of habits) {
      // Bepaal het dagdeel op basis van welk slot deze tijd heeft
      const slot  = Object.keys(habit.remind_times).find(k => habit.remind_times[k] === timeStr) || 'avond'
      const title = `${habit.icon} ${habit.name}`
      const body  = randomMsg(slot)
      const payload = JSON.stringify({ title, body, tag: `habit-${habit.id}`, url: '/gewoontes' })

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(sub.subscription, payload)
        } catch (e) {
          console.error('Push failed for sub', sub.id, e.statusCode, e.message)
          if (e.statusCode === 410 || e.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }
    }
  }

  return { statusCode: 200 }
}

exports.handler = schedule('0 * * * *', habitReminderHandler)
