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

async function main() {
  const { h, accountId, storeId } = await login()

  // Haal een paar collega account_ids op
  const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=500`, { headers: h })
  const employees = (await empRes.json()).result || []
  // Kies een paar willekeurige collega's (niet jezelf)
  const others = employees.filter(e => e.account_id !== accountId).slice(0, 5)
  console.log('Test collega\'s:')
  others.forEach(e => console.log(`  ${e.name} (id: ${e.account_id})`))

  for (const emp of others) {
    const id = emp.account_id
    const naam = emp.name
    console.log(`\n====== ${naam} (${id}) ======`)

    // Schedules (definitief rooster)
    const schedRes = await fetch(BASE + `/api/v2/schedules?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${id}`, { headers: h })
    const sched = (await schedRes.json()).result || []
    console.log(`  Rooster maart: ${schedRes.status} — ${sched.length} shifts`)
    sched.slice(0, 3).forEach(s => console.log(`    ${s.schedule_time_from?.slice(0,10)} | ${s.schedule_time_from?.slice(11,16)}-${s.schedule_time_to?.slice(11,16)} | ${s.department?.department_name}`))

    // Eigen shifts
    const shiftRes = await fetch(BASE + `/api/v2/shifts?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${id}`, { headers: h })
    const shifts = (await shiftRes.json()).result || []
    console.log(`  Shifts maart: ${shiftRes.status} — ${shifts.length} entries`)

    // Contract
    const contRes = await fetch(BASE + `/api/v2/contracts?account_id=${id}`, { headers: h })
    const cont = (await contRes.json()).result || []
    console.log(`  Contract: ${contRes.status} — ${cont.length > 0 ? JSON.stringify(cont[0]).slice(0,80) : 'leeg'}`)

    // Profiel
    const profRes = await fetch(BASE + `/api/v2/employees?account_id=${id}`, { headers: h })
    const prof = (await profRes.json()).result || []
    if (prof[0]) {
      console.log(`  Profiel: ${profRes.status} — gender:${prof[0].employee_gender} persnum:${prof[0].personnel_number} labor_access:${prof[0].planning_labor_access}`)
    }
  }
}
main().catch(e => console.error('FATAL:', e.message))
