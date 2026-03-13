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
  const { h, storeId } = auth
  const date = '2026-03-13'

  // Haal alle departments op
  const deptRes = await fetch(BASE + `/api/v2/departments?date=${date}`, { headers: h, timeout: 10000 })
  const deptData = await deptRes.json()
  const depts = deptData.result || []
  console.log('Afdelingen:', depts.map(d => `${d.department_id}=${d.department_name}`).join(', '))

  // Test: shifts per department_id
  console.log('\n=== Shifts per afdeling op', date, '===')
  let allShifts = []
  for (const dept of depts) {
    const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, department_id: dept.department_id, limit: 200 }).toString()
    const res = await fetch(BASE + '/api/v2/shifts?' + qs, { headers: h, timeout: 10000 })
    const data = await res.json()
    const shifts = (data.result||[]).filter(s => s.start_datetime && s.start_datetime.startsWith(date))
    console.log(`  dept ${dept.department_id} (${dept.department_name}): ${shifts.length} shifts`)
    allShifts = allShifts.concat(shifts)
  }

  // Deduplicate op shift_id
  const seen = new Set()
  const unique = allShifts.filter(s => { if (seen.has(s.shift_id)) return false; seen.add(s.shift_id); return true })
  console.log('\nTotaal unieke shifts alle afdelingen:', unique.length)

  // Haal employees op
  const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=10000`, { headers: h, timeout: 10000 })
  const empData = await empRes.json()
  const empMap = {}
  for (const e of (empData.result||[])) empMap[String(e.account_id)] = e.name
  console.log('Employees geladen:', Object.keys(empMap).length)

  // Deptmap
  const deptMap = {}
  for (const d of depts) deptMap[d.department_id] = d.department_name

  // Print alle shifts
  unique.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
  console.log('\n=== Volledige dag planning ===')
  for (const s of unique) {
    const naam = empMap[String(s.account_id)] || `(account ${s.account_id})`
    const dept = deptMap[s.department_id] || s.department_id
    const own = String(s.account_id) === String(auth.accountId) ? ' ← JIJ' : ''
    console.log(`  ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)} | ${dept}${own}`)
  }

  // Test ook: shifts ZONDER department filter maar met store_id
  console.log('\n=== shifts?store_id=287 ===')
  const qs2 = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, store_id: storeId, limit: 200 }).toString()
  const r2 = await fetch(BASE + '/api/v2/shifts?' + qs2, { headers: h, timeout: 10000 })
  const d2 = await r2.json()
  const s2 = (d2.result||[]).filter(s => s.start_datetime && s.start_datetime.startsWith(date))
  console.log('count:', s2.length, '| error?', d2.result?.[0]?.code || 'nee')
}
main().catch(e => console.error('FATAL:', e.message))
