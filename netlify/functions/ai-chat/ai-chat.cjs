// Hypex AI — proxy naar de Google Gemini API (gratis tier). De client (ingelogde
// admin) stuurt een system-prompt + berichten; deze functie roept Gemini aan en
// geeft het antwoord terug. Vereist env-var GEMINI_API_KEY (en SUPABASE_URL/
// _SERVICE_KEY voor de auth-check). Optioneel AI_MODEL (default gemini-2.0-flash).

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.AI_MODEL || 'gemini-2.5-flash'
const ADMIN = (process.env.WIDGET_USER_EMAIL || 'zhafirfachri@gmail.com').toLowerCase()

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'method not allowed' })
  if (!KEY) return resp(500, { error: 'AI niet geconfigureerd (GEMINI_API_KEY ontbreekt)' })

  // Auth: alleen de ingelogde admin mag de AI aanroepen
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return resp(401, { error: 'unauthorized' })
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user || (data.user.email || '').toLowerCase() !== ADMIN) return resp(403, { error: 'forbidden' })
  } catch { return resp(401, { error: 'unauthorized' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return resp(400, { error: 'bad json' }) }
  let messages = Array.isArray(body.messages)
    ? body.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    : []
  // Gemini verwacht dat het gesprek met een 'user'-bericht begint
  while (messages.length && messages[0].role !== 'user') messages = messages.slice(1)
  if (!messages.length) return resp(400, { error: 'no messages' })
  const system = typeof body.system === 'string' && body.system.trim() ? body.system : undefined
  const maxTokens = Math.min(2048, Math.max(256, Number(body.max_tokens) || 1024))
  const temperature = (typeof body.temperature === 'number') ? body.temperature : 0.7
  const wantJson = body.json === true

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const payload = {
    contents,
    ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      // Zet "thinking" uit: anders eten redeneer-tokens de output-limiet op,
      // waardoor antwoorden halverwege afgekapt worden (en meer quota kosten).
      thinkingConfig: { thinkingBudget: 0 },
      ...(wantJson ? { responseMimeType: 'application/json' } : {}),
    },
  }

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(payload),
    })
    const j = await r.json()
    if (!r.ok) return resp(502, { error: j?.error?.message || 'AI-fout' })
    const text = (j?.candidates?.[0]?.content?.parts || []).map(p => p.text).filter(Boolean).join('').trim()
    if (!text) return resp(200, { reply: 'Sorry, ik kon hier even geen antwoord op geven. Probeer het anders te formuleren.' })
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
