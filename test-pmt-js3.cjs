const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'

async function main() {
  const res = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 15000 })
  const js = await res.text()

  // Find Okta issuer / domain config
  console.log('=== Okta config ===')
  const oktaConfigPatterns = [
    /okta["':\s]+["']([^"']+)["']/g,
    /issuerOrigin[^"']{0,20}["']([^"']{10,80})["']/g,
    /clientId["'\s:]+["']([^"']{10,50})["']/g,
    /["']https:\/\/[^"']*\.okta[^"']{0,50}["']/g,
    /issuer[^"']{0,5}["']([^"']{15,100})["']/g,
  ]
  for (const p of oktaConfigPatterns) {
    const matches = [...js.matchAll(p)].map(m => m[0]).filter(s => !s.includes('{yourOkta') && s.length < 150)
    if (matches.length) matches.forEach(m => console.log(m))
  }

  // Find the Vue Router route definition for my-schedule
  const mySchedRouteIdx = js.indexOf('"my-schedule"')
  if (mySchedRouteIdx > -1) {
    console.log('\n=== my-schedule route def ===')
    console.log(js.slice(Math.max(0, mySchedRouteIdx - 100), mySchedRouteIdx + 500))
  }

  // Find my-schedule-init route
  const initIdx = js.indexOf('my-schedule-init')
  if (initIdx > -1) {
    console.log('\n=== my-schedule-init context ===')
    console.log(js.slice(Math.max(0, initIdx - 200), initIdx + 400))
  }

  // Find schedule API call (what endpoint does the schedule page call)
  const schedApiIdx = js.indexOf('scheduleId')
  if (schedApiIdx > -1) {
    console.log('\n=== scheduleId context ===')
    console.log(js.slice(Math.max(0, schedApiIdx - 300), schedApiIdx + 300))
  }

  // Find API calls for /my-schedule or employee schedule
  const empSchedPatterns = [
    /["'`][^"'`]*(?:employee|medewerker|my)[^"'`]*(?:schedule|rooster)[^"'`]{0,60}["'`]/g,
    /["'`][^"'`]*schedule[^"'`]*(?:week|year|datum)[^"'`]{0,60}["'`]/g,
  ]
  console.log('\n=== Employee schedule API patterns ===')
  for (const p of empSchedPatterns) {
    const matches = [...js.matchAll(p)].map(m => m[0]).filter(s => s.length < 120)
    if (matches.length) matches.slice(0, 10).forEach(m => console.log(m))
  }

  // Find the store Vuex/Pinia module for auth
  const authStoreIdx = js.indexOf('"auth/user"')
  if (authStoreIdx > -1) {
    console.log('\n=== auth/user context ===')
    console.log(js.slice(Math.max(0, authStoreIdx - 100), authStoreIdx + 800))
  }

  // getDefaultStoreParameter
  const storeParamIdx = js.indexOf('getDefaultStoreParameter')
  if (storeParamIdx > -1) {
    console.log('\n=== getDefaultStoreParameter context ===')
    console.log(js.slice(storeParamIdx, storeParamIdx + 400))
  }

  // Look for the actual Okta domain in the app config or env
  const domainRegex = /["']([a-z0-9-]+\.okta(?:preview)?\.com)['"]/g
  const domains = [...js.matchAll(domainRegex)].map(m => m[1])
  console.log('\n=== Okta domains ===', domains)

  // look for auth config object
  const authConfigIdx = js.indexOf('OKTA') !== -1 ? js.indexOf('OKTA') : js.indexOf('okta_')
  if (authConfigIdx > -1) {
    console.log('\n=== OKTA config object ===')
    console.log(js.slice(authConfigIdx, authConfigIdx + 500))
  }

  // Find vt (axios instance) usage for schedule
  // vt.get or vt.post calls related to schedule
  const vtSchedPatterns = [
    /vt\.(?:get|post)\([^)]{0,200}schedule[^)]{0,100}\)/g,
    /vt\.(?:get|post)\([^)]{0,200}rooster[^)]{0,100}\)/g,
    /vt\.(?:get|post)\([^)]{0,200}shift[^)]{0,100}\)/g,
  ]
  console.log('\n=== vt axios calls for schedule ===')
  for (const p of vtSchedPatterns) {
    const matches = [...js.matchAll(p)].map(m => m[0]).slice(0, 5)
    if (matches.length) matches.forEach(m => console.log(m.slice(0, 200)))
  }
}

main().catch(e => console.error('FATAL:', e.message))
