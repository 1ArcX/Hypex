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

  const jsRes = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 30000 })
  const js = await jsRes.text()

  // Zoek getColleaguesShifts implementatie
  console.log('=== getColleaguesShifts ===')
  let idx = 0
  let count = 0
  while (count < 5) {
    idx = js.indexOf('getColleaguesShifts', idx + 1)
    if (idx === -1) break
    console.log('\n@ ' + idx + ':')
    console.log(js.slice(Math.max(0, idx - 150), idx + 400))
    count++
  }

  // Zoek getMyShifts
  console.log('\n=== getMyShifts ===')
  idx = js.indexOf('getMyShifts')
  if (idx !== -1) console.log(js.slice(Math.max(0, idx - 100), idx + 400))

  // Zoek employeeName in instances context
  console.log('\n=== employeeName context ===')
  idx = 0
  count = 0
  while (count < 3) {
    idx = js.indexOf('employeeName', idx + 1)
    if (idx === -1) break
    console.log('\n@ ' + idx + ':')
    console.log(js.slice(Math.max(0, idx - 200), idx + 300))
    count++
  }

  // Zoek 'hu.' service definitie (API client voor shifts)
  console.log('\n=== hu service (getColleaguesShifts) ===')
  const huIdx = js.indexOf('getColleaguesShifts')
  if (huIdx !== -1) {
    // Zoek terug naar de 'hu' definitie
    const ctx = js.slice(Math.max(0, huIdx - 500), huIdx + 100)
    console.log(ctx)
  }

  // Zoek ShiftService of ColleagueService
  for (const svc of ['ShiftService', 'ColleagueShift', 'colleague_shift', 'colleagueShift', 'my-overview', 'my-department']) {
    const i = js.indexOf(svc)
    if (i !== -1) {
      console.log('\n[' + svc + ' @ ' + i + ']')
      console.log(js.slice(Math.max(0, i - 100), i + 300))
    }
  }
}
main().catch(e => console.error('FATAL:', e.message))
