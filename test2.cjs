const { Issuer, generators } = require('openid-client')
const fetch = require('node-fetch')

async function test() {
  const issuerUrl = 'https://accounts.magister.net'
  const school = 'ichthus'
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

  // Fetch login page and all script src
  const loginPage = await fetch(`${issuerUrl}/account/login?sessionId=${sessionId}&returnUrl=${encodeURIComponent(returnUrl)}`, { headers: { cookie: cookieStr } })
  const html = await loginPage.text()
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1])
  console.log('Script URLs:', scripts)

  // Fetch each script and look for authCode
  for (const s of scripts.slice(0, 5)) {
    const url = s.startsWith('http') ? s : issuerUrl + s
    const r = await fetch(url)
    const js = await r.text()
    const match = js.match(/authCode['":\s]+['"]([a-f0-9]{8,16})['"]/i)
    if (match) { console.log('FOUND authCode in', url, ':', match[1]); break }
    // also try finding it as a variable
    const match2 = js.match(/['"]([\w]{8,16})['"]/g)
    if (match2) {
      const hex = match2.map(m => m.replace(/['"]/g, '')).filter(c => /^[a-f0-9]{8,16}$/.test(c))
      if (hex.length) console.log('Possible codes in', s.slice(-30), ':', hex.slice(0,5))
    }
  }
}
test().catch(e => console.error('ERROR:', e.message))
