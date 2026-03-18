const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'

async function main() {
  const res = await fetch(BASE + '/media/js/index-CVIyVS2_.js', { timeout: 15000 })
  const js = await res.text()
  console.log('Bundle size:', js.length, 'chars')

  // Find all quoted paths starting with /api, /auth, /login, etc.
  const pathRegex = /["'`](\/(?:api|auth|login|token|schedule|rooster|shift|planning|my-overview|my-schedule)[^"'`\s]{0,80})["'`]/g
  const paths = [...js.matchAll(pathRegex)].map(m => m[1])
  console.log('\n=== API/route paths ===')
  ;[...new Set(paths)].slice(0, 40).forEach(p => console.log(p))

  // Find endpoint-like strings with interpolation
  const tplRegex = /["'`][^"'`]*\/(api|schedule|rooster|shift|auth)[^"'`\s]{0,60}["'`]/g
  const tpls = [...js.matchAll(tplRegex)].map(m => m[0]).filter(s => s.length < 100)
  console.log('\n=== Template paths ===')
  ;[...new Set(tpls)].slice(0, 30).forEach(p => console.log(p))

  // Find login/auth related field names
  const fieldRegex = /["']((?:username|email|password|token|access|refresh|csrfmiddlewaretoken|sessionid)[^"']{0,30})["']/gi
  const fields = [...js.matchAll(fieldRegex)].map(m => m[1]).filter(s => s.length < 50)
  console.log('\n=== Auth field names ===')
  ;[...new Set(fields)].slice(0, 20).forEach(f => console.log(f))

  // Look for fetch calls
  const fetchRegex = /fetch\(["'`]([^"'`\s]{3,80})["'`]/g
  const fetches = [...js.matchAll(fetchRegex)].map(m => m[1])
  console.log('\n=== fetch() calls ===')
  ;[...new Set(fetches)].slice(0, 20).forEach(f => console.log(f))

  // Look for axios or XMLHttpRequest
  if (js.includes('axios')) console.log('\nAxios is used')
  if (js.includes('XMLHttpRequest')) console.log('XMLHttpRequest is used')
  if (js.includes('$http')) console.log('$http (Angular?) is used')

  // Find baseURL definitions
  const baseUrlRegex = /baseURL\s*[:=]\s*["'`]([^"'`]{5,80})["'`]/g
  const baseUrls = [...js.matchAll(baseUrlRegex)].map(m => m[1])
  console.log('\n=== baseURL definitions ===')
  baseUrls.forEach(u => console.log(u))
}

main().catch(e => console.error('FATAL:', e.message))
