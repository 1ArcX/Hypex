const { magister } = require('magister.js')

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

function ok(data) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) }
}
function err(msg, status = 400) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }
}

function dateStr(d) {
  if (!d) return null
  try { return new Date(d).toISOString() } catch { return String(d) }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid JSON') }

  const { action, username, password } = body
  const school = 'ichthus'

  if (!action || !username || !password) return err('action, username en password zijn verplicht')

  let m
  try {
    m = await magister({
      school: { url: `https://${school}.magister.net` },
      username,
      password
    })
  } catch (e) {
    const msg = e.message || ''
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('credentials') || msg.includes('password')) {
      return err('Inloggen mislukt. Controleer je leerlingnummer en wachtwoord.', 401)
    }
    return err(`Inlogfout: ${msg}`, 500)
  }

  try {
    if (action === 'login') {
      return ok({ success: true })
    }

    if (action === 'grades') {
      const top = body.top || 15
      const grades = await m.grades(undefined, undefined, undefined, top)
      const result = grades.map(g => ({
        vak: g.course?.description || g.subject?.description || '',
        cijfer: g.grade,
        omschrijving: g.description || '',
        datum: dateStr(g.date),
        weging: g.weight,
        klaar: g.passed
      }))
      return ok(result)
    }

    if (action === 'schedule') {
      const from = new Date(body.start || new Date())
      const to = new Date(body.end || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })())
      const appointments = await m.appointments(from, to)
      const result = appointments.map(a => ({
        vak: a.courses?.map(c => c.description).join(', ') || a.description || '',
        start: dateStr(a.start),
        einde: dateStr(a.end),
        lokaal: a.location || a.classroom || '',
        docent: a.teachers?.map(t => t.fullName || t.name).join(', ') || '',
        uitgevallen: a.isCancelled || false,
        huiswerk: a.content || ''
      }))
      return ok(result)
    }

    if (action === 'homework') {
      const from = new Date(body.start || new Date())
      const to = new Date(body.end || (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })())
      const appointments = await m.appointments(from, to)
      const hw = appointments.filter(a => a.content && a.content.trim())
      const result = hw.map(a => ({
        vak: a.courses?.map(c => c.description).join(', ') || a.description || '',
        omschrijving: a.content || '',
        datum: dateStr(a.start),
        klaar: a.finished || false
      }))
      return ok(result)
    }

    return err(`Onbekende actie: ${action}`)

  } catch (e) {
    console.error('Magister API fout:', e)
    return err(`API fout: ${e.message}`, 500)
  }
}
