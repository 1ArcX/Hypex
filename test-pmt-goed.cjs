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
  const { h, storeId, accountId } = await login()
  const date = '2026-03-13'
  const dept102 = 102

  // Employees in week 11
  const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=10000`, { headers: h, timeout: 10000 })
  const empMap = {}
  for (const e of ((await empRes.json()).result || [])) empMap[String(e.account_id)] = e.name

  console.log('=== Pagination test: shifts dept 102 op 13 mrt ===')
  for (const page of [1, 2, 3, 4]) {
    const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, department_id: dept102, limit: 50, page }).toString()
    const res = await fetch(BASE + `/api/v2/shifts?${qs}`, { headers: h, timeout: 10000 })
    const data = await res.json()
    const filtered = (data.result || []).filter(s => s.start_datetime?.startsWith(date))
    const meta = data.metaData?.pagination || {}
    console.log(`  page ${page}: total_records=${meta.total_records ?? '?'} | filtered=${filtered.length}`)
    filtered.forEach(s => console.log(`    ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${(empMap[String(s.account_id)] || '(id:'+s.account_id+')').padEnd(25)} | status:${s.status}`))
  }

  console.log('\n=== Alle paginas, alle shifts op 13 mrt (geen dept filter) ===')
  let allShifts = []
  for (const page of [1, 2, 3, 4, 5]) {
    const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, limit: 50, page }).toString()
    const res = await fetch(BASE + `/api/v2/shifts?${qs}`, { headers: h, timeout: 10000 })
    const data = await res.json()
    const filtered = (data.result || []).filter(s => s.start_datetime?.startsWith(date))
    const meta = data.metaData?.pagination || {}
    console.log(`  page ${page}: total_records=${meta.total_records ?? '?'} | vandaag=${filtered.length}`)
    allShifts = allShifts.concat(filtered)
    if (!meta.next) { console.log('  (geen volgende pagina)'); break }
  }

  const seen = new Set()
  const unique = allShifts.filter(s => { if (seen.has(s.shift_id)) return false; seen.add(s.shift_id); return true })
  console.log('\nTotaal uniek:', unique.length)
  unique.sort((a,b) => a.start_datetime.localeCompare(b.start_datetime))
  unique.forEach(s => {
    const naam = empMap[String(s.account_id)] || '(id:'+s.account_id+')'
    const own = String(s.account_id) === String(accountId) ? ' ← JIJ' : ''
    console.log(`  ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)} | dept:${s.department_id} | status:${s.status}${own}`)
  })

  // Test: zijn er extra shifts als je met verschillende dept_id filters combineert?
  console.log('\n=== Shifts met status=plan op 13 mrt ===')
  const qs2 = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, status: 'plan', limit: 200 }).toString()
  const r2 = await fetch(BASE + `/api/v2/shifts?${qs2}`, { headers: h, timeout: 10000 })
  const d2 = await r2.json()
  const planShifts = (d2.result || []).filter(s => s.start_datetime?.startsWith(date))
  console.log('Plan shifts count:', planShifts.length)
  planShifts.forEach(s => {
    const naam = empMap[String(s.account_id)] || '(id:'+s.account_id+')'
    console.log(`  ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)} | dept:${s.department_id}`)
  })

  console.log('\n=== Shifts met status=realized op 13 mrt ===')
  const qs3 = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, status: 'realized', limit: 200 }).toString()
  const r3 = await fetch(BASE + `/api/v2/shifts?${qs3}`, { headers: h, timeout: 10000 })
  const d3 = await r3.json()
  const realizedShifts = (d3.result || []).filter(s => s.start_datetime?.startsWith(date))
  console.log('Realized shifts count:', realizedShifts.length)
  realizedShifts.forEach(s => {
    const naam = empMap[String(s.account_id)] || '(id:'+s.account_id+')'
    console.log(`  ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)} | dept:${s.department_id}`)
  })

  // Combineer plan + realized, dedup
  console.log('\n=== Gecombineerd plan + realized ===')
  const combined = [...planShifts, ...realizedShifts]
  const seenComb = new Set()
  const uniqueComb = combined.filter(s => { if (seenComb.has(s.shift_id)) return false; seenComb.add(s.shift_id); return true })
  uniqueComb.sort((a,b) => a.start_datetime.localeCompare(b.start_datetime))
  console.log('Totaal uniek:', uniqueComb.length)
  uniqueComb.filter(s => s.department_id === dept102).forEach(s => {
    const naam = empMap[String(s.account_id)] || '(id:'+s.account_id+')'
    const own = String(s.account_id) === String(accountId) ? ' ← JIJ' : ''
    console.log(`  ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)}${own}`)
  })
}
main().catch(e => console.error('FATAL:', e.message))
