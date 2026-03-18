const fetch = require('node-fetch')

const BASE = 'https://jumbo7044.personeelstool.nl'

async function probe(path, opts = {}) {
  try {
    const res = await fetch(BASE + path, { redirect: 'manual', ...opts, timeout: 8000 })
    return { status: res.status, location: res.headers.get('location'), ct: res.headers.get('content-type'), cookies: res.headers.raw()['set-cookie'] }
  } catch (e) {
    return { error: e.message }
  }
}

async function main() {
  console.log('=== PMT API Discovery ===\n')

  // 1. Probe homepage
  console.log('--- GET / ---')
  const home = await probe('/')
  console.log(home)

  // 2. Probe common auth endpoints
  const authPaths = [
    '/login/', '/api/auth/token/', '/api/token/', '/api/login/',
    '/api/v1/auth/login/', '/api/v1/login/', '/accounts/login/',
    '/auth/login/', '/api/auth/login/'
  ]
  console.log('\n--- Auth endpoint probes (GET) ---')
  for (const p of authPaths) {
    const r = await probe(p)
    if (r.status !== 404) console.log(p, '->', r.status, r.ct || '', r.location || '')
  }

  // 3. Get homepage HTML and look for clues
  console.log('\n--- Homepage HTML analysis ---')
  try {
    const res = await fetch(BASE + '/', { timeout: 8000 })
    const html = await res.text()
    console.log('Final URL:', res.url)
    console.log('Status:', res.status)

    // Look for CSRF
    const csrf = html.match(/csrfmiddlewaretoken.*?value="([^"]{10,})"/i)
    console.log('CSRF token found:', csrf ? csrf[1].slice(0, 20) + '...' : 'no')

    // Look for API base URLs
    const apiUrls = [...html.matchAll(/['"]\/api\/[^'"]{2,50}['"]/g)].map(m => m[0]).slice(0, 10)
    console.log('API paths in HTML:', apiUrls)

    // Look for framework hints
    if (html.includes('django')) console.log('Framework hint: Django')
    if (html.includes('react')) console.log('Framework hint: React')
    if (html.includes('vue')) console.log('Framework hint: Vue')
    if (html.includes('angular')) console.log('Framework hint: Angular')
    if (html.includes('csrftoken')) console.log('Auth hint: CSRF (Django session)')
    if (html.includes('jwt')) console.log('Auth hint: JWT')

    // Find script tags
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).slice(0, 5)
    console.log('Script srcs:', scripts)

    // Show first 500 chars of title area
    const title = html.match(/<title>([^<]*)<\/title>/i)
    console.log('Page title:', title ? title[1] : 'not found')

    // Look for login form action
    const form = html.match(/<form[^>]*action="([^"]*)"[^>]*>/i)
    console.log('Form action:', form ? form[1] : 'not found')

  } catch (e) {
    console.log('Error fetching homepage:', e.message)
  }

  // 4. Try to POST to login with dummy creds to see the error shape
  console.log('\n--- POST /login/ with dummy creds (to see error format) ---')
  try {
    const res = await fetch(BASE + '/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' }),
      timeout: 8000, redirect: 'manual'
    })
    const body = await res.text()
    console.log('Status:', res.status)
    console.log('Body (first 300):', body.slice(0, 300))
  } catch (e) { console.log('Error:', e.message) }

  console.log('\n--- POST /api/auth/token/ with dummy creds ---')
  try {
    const res = await fetch(BASE + '/api/auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' }),
      timeout: 8000
    })
    const body = await res.text()
    console.log('Status:', res.status)
    console.log('Body (first 300):', body.slice(0, 300))
  } catch (e) { console.log('Error:', e.message) }
}

main().catch(e => console.error('FATAL:', e.message))
