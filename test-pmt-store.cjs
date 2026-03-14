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
  const date = '2026-03-13'

  // Zoek schedules store chunk in main bundle
  const jsRes = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 30000 })
  const js = await jsRes.text()
  console.log('Bundle size:', js.length)

  // Zoek getDaySchedules
  let pos = 0
  let found = 0
  while (true) {
    const idx = js.indexOf('DaySchedule', pos)
    if (idx === -1) break
    console.log('\nDaySchedule @ ' + idx + ':')
    console.log(js.slice(Math.max(0, idx-100), idx+300))
    pos = idx + 1
    found++
    if (found >= 5) break
  }

  // Zoek alle calls naar /schedules in de bundle (API calls)
  console.log('\n=== /schedules API calls in bundle ===')
  let spos = 0
  let sfound = 0
  while (true) {
    const idx = js.indexOf("'schedules'", spos)
    if (idx === -1) break
    const ctx = js.slice(Math.max(0, idx-200), idx+300)
    if (ctx.includes('get') || ctx.includes('params') || ctx.includes('date') || ctx.includes('department')) {
      console.log('\n[schedules @ ' + idx + ']')
      console.log(ctx)
      sfound++
      if (sfound >= 10) break
    }
    spos = idx + 1
  }

  // Check alle JS chunks via HTML
  console.log('\n\n=== Vind alle JS chunks ===')
  const homeRes = await fetch(BASE + '/', { timeout: 10000 })
  const html = await homeRes.text()
  const chunks = [...html.matchAll(/src="([^"]*\.js)"/g)].map(m => m[1])
  console.log('Chunks in HTML:', chunks)

  // Analyseer alle beschikbare chunks voor schedules calls
  console.log('\n=== Analyseer alle chunks voor schedule API calls ===')
  const allChunks = [
    '/media/js/MyDepartmentSchedulePage-CrAPerxW.js',
    '/media/js/useScheduleStore-CuW1a5Mp.js',
    '/media/js/MySchedulePage-CTrQMyag.js',
  ]
  for (const chunk of allChunks) {
    try {
      const cres = await fetch(BASE + chunk, { timeout: 10000 })
      if (!cres.ok) continue
      const cjs = await cres.text()
      console.log('\n--- ' + chunk.split('/').pop() + ' (' + cjs.length + ') ---')
      // Print volledige chunk als klein genoeg
      if (cjs.length < 15000) {
        // Zoek API-gerelateerde strings
        const matches = [...cjs.matchAll(/["']([^"']{5,120})["']/g)].map(m=>m[1]).filter(s => s.includes('api') || s.includes('schedule') || s.includes('shift') || s.includes('date') || s.includes('department'))
        ;[...new Set(matches)].slice(0, 20).forEach(m => console.log(' ', m))

        // Zoek v.get of axios calls
        const getCalls = [...cjs.matchAll(/\.get\([^)]{5,200}\)/g)].map(m=>m[0])
        getCalls.slice(0, 10).forEach(c => console.log('  GET:', c.slice(0,150)))
      }
    } catch(e) { console.log(chunk, 'ERROR:', e.message) }
  }

  // Test: schedules endpoint met format-variaties die de app mogelijk gebruikt
  console.log('\n=== Extra schedule endpoint tests ===')
  const tests = [
    `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&department_id[]=102&limit=50`,
    `/api/v2/schedules?date=${date}&department_id=102&limit=50`,
    `/api/v2/schedules?year=${date.slice(0,4)}&week=11&department_id=102&limit=50`,
    `/api/v2/schedules?year=${date.slice(0,4)}&week=11&limit=50`,
    `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&limit=200&type=department`,
    `/api/v2/schedules?date[gte]=${date}&date[lte]=${date}&view=department&limit=50`,
  ]
  for (const ep of tests) {
    const r = await fetch(BASE + ep, { headers: h, timeout: 8000 })
    const d = await r.json()
    const count = (d.result||[]).length
    const err = d.result?.[0]?.code ? d.result[0].message : ''
    console.log(`  ${r.status} | count:${count} | ${err || ep.split('?')[1].slice(0,60)}`)
  }
}
main().catch(e => console.error('FATAL:', e.message))
