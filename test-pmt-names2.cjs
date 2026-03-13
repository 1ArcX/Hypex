const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const PMT_HEADERS = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function main() {
  const loginRes = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', { method: 'POST', headers: PMT_HEADERS, body: JSON.stringify({ username: 'Fachri.zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } }), timeout: 10000 })
  const loginData = await loginRes.json()
  const r = loginData.result
  const h = { ...PMT_HEADERS, 'x-api-user': r.user_token }

  // Test: stores/287/employees zonder extra params
  console.log('=== stores/287/employees (geen params) ===')
  const s1 = await fetch(BASE + '/api/v2/stores/287/employees?limit=5', { headers: h, timeout: 10000 })
  const d1 = await s1.json()
  console.log('status:', s1.status, '| count:', (d1.result||[]).length)
  if ((d1.result||[])[0]) console.log('keys:', Object.keys(d1.result[0]), '\n', JSON.stringify(d1.result[0], null, 2))
  else console.log(JSON.stringify(d1).slice(0,300))

  // Test: shifts met expand params
  for (const param of ['with=employee', 'expand=employee', 'fields=name,account_name', 'account_name=1']) {
    const s = await fetch(BASE + '/api/v2/shifts?date[gte]=2026-03-13&date[lte]=2026-03-13&limit=2&' + param, { headers: h, timeout: 10000 })
    const d = await s.json()
    const first = (d.result||[])[0]
    if (first && !first.code) {
      console.log('\nparam:', param, '| keys:', Object.keys(first))
    } else {
      console.log('\nparam:', param, '-> error:', JSON.stringify(d).slice(0,100))
    }
  }

  // Test: /api/v2/accounts
  console.log('\n=== /api/v2/accounts ===')
  const s3 = await fetch(BASE + '/api/v2/accounts?limit=3', { headers: h, timeout: 10000 })
  const d3 = await s3.json()
  console.log('status:', s3.status, JSON.stringify(d3).slice(0,400))

  // Test: /api/v2/stores/287/schedule
  console.log('\n=== /api/v2/stores/287/schedule?date=2026-03-13 ===')
  const s4 = await fetch(BASE + '/api/v2/stores/287/schedule?date=2026-03-13&limit=5', { headers: h, timeout: 10000 })
  const d4 = await s4.json()
  console.log('status:', s4.status, JSON.stringify(d4).slice(0,400))
  if ((d4.result||[])[0]) console.log('keys:', Object.keys(d4.result[0]))

  // Test: labour-program endpoint
  console.log('\n=== /api/v2/labour-program?date=2026-03-13 ===')
  const s5 = await fetch(BASE + '/api/v2/labour-program?date=2026-03-13&limit=5', { headers: h, timeout: 10000 })
  const d5 = await s5.json()
  console.log('status:', s5.status, JSON.stringify(d5).slice(0,300))

  // Test: employees met week param
  console.log('\n=== stores/287/employees?week=11&year=2026 ===')
  const s6 = await fetch(BASE + '/api/v2/stores/287/employees?week=11&year=2026&limit=5', { headers: h, timeout: 10000 })
  const d6 = await s6.json()
  console.log('status:', s6.status, JSON.stringify(d6).slice(0,400))
  if ((d6.result||[])[0] && !d6.result[0].code) console.log('keys:', Object.keys(d6.result[0]))

  // Test: employees met exchange + week
  console.log('\n=== stores/287/employees?exchange=true&week=2026-11 ===')
  const s7 = await fetch(BASE + '/api/v2/stores/287/employees?exchange=true&week=2026-11&limit=5', { headers: h, timeout: 10000 })
  const d7 = await s7.json()
  console.log('status:', s7.status, JSON.stringify(d7).slice(0,400))

  // Test: /api/v2/schedules met alle accounts (geen account_id filter)
  console.log('\n=== schedules alle accounts week 11 ===')
  const s8 = await fetch(BASE + '/api/v2/schedules?date[gte]=2026-03-09&date[lte]=2026-03-15&limit=5', { headers: h, timeout: 10000 })
  const d8 = await s8.json()
  console.log('status:', s8.status, '| count:', (d8.result||[]).length)
  if ((d8.result||[])[0]) console.log('keys:', Object.keys(d8.result[0]), '\n', JSON.stringify(d8.result[0], null, 2))
}
main().catch(e => console.error(e.message))
