// Bankkoppeling (alleen-lezen, PSD2) via Enable Banking: ING-saldo's en -transacties ophalen.
// Docs: https://enablebanking.com/docs/api/reference/
//
// Env: ENABLEBANKING_APP_ID, optioneel ENABLEBANKING_ASPSP (standaard "ING"),
//      SITE_URL (standaard https://hypexdash.netlify.app), SUPABASE_URL, SUPABASE_SERVICE_KEY, CRON_SECRET.
// De private key (PEM) staat in de Supabase Vault als `enablebanking_private_key` (zie add_app_secrets.sql),
// omdat Netlify/Lambda maar 4 KB aan omgevingsvariabelen toestaat; ENABLEBANKING_PRIVATE_KEY in env werkt ook.
//
// Aanroepen:
//  - App (POST, Authorization: Bearer <Supabase access token>): { action: 'start' | 'callback' | 'sync' | 'status' | 'disconnect', ... }
//  - Supabase pg_cron (header x-cron-secret): alle actieve koppelingen synchroniseren (elke ochtend).

const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { suggest, manualBalance } = require('./bankCore')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const API = 'https://api.enablebanking.com'
const APP_ID = process.env.ENABLEBANKING_APP_ID
const normPem = (v) => String(v || '').replace(/\\n/g, '\n').trim()
let privateKeyCache = normPem(process.env.ENABLEBANKING_PRIVATE_KEY) || null
async function privateKey() {
  if (privateKeyCache) return privateKeyCache
  const { data, error } = await supabase.rpc('get_app_secret', { secret_name: 'enablebanking_private_key' })
  if (error) throw new Error(`Sleutel ophalen uit Supabase Vault mislukt: ${error.message}`)
  if (!data || !String(data).includes('PRIVATE KEY')) throw new Error('Geen Enable Banking-sleutel gevonden (Supabase Vault: enablebanking_private_key)')
  return (privateKeyCache = normPem(data))
}
const ASPSP = process.env.ENABLEBANKING_ASPSP || 'ING'
const SITE = (process.env.SITE_URL || 'https://hypexdash.netlify.app').replace(/\/$/, '')
const REDIRECT = `${SITE}/geld/bank-callback`
const DAY = 86400000
const SYNC_MIN_GAP = 60 * 60 * 1000 // bij openen max. één keer per uur

// ── Enable Banking-client ───────────────────────────────────────────────────
// Verzoek dat de gebruiker zelf doet (app open): PSU-headers mee, dan geldt de PSD2-limiet van
// 4 achtergrond-verzoeken per dag niet. Wordt per request gezet in de handler.
let psuHeaders = {}
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
function jwt(key) {
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: APP_ID }))
  const body = b64url(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }))
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(key)
  return `${head}.${body}.${b64url(sig)}`
}
async function eb(path, { method = 'GET', body, query } = {}) {
  const url = new URL(API + path)
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url, {
      method, signal: ctrl.signal,
      headers: { Authorization: `Bearer ${jwt(await privateKey())}`, 'Content-Type': 'application/json', ...psuHeaders },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
    if (!res.ok) {
      const msg = data?.message || data?.detail || data?.error || text || `HTTP ${res.status}`
      const err = new Error(`Enable Banking ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
      err.status = res.status
      throw err
    }
    return data
  } finally { clearTimeout(t) }
}

// ── helpers ─────────────────────────────────────────────────────────────────
const isoDate = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
const accountKind = (a) => (a.cash_account_type === 'SVGS' || /spaar|saving|sparen|rente/i.test(`${a.name || ''} ${a.product || ''}`)) ? 'spaar' : 'betaal'
const ibanOf = (a) => a?.account_id?.iban || a?.iban || null
const BALANCE_ORDER = ['CLBD', 'ITBD', 'XPCD', 'ITAV', 'CLAV', 'OPBD', 'PRCD', 'OTHR']

function pickBalance(balances) {
  const list = (balances || []).filter(b => b?.balance_amount?.amount != null)
  list.sort((a, b) => {
    const ia = BALANCE_ORDER.indexOf(a.balance_type), ib = BALANCE_ORDER.indexOf(b.balance_type)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return list[0] || null
}

function mapTransaction(t) {
  const debit = t.credit_debit_indicator === 'DBIT'
  const raw = Number(t?.transaction_amount?.amount || 0)
  const amount = Math.round((debit ? -Math.abs(raw) : Math.abs(raw)) * 100) / 100
  const party = debit ? t.creditor : t.debtor
  const partyAcc = debit ? t.creditor_account : t.debtor_account
  const description = (Array.isArray(t.remittance_information) ? t.remittance_information.join(' ') : (t.remittance_information || '')).trim()
  const booking = t.booking_date || t.value_date || t.transaction_date
  const counterparty = (party?.name || '').trim() || null
  const ext = t.entry_reference || t.transaction_id
    || crypto.createHash('sha1').update(`${booking}|${amount}|${counterparty}|${description}`).digest('hex')
  return { ext_id: String(ext), booking_date: booking, amount, counterparty, counterparty_iban: partyAcc?.iban || null, description: description || null, status: t.status }
}

async function userFromEvent(event) {
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  return error ? null : data.user
}
// Fout door de gebruiker/invoer (→ 400 i.p.v. 500)
const userError = (msg) => Object.assign(new Error(msg), { status: 400 })
const getConnection = async (uid) => (await supabase.from('bank_connections').select('*').eq('user_id', uid).maybeSingle()).data

// ── synchroniseren ──────────────────────────────────────────────────────────
// Oudere geschiedenis (> 90 dagen) geven banken meestal alleen vlak na het inloggen bij de bank (PSD2/SCA).
// Lukt het niet, dan valt de sync terug op 90 dagen en meldt `history_limited`.
async function syncConnection(conn, { from } = {}) {
  const uid = conn.user_id
  if (!conn.session_id || conn.status === 'disconnected') return { skipped: 'geen koppeling' }
  if (conn.valid_until && new Date(conn.valid_until) < new Date()) {
    await supabase.from('bank_connections').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', conn.id)
    return { expired: true }
  }
  try {
    const { data: allAccounts } = await supabase.from('bank_accounts').select('*').eq('user_id', uid)
    const accounts = (allAccounts || []).filter(a => a.connection_id === conn.id && !a.manual)
    const { data: cfg } = await supabase.from('budget_config').select('bank_rules').eq('user_id', uid).maybeSingle()
    // Eigen rekeningen (ook zelf toegevoegde spaarrekeningen) → overboekingen herkennen
    const ctx = { ownAccounts: (allAccounts || []).map(a => ({ iban: a.iban, kind: a.kind, match: a.match })), rules: cfg?.bank_rules || {} }
    const since = from ? new Date(`${from}T00:00:00`)
      : conn.last_synced_at ? new Date(new Date(conn.last_synced_at).getTime() - 14 * DAY) : new Date(Date.now() - 365 * DAY)
    const fallback = new Date(Date.now() - 89 * DAY)
    let added = 0, historyLimited = false

    for (const acc of accounts || []) {
      // Saldo
      try {
        const bal = pickBalance((await eb(`/accounts/${acc.uid}/balances`))?.balances)
        if (bal) await supabase.from('bank_accounts').update({
          balance: Number(bal.balance_amount.amount), currency: bal.balance_amount.currency || 'EUR',
          balance_at: bal.last_change_date_time || new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('uid', acc.uid)
      } catch (e) { console.warn('[bank] saldo', acc.uid, e.message) }

      // Transacties (gepagineerd)
      const rows = []
      let key = null, pages = 0, accFrom = since
      do {
        let res
        try { res = await eb(`/accounts/${acc.uid}/transactions`, { query: { date_from: isoDate(accFrom), continuation_key: key } }) }
        catch (e) {
          // Bank weigert de oude periode → met 90 dagen opnieuw (alleen bij de eerste pagina)
          if (!key && accFrom < fallback && e.status && e.status < 500 && e.status !== 401) {
            historyLimited = true; accFrom = fallback
            res = await eb(`/accounts/${acc.uid}/transactions`, { query: { date_from: isoDate(accFrom) } })
          } else throw e
        }
        for (const t of res?.transactions || []) {
          const m = mapTransaction(t)
          if (!m.booking_date || (m.status && m.status !== 'BOOK')) continue // alleen geboekte transacties (pending krijgen later een ander id)
          const s = suggest({ ...m, account_kind: acc.kind }, ctx)
          rows.push({
            user_id: uid, account_uid: acc.uid, ext_id: m.ext_id, booking_date: m.booking_date, amount: m.amount,
            counterparty: m.counterparty, counterparty_iban: m.counterparty_iban, description: m.description,
            suggested_kind: s.kind, suggested_category: s.category, status: s.autoIgnore ? 'ignored' : 'new',
          })
        }
        key = res?.continuation_key || null
      } while (key && ++pages < 40)

      if (rows.length) {
        // Bestaande (zelfde rekening + ext_id) blijven zoals ze zijn
        const { data: inserted, error } = await supabase.from('bank_transactions')
          .upsert(rows, { onConflict: 'account_uid,ext_id', ignoreDuplicates: true }).select()
        if (error) throw new Error(error.message)
        added += (inserted || []).length
        await matchExisting(uid, (inserted || []).filter(r => r.status === 'new' && r.suggested_kind === 'uitgave'))
      }
    }
    await updateManualSavings(uid, allAccounts || [])
    await supabase.from('bank_connections').update({ status: 'active', last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', conn.id)
    return { added, history_limited: historyLimited }
  } catch (e) {
    const expired = e.status === 401 || e.status === 403 || /expired|EXPIRED_SESSION|not authorized/i.test(e.message)
    await supabase.from('bank_connections').update({ status: expired ? 'expired' : conn.status, last_error: e.message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', conn.id)
    throw e
  }
}

// Zelf toegevoegde spaarrekeningen: saldo = startsaldo + overboekingen die op de betaalrekening te zien zijn
async function updateManualSavings(uid, accounts) {
  const manual = accounts.filter(a => a.manual && a.base_date)
  if (!manual.length) return
  const from = manual.map(a => a.base_date).sort()[0]
  const real = new Set(accounts.filter(a => !a.manual).map(a => a.uid))
  const { data: txs } = await supabase.from('bank_transactions').select('booking_date, amount, counterparty, counterparty_iban, account_uid')
    .eq('user_id', uid).gt('booking_date', from)
  const own = (txs || []).filter(t => real.has(t.account_uid))
  for (const a of manual) {
    await supabase.from('bank_accounts').update({ balance: manualBalance(a, own), balance_at: new Date().toISOString() }).eq('uid', a.uid)
  }
}

// Al zelf ingevoerd? Zelfde bedrag binnen 2 dagen en nog niet aan een banktransactie gekoppeld → 'matched'
async function matchExisting(uid, txs) {
  if (!txs.length) return
  const dates = txs.map(t => t.booking_date).sort()
  const from = isoDate(new Date(new Date(dates[0]).getTime() - 2 * DAY)), to = isoDate(new Date(new Date(dates[dates.length - 1]).getTime() + 2 * DAY))
  const [{ data: exps }, { data: linked }] = await Promise.all([
    supabase.from('expenses').select('id, amount, date').eq('user_id', uid).gte('date', from).lte('date', to)
      .eq('is_income', false).eq('is_savings_withdrawal', false).not('is_savings_contribution', 'is', true),
    supabase.from('bank_transactions').select('expense_id').eq('user_id', uid).not('expense_id', 'is', null),
  ])
  const used = new Set((linked || []).map(l => l.expense_id))
  for (const t of txs) {
    const amt = Math.abs(Number(t.amount))
    const day = new Date(t.booking_date).getTime()
    const hit = (exps || []).find(e => !used.has(e.id) && Math.abs(Number(e.amount) - amt) < 0.005 && Math.abs(new Date(e.date).getTime() - day) <= 2 * DAY)
    if (hit) {
      used.add(hit.id)
      await supabase.from('bank_transactions').update({ status: 'matched', expense_id: hit.id }).eq('id', t.id)
    }
  }
}

// ── acties ──────────────────────────────────────────────────────────────────
async function status(uid) {
  const conn = await getConnection(uid)
  const { data: accounts } = await supabase.from('bank_accounts').select('*').eq('user_id', uid).order('kind')
  const { count } = await supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'new')
  return {
    connected: !!conn?.session_id && conn.status !== 'disconnected', status: conn?.status || 'none', aspsp: conn?.aspsp || ASPSP,
    valid_until: conn?.valid_until || null, last_synced_at: conn?.last_synced_at || null, last_error: conn?.last_error || null,
    accounts: accounts || [], new_count: count || 0,
  }
}

async function start(uid) {
  const state = crypto.randomBytes(16).toString('hex')
  const existing = await getConnection(uid)
  if (existing) await supabase.from('bank_connections').update({ pending_state: state, aspsp: ASPSP, updated_at: new Date().toISOString() }).eq('id', existing.id)
  else await supabase.from('bank_connections').insert({ user_id: uid, aspsp: ASPSP, pending_state: state, status: 'pending' })
  const body = (days) => ({
    access: { valid_until: new Date(Date.now() + days * DAY).toISOString() },
    aspsp: { name: ASPSP, country: 'NL' }, state, redirect_url: REDIRECT, psu_type: 'personal',
  })
  let res
  try { res = await eb('/auth', { method: 'POST', body: body(180) }) }
  catch (e) {
    if (e.status !== 400 && e.status !== 422) throw e
    res = await eb('/auth', { method: 'POST', body: body(90) }) // sommige banken staan minder dan 180 dagen toe
  }
  return { url: res.url }
}

async function callback(uid, { code, state }) {
  if (!code) throw userError('code ontbreekt')
  const conn = await getConnection(uid)
  if (!conn || !conn.pending_state || conn.pending_state !== state) throw userError('Ongeldige of verlopen koppelpoging, probeer opnieuw')
  const session = await eb('/sessions', { method: 'POST', body: { code } })
  if (conn.session_id && conn.session_id !== session.session_id) {
    try { await eb(`/sessions/${conn.session_id}`, { method: 'DELETE' }) } catch { /* oude sessie al weg */ }
  }
  const update = {
    session_id: session.session_id, valid_until: session.access?.valid_until || null, status: 'active',
    pending_state: null, last_error: null, updated_at: new Date().toISOString(),
  }
  await supabase.from('bank_connections').update(update).eq('id', conn.id)
  const accounts = (session.accounts || []).map(a => ({
    uid: a.uid, user_id: uid, connection_id: conn.id, name: a.name || a.product || 'Rekening',
    iban: ibanOf(a), kind: accountKind(a), currency: a.currency || 'EUR', updated_at: new Date().toISOString(),
  }))
  if (accounts.length) {
    // Bestaande rekeningen houden hun eigen instellingen (kind/hidden) — alleen naam/koppeling bijwerken
    const { data: known } = await supabase.from('bank_accounts').select('uid, kind, hidden').in('uid', accounts.map(a => a.uid))
    const prev = new Map((known || []).map(k => [k.uid, k]))
    const rows = accounts.map(a => prev.has(a.uid) ? { ...a, kind: prev.get(a.uid).kind, hidden: prev.get(a.uid).hidden } : a)
    const { error } = await supabase.from('bank_accounts').upsert(rows, { onConflict: 'uid' })
    if (error) throw new Error(error.message)
  }
  try { await syncConnection({ ...conn, ...update }) } catch (e) { console.warn('[bank] eerste sync', e.message) }
  return status(uid)
}

async function disconnect(uid) {
  const conn = await getConnection(uid)
  if (conn?.session_id) { try { await eb(`/sessions/${conn.session_id}`, { method: 'DELETE' }) } catch { /* al verlopen */ } }
  if (conn) await supabase.from('bank_connections').update({ status: 'disconnected', session_id: null, updated_at: new Date().toISOString() }).eq('id', conn.id)
  return status(uid)
}

// ── handler ─────────────────────────────────────────────────────────────────
const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' }
const json = (statusCode, obj) => ({ statusCode, headers: HEADERS, body: JSON.stringify(obj) })

exports.handler = async (event) => {
  // Geplande sync (Supabase pg_cron)
  const cronSecret = event.headers['x-cron-secret']
  if (cronSecret !== undefined) {
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) return { statusCode: 401 }
    psuHeaders = {}
    const { data: conns } = await supabase.from('bank_connections').select('*').eq('status', 'active')
    const results = []
    for (const c of conns || []) {
      try { results.push({ user: c.user_id, ...(await syncConnection(c)) }) } catch (e) { results.push({ user: c.user_id, error: e.message }) }
    }
    return json(200, { synced: results.length, results })
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Alleen POST' })
  if (!APP_ID) return json(500, { error: 'Bankkoppeling nog niet ingesteld (ENABLEBANKING_APP_ID ontbreekt in Netlify)' })
  const user = await userFromEvent(event)
  if (!user) return json(401, { error: 'Niet ingelogd' })
  const ip = event.headers['x-nf-client-connection-ip'] || (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
  psuHeaders = ip ? { 'Psu-Ip-Address': ip, 'Psu-User-Agent': event.headers['user-agent'] || 'Hypex' } : {}
  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Ongeldige JSON' }) }

  try {
    if (body.action === 'status') return json(200, await status(user.id))
    if (body.action === 'start') return json(200, await start(user.id))
    if (body.action === 'callback') return json(200, await callback(user.id, body))
    if (body.action === 'disconnect') return json(200, await disconnect(user.id))
    if (body.action === 'history') {
      // Oudere transacties ophalen vanaf `from` (YYYY-MM-DD, max. 2 jaar terug)
      const conn = await getConnection(user.id)
      if (!conn?.session_id) return json(400, { error: 'Nog geen bankkoppeling' })
      const min = isoDate(new Date(Date.now() - 730 * DAY))
      const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from || '') && body.from >= min ? body.from : isoDate(new Date(Date.now() - 365 * DAY))
      const r = await syncConnection(conn, { from })
      return json(200, { ...(await status(user.id)), history: r })
    }
    if (body.action === 'sync') {
      const conn = await getConnection(user.id)
      if (!conn?.session_id) return json(200, await status(user.id))
      const fresh = conn.last_synced_at && Date.now() - new Date(conn.last_synced_at).getTime() < SYNC_MIN_GAP
      if (!fresh || body.force) await syncConnection(conn)
      return json(200, await status(user.id))
    }
    return json(400, { error: 'Onbekende actie' })
  } catch (e) {
    if (!(e.status && e.status < 500)) console.error('[bank]', e)
    return json(e.status && e.status < 500 ? 400 : 500, { error: e.message })
  }
}

exports._internal = { jwt, mapTransaction, pickBalance, accountKind }
