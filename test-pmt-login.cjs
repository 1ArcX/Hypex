// Usage: node test-pmt-login.cjs <username> <password> [week] [year]
const fetch = require('node-fetch')

const BASE_URL = 'https://jumbo7044.personeelstool.nl'
const API_V2 = `${BASE_URL}/api/v2`
const X_API_CONTEXT = 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq'

const PMT_HEADERS = {
  'x-api-context': X_API_CONTEXT,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

const [,, username, password, weekArg, yearArg] = process.argv
if (!username || !password) {
  console.error('Usage: node test-pmt-login.cjs <username> <password> [week] [year]')
  process.exit(1)
}

function weekToDateRange(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const monday = new Date(simple)
  monday.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    dateFrom: monday.toISOString().slice(0, 10),
    dateTo: sunday.toISOString().slice(0, 10)
  }
}

function currentISOWeek() {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)
}

async function main() {
  const week = parseInt(weekArg) || currentISOWeek()
  const year = parseInt(yearArg) || new Date().getFullYear()
  console.log(`Testing PMT login for ${username}, week ${week}/${year}`)

  // Step 1: Login
  console.log('\n--- Step 1: Login ---')
  const loginRes = await fetch(`${BASE_URL}/pmtLoginSso?subdomain=jumbo7044`, {
    method: 'POST',
    headers: PMT_HEADERS,
    body: JSON.stringify({
      username, password,
      browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' }
    }),
    timeout: 10000
  })

  console.log('Login status:', loginRes.status)
  const loginData = await loginRes.json()
  console.log('Login response:', JSON.stringify(loginData, null, 2).slice(0, 800))

  if (!loginRes.ok || loginData?.result?.authenticated !== true) {
    console.error('Login failed!')
    return
  }

  const token = loginData.result.user_token
  const accountId = loginData.result.account_id
  const storeId = loginData.result.store_id
  console.log('✓ Login success! token:', token?.slice(0, 20) + '...', 'accountId:', accountId, 'storeId:', storeId)

  const authHeaders = { ...PMT_HEADERS, 'x-api-user': token }
  const { dateFrom, dateTo } = weekToDateRange(week, year)
  console.log('Week date range:', dateFrom, 'to', dateTo)

  // Step 2: Try schedule endpoint with various params
  console.log('\n--- Step 2: Schedule endpoints ---')
  const scheduleParams = [
    { week, year, account_id: accountId },
    { week, year },
    { account_id: accountId },
    { 'date[gte]': dateFrom, 'date[lte]': dateTo, account_id: accountId },
    { 'date_from': dateFrom, 'date_to': dateTo, account_id: accountId },
    { week, year, store_id: storeId },
  ]

  for (const params of scheduleParams) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null))).toString()
    const url = `${API_V2}/schedules?${qs}`
    try {
      const res = await fetch(url, { headers: authHeaders, timeout: 8000 })
      const body = await res.text()
      console.log(`GET /api/v2/schedules?${qs} -> ${res.status}:`, body.slice(0, 300))
    } catch (e) { console.log(`Error: ${e.message}`) }
  }

  // Step 3: Try shifts endpoint
  console.log('\n--- Step 3: Shifts endpoint ---')
  const shiftParams = [
    { 'date[gte]': dateFrom, 'date[lte]': dateTo, account_id: accountId, limit: 50, sorting: '+date' },
    { date_from: dateFrom, date_to: dateTo, account_id: accountId },
    { week, year, account_id: accountId, limit: 50 },
  ]
  for (const params of shiftParams) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null))).toString()
    try {
      const res = await fetch(`${API_V2}/shifts?${qs}`, { headers: authHeaders, timeout: 8000 })
      const body = await res.text()
      console.log(`GET /api/v2/shifts?${qs.slice(0,60)}... -> ${res.status}:`, body.slice(0, 400))
    } catch (e) { console.log(`Error: ${e.message}`) }
  }

  // Step 4: Try /api/v2/employees/me or similar
  console.log('\n--- Step 4: Profile/account endpoints ---')
  const profilePaths = [
    `/employees/${accountId}`, `/accounts/${accountId}`,
    '/employees/me', '/me', `/employees/${accountId}/schedules?week=${week}&year=${year}`,
    `/accounts/${accountId}/schedules?week=${week}&year=${year}`,
  ]
  for (const path of profilePaths) {
    try {
      const res = await fetch(`${API_V2}${path}`, { headers: authHeaders, timeout: 8000 })
      const body = await res.text()
      if (res.status !== 404) console.log(`GET /api/v2${path} -> ${res.status}:`, body.slice(0, 300))
    } catch (_) {}
  }
}

main().catch(e => console.error('FATAL:', e.message, e.stack))
