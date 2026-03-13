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

  // Jouw eigen schedule voor week 11
  console.log('=== Jouw schedules week 11 ===')
  const s1 = await fetch(BASE + `/api/v2/schedules?date[gte]=2026-03-09&date[lte]=2026-03-15&account_id=${accountId}`, { headers: h, timeout: 10000 })
  const d1 = await s1.json()
  const ownShifts = d1.result || []
  ownShifts.forEach(s => {
    const date = s.schedule_time_from.slice(0,10)
    console.log(`  ${s.schedule_time_from} - ${s.schedule_time_to.slice(11,16)} | dept: ${s.department?.department_name}`)
  })

  // Voor elke dag dat je werkt: vergelijk shifts endpoint
  for (const own of ownShifts) {
    const date = own.schedule_time_from.slice(0,10)
    console.log(`\n=== Dag planning voor ${date} (jij: ${own.schedule_time_from.slice(11,16)}-${own.schedule_time_to.slice(11,16)}) ===`)

    const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, limit: 200 }).toString()
    const r2 = await fetch(BASE + `/api/v2/shifts?${qs}`, { headers: h, timeout: 10000 })
    const d2 = await r2.json()

    const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=${getYearWeek(date)}&limit=10000`, { headers: h, timeout: 10000 })
    const empData = await empRes.json()
    const empMap = {}
    for (const e of (empData.result||[])) empMap[String(e.account_id)] = e.name

    const deptRes = await fetch(BASE + `/api/v2/departments?date=${date}`, { headers: h, timeout: 10000 })
    const deptData = await deptRes.json()
    const deptMap = {}
    for (const d of (deptData.result||[])) deptMap[d.department_id] = d.department_name

    const dayShifts = (d2.result||[])
      .filter(s => s.start_datetime && s.start_datetime.startsWith(date) && s.start_datetime !== s.end_datetime && !s.start_datetime.endsWith('00:00'))
      .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime))

    dayShifts.forEach(s => {
      const naam = empMap[String(s.account_id)] || `(id:${s.account_id})`
      const dept = deptMap[s.department_id] || s.department_id
      const own = String(s.account_id) === String(accountId) ? ' ← JIJ' : ''
      // Vergelijk: zijn er instances met andere tijden?
      const inst = (s.instances||[])[0]
      const instTime = inst ? `[instance: ${inst.start_datetime.slice(11,16)}-${inst.end_datetime.slice(11,16)} status:${inst.status}]` : '[geen instance]'
      console.log(`  SHIFT:    ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)} | ${dept}${own}`)
      if (inst && (inst.start_datetime !== s.start_datetime || inst.end_datetime !== s.end_datetime)) {
        console.log(`  INSTANCE: ${instTime}  ← ANDERE TIJDEN!`)
      }
    })
  }
}

function getYearWeek(dateStr) {
  const d = new Date(dateStr)
  const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dow = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-${String(week).padStart(2,'0')}`
}

main().catch(e => console.error('FATAL:', e.message))
