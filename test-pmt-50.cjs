const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const H = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function login() {
  const res = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', {
    method: 'POST', headers: H, timeout: 10000,
    body: JSON.stringify({ username: 'Fachri.Zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } })
  })
  const r = (await res.json()).result
  console.log('Login OK — accountId:', r.account_id, 'storeId:', r.store_id)
  return { token: r.user_token, accountId: r.account_id, storeId: r.store_id, h: { ...H, 'x-api-user': r.user_token } }
}

async function get(h, path) {
  try {
    const res = await fetch(BASE + path, { headers: h, timeout: 8000 })
    const data = await res.json()
    const result = data.result || data
    const count = Array.isArray(result) ? result.length : (result ? 1 : 0)
    const isErr = Array.isArray(result) && result[0]?.code
    const preview = isErr
      ? `ERR: ${result[0]?.message || result[0]?.code}`
      : (Array.isArray(result) && result.length > 0 ? JSON.stringify(result[0]).slice(0, 120) : JSON.stringify(result).slice(0, 120))
    return { status: res.status, count: isErr ? 0 : count, preview, isErr }
  } catch(e) {
    return { status: 'NET', count: 0, preview: e.message, isErr: true }
  }
}

async function main() {
  const { h, accountId, storeId } = await login()
  const date = '2026-03-13'
  const date2 = '2026-03-15' // today
  const week = '2026-11'
  const week2 = '2026-12' // current week

  const endpoints = [
    // ===== SHIFTS =====
    [`/api/v2/shifts?date=${date}&account_id=${accountId}`, 'Eigen shifts op datum'],
    [`/api/v2/shifts?date=${date2}&account_id=${accountId}`, 'Eigen shifts vandaag'],
    [`/api/v2/shifts?date[gte]=${date}&date[lte]=${date}&account_id=${accountId}`, 'Eigen shifts range'],
    [`/api/v2/shifts?date[gte]=2026-03-10&date[lte]=2026-03-16&account_id=${accountId}`, 'Eigen shifts hele week'],
    [`/api/v2/shifts?date=${date}&ignore_lent_out=true`, 'Alle shifts die dag'],
    [`/api/v2/shifts?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${accountId}`, 'Eigen shifts hele maand'],
    [`/api/v2/shifts?date=${date}&department_id=102`, 'Shifts afdeling 102'],
    [`/api/v2/shifts?date=${date}&open=true`, 'Open shifts'],
    [`/api/v2/shifts?date=${date}&exchange=true`, 'Ruilshifts'],
    [`/api/v2/shifts?date[gte]=2026-03-10&date[lte]=2026-03-16&limit=100`, 'Alle shifts week limit 100'],

    // ===== SCHEDULES =====
    [`/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&account_id=${accountId}`, 'Definitief rooster vandaag'],
    [`/api/v2/schedules?date[gte]=2026-03-10&date[lte]=2026-03-16&account_id=${accountId}`, 'Definitief rooster week 11'],
    [`/api/v2/schedules?date[gte]=2026-03-17&date[lte]=2026-03-23&account_id=${accountId}`, 'Definitief rooster week 12'],
    [`/api/v2/schedules?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${accountId}`, 'Definitief rooster hele maand'],
    [`/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&department_id=102`, 'Rooster afdeling 102'],
    [`/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&limit=200`, 'Alle roosters die dag'],
    [`/api/v2/schedules?date[gte]=2026-04-01&date[lte]=2026-04-30&account_id=${accountId}`, 'Rooster april'],

    // ===== DEPARTMENTS =====
    [`/api/v2/departments?date=${date}`, 'Afdelingen op datum'],
    [`/api/v2/departments`, 'Alle afdelingen (geen datum)'],
    [`/api/v2/departments?limit=100`, 'Afdelingen limit 100'],
    [`/api/v2/departments?active=true`, 'Actieve afdelingen'],

    // ===== EMPLOYEES =====
    [`/api/v2/stores/${storeId}/employees?exchange=true&week=${week}&limit=100`, 'Medewerkers week 11'],
    [`/api/v2/stores/${storeId}/employees?exchange=true&week=${week2}&limit=100`, 'Medewerkers week 12'],
    [`/api/v2/stores/${storeId}/employees?limit=100`, 'Medewerkers zonder week'],
    [`/api/v2/employees/${accountId}`, 'Eigen medewerker profiel'],
    [`/api/v2/employees?account_id=${accountId}`, 'Eigen medewerker via filter'],
    [`/api/v2/employees?store_id=${storeId}&limit=50`, 'Medewerkers via employees endpoint'],

    // ===== AVAILABILITY =====
    [`/api/v2/availability?account_id=${accountId}`, 'Beschikbaarheid eigen'],
    [`/api/v2/availability?account_id=${accountId}&week=${week}`, 'Beschikbaarheid week 11'],
    [`/api/v2/availabilities?account_id=${accountId}`, 'Beschikbaarheid (meervoud)'],
    [`/api/v2/employees/${accountId}/availability`, 'Beschikbaarheid via employee'],

    // ===== LEAVE / RDO / VERLOF =====
    [`/api/v2/rdo?account_id=${accountId}`, 'RDO verzoeken'],
    [`/api/v2/leave?account_id=${accountId}`, 'Verlof'],
    [`/api/v2/leave-requests?account_id=${accountId}`, 'Verlofverzoeken'],
    [`/api/v2/absence?account_id=${accountId}`, 'Afwezigheid'],
    [`/api/v2/employees/${accountId}/leave`, 'Verlof via employee'],

    // ===== BALANCE / HOURS =====
    [`/api/v2/balance?account_id=${accountId}`, 'Uren saldo'],
    [`/api/v2/hours?account_id=${accountId}`, 'Uren'],
    [`/api/v2/clock-times?account_id=${accountId}&date=${date}`, 'Klok tijden'],
    [`/api/v2/clock-times?account_id=${accountId}&date[gte]=2026-03-10&date[lte]=2026-03-16`, 'Klok tijden week'],
    [`/api/v2/indirect-hours?account_id=${accountId}`, 'Indirecte uren'],
    [`/api/v2/payroll?account_id=${accountId}`, 'Loonstrook/payroll'],

    // ===== STORES / VESTIGING =====
    [`/api/v2/stores/${storeId}`, 'Vestiging info'],
    [`/api/v2/stores`, 'Alle vestigingen'],
    [`/api/v2/stores/${storeId}/departments`, 'Afdelingen via store'],

    // ===== CONTRACTS / DIENSTVERBAND =====
    [`/api/v2/contracts?account_id=${accountId}`, 'Contracten'],
    [`/api/v2/employees/${accountId}/contract`, 'Contract via employee'],

    // ===== NOTIFICATIONS / NEWS =====
    [`/api/v2/notifications?account_id=${accountId}`, 'Notificaties'],
    [`/api/v2/news`, 'Nieuws'],
    [`/api/v2/news?store_id=${storeId}`, 'Nieuws per vestiging'],
    [`/api/v2/messages?account_id=${accountId}`, 'Berichten'],

    // ===== OPEN SHIFTS / EXCHANGE =====
    [`/api/v2/open-shifts?date=${date}`, 'Open shifts'],
    [`/api/v2/exchange?account_id=${accountId}`, 'Ruildiensten'],
    [`/api/v2/shift-exchange?account_id=${accountId}`, 'Shift exchange'],

    // ===== MISC =====
    [`/api/v2/accounts/${accountId}`, 'Account info'],
    [`/api/v2/accounts?account_id=${accountId}`, 'Account via filter'],
    [`/api/v2/workload?date=${date}&department_id=102`, 'Werkdruk'],
    [`/api/v2/remarks?account_id=${accountId}`, 'Opmerkingen'],
    [`/api/v2/tasks?account_id=${accountId}`, 'Taken'],
    [`/api/v2/warnings?account_id=${accountId}`, 'Waarschuwingen'],
    [`/api/v2/birthdays`, 'Verjaardagen'],
    [`/api/v2/birthdays?week=${week}`, 'Verjaardagen week'],
  ]

  console.log(`\nTesting ${endpoints.length} endpoints...\n`)
  console.log('STATUS | COUNT | ENDPOINT')
  console.log('-------|-------|' + '-'.repeat(60))

  const results = []
  for (const [path, label] of endpoints) {
    const r = await get(h, path)
    const status = r.isErr ? `${r.status}!` : `${r.status} `
    const countStr = String(r.count).padStart(4)
    console.log(`  ${status}  | ${countStr}  | ${label}`)
    if (!r.isErr && r.count > 0) {
      console.log(`         |       | PREVIEW: ${r.preview}`)
    } else if (r.isErr) {
      console.log(`         |       | ${r.preview}`)
    }
    results.push({ path, label, ...r })
  }

  console.log('\n\n=== SAMENVATTING: WERKENDE ENDPOINTS ===')
  const working = results.filter(r => !r.isErr && r.status === 200 && r.count > 0)
  working.forEach(r => console.log(`  [${r.count}] ${r.label}: ${r.path}`))

  console.log('\n=== ENDPOINTS MET DATA MAAR LEEG ===')
  const empty = results.filter(r => !r.isErr && r.status === 200 && r.count === 0)
  empty.forEach(r => console.log(`  [] ${r.label}: ${r.path}`))

  console.log('\n=== GEFAALDE ENDPOINTS ===')
  const failed = results.filter(r => r.isErr || r.status !== 200)
  failed.forEach(r => console.log(`  [${r.status}] ${r.label}: ${r.preview}`))

  console.log(`\nTotaal: ${endpoints.length} getest, ${working.length} met data, ${empty.length} leeg, ${failed.length} gefaald`)
}
main().catch(e => console.error('FATAL:', e.message))
