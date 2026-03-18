const { Issuer, generators } = require('openid-client')
const fetch = require('node-fetch')

async function test() {
  const issuerUrl = 'https://accounts.magister.net'
  const school = 'ichthus'
  const username = '122952'
  const password = '5ju8mhp!'

  const issuer = await Issuer.discover(issuerUrl)
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)
  const state = generators.state()
  const nonce = generators.nonce()
  const client = new issuer.Client({ client_id: 'M6LOAPP', redirect_uris: ['m6loapp://oauth2redirect/'], response_types: ['code id_token'], id_token_signed_response_alg: 'RS256', token_endpoint_auth_method: 'none' })
  const authUrl = client.authorizationUrl({ scope: 'openid profile offline_access', code_challenge: codeChallenge, code_challenge_method: 'S256', acr_values: `tenant:${school}.magister.net`, client_id: 'M6LOAPP', state, nonce, prompt: 'select_account' })

  const noRedirects = { redirect: 'manual', follow: 0 }
  const r1 = await fetch(authUrl, noRedirects)
  const r2 = await fetch(r1.headers.get('location'), noRedirects)
  const location = r2.headers.get('location')
  const rawCookies = r2.headers.raw()['set-cookie']
  const cookieStr = (rawCookies || []).map(c => c.split(';')[0]).join('; ')
  const xsrfEntry = (rawCookies || []).find(c => c.split('=')[0] === 'XSRF-TOKEN')
  const xsrfToken = xsrfEntry ? xsrfEntry.split('=')[1].split(';')[0] : ''
  const locationUrl = new URL(location.startsWith('http') ? location : issuerUrl + location)
  const sessionId = locationUrl.searchParams.get('sessionId')
  const returnUrl = locationUrl.searchParams.get('returnUrl')
  console.log('sessionId:', sessionId)
  console.log('returnUrl:', returnUrl)
  console.log('xsrfToken:', xsrfToken)

  // Check what the login page HTML says
  const loginPage = await fetch(`${issuerUrl}/account/login?sessionId=${sessionId}&returnUrl=${encodeURIComponent(returnUrl)}`, { headers: { cookie: cookieStr } })
  const html = await loginPage.text()
  const authCodeMatch = html.match(/authCode["']?\s*[:=]\s*["']([^"']+)["']/i)
  console.log('AuthCode from HTML:', authCodeMatch ? authCodeMatch[1] : 'not found')
  const codeMatches = [...html.matchAll(/["']([\w]{8,12})["']/g)].map(m => m[1]).filter(c => /^[a-f0-9]+$/.test(c))
  console.log('Hex-like values in HTML:', [...new Set(codeMatches)].slice(0, 15))
}
test().catch(e => console.error('ERROR:', e.message))
