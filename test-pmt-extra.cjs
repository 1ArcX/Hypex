const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const H = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function login() {
  const res = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', {
    method: 'POST', headers: H, timeout: 10000,
    body: JSON.stringify({ username: 'Fachri.Zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } })
  })
  const r = (await res.json()).result
  return { token: r.user_token, accountId: r.account_id, storeId: r.store_id, h: { ...H, 'x-api-user': r.user_token } }
}

async function get(h, path) {
  const res = await fetch(BASE + path, { headers: h, timeout: 8000 })
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  const { h, accountId, storeId } = await login()

  // 1. Clock-tijden via instances — controleer eigen shift instances
  console.log('\n=== 1. EIGEN SHIFTS MET INSTANCES (hele maand) ===')
  const myShiftsRes = await fetch(BASE + `/api/v2/shifts?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${accountId}`, { headers: h })
  const myShifts = (await myShiftsRes.json()).result || []
  console.log('Eigen shifts:', myShifts.length)
  for (const s of myShifts) {
    const inst = s.instances?.[0]
    const status = inst ? `[${inst.status}] processor:${inst.processor}` : '[no instance]'
    console.log(`  ${s.start_datetime?.slice(0,10)} | plan: ${s.start_datetime?.slice(11,16)}-${s.end_datetime?.slice(11,16)} | ${status}`)
    if (inst && inst.start_datetime !== s.start_datetime) {
      console.log(`     CLOCK: ${inst.start_datetime?.slice(11,16)}-${inst.end_datetime?.slice(11,16)} (verschil!)`)
    }
  }

  // 2. Nieuws volledig lezen
  console.log('\n=== 2. NIEUWS VOLLEDIGE VELDEN ===')
  const newsRes = await fetch(BASE + `/api/v2/news`, { headers: h })
  const newsAll = (await newsRes.json()).result || []
  console.log('Totaal nieuwsberichten:', newsAll.length)
  console.log('Keys van eerste bericht:', Object.keys(newsAll[0] || {}))
  console.log('Eerste bericht:')
  console.log(JSON.stringify(newsAll[0], null, 2))

  // 3. Probeer extra endpoints uit JS bundle (reverse engineered namen)
  console.log('\n=== 3. EXTRA ENDPOINTS REVERSE ENGINEERED ===')
  const extras = [
    `/api/v2/news/${newsAll[0]?.news_id}`,
    `/api/v2/news?limit=5&page=1`,
    `/api/v2/shifts?date=2026-03-13&ignore_lent_out=true&limit=500`,
    `/api/v2/shifts?date=2026-03-13&limit=500`,
    `/api/v2/contracts`,
    `/api/v2/contracts?store_id=${storeId}`,
    `/api/v2/employees?store_id=${storeId}&limit=200`,
    `/api/v2/employees?store_id=${storeId}&department_id=102&limit=100`,
    `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=500`,
    `/api/v2/departments?store_id=${storeId}`,
    `/api/v2/departments/${102}`,
    `/api/v2/stores/${storeId}/departments?active=true`,
    `/api/v2/shift-instances?account_id=${accountId}&date[gte]=2026-03-01&date[lte]=2026-03-31`,
    `/api/v2/shift-instances?date=2026-03-13`,
    `/api/v2/instances?account_id=${accountId}`,
    `/api/v2/time-registration?account_id=${accountId}`,
    `/api/v2/time-registrations?account_id=${accountId}`,
    `/api/v2/clocking?account_id=${accountId}`,
    `/api/v2/week-schedules?account_id=${accountId}&week=2026-11`,
    `/api/v2/day-schedules?account_id=${accountId}&date=2026-03-13`,
  ]
  for (const ep of extras) {
    const r = await get(h, ep)
    const result = r.data.result || r.data
    const count = Array.isArray(result) ? result.length : (result ? 1 : 0)
    const isErr = Array.isArray(result) && result[0]?.code
    const preview = isErr ? result[0]?.message : JSON.stringify(result).slice(0, 80)
    console.log(`  ${r.status} [${count}] ${ep.split('?')[0].slice(-30)}... ${isErr ? 'ERR: ' + preview : preview}`)
  }

  // 4. Check alle shifts goederenverwerking 13 mrt — met instances
  console.log('\n=== 4. GOEDERENVERWERKING 13 MRT MET INSTANCES ===')
  const gRes = await fetch(BASE + `/api/v2/shifts?date=2026-03-13&department_id=102`, { headers: h })
  const gShifts = (await gRes.json()).result || []
  // Haal emp namen
  const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=500`, { headers: h })
  const empMap = {}
  for (const e of ((await empRes.json()).result || [])) empMap[String(e.account_id)] = e.name
  console.log('Shifts Goederenverwerking 13 mrt:', gShifts.length)
  for (const s of gShifts.filter(s => s.start_datetime?.startsWith('2026-03-13'))) {
    const naam = empMap[String(s.account_id)] || `[id:${s.account_id}]`
    const inst = s.instances?.[0]
    const instInfo = inst ? `| inst:${inst.status} ${inst.start_datetime?.slice(11,16)}-${inst.end_datetime?.slice(11,16)} proc:${inst.processor}` : ''
    console.log(`  ${naam.padEnd(35)} plan:${s.start_datetime?.slice(11,16)}-${s.end_datetime?.slice(11,16)} ${instInfo}`)
  }

  // 5. Alle afdelingen shifts 13 mrt — tellingen
  console.log('\n=== 5. ALLE AFDELINGEN TELLINGEN ===')
  const deptListRes = await fetch(BASE + `/api/v2/departments`, { headers: h })
  const allDepts = (await deptListRes.json()).result || []
  for (const dept of allDepts) {
    const dRes = await fetch(BASE + `/api/v2/shifts?date=2026-03-13&department_id=${dept.department_id}`, { headers: h })
    const dShifts = ((await dRes.json()).result || []).filter(s => s.start_datetime?.startsWith('2026-03-13'))
    console.log(`  ${dept.department_name.padEnd(30)} (${dept.department_id}): ${dShifts.length} shifts`)
  }

  // 6. Check schedule status velden
  console.log('\n=== 6. SCHEDULE STATUS VELDEN (eigen) ===')
  const schedRes = await fetch(BASE + `/api/v2/schedules?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${accountId}`, { headers: h })
  const scheds = (await schedRes.json()).result || []
  scheds.forEach(s => {
    console.log(`  ${s.schedule_time_from?.slice(0,10)} | ${s.status} | edited:${s.is_edited} | cross:${s.cross_planned_schedule} | sub_req:${s.substitute_requests}`)
  })
}
main().catch(e => console.error('FATAL:', e.message))
