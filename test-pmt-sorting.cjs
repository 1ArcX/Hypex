const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const PMT_HEADERS = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function main() {
  const loginRes = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', { method: 'POST', headers: PMT_HEADERS, body: JSON.stringify({ username: 'Fachri.zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } }), timeout: 10000 })
  const r = (await loginRes.json()).result
  const h = { ...PMT_HEADERS, 'x-api-user': r.user_token }

  // Met sorting
  console.log('=== MET sorting=+start_datetime ===')
  const qs1 = new URLSearchParams({ 'date[gte]': '2026-03-12', 'date[lte]': '2026-03-12', limit: 5, sorting: '+start_datetime' }).toString()
  const r1 = await fetch(BASE + '/api/v2/shifts?' + qs1, { headers: h, timeout: 10000 })
  const d1 = await r1.json()
  console.log('count:', (d1.result||[]).length)
  ;(d1.result||[]).slice(0,5).forEach(s => console.log(' ', s.start_datetime, '| dept:', s.department_id, '| acc:', s.account_id))

  // Zonder sorting
  console.log('\n=== ZONDER sorting ===')
  const qs2 = new URLSearchParams({ 'date[gte]': '2026-03-12', 'date[lte]': '2026-03-12', limit: 5 }).toString()
  const r2 = await fetch(BASE + '/api/v2/shifts?' + qs2, { headers: h, timeout: 10000 })
  const d2 = await r2.json()
  console.log('count:', (d2.result||[]).length)
  ;(d2.result||[]).slice(0,5).forEach(s => console.log(' ', s.start_datetime, '| dept:', s.department_id, '| acc:', s.account_id))

  // Hoeveel shifts zijn er totaal op 12 mrt (met hogere limit)
  console.log('\n=== Totaal shifts 12 mrt (limit=200, geen sorting) ===')
  const qs3 = new URLSearchParams({ 'date[gte]': '2026-03-12', 'date[lte]': '2026-03-12', limit: 200 }).toString()
  const r3 = await fetch(BASE + '/api/v2/shifts?' + qs3, { headers: h, timeout: 10000 })
  const d3 = await r3.json()
  console.log('total:', (d3.result||[]).length)
  // Check of alle datums echt 2026-03-12 zijn
  const dates = [...new Set((d3.result||[]).map(s => s.start_datetime.slice(0,10)))]
  console.log('unieke datums:', dates)

  // Namen via employees week 2026-11
  const empRes = await fetch(BASE + '/api/v2/stores/287/employees?exchange=true&week=2026-11&limit=10000', { headers: h, timeout: 10000 })
  const empData = await empRes.json()
  const empMap = {}
  for (const e of (empData.result||[])) empMap[String(e.account_id)] = e.name
  console.log('\nEerste 8 shifts met namen:')
  ;(d3.result||[]).slice(0,8).forEach(s => {
    const naam = empMap[String(s.account_id)] || '(??)'
    const own = String(s.account_id) === String(r.account_id) ? ' <-- JIJ' : ''
    console.log(' ', s.start_datetime.slice(11,16), '-', s.end_datetime.slice(11,16), '|', naam, '| dept:', s.department_id, own)
  })
}
main().catch(e => console.error(e.message))
