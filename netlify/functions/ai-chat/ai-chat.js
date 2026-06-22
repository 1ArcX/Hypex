// Hypex AI — proxy naar de Anthropic API. De client (ingelogde admin) stuurt
// een system-prompt + berichten; deze functie roept Claude aan en geeft het
// antwoord terug. Vereist env-var ANTHROPIC_API_KEY (en SUPABASE_URL/_SERVICE_KEY
// voor de auth-check). Optioneel AI_MODEL.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.AI_MODEL || 'claude-sonnet-4-6'
const ADMIN = (process.env.WIDGET_USER_EMAIL || 'zhafirfachri@gmail.com').toLowerCase()

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'method not allowed' })
  if (!KEY) return resp(500, { error: 'ANTHROPIC_API_KEY niet ingesteld' })

  // Auth: alleen de ingelogde admin mag de (betaalde) AI aanroepen
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return resp(401, { error: 'unauthorized' })
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user || (data.user.email || '').toLowerCase() !== ADMIN) return resp(403, { error: 'forbidden' })
  } catch { return resp(401, { error: 'unauthorized' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return resp(400, { error: 'bad json' }) }
  const messages = Array.isArray(body.messages)
    ? body.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    : []
  if (!messages.length) return resp(400, { error: 'no messages' })
  const system = typeof body.system === 'string' && body.system.trim() ? body.system : undefined
  const maxTokens = Math.min(2048, Math.max(256, Number(body.max_tokens) || 1024))

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, ...(system ? { system } : {}), messages }),
    })
    const j = await r.json()
    if (!r.ok) return resp(502, { error: j?.error?.message || 'AI-fout' })
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
    return resp(200, { reply: text })
  } catch (e) {
    return resp(502, { error: 'AI niet bereikbaar' })
  }
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(obj),
  }
}
