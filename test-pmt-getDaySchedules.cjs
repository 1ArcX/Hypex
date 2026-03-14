const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const H = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function login() {
  const res = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', {
    method: 'POST', headers: H, timeout: 10000,
    body: JSON.stringify({ username: 'Fachri.zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } })
  })
  const r = (await res.json()).result
  return { token: r.user_token, accountId: r.account_id, storeId: r.store_id, h: { ...H, 'x-api-user': r.user_token } }
}

async function main() {
  const auth = await login()
  const { h, storeId, accountId } = auth
  const date = '2026-03-13'

  // Zoek getDaySchedules in main bundle
  console.log('=== Zoek getDaySchedules in main bundle ===')
  const jsRes = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 15000 })
  const js = await jsRes.text()

  const idx = js.indexOf('getDaySchedules')
  if (idx !== -1) {
    console.log('Gevonden op positie', idx)
    console.log(js.slice(Math.max(0, idx - 200), idx + 600))
  }

  // Zoek ook getDaySchedule (zonder s)
  const idx2 = js.indexOf('getDaySchedule(')
  if (idx2 !== -1) {
    console.log('\ngetDaySchedule( context:')
    console.log(js.slice(Math.max(0, idx2 - 200), idx2 + 400))
  }

  // Zoek schedules-not-finalized
  const idx3 = js.indexOf('schedules-not-finalized')
  if (idx3 !== -1) {
    console.log('\nschedules-not-finalized context:')
    console.log(js.slice(Math.max(0, idx3 - 300), idx3 + 400))
  }

  // Zoek schedules-grid
  const idx4 = js.indexOf('schedules-grid')
  if (idx4 !== -1) {
    console.log('\nschedules-grid context:')
    console.log(js.slice(Math.max(0, idx4 - 300), idx4 + 400))
  }

  // Zoek getWeekDepartmentsForEmployee
  const idx5 = js.indexOf('getWeekDepartmentsForEmployee')
  if (idx5 !== -1) {
    console.log('\ngetWeekDepartmentsForEmployee context:')
    console.log(js.slice(Math.max(0, idx5 - 100), idx5 + 400))
  }

  // Test: schedules endpoint met department_id en GEEN account_id
  console.log('\n=== Test schedules?department_id=102 ===')
  const r1 = await fetch(BASE + `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&department_id=102&limit=50`, { headers: h, timeout: 10000 })
  const d1 = await r1.json()
  console.log('status:', r1.status, '| count:', (d1.result||[]).length, d1.result?.[0]?.code || '')

  // Test: schedules-not-finalized endpoint
  console.log('\n=== Test /api/v2/schedules-not-finalized ===')
  const r2 = await fetch(BASE + `/api/v2/schedules-not-finalized?date[gte]=${date}&date[lte]=${date}&limit=10`, { headers: h, timeout: 10000 })
  const d2 = await r2.json()
  console.log('status:', r2.status, '| result:', JSON.stringify(d2).slice(0,200))

  // Test: schedules-grid endpoint
  console.log('\n=== Test /api/v2/schedules-grid ===')
  const r3 = await fetch(BASE + `/api/v2/schedules-grid?date=${date}&limit=10`, { headers: h, timeout: 10000 })
  const d3 = await r3.json()
  console.log('status:', r3.status, '| result:', JSON.stringify(d3).slice(0,200))

  // Test: schedules met date (niet date[gte/lte])
  console.log('\n=== Test schedules?date=2026-03-13 ===')
  const r4 = await fetch(BASE + `/api/v2/schedules?date=${date}&limit=50`, { headers: h, timeout: 10000 })
  const d4 = await r4.json()
  console.log('status:', r4.status, '| count:', (d4.result||[]).length, d4.result?.[0]?.code || '')
  if ((d4.result||[]).length > 0) console.log('first:', JSON.stringify(d4.result[0]).slice(0,200))
}
main().catch(e => console.error('FATAL:', e.message))
