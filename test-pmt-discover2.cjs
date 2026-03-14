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

async function tryGet(h, path) {
  try {
    const res = await fetch(BASE + path, { headers: h, timeout: 8000 })
    const data = await res.json()
    const arr = data.result || data.data || (Array.isArray(data) ? data : null)
    const first = Array.isArray(arr) ? arr[0] : arr
    const isErr = first && (first.code || first.error)
    if (res.status !== 404 && !isErr && Array.isArray(arr) && arr.length > 0) {
      return { ok: true, count: arr.length, keys: Object.keys(first || {}).slice(0, 10), first }
    }
    return { ok: false, status: res.status, msg: isErr ? first?.message : JSON.stringify(data).slice(0, 60) }
  } catch(e) { return { ok: false, msg: e.message } }
}

async function main() {
  const { h, storeId } = await login()
  const date = '2026-03-13'

  // Analyseer JS bundle voor API endpoints
  console.log('=== JS Bundle analyse — alle /api/ paths ===')
  const jsRes = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 15000 })
  const js = await jsRes.text()

  // Zoek alle unieke /api/v2/ paths
  const apiPaths = [...js.matchAll(/['"`]\/api\/v2\/([^'"`\s?&]{3,60})['"`]/g)]
    .map(m => m[1])
    .filter(p => !p.includes('${'))
  const unique = [...new Set(apiPaths)].sort()
  console.log('Gevonden endpoints:', unique.length)
  unique.forEach(p => console.log(' ', p))

  // Zoek template strings met ${} voor dynamische paths
  console.log('\n=== Dynamische API paths (template literals) ===')
  const templatePaths = [...js.matchAll(/['"`]\/api\/v2\/[^'"`]*\$\{[^'"`]*\}[^'"`]{0,40}['"`]/g)]
    .map(m => m[0].slice(1,-1))
  const uniqueTemplate = [...new Set(templatePaths)]
  uniqueTemplate.slice(0, 30).forEach(p => console.log(' ', p))

  // Zoek "department" gerelateerde code
  console.log('\n=== Department schedule context in bundle ===')
  const patterns = ['department-schedule', 'departmentSchedule', 'department_schedule', 'DepartmentSchedule']
  for (const p of patterns) {
    const idx = js.indexOf(p)
    if (idx !== -1) {
      console.log(`\n"${p}" gevonden op positie ${idx}:`)
      console.log(js.slice(Math.max(0, idx - 150), idx + 300))
    }
  }

  // Zoek alle routes die planning gerelateerd zijn
  console.log('\n=== Planning gerelateerde routes/endpoints ===')
  const planPatterns = [...js.matchAll(/['"`][^'"`]*(?:planning|department|schedule|dienst|roster|rooster)[^'"`]{3,80}['"`]/g)]
    .map(m => m[0])
    .filter(s => s.includes('/api/') && s.length < 150)
  ;[...new Set(planPatterns)].slice(0, 20).forEach(p => console.log(' ', p))

  // Test gevonden endpoints
  console.log('\n=== Test nieuwe endpoints ===')
  const toTest = [
    `/api/v2/departments/102/shifts?date[gte]=${date}&date[lte]=${date}&limit=50`,
    `/api/v2/departments/102/schedule?date=${date}&limit=50`,
    `/api/v2/departments/102/planning?date=${date}&limit=50`,
    `/api/v2/stores/${storeId}/departments/102/shifts?date[gte]=${date}&date[lte]=${date}&limit=50`,
    `/api/v2/department-schedule?date=${date}&department_id=102&limit=50`,
    `/api/v2/department-shifts?date=${date}&department_id=102&limit=50`,
    `/api/v2/departments/${date}/shifts?limit=10`,
    `/api/v2/shifts?date[gte]=${date}&date[lte]=${date}&limit=50&department_id[]=102&department_id[]=101`,
    `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&department_id=102&limit=50`,
    `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&store_id=${storeId}&department_id=102&limit=50`,
    `/api/v3/shifts?date[gte]=${date}&date[lte]=${date}&department_id=102&limit=50`,
    `/api/v1/shifts?date[gte]=${date}&date[lte]=${date}&department_id=102&limit=50`,
  ]

  for (const ep of toTest) {
    const r = await tryGet(h, ep)
    if (r.ok) {
      console.log(`\n✓ ${ep}`)
      console.log('  count:', r.count, '| keys:', r.keys)
      console.log('  voorbeeld:', JSON.stringify(r.first).slice(0, 200))
    } else {
      console.log(`✗ ${ep.split('?')[0]} -> ${r.status || ''} ${r.msg || ''}`)
    }
  }
}
main().catch(e => console.error('FATAL:', e.message))
