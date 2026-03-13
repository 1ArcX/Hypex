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

async function getShifts(h, date, extra = {}) {
  const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, limit: 200, ...extra }).toString()
  const res = await fetch(BASE + `/api/v2/shifts?${qs}`, { headers: h, timeout: 10000 })
  const data = await res.json()
  if (data.result?.[0]?.code) return { error: data.result[0].message }
  return (data.result || []).filter(s => s.start_datetime && s.start_datetime.startsWith(date))
}

async function main() {
  const auth = await login()
  const { h, storeId, accountId } = auth

  // Test verschillende status filters op een dag dat Fachri werkte (12 mrt)
  const date = '2026-03-12'
  console.log(`=== Status filters op ${date} ===`)
  console.log('(Fachri werkte 16:15-21:45 die dag - staat hij in de resultaten?)\n')

  for (const status of ['plan', 'final', 'concept', 'approved', 'realized', 'open']) {
    const shifts = await getShifts(h, date, { status })
    if (shifts.error) {
      console.log(`status=${status}: FOUT - ${shifts.error}`)
    } else {
      const fachri = shifts.find(s => String(s.account_id) === String(accountId))
      console.log(`status=${status}: ${shifts.length} shifts | Fachri erin: ${fachri ? 'JA (' + fachri.start_datetime.slice(11,16) + '-' + fachri.end_datetime.slice(11,16) + ')' : 'nee'}`)
    }
  }

  // Zonder status filter (huidig)
  const base = await getShifts(h, date)
  const fachriBase = base.find ? base.find(s => String(s.account_id) === String(accountId)) : null
  console.log(`\nGeen status filter: ${Array.isArray(base) ? base.length : '?'} shifts | Fachri: ${fachriBase ? 'JA' : 'nee'}`)

  // Verken ook toekomstige dag (14 mrt) - zijn ALLE shifts zichtbaar voor toekomst?
  const futureDate = '2026-03-16'
  console.log(`\n=== Toekomstige dag ${futureDate} (geen status filter) ===`)
  const future = await getShifts(h, futureDate)
  console.log(`Aantal shifts: ${Array.isArray(future) ? future.length : future.error}`)
  if (Array.isArray(future)) {
    // Haal employees op voor namen
    const empRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-12&limit=10000`, { headers: h, timeout: 10000 })
    const empData = await empRes.json()
    const empMap = {}
    for (const e of (empData.result||[])) empMap[String(e.account_id)] = e.name

    future.sort((a,b) => a.start_datetime.localeCompare(b.start_datetime))
    future.forEach(s => {
      const naam = empMap[String(s.account_id)] || `(id:${s.account_id})`
      const own = String(s.account_id) === String(accountId) ? ' ← JIJ' : ''
      console.log(`  ${s.start_datetime.slice(11,16)}-${s.end_datetime.slice(11,16)} | ${naam.padEnd(25)} | dept:${s.department_id} | status:${s.status}${own}`)
    })
  }

  // Vergelijk: voor dag in toekomst, wat zegt schedules endpoint voor Fachri?
  console.log(`\n=== Fachri's schedule week 12 ===`)
  const s1 = await fetch(BASE + `/api/v2/schedules?date[gte]=2026-03-16&date[lte]=2026-03-22&account_id=${accountId}`, { headers: h, timeout: 10000 })
  const d1 = await s1.json()
  ;(d1.result||[]).forEach(s => console.log(`  ${s.schedule_time_from} - ${s.schedule_time_to.slice(11,16)} | ${s.department?.department_name}`))
}
main().catch(e => console.error('FATAL:', e.message))
