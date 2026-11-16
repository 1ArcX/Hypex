// MCP-server voor de Geld-app: Claude (claude.ai → Instellingen → Connectors → eigen connector) kan je
// uitgaven en budget bekijken en aanpassen. Stateless "Streamable HTTP": elke POST is één JSON-RPC-bericht
// (of een batch) en krijgt direct een JSON-antwoord terug; geen SSE nodig.
//
// Beveiliging: geheime sleutel GELD_MCP_TOKEN (Netlify env), mee te geven als laatste deel van het pad
// (/mcp/geld/<sleutel>, zie netlify.toml) of als ?key=<sleutel>. Alleen de gebruiker WIDGET_USER_EMAIL.
// De berekening van het overzicht volgt src/geld (useBudgetStats + lib/budget), incl. de
// carryover-reset per september 2026 en maand-aanpassingen.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const TOKEN = process.env.GELD_MCP_TOKEN
const USER_EMAIL = (process.env.WIDGET_USER_EMAIL || 'zhafirfachri@gmail.com').toLowerCase()
const TZ = 'Europe/Amsterdam'
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const CATEGORIES = [
  { id: 'eten', label: 'Eten & drinken' }, { id: 'boodschappen', label: 'Boodschappen' },
  { id: 'transport', label: 'Transport' }, { id: 'kleding', label: 'Kleding' },
  { id: 'abonnementen', label: 'Vaste lasten' }, { id: 'sport', label: 'Sport' }, { id: 'overig', label: 'Overig' },
]
const INCOME_CATEGORIES = ['salaris', 'bijbaan', 'freelance', 'zakgeld', 'overig']
const DEFAULT_CAT_BUDGETS = { eten: 120, boodschappen: 80, transport: 40, kleding: 50, abonnementen: 30, sport: 20, overig: 60 }
const FIXED_CAT = 'abonnementen'
const EXPENSE_FIELDS = ['amount', 'category', 'description', 'date', 'is_income', 'is_planned', 'paid_from_savings',
  'is_savings_withdrawal', 'is_savings_contribution', 'is_loan_repayment', 'savings_type', 'repaid']

// ── helpers ─────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const todayTZ = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const monthStart = (y, m) => `${y}-${pad(m + 1)}-01`
const monthEnd = (y, m) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`
const monthKey = (y, m) => `${y}-${pad(m + 1)}`
const sum = (list) => list.reduce((s, e) => s + Number(e.amount), 0)
const r2 = (x) => Math.round(x * 100) / 100
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const isHistVac = (e, vh) => (vh || []).some(v => e.date >= v.start && e.date <= (v.end || v.start))
const kindOf = (e) => e.is_income ? 'inkomen' : e.is_savings_withdrawal ? 'spaaropname' : e.is_savings_contribution ? 'spaarstorting'
  : e.is_loan_repayment ? 'aflossing' : e.is_planned ? 'gepland' : e.paid_from_savings ? 'uitgave (van spaargeld)' : 'uitgave'
const regular = (list) => list.filter(e => !e.is_savings_withdrawal && !e.is_income && !e.is_savings_contribution && !e.is_loan_repayment)

let cachedUid = null
async function userId() {
  if (cachedUid) return cachedUid
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('Gebruiker ophalen mislukt')
    const u = data?.users?.find(x => (x.email || '').toLowerCase() === USER_EMAIL)
    if (u) return (cachedUid = u.id)
    if (!data?.users?.length || data.users.length < 200) break
  }
  throw new Error('Gebruiker niet gevonden')
}
async function getConfig(uid) {
  const { data } = await supabase.from('budget_config').select('*').eq('user_id', uid).maybeSingle()
  return data || {}
}
const allCategories = (cfg) => [...CATEGORIES, ...((cfg.custom_categories || []).map(c => ({ id: c.id, label: c.label })))]
const slim = (e) => ({ id: e.id, date: e.date, amount: Number(e.amount), category: e.category, description: e.description || '', type: kindOf(e),
  ...(e.savings_type ? { savings_type: e.savings_type } : {}), ...(e.repaid ? { repaid: true } : {}) })

// ── overzicht (spiegelt useBudgetStats) ─────────────────────────────────────
async function overview(uid, month) {
  const t = todayTZ()
  const [y, m] = (month && /^\d{4}-\d{2}$/.test(month) ? month : t.slice(0, 7)).split('-').map(Number)
  const selY = y, selM = m - 1
  const cfg = await getConfig(uid)
  const recovery = cfg.recovery_months || 3
  const from = new Date(selY, selM - recovery, 1)
  const { data: rows, error } = await supabase.from('expenses').select('*').eq('user_id', uid)
    .gte('date', monthStart(from.getFullYear(), from.getMonth())).lte('date', monthEnd(selY, selM))
  if (error) throw new Error(error.message)
  const all = rows || []
  const inMonth = (e, yy, mm) => e.date >= monthStart(yy, mm) && e.date <= monthEnd(yy, mm)
  const exp = all.filter(e => inMonth(e, selY, selM))

  const vac = !!cfg.vacation_mode
  const baseMonthly = vac && (cfg.vacation_budget || 0) > 0 ? cfg.vacation_budget : (cfg.monthly_budget || 400)
  const adjustment = (cfg.month_adjustments || {})[monthKey(selY, selM)] || 0
  const base = baseMonthly + adjustment
  const catBudgets = cfg.category_budgets || DEFAULT_CAT_BUDGETS
  const vh = cfg.vacation_history || []
  const vaste = catBudgets[FIXED_CAT] || 0
  const variableBase = Math.max(0, base - vaste)

  const reg = regular(exp)
  const budgetExp = reg.filter(e => !e.paid_from_savings && (vac || e.category !== FIXED_CAT) && (!e.is_planned || e.amount > 0)
    && (!vac || !cfg.vacation_start || e.date >= cfg.vacation_start) && (vac || !isHistVac(e, vh)))
  const totalSpent = sum(budgetExp)

  // Carryover: overschrijding van vorige maanden gespreid terugbetalen (t/m augustus 2026 telt niet mee)
  let carryover = 0
  if (!vac) {
    for (let i = 1; i <= recovery; i++) {
      const d = new Date(selY, selM - i, 1), pY = d.getFullYear(), pM = d.getMonth()
      if (pY < 2026 || (pY === 2026 && pM <= 7)) continue
      const pSpent = sum(all.filter(e => inMonth(e, pY, pM) && !e.is_savings_withdrawal && !e.is_income && !e.paid_from_savings
        && !e.is_savings_contribution && !e.is_loan_repayment && e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0) && !isHistVac(e, vh)))
      const thr = Math.max(0, baseMonthly + ((cfg.month_adjustments || {})[monthKey(pY, pM)] || 0) - vaste)
      carryover += Math.max(0, pSpent - thr) / recovery
    }
  }
  const adjustedBase = vac ? base : Math.max(0, variableBase - carryover)
  const remaining = adjustedBase - totalSpent

  const cats = allCategories(cfg)
  const variableTotal = cats.filter(c => c.id !== FIXED_CAT).reduce((s, c) => s + (catBudgets[c.id] || 0), 0)
  const scale = carryover > 0 && variableTotal > 0 ? Math.max(0, adjustedBase / variableTotal) : 1
  const perCategory = cats.map(c => {
    const spent = sum(reg.filter(e => e.category === c.id && !e.paid_from_savings && (!e.is_planned || e.amount > 0)))
    const budget = c.id === FIXED_CAT ? (catBudgets[c.id] || 0) : Math.round((catBudgets[c.id] || 0) * scale)
    return { id: c.id, label: c.label, budget, spent: r2(spent), remaining: r2(budget - spent) }
  }).filter(c => c.budget || c.spent)

  const isCurrent = monthKey(selY, selM) === t.slice(0, 7)
  const dayOfMonth = isCurrent ? Number(t.slice(8, 10)) : null
  const daysInMonth = new Date(selY, selM + 1, 0).getDate()
  const daysLeft = isCurrent ? daysInMonth - dayOfMonth + 1 : null
  return {
    month: monthKey(selY, selM), today: t, vacation_mode: vac,
    monthly_budget: baseMonthly, month_adjustment: adjustment, fixed_costs_budget: vaste,
    carryover_deduction: r2(carryover), spendable_budget: r2(adjustedBase),
    spent_against_budget: r2(totalSpent), remaining: r2(remaining),
    ...(isCurrent ? { days_left: daysLeft, per_day_left: r2(remaining > 0 ? remaining / daysLeft : 0) } : {}),
    spent_from_savings: r2(sum(reg.filter(e => e.paid_from_savings))),
    fixed_costs_spent: r2(sum(reg.filter(e => e.category === FIXED_CAT && !e.paid_from_savings))),
    planned_open: exp.filter(e => e.is_planned).map(slim),
    income: r2(sum(exp.filter(e => e.is_income))),
    savings_contributions: r2(sum(exp.filter(e => e.is_savings_contribution))),
    savings_withdrawals: r2(sum(exp.filter(e => e.is_savings_withdrawal))),
    loan_repayments: r2(sum(exp.filter(e => e.is_loan_repayment))),
    savings_goal: cfg.savings_goal || 0,
    per_category: perCategory,
    count: exp.length,
    note: 'Vaste lasten (abonnementen) tellen niet mee in het vrije budget. remaining = spendable_budget − spent_against_budget.',
  }
}

// ── tools ───────────────────────────────────────────────────────────────────
const expenseProps = {
  amount: { type: 'number', description: 'Bedrag in euro, positief' },
  category: { type: 'string', description: 'Categorie-id (zie get_budget_config; inkomen: salaris/bijbaan/freelance/zakgeld/overig)' },
  description: { type: 'string', description: 'Omschrijving' },
  date: { type: 'string', description: 'Datum YYYY-MM-DD' },
  is_income: { type: 'boolean', description: 'Inkomen in plaats van uitgave' },
  is_planned: { type: 'boolean', description: 'Geplande (nog niet betaalde) uitgave' },
  paid_from_savings: { type: 'boolean', description: 'Betaald van spaargeld (telt niet tegen het budget)' },
  is_savings_withdrawal: { type: 'boolean', description: 'Opname van spaarrekening' },
  is_savings_contribution: { type: 'boolean', description: 'Storting naar spaarrekening' },
  is_loan_repayment: { type: 'boolean', description: 'Aflossing van geleend spaargeld' },
  savings_type: { type: 'string', enum: ['saved', 'loan'], description: 'Bij een spaaropname: echt gespaard of geleend' },
  repaid: { type: 'boolean', description: 'Lening terugbetaald' },
}
const TOOLS = [
  { name: 'get_overview', description: 'Budgetoverzicht van een maand: vrij budget, uitgegeven, nog te besteden (incl. aftrek van eerdere overschrijdingen), per categorie, inkomen, sparen, geplande uitgaven. Zonder month = huidige maand.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } } }, annotations: { readOnlyHint: true } },
  { name: 'list_expenses', description: 'Transacties (uitgaven, inkomen, spaaracties) opzoeken, nieuwste eerst.',
    inputSchema: { type: 'object', properties: {
      from: { type: 'string', description: 'Vanaf YYYY-MM-DD' }, to: { type: 'string', description: 'T/m YYYY-MM-DD' },
      category: { type: 'string' }, search: { type: 'string', description: 'Zoek in omschrijving' },
      type: { type: 'string', enum: ['alle', 'uitgave', 'inkomen', 'sparen', 'gepland'], description: 'Standaard alle' },
      limit: { type: 'number', description: 'Max. aantal (standaard 100, max 500)' } } }, annotations: { readOnlyHint: true } },
  { name: 'get_budget_config', description: 'Instellingen: maandbudget, budget per categorie, categorieën (ook eigen), spaardoel, min. saldo, terugbetaalmaanden, vakantiemodus, vaste inkomsten en maand-aanpassingen.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'add_expense', description: 'Nieuwe transactie toevoegen (standaard een gewone uitgave van vandaag).',
    inputSchema: { type: 'object', properties: expenseProps, required: ['amount', 'category'] } },
  { name: 'update_expense', description: 'Een bestaande transactie aanpassen (alleen de meegegeven velden).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...expenseProps }, required: ['id'] } },
  { name: 'delete_expense', description: 'Een transactie definitief verwijderen. Vraag de gebruiker eerst om bevestiging.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, annotations: { destructiveHint: true } },
  { name: 'update_budget_config', description: 'Budgetinstellingen aanpassen. category_budgets en month_adjustments worden samengevoegd met de bestaande waarden (zet een maand op 0 om de aanpassing te wissen).',
    inputSchema: { type: 'object', properties: {
      monthly_budget: { type: 'number' }, savings_goal: { type: 'number' }, min_balance: { type: 'number' },
      recovery_months: { type: 'number', description: 'Over hoeveel maanden een overschrijding wordt terugbetaald (1–12)' },
      category_budgets: { type: 'object', additionalProperties: { type: 'number' }, description: '{ categorie-id: bedrag }' },
      month_adjustments: { type: 'object', additionalProperties: { type: 'number' }, description: '{ "YYYY-MM": extra bedrag (+/−) }' },
    } } },
]

function cleanExpense(args, cfg, partial) {
  const out = {}
  for (const k of EXPENSE_FIELDS) if (args[k] !== undefined) out[k] = args[k]
  if (!partial && out.date === undefined) out.date = todayTZ()
  if (out.amount !== undefined && (typeof out.amount !== 'number' || !isFinite(out.amount) || out.amount < 0)) throw new Error('amount moet een positief getal zijn')
  if (out.amount !== undefined) out.amount = r2(out.amount)
  if (out.date !== undefined && !isDate(out.date)) throw new Error('date moet YYYY-MM-DD zijn')
  if (out.category !== undefined) {
    const ok = out.is_income || args.is_income ? INCOME_CATEGORIES.includes(out.category) || allCategories(cfg).some(c => c.id === out.category)
      : allCategories(cfg).some(c => c.id === out.category)
    if (!ok) throw new Error(`Onbekende categorie "${out.category}". Gebruik get_budget_config voor de lijst.`)
  }
  if (out.description !== undefined) out.description = String(out.description).slice(0, 300)
  return out
}

async function callTool(name, args = {}) {
  const uid = await userId()
  if (name === 'get_overview') return overview(uid, args.month)
  if (name === 'get_budget_config') {
    const cfg = await getConfig(uid)
    return {
      monthly_budget: cfg.monthly_budget || 400, category_budgets: cfg.category_budgets || DEFAULT_CAT_BUDGETS,
      categories: allCategories(cfg), income_categories: INCOME_CATEGORIES, fixed_costs_category: FIXED_CAT,
      savings_goal: cfg.savings_goal || 0, min_balance: cfg.min_balance ?? 300, recovery_months: cfg.recovery_months || 3,
      vacation_mode: !!cfg.vacation_mode, vacation_budget: cfg.vacation_budget || 0, vacation_start: cfg.vacation_start || null, vacation_end: cfg.vacation_end || null,
      recurring_income: cfg.recurring_income || [], month_adjustments: cfg.month_adjustments || {},
    }
  }
  if (name === 'list_expenses') {
    let q = supabase.from('expenses').select('*').eq('user_id', uid)
    if (args.from) { if (!isDate(args.from)) throw new Error('from moet YYYY-MM-DD zijn'); q = q.gte('date', args.from) }
    if (args.to) { if (!isDate(args.to)) throw new Error('to moet YYYY-MM-DD zijn'); q = q.lte('date', args.to) }
    if (args.category) q = q.eq('category', args.category)
    if (args.search) q = q.ilike('description', `%${String(args.search).replace(/[%_]/g, '')}%`)
    const type = args.type || 'alle'
    if (type === 'inkomen') q = q.eq('is_income', true)
    if (type === 'gepland') q = q.eq('is_planned', true)
    const limit = Math.min(500, Math.max(1, Number(args.limit) || 100))
    const { data, error } = await q.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit * 2)
    if (error) throw new Error(error.message)
    let list = data || []
    if (type === 'uitgave') list = regular(list).filter(e => !e.is_planned)
    if (type === 'sparen') list = list.filter(e => e.is_savings_withdrawal || e.is_savings_contribution || e.is_loan_repayment || e.paid_from_savings)
    list = list.slice(0, limit)
    return { count: list.length, total: r2(sum(list)), items: list.map(slim) }
  }
  if (name === 'add_expense') {
    const cfg = await getConfig(uid)
    const row = { is_income: false, is_savings_withdrawal: false, ...cleanExpense(args, cfg, false), user_id: uid }
    const { data, error } = await supabase.from('expenses').insert(row).select().single()
    if (error) throw new Error(error.message)
    return { added: slim(data) }
  }
  if (name === 'update_expense') {
    if (!args.id) throw new Error('id ontbreekt')
    const cfg = await getConfig(uid)
    const patch = cleanExpense(args, cfg, true)
    if (!Object.keys(patch).length) throw new Error('Geen velden om aan te passen')
    const { data, error } = await supabase.from('expenses').update(patch).eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Transactie niet gevonden')
    return { updated: slim(data) }
  }
  if (name === 'delete_expense') {
    if (!args.id) throw new Error('id ontbreekt')
    const { data, error } = await supabase.from('expenses').delete().eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Transactie niet gevonden')
    return { deleted: slim(data) }
  }
  if (name === 'update_budget_config') {
    const cfg = await getConfig(uid)
    const patch = {}
    for (const k of ['monthly_budget', 'savings_goal', 'min_balance']) {
      if (args[k] !== undefined) { if (typeof args[k] !== 'number' || args[k] < 0) throw new Error(`${k} moet een positief getal zijn`); patch[k] = r2(args[k]) }
    }
    if (args.recovery_months !== undefined) patch.recovery_months = Math.min(12, Math.max(1, Math.round(args.recovery_months)))
    if (args.category_budgets) {
      const known = allCategories(cfg).map(c => c.id)
      for (const [k, v] of Object.entries(args.category_budgets)) {
        if (!known.includes(k)) throw new Error(`Onbekende categorie "${k}"`)
        if (typeof v !== 'number' || v < 0) throw new Error(`Budget voor ${k} moet een positief getal zijn`)
      }
      patch.category_budgets = { ...(cfg.category_budgets || DEFAULT_CAT_BUDGETS), ...args.category_budgets }
    }
    if (args.month_adjustments) {
      const next = { ...(cfg.month_adjustments || {}) }
      for (const [k, v] of Object.entries(args.month_adjustments)) {
        if (!/^\d{4}-\d{2}$/.test(k) || typeof v !== 'number') throw new Error('month_adjustments: { "YYYY-MM": getal }')
        if (v === 0) delete next[k]; else next[k] = r2(v)
      }
      patch.month_adjustments = next
    }
    if (!Object.keys(patch).length) throw new Error('Geen velden om aan te passen')
    patch.updated_at = new Date().toISOString()
    const res = cfg.user_id
      ? await supabase.from('budget_config').update(patch).eq('user_id', uid)
      : await supabase.from('budget_config').insert({ user_id: uid, ...patch })
    if (res.error) throw new Error(res.error.message)
    return { updated: patch }
  }
  throw new Error(`Onbekende tool: ${name}`)
}

// ── JSON-RPC / MCP ──────────────────────────────────────────────────────────
const INSTRUCTIONS = 'Geld-app van Fachri (Hypex Dash). Bedragen in euro. Gebruik get_overview voor de stand van een maand, ' +
  'list_expenses om transacties te vinden (ids nodig voor wijzigen/verwijderen) en get_budget_config voor categorieën en instellingen. ' +
  'Vraag bevestiging voordat je transacties verwijdert of budgetten wijzigt.'

async function handleMessage(msg) {
  const { id, method, params } = msg || {}
  const isRequest = id !== undefined && id !== null
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id: isRequest ? id : null, error: { code, message } })
  if (!msg || msg.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid Request')
  if (!isRequest) return null // notificaties (bv. notifications/initialized) krijgen geen antwoord
  try {
    if (method === 'initialize') {
      const asked = params?.protocolVersion
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'hypex-geld', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      })
    }
    if (method === 'ping') return ok({})
    if (method === 'tools/list') return ok({ tools: TOOLS })
    if (method === 'tools/call') {
      const name = params?.name
      if (!TOOLS.some(t => t.name === name)) return fail(-32602, `Onbekende tool: ${name}`)
      try {
        const result = await callTool(name, params?.arguments || {})
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result })
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `Fout: ${e.message}` }], isError: true })
      }
    }
    if (method === 'resources/list') return ok({ resources: [] })
    if (method === 'prompts/list') return ok({ prompts: [] })
    return fail(-32601, `Method not found: ${method}`)
  } catch (e) {
    return fail(-32603, e.message || 'Internal error')
  }
}

const HEADERS = {
  'content-type': 'application/json', 'cache-control': 'no-store',
  'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, mcp-session-id, mcp-protocol-version, authorization',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (!TOKEN) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'GELD_MCP_TOKEN niet ingesteld' }) }
  const fromPath = (event.path || '').split('/').filter(Boolean).pop()
  const key = (event.queryStringParameters || {}).key || fromPath
  if (key !== TOKEN) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'unauthorized' }) }
  // Geen server-naar-client stream: GET/DELETE niet ondersteund (spec staat 405 toe)
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { ...HEADERS, allow: 'POST, OPTIONS' }, body: '' }

  let body
  try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '')) }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) } }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handleMessage))).filter(Boolean)
    return out.length ? { statusCode: 200, headers: HEADERS, body: JSON.stringify(out) } : { statusCode: 202, headers: HEADERS, body: '' }
  }
  const res = await handleMessage(body)
  return res ? { statusCode: 200, headers: HEADERS, body: JSON.stringify(res) } : { statusCode: 202, headers: HEADERS, body: '' }
}

// Voor tests
exports._internal = { overview, callTool, handleMessage, TOOLS }
