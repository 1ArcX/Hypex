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

async function tryGet(h, path, label) {
  try {
    const res = await fetch(BASE + path, { headers: h, timeout: 8000 })
    const data = await res.json()
    const arr = data.result || data.data || (Array.isArray(data) ? data : null)
    const first = Array.isArray(arr) ? arr[0] : arr
    const isErr = first && first.code
    if (res.status !== 404 && !isErr) {
      console.log(`\n✓ ${label}`)
      console.log('  status:', res.status, '| count:', Array.isArray(arr) ? arr.length : '?')
      if (first) console.log('  keys:', Object.keys(first).slice(0, 12).join(', '))
      if (first) console.log('  voorbeeld:', JSON.stringify(first).slice(0, 250))
      return arr
    } else {
      const msg = isErr ? first.message : JSON.stringify(data).slice(0, 80)
      console.log(`  ✗ ${label} -> ${res.status} | ${msg}`)
      return null
    }
  } catch(e) { console.log(`  ✗ ${label} -> ERROR: ${e.message}`); return null }
}

async function main() {
  const auth = await login()
  const { h, storeId } = auth
  const date = '2026-03-13'
  const week = '2026-11'

  console.log('=== HUIDIGE AANPAK: shifts zonder sorting ===')
  const qs0 = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, limit: 200 }).toString()
  const r0 = await fetch(BASE + '/api/v2/shifts?' + qs0, { headers: h, timeout: 10000 })
  const d0 = await r0.json()
  const vandaag = (d0.result||[]).filter(s => s.start_datetime && s.start_datetime.startsWith(date))
  console.log('Totaal terug:', (d0.result||[]).length, '| Na date filter:', vandaag.length)
  const uniqueDates = [...new Set((d0.result||[]).map(s => s.start_datetime.slice(0,10)))]
  console.log('Datums in resultaat:', uniqueDates)

  console.log('\n\n=== PAGINA 1 vs 2 van shifts (pagination) ===')
  for (const page of [0, 1, 2]) {
    const qsp = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, limit: 50, page }).toString()
    const rp = await fetch(BASE + '/api/v2/shifts?' + qsp, { headers: h, timeout: 10000 })
    const dp = await rp.json()
    const count = (dp.result||[]).filter(s => s.start_datetime && s.start_datetime.startsWith(date)).length
    const meta = dp.metaData?.pagination || {}
    console.log(`  page ${page}: total_records=${meta.total_records}, op ${date}: ${count}`)
  }

  console.log('\n\n=== ALTERNATIEVE ENDPOINTS VERKENNEN ===')

  // Rooster endpoints
  await tryGet(h, `/api/v2/rosters?date=${date}&limit=10`, 'rosters')
  await tryGet(h, `/api/v2/roster?date=${date}&limit=10`, 'roster')
  await tryGet(h, `/api/v2/day-schedule?date=${date}&limit=10`, 'day-schedule')
  await tryGet(h, `/api/v2/schedule?date=${date}&limit=10`, 'schedule (singular)')
  await tryGet(h, `/api/v2/store-schedule?date=${date}&limit=10`, 'store-schedule')
  await tryGet(h, `/api/v2/stores/${storeId}/shifts?date[gte]=${date}&date[lte]=${date}&limit=10`, 'stores/{id}/shifts')
  await tryGet(h, `/api/v2/stores/${storeId}/schedule?date=${date}&limit=10`, 'stores/{id}/schedule')
  await tryGet(h, `/api/v2/stores/${storeId}/planning?date=${date}&limit=10`, 'stores/{id}/planning')
  await tryGet(h, `/api/v2/stores/${storeId}/rooster?date=${date}&limit=10`, 'stores/{id}/rooster')
  await tryGet(h, `/api/v2/stores/${storeId}/day-schedule?date=${date}&limit=10`, 'stores/{id}/day-schedule')

  // Week-gebaseerd
  await tryGet(h, `/api/v2/week-schedule?week=${week}&limit=10`, 'week-schedule')
  await tryGet(h, `/api/v2/stores/${storeId}/week-schedule?week=${week}&limit=10`, 'stores/{id}/week-schedule')
  await tryGet(h, `/api/v2/labour?date=${date}&limit=10`, 'labour')
  await tryGet(h, `/api/v2/labour-planning?date=${date}&limit=10`, 'labour-planning')
  await tryGet(h, `/api/v2/work-schedule?date=${date}&limit=10`, 'work-schedule')
  await tryGet(h, `/api/v2/shifts?week=${week}&limit=10`, 'shifts by week')
  await tryGet(h, `/api/v2/shifts?year_week=${week}&limit=10`, 'shifts by year_week')

  // Schedules zonder account_id filter voor alle medewerkers
  await tryGet(h, `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&limit=10`, 'schedules alle (no account_id)')
  await tryGet(h, `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&store_id=${storeId}&limit=10`, 'schedules store filter')

  // Employees gerelateerd
  await tryGet(h, `/api/v2/stores/${storeId}/employees?week=${week}&limit=10`, 'employees week (geen exchange)')
  await tryGet(h, `/api/v2/employees?store_id=${storeId}&limit=10`, 'employees by store')
  await tryGet(h, `/api/v2/employees?limit=10`, 'employees (no filter)')

  // Clocking / presence
  await tryGet(h, `/api/v2/clocktimes?date=${date}&limit=10`, 'clocktimes')
  await tryGet(h, `/api/v2/presence?date=${date}&limit=10`, 'presence')
  await tryGet(h, `/api/v2/clock?date=${date}&limit=10`, 'clock')
}
main().catch(e => console.error('FATAL:', e.message))
