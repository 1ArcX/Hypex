const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const PMT_HEADERS = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function main() {
  const loginRes = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', { method: 'POST', headers: PMT_HEADERS, body: JSON.stringify({ username: 'Fachri.zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } }), timeout: 10000 })
  const r = (await loginRes.json()).result
  const h = { ...PMT_HEADERS, 'x-api-user': r.user_token }

  // Log volledig shift object inclusief instances
  console.log('=== Volledig shift object (date=2026-03-12, limit=1) ===')
  const qs = new URLSearchParams({ 'date[gte]': '2026-03-12', 'date[lte]': '2026-03-12', limit: 1 }).toString()
  const s1 = await fetch(BASE + '/api/v2/shifts?' + qs, { headers: h, timeout: 10000 })
  const d1 = await s1.json()
  console.log(JSON.stringify((d1.result || []).slice(0, 1), null, 2))

  // Probeer alternatieve endpoints
  const endpoints = [
    '/api/v2/shift-instances?date=2026-03-12&limit=3',
    '/api/v2/shifts/instances?date[gte]=2026-03-12&date[lte]=2026-03-12&limit=3',
    '/api/v2/instances?date[gte]=2026-03-12&date[lte]=2026-03-12&limit=3',
    '/api/v2/shifts?start_datetime[gte]=2026-03-12&start_datetime[lte]=2026-03-12 23:59&limit=3',
    '/api/v2/department-planning?date=2026-03-12&limit=3',
    '/api/v2/store-planning?date=2026-03-12&limit=3',
    '/api/v2/shifts?instance_date=2026-03-12&limit=3',
  ]

  console.log('\n=== Alternatieve endpoints ===')
  for (const ep of endpoints) {
    try {
      const res = await fetch(BASE + ep, { headers: h, timeout: 8000 })
      const data = await res.json()
      const first = (data.result || [])[0]
      const isError = first && first.code
      if (res.status !== 404 && !isError) {
        console.log('\n' + ep, '->', res.status, '| count:', (data.result || []).length)
        if (first) console.log('  keys:', Object.keys(first))
        if (first) console.log('  example:', JSON.stringify(first).slice(0, 200))
      } else {
        const msg = isError ? first.message : JSON.stringify(data).slice(0, 80)
        console.log(ep, '->', res.status, '|', msg)
      }
    } catch (e) {
      console.log(ep, '-> ERROR:', e.message)
    }
  }
}
main().catch(e => console.error(e.message))
