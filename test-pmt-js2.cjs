const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'

async function main() {
  const res = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 15000 })
  const js = await res.text()

  // Find Okta domain
  const oktaPatterns = [
    /okta\.com[^"'\s]{0,60}/g,
    /issuer["'\s:]+["']([^"']+)["']/g,
    /["']https:\/\/[^"']+\.okta(?:preview)?\.com[^"']*["']/g,
    /["']https:\/\/[^"']+personeelstool[^"']*["']/g,
  ]
  console.log('=== Okta/issuer URLs ===')
  for (const p of oktaPatterns) {
    const matches = [...js.matchAll(p)].map(m => m[0]).slice(0, 5)
    if (matches.length) matches.forEach(m => console.log(m))
  }

  // Find getHost function
  const getHostIdx = js.indexOf('getHost')
  if (getHostIdx > -1) {
    console.log('\n=== getHost context ===')
    console.log(js.slice(Math.max(0, getHostIdx - 200), getHostIdx + 400))
  }

  // Find api/v2 context
  const v2Idx = js.indexOf('/api/v2/')
  if (v2Idx > -1) {
    console.log('\n=== /api/v2/ context ===')
    console.log(js.slice(Math.max(0, v2Idx - 300), v2Idx + 300))
  }

  // Find config/settings object with base URL
  const configPatterns = [
    /baseUrl["'\s:]+["']([^"']{10,80})["']/g,
    /apiBase["'\s:]+["']([^"']{10,80})["']/g,
    /API_URL["'\s:]+["']([^"']{10,80})["']/g,
    /apiUrl["'\s:]+["']([^"']{10,80})["']/g,
    /host["'\s:]+["'](https:\/\/[^"']{5,80})["']/g,
  ]
  console.log('\n=== Base URL configs ===')
  for (const p of configPatterns) {
    const matches = [...js.matchAll(p)].map(m => m[0]).slice(0, 5)
    if (matches.length) matches.forEach(m => console.log(m))
  }

  // Find what happens after /api/v1/authn
  const authnIdx = js.indexOf('/api/v1/authn"')
  if (authnIdx > -1) {
    console.log('\n=== /api/v1/authn context ===')
    console.log(js.slice(Math.max(0, authnIdx - 400), authnIdx + 400))
  }

  // Look for /my-schedule endpoint
  const schedIdx = js.indexOf('my-schedule')
  if (schedIdx > -1) {
    console.log('\n=== my-schedule context ===')
    console.log(js.slice(Math.max(0, schedIdx - 200), schedIdx + 400))
  }

  // Find employee/schedule API paths
  const scheduleRegex = /["'`][^"'`]*(?:schedule|rooster|dienst|shift)[^"'`]{0,60}["'`]/g
  const schedPaths = [...js.matchAll(scheduleRegex)].map(m => m[0]).filter(s => !s.includes('substitute') && s.length < 100)
  console.log('\n=== Schedule-related strings ===')
  ;[...new Set(schedPaths)].slice(0, 20).forEach(s => console.log(s))

  // Find /api/v3 context
  const v3Idx = js.indexOf('/api/v3')
  if (v3Idx > -1) {
    console.log('\n=== /api/v3 context ===')
    console.log(js.slice(Math.max(0, v3Idx - 200), v3Idx + 400))
  }
}

main().catch(e => console.error('FATAL:', e.message))
