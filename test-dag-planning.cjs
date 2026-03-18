// node test-dag-planning.cjs <username> <password>
const fetch = require('node-fetch')

const BASE_URL = 'https://jumbo7044.personeelstool.nl'
const API_V2 = `${BASE_URL}/api/v2`
const API_V3 = `${BASE_URL}/api/v3`
const X_API_CONTEXT = 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq'
const PMT_HEADERS = { 'x-api-context': X_API_CONTEXT, 'Content-Type': 'application/json', 'Accept': 'application/json' }

const DATE = '2026-03-12'
const [,, username, password] = process.argv
if (!username || !password) { console.error('Usage: node test-dag-planning.cjs <username> <password>'); process.exit(1) }

async function get(url, headers) {
  const res = await fetch(url, { headers, timeout: 10000 })
  const data = await res.json()
  return { status: res.status, ok: res.ok, data }
}

async function main() {
  // Login
  const loginRes = await fetch(`${BASE_URL}/pmtLoginSso?subdomain=jumbo7044`, {
    method: 'POST', headers: PMT_HEADERS, timeout: 10000,
    body: JSON.stringify({ username, password, browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } })
  })
  const loginData = await loginRes.json()
  if (!loginRes.ok || loginData?.result?.authenticated !== true) { console.error('Login mislukt:', JSON.stringify(loginData?.result)); process.exit(1) }

  const token = loginData.result.user_token
  const accountId = loginData.result.account_id
  const storeId = loginData.result.store_id
  const h = { ...PMT_HEADERS, 'x-api-user': token }
  console.log(`✓ Ingelogd: accountId=${accountId}, storeId=${storeId}\n`)

  // Departments op deze dag
  const { data: deptData } = await get(`${API_V2}/departments?date=${DATE}`, h)
  const depts = deptData.result || []
  console.log(`Departments op ${DATE}: ${depts.length} stuks`)
  depts.forEach(d => console.log(`  dept ${d.department_id}: ${d.department_name}`))
  console.log()

  const dept102 = depts.find(d => d.department_id == 102) || depts[0]
  console.log(`Eigen afdeling: ${dept102?.department_id} (${dept102?.department_name})\n`)

  // Test 1: eigen shift
  const { data: myData } = await get(`${API_V2}/shifts?date=${DATE}&account_id=${accountId}`, h)
  const myShifts = (myData.result || []).filter(s => s.start_datetime?.startsWith(DATE))
  console.log(`Test 1 — eigen shift (account_id=${accountId}): ${myShifts.length} shifts`)
  myShifts.forEach(s => console.log(`  ${s.start_datetime} - ${s.end_datetime} | dept=${s.department_id} | account=${s.account_id}`))
  const myDeptId = myShifts[0]?.department_id || 102
  console.log(`  → gebruik department_id=${myDeptId}\n`)

  // Test 2: collega's met department_id filter (huidige aanpak)
  const qs2 = `date=${DATE}&ignore_lent_out=true&account_id[neq]=${accountId}&department_id=${myDeptId}`
  const { data: d2 } = await get(`${API_V2}/shifts?${qs2}`, h)
  const c2 = (d2.result || []).filter(s => s.start_datetime?.startsWith(DATE) && s.start_datetime !== s.end_datetime)
  console.log(`Test 2 — collega shifts (dept filter, huidige aanpak): ${c2.length} shifts`)
  c2.forEach(s => console.log(`  account=${s.account_id} | ${s.start_datetime} - ${s.end_datetime} | dept=${s.department_id}`))
  console.log()

  // Test 3: zonder account_id[neq], alle shifts in dept 102
  const qs3 = `date=${DATE}&ignore_lent_out=true&department_id=${myDeptId}`
  const { data: d3 } = await get(`${API_V2}/shifts?${qs3}`, h)
  const c3 = (d3.result || []).filter(s => s.start_datetime?.startsWith(DATE) && s.start_datetime !== s.end_datetime)
  console.log(`Test 3 — alle shifts dept ${myDeptId} (geen neq filter): ${c3.length} shifts`)
  c3.forEach(s => console.log(`  account=${s.account_id} | ${s.start_datetime} - ${s.end_datetime}`))
  console.log()

  // Test 4: zonder department filter helemaal
  const qs4 = `date=${DATE}&ignore_lent_out=true`
  const { data: d4 } = await get(`${API_V2}/shifts?${qs4}`, h)
  const c4 = (d4.result || []).filter(s => s.start_datetime?.startsWith(DATE) && s.start_datetime !== s.end_datetime)
  console.log(`Test 4 — alle shifts op ${DATE} (geen dept filter): ${c4.length} shifts`)
  const deptCounts = {}
  c4.forEach(s => { deptCounts[s.department_id] = (deptCounts[s.department_id] || 0) + 1 })
  console.log('  per afdeling:', JSON.stringify(deptCounts))
  console.log()

  // Test 5: date[gte]/date[lte] ipv date= voor dept 102
  const qs5 = `date[gte]=${DATE}&date[lte]=${DATE}&department_id=${myDeptId}`
  const { data: d5 } = await get(`${API_V2}/shifts?${qs5}`, h)
  const c5 = (d5.result || []).filter(s => s.start_datetime?.startsWith(DATE) && s.start_datetime !== s.end_datetime)
  console.log(`Test 5 — date[gte/lte] + dept ${myDeptId}: ${c5.length} shifts`)
  c5.forEach(s => console.log(`  account=${s.account_id} | ${s.start_datetime} - ${s.end_datetime}`))
  console.log()

  // Test 6: simpleShifts v3 (van eigen week)
  const { data: d6, status: s6 } = await get(`${API_V3}/environments/5/stores/${storeId}/employee/${accountId}/simpleShifts?from_date=2026-03-09&to_date=2026-03-15`, h)
  console.log(`Test 6 — simpleShifts v3: status=${s6}, ${JSON.stringify(d6).slice(0, 300)}\n`)

  // Test 7: employees endpoint — hoeveel mensen in dept 102?
  const { data: empData } = await get(`${API_V2}/stores/${storeId}/employees?exchange=true&limit=10000&week=2026-11`, h)
  const allEmp = empData.result || []
  console.log(`Test 7 — employees (exchange=true): ${allEmp.length} totaal`)

  // Naam lookup map
  const empMap = {}
  for (const e of allEmp) empMap[String(e.account_id)] = e.name

  // Toon namen van mensen in test 3 (alle shifts dept 102)
  console.log(`\nNamen van test 3 (alle shifts dept ${myDeptId}):`)
  c3.forEach(s => console.log(`  ${empMap[String(s.account_id)] || '(onbekend)'} | ${s.start_datetime} - ${s.end_datetime}`))

  console.log(`\nNamen van test 4 dept 102 shifts:`)
  c4.filter(s => s.department_id == myDeptId).forEach(s => console.log(`  ${empMap[String(s.account_id)] || '(onbekend)'} | ${s.start_datetime} - ${s.end_datetime}`))
}

main().catch(e => console.error('FATAL:', e.message))
