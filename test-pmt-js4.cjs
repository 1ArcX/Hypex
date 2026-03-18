const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'

async function main() {
  // First: check login page HTML for embedded Okta config
  console.log('=== Login page for Okta config ===')
  const loginRes = await fetch(BASE + '/login/', { timeout: 10000 })
  const loginHtml = await loginRes.text()

  // Look for Okta config object in HTML
  const oktaInHtml = loginHtml.match(/okta[^<]{0,500}/gi)
  if (oktaInHtml) oktaInHtml.slice(0, 5).forEach(m => console.log(m.slice(0, 200)))

  // Look for any JSON config
  const configInHtml = loginHtml.match(/window\.__[A-Z_]+\s*=\s*\{[^}]{0,500}\}/g)
  if (configInHtml) configInHtml.forEach(c => console.log('window config:', c.slice(0, 300)))

  // Check for script tags in login page
  const scripts = [...loginHtml.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])
  console.log('Login page scripts:', scripts)

  // Check meta tags
  const metas = [...loginHtml.matchAll(/<meta[^>]+>/gi)].map(m => m[0])
  metas.forEach(m => console.log('Meta:', m.slice(0, 150)))

  // Now fetch the main JS and look for Okta issuer config specifically
  console.log('\n=== Okta issuer in main JS ===')
  const jsRes = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 15000 })
  const js = await jsRes.text()

  // Find OktaAuth config
  const oktaAuthIdx = js.indexOf('OktaAuth(')
  if (oktaAuthIdx > -1) {
    console.log('OktaAuth config:', js.slice(oktaAuthIdx, oktaAuthIdx + 600))
  }

  // Find issuer in object literals near 'okta'
  const issuerContexts = []
  let idx = 0
  while (true) {
    idx = js.indexOf('issuer', idx)
    if (idx === -1) break
    const ctx = js.slice(Math.max(0, idx - 50), idx + 200)
    if (!ctx.includes('{yourOkta') && (ctx.includes('http') || ctx.includes('okta'))) {
      issuerContexts.push(ctx)
    }
    idx++
    if (issuerContexts.length >= 5) break
  }
  issuerContexts.forEach(c => console.log('Issuer ctx:', c))

  // Find subdomain/okta relationship
  const subdomainOkta = [...js.matchAll(/subdomain[^"']{0,30}["']([^"']{5,50})["']/g)].map(m => m[0]).slice(0, 5)
  if (subdomainOkta.length) console.log('Subdomain patterns:', subdomainOkta)

  // Check homepage for SSO/Okta config
  console.log('\n=== Homepage for auth config ===')
  const homeRes = await fetch(BASE + '/', { timeout: 10000 })
  const homeHtml = await homeRes.text()
  const homeScripts = [...homeHtml.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])
  console.log('Home scripts:', homeScripts)

  // Try the MySchedulePage chunk
  console.log('\n=== Fetching MySchedulePage chunk ===')
  try {
    const schedRes = await fetch(BASE + '/media/js/MySchedulePage-CTrQMyag.js', { timeout: 10000 })
    if (schedRes.ok) {
      const schedJs = await schedRes.text()
      console.log('MySchedulePage chunk size:', schedJs.length)
      // Find API calls
      const apiCalls = [...schedJs.matchAll(/vt\.(?:get|post)\([^)]{0,200}\)/g)].map(m => m[0])
      apiCalls.forEach(c => console.log('API call:', c.slice(0, 150)))
      // Find schedule endpoint patterns
      const schedPaths = [...schedJs.matchAll(/["'`][^"'`]*(?:schedule|shift|rooster)[^"'`]{0,60}["'`]/g)].map(m => m[0]).filter(s => s.length < 100)
      ;[...new Set(schedPaths)].slice(0, 15).forEach(p => console.log('Sched path:', p))
    } else {
      console.log('MySchedulePage chunk status:', schedRes.status)
    }
  } catch (e) { console.log('Error fetching chunk:', e.message) }

  // Try to find the config/environment endpoint
  console.log('\n=== Try config endpoints ===')
  for (const path of ['/api/v2/config', '/api/config', '/config', '/api/v2/settings', '/api/v2/auth/config']) {
    try {
      const r = await fetch(BASE + path, { headers: { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq' }, timeout: 5000 })
      if (r.status !== 404) {
        const body = await r.text()
        console.log(path, '->', r.status, body.slice(0, 200))
      }
    } catch (_) {}
  }
}

main().catch(e => console.error('FATAL:', e.message))
