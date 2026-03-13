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

  // Haal alle 109 employees op
  const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=10000`, { headers: h, timeout: 10000 })
  const empData = await empRes.json()
  const employees = empData.result || []
  console.log('Employees:', employees.length)
  const empMap = {}
  for (const e of employees) empMap[String(e.account_id)] = e.name

  // Test 1: schedules met meerdere account_ids via account_id[]= syntax
  console.log('\n=== Test schedules account_id[] multi syntax ===')
  const testIds = employees.slice(0, 5).map(e => e.account_id)
  const multiQs = testIds.map(id => `account_id[]=${id}`).join('&')
  const r1 = await fetch(BASE + `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&${multiQs}&limit=50`, { headers: h, timeout: 10000 })
  const d1 = await r1.json()
  console.log('status:', r1.status, '| count:', (d1.result||[]).length, d1.result?.[0]?.code || '')

  // Test 2: schedules met comma-separated account_ids
  const commaIds = testIds.join(',')
  const r2 = await fetch(BASE + `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&account_id=${commaIds}&limit=50`, { headers: h, timeout: 10000 })
  const d2 = await r2.json()
  console.log('comma syntax:', r2.status, '| count:', (d2.result||[]).length, d2.result?.[0]?.code || '')

  // Test 3: schedules per-account in batch van 10 parallel requests
  console.log('\n=== Batch schedules: 30 medewerkers parallel ===')
  const batch = employees.slice(0, 30)
  const results = await Promise.all(batch.map(async (emp) => {
    try {
      const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, account_id: emp.account_id }).toString()
      const res = await fetch(BASE + `/api/v2/schedules?${qs}`, { headers: h, timeout: 8000 })
      const data = await res.json()
      return (data.result || []).map(s => ({ ...s, _name: emp.name }))
    } catch { return [] }
  }))
  const allSchedules = results.flat()
  console.log('Schedules gevonden voor 30 employees:', allSchedules.length)
  allSchedules.slice(0, 10).forEach(s => {
    console.log(' ', s.schedule_time_from, '-', s.schedule_time_to, '|', s._name, '| dept:', s.department?.department_name)
  })

  // Test 4: alle 109 employees parallel (grotere batch)
  console.log('\n=== Volledige batch: alle 109 employees ===')
  const allResults = await Promise.all(employees.map(async (emp) => {
    try {
      const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, account_id: emp.account_id }).toString()
      const res = await fetch(BASE + `/api/v2/schedules?${qs}`, { headers: h, timeout: 8000 })
      const data = await res.json()
      return (data.result || []).map(s => ({ ...s, _name: emp.name }))
    } catch { return [] }
  }))
  const fullSchedules = allResults.flat()
  console.log('Totaal schedules gevonden:', fullSchedules.length)
  fullSchedules.sort((a,b) => (a.schedule_time_from||'').localeCompare(b.schedule_time_from||''))
  console.log('\nVolledig dagoverzicht:')
  fullSchedules.forEach(s => {
    const van = (s.schedule_time_from||'').slice(11,16)
    const tot = (s.schedule_time_to||'').slice(11,16)
    const dept = s.department?.department_name || s.department?.department_id || '?'
    const own = String(s.account_id) === String(accountId) ? ' ← JIJ' : ''
    console.log(`  ${van}-${tot} | ${(s._name||'?').padEnd(25)} | ${dept}${own}`)
  })
}
main().catch(e => console.error('FATAL:', e.message))
