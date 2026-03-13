// Test: debug namen in dag-planning
// Gebruik: node test-pmt-names.cjs <username> <password> <date YYYY-MM-DD>
const fetch = require('node-fetch')

const BASE = 'https://jumbo7044.personeelstool.nl'
const API_V2 = `${BASE}/api/v2`
const PMT_HEADERS = {
  'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

const [,, username, password, date = new Date().toISOString().slice(0, 10)] = process.argv
if (!username || !password) {
  console.error('Gebruik: node test-pmt-names.cjs <username> <password> [date]')
  process.exit(1)
}

async function main() {
  // 1. Login
  console.log('=== Login ===')
  const loginRes = await fetch(`${BASE}/pmtLoginSso?subdomain=jumbo7044`, {
    method: 'POST',
    headers: PMT_HEADERS,
    body: JSON.stringify({ username, password, browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } }),
    timeout: 10000
  })
  const loginData = await loginRes.json()
  const result = loginData?.result
  if (!result?.authenticated) { console.error('Login mislukt:', JSON.stringify(result)); process.exit(1) }
  const auth = { token: result.user_token, accountId: result.account_id, storeId: result.store_id }
  console.log('accountId:', auth.accountId, '| storeId:', auth.storeId)
  const h = { ...PMT_HEADERS, 'x-api-user': auth.token }

  // 2. Haal shifts op voor datum
  console.log(`\n=== Shifts op ${date} ===`)
  const qs = new URLSearchParams({ 'date[gte]': date, 'date[lte]': date, limit: 10, sorting: '+start_datetime' }).toString()
  const shiftsRes = await fetch(`${API_V2}/shifts?${qs}`, { headers: h, timeout: 10000 })
  const shiftsData = await shiftsRes.json()
  const shifts = (shiftsData.result || []).slice(0, 5)
  const accountIds = [...new Set(shifts.map(s => s.account_id).filter(Boolean))]
  console.log('Shift account_ids:', accountIds)
  console.log('Eerste shift keys:', Object.keys(shifts[0] || {}))

  // 3. Probeer /employees endpoint en log structuur
  console.log('\n=== GET /stores/{storeId}/employees structuur ===')
  const empRes = await fetch(`${API_V2}/stores/${auth.storeId}/employees?exchange=true&limit=5`, { headers: h, timeout: 10000 })
  const empData = await empRes.json()
  console.log('HTTP status:', empRes.status)
  console.log('Top-level keys:', Object.keys(empData))
  const empArr = empData.result || empData.data || empData || []
  const firstEmp = Array.isArray(empArr) ? empArr[0] : null
  console.log('Eerste medewerker keys:', firstEmp ? Object.keys(firstEmp) : 'geen resultaat')
  console.log('Eerste medewerker:', JSON.stringify(firstEmp, null, 2))
  console.log('Totaal medewerkers:', Array.isArray(empArr) ? empArr.length : 'niet array')

  // 4. Probeer per-account endpoints voor de account_ids uit shifts
  console.log('\n=== Per-account endpoints ===')
  for (const accId of accountIds.slice(0, 3)) {
    const endpoints = [
      `/api/v2/employees/${accId}`,
      `/api/v2/accounts/${accId}`,
      `/api/v2/users/${accId}`,
      `/api/v2/stores/${auth.storeId}/employees/${accId}`,
      `/api/v2/employees?account_id=${accId}`,
    ]
    console.log(`\n-- account_id ${accId} --`)
    for (const ep of endpoints) {
      try {
        const r = await fetch(`${BASE}${ep}`, { headers: h, timeout: 5000 })
        const body = await r.json().catch(() => ({}))
        const res = body.result || body.data || body
        const info = Array.isArray(res) ? res[0] : res
        const name = info?.name || info?.full_name || info?.first_name || info?.display_name || '(geen naam veld)'
        console.log(`  ${ep} -> ${r.status} | naam: ${name} | keys: ${JSON.stringify(Object.keys(info || {}).slice(0, 8))}`)
      } catch (e) {
        console.log(`  ${ep} -> ERROR: ${e.message}`)
      }
    }
  }

  // 5. Probeer /departments
  console.log('\n=== Departments structuur ===')
  const deptRes = await fetch(`${API_V2}/departments?date=${date}`, { headers: h, timeout: 10000 })
  const deptData = await deptRes.json()
  console.log('HTTP status:', deptRes.status)
  const deptArr = deptData.result || deptData.data || []
  console.log('Eerste dept:', JSON.stringify((Array.isArray(deptArr) ? deptArr[0] : deptArr), null, 2))
  console.log('Totaal depts:', Array.isArray(deptArr) ? deptArr.length : 'niet array')
}

main().catch(e => console.error('FATAL:', e.message))
