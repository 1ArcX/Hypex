// MCP-server "Hypex" (was: Geld-app): Geld-tools hieronder + planner-tools (agenda, werkuren, taken, notities) uit
// ./planner.js. Bereikbaar via /mcp/hypex/<sleutel> en (oud) /mcp/geld/<sleutel>.
// Geld-app: Claude (claude.ai → Instellingen → Connectors → eigen connector) kan je
// uitgaven en budget bekijken en aanpassen. Stateless "Streamable HTTP": elke POST is één JSON-RPC-bericht
// (of een batch) en krijgt direct een JSON-antwoord terug; geen SSE nodig.
//
// Beveiliging: geheime sleutel GELD_MCP_TOKEN (Netlify env), mee te geven als laatste deel van het pad
// (/mcp/geld/<sleutel>, zie netlify.toml) of als ?key=<sleutel>. Alleen de gebruiker WIDGET_USER_EMAIL.
// De berekening van het overzicht volgt src/geld (useBudgetStats + lib/budget), incl. de
// carryover-reset per september 2026 en maand-aanpassingen.

const { createClient } = require('@supabase/supabase-js')
const { processTransaction, unlinkExpense, atmCounterparty, normalizeCounterparty } = require('../bank/bankCore')
const planner = require('./planner') // agenda, werkuren, taken, notities (Hypex-connector)
const study = require('./study') // Focus (vakken, studiesessies) + Recap
const recurring = require('./recurring') // terugkerend inkomen invullen (knop "Invullen" in Inkomsten & sparen)

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
const CAT_COLORS = ['#F97316', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FACC15', '#06B6D4', '#84CC16', '#94A3B8', '#FB923C', '#A3E635']
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
const allCategories = (cfg) => [...CATEGORIES, ...((cfg.custom_categories || []).map(c => ({ id: c.id, label: c.label, custom: true })))]
/**
 * Transactie voor de output. paid_from_savings staat er altijd (dat bepaalt of een uitgave tegen je budget telt).
 * savings_type alleen bij een spaaropname: de kolom heeft standaard 'saved', ook bij gewone uitgaven, maar betekent
 * alleen iets voor opnames ("Echt gespaard" vs. lening van jezelf). vacation = valt in een eerdere vakantie (telt niet mee).
 */
const slim = (e, vh) => ({ id: e.id, date: e.date, amount: Number(e.amount), category: e.category, description: e.description || '', type: kindOf(e),
  paid_from_savings: !!e.paid_from_savings,
  ...(e.is_savings_withdrawal ? { savings_type: e.savings_type === 'loan' ? 'loan' : 'saved' } : {}),
  ...(e.is_savings_withdrawal && e.savings_type === 'loan' ? { repaid: !!e.repaid } : {}),
  ...(vh && !e.is_income && isHistVac(e, vh) ? { vacation: true } : {}) })

/** "33,85" / "€ 1.234,50" / 33.85 → 33.85 (zonder teken), of null als het geen bedrag is. */
function parseAmount(v) {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? Math.abs(r2(v)) : null
  let s = String(v).replace(/[€\s+]/g, '').replace(/^-/, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  return Math.abs(r2(Number(s)))
}
/** Filter op bedrag (zonder teken: 33,85 vindt zowel −33,85 als +33,85). amount = exact, of min_amount/max_amount. */
function amountFilter(q, args) {
  const exact = parseAmount(args.amount)
  const lo = parseAmount(args.min_amount), hi = parseAmount(args.max_amount)
  if (args.amount !== undefined && exact === null) throw new Error('amount moet een bedrag zijn, bv. 33.85 of "33,85"')
  if (exact !== null) return q.or(`amount.eq.${exact},amount.eq.${-exact}`)
  if (lo === null && hi === null) return q
  const a = lo ?? 0, b = hi ?? 1e9
  return q.or(`and(amount.gte.${a},amount.lte.${b}),and(amount.lte.${-a},amount.gte.${-b})`)
}
const amountProps = {
  amount: { type: ['number', 'string'], description: 'Exact bedrag zonder teken, bv. 33.85 of "33,85" (vindt af én bij)' },
  min_amount: { type: 'number', description: 'Minimaal bedrag (zonder teken)' },
  max_amount: { type: 'number', description: 'Maximaal bedrag (zonder teken)' },
}

// ── bank (ING via Enable Banking, zie netlify/functions/bank) ────────────────
async function bankBalances(uid) {
  const [conn, accs, inbox] = await Promise.all([
    supabase.from('bank_connections').select('status, valid_until, last_synced_at, last_error').eq('user_id', uid).maybeSingle(),
    supabase.from('bank_accounts').select('*').eq('user_id', uid),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'new'),
  ])
  if (conn.error && /bank_connections|does not exist/i.test(conn.error.message)) return { connected: false, note: 'Bankkoppeling nog niet ingesteld (migratie add_bank_sync.sql)' }
  const accounts = (accs.data || []).filter(a => !a.hidden).map(a => ({
    name: a.name, iban: a.iban, kind: a.kind, balance: a.balance == null ? null : Number(a.balance), as_of: a.balance_at,
    ...(a.manual ? { source: 'zelf bijgehouden (startsaldo + overboekingen op de betaalrekening; rente niet meegeteld)', recognised_by: a.match || null } : { source: 'bank' }),
    ...(a.goal ? { goal: Number(a.goal), goal_progress_pct: Math.round((Number(a.balance || 0) / Number(a.goal)) * 100), to_goal: r2(Math.max(0, Number(a.goal) - Number(a.balance || 0))) } : {}),
  }))
  return {
    connected: !!conn.data && conn.data.status !== 'disconnected', status: conn.data?.status || 'none',
    consent_valid_until: conn.data?.valid_until || null, last_synced_at: conn.data?.last_synced_at || null,
    accounts,
    checking_total: r2(accounts.filter(a => a.kind === 'betaal').reduce((n, a) => n + (a.balance || 0), 0)),
    savings_total: r2(accounts.filter(a => a.kind === 'spaar').reduce((n, a) => n + (a.balance || 0), 0)),
    inbox_new: inbox.count || 0,
  }
}

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

  // Carryover: overschrijding van vorige maanden gespreid terugbetalen (t/m oktober 2026 telt niet mee)
  let carryover = 0
  if (!vac) {
    for (let i = 1; i <= recovery; i++) {
      const d = new Date(selY, selM - i, 1), pY = d.getFullYear(), pM = d.getMonth()
      if (pY < 2026 || (pY === 2026 && pM <= 9)) continue
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
    const vacSpent = vac ? 0 : sum(reg.filter(e => e.category === c.id && !e.paid_from_savings && (!e.is_planned || e.amount > 0) && isHistVac(e, vh)))
    return { id: c.id, label: c.label, budget, spent: r2(spent), remaining: r2(budget - spent), ...(vacSpent ? { of_which_vacation: r2(vacSpent) } : {}) }
  }).filter(c => c.budget || c.spent)

  // Wat valt buiten het budget door een eerdere vakantie (vacation_history)? Zelfde regel als de app.
  const vacItems = vac ? [] : reg.filter(e => !e.paid_from_savings && e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0) && isHistVac(e, vh))
  const vacPeriods = vh.filter(v => v.start <= monthEnd(selY, selM) && (v.end || v.start) >= monthStart(selY, selM))

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
    ...(vacItems.length ? { vacation_excluded: {
      total: r2(sum(vacItems)), count: vacItems.length,
      periods: vacPeriods.map(v => ({ start: v.start, end: v.end || v.start, ...(v.budget ? { budget: v.budget } : {}) })),
      note: 'Uitgaven in een eerdere vakantie tellen niet tegen het maandbudget (zoals in de app: Uitgaven → Vakantie). Ze staan wel in per_category (of_which_vacation).',
    } } : {}),
    spent_from_savings: r2(sum(reg.filter(e => e.paid_from_savings))),
    fixed_costs_spent: r2(sum(reg.filter(e => e.category === FIXED_CAT && !e.paid_from_savings))),
    planned_open: exp.filter(e => e.is_planned).map(e => slim(e, vh)),
    income: r2(sum(exp.filter(e => e.is_income))),
    savings_contributions: r2(sum(exp.filter(e => e.is_savings_contribution))),
    savings_withdrawals: r2(sum(exp.filter(e => e.is_savings_withdrawal))),
    loan_repayments: r2(sum(exp.filter(e => e.is_loan_repayment))),
    savings_goal: cfg.savings_goal || 0,
    per_category: perCategory,
    count: exp.length,
    ...(isCurrent ? { bank: await bankBalances(uid).catch(() => null) } : {}),
    ...((cfg.recurring_income || []).length ? { recurring_income: await recurring.sourcesStatus(supabase, uid, cfg, t, { from: monthStart(selY, selM), to: monthEnd(selY, selM) }).catch(() => []) } : {}),
    note: 'Vaste lasten (abonnementen), uitgaven van spaargeld (paid_from_savings) en uitgaven tijdens een eerdere vakantie tellen niet mee in het vrije budget. remaining = spendable_budget − spent_against_budget.',
  }
}

// ── tools ───────────────────────────────────────────────────────────────────
const expenseProps = {
  amount: { type: 'number', description: 'Bedrag in euro. Positief; alleen bij een gewone uitgave mag het negatief zijn (terugbetaling/Tikkie: verlaagt die categorie)' },
  category: { type: 'string', description: 'Categorie-id (zie get_budget_config; inkomen: salaris/bijbaan/freelance/zakgeld/overig)' },
  description: { type: 'string', description: 'Omschrijving' },
  date: { type: 'string', description: 'Datum YYYY-MM-DD' },
  is_income: { type: 'boolean', description: 'Inkomen in plaats van uitgave' },
  is_planned: { type: 'boolean', description: 'Geplande (nog niet betaalde) uitgave' },
  paid_from_savings: { type: 'boolean', description: 'Uitgave betaald van spaargeld: telt niet tegen het budget (spent_from_savings). Dit is het veld dat telt, niet savings_type' },
  is_savings_withdrawal: { type: 'boolean', description: 'Opname van spaarrekening' },
  is_savings_contribution: { type: 'boolean', description: 'Storting naar spaarrekening' },
  is_loan_repayment: { type: 'boolean', description: 'Aflossing van geleend spaargeld' },
  savings_type: { type: 'string', enum: ['saved', 'loan'], description: 'Alleen bij een spaaropname (is_savings_withdrawal): saved = "Echt gespaard", loan = lening van jezelf. Zegt niets over gewone uitgaven' },
  repaid: { type: 'boolean', description: 'Lening terugbetaald' },
}
const TOOLS = [
  { name: 'get_overview', description: 'Budgetoverzicht van een maand: vrij budget, uitgegeven, nog te besteden (incl. aftrek van eerdere overschrijdingen), per categorie, inkomen, sparen, geplande uitgaven, en per vaste inkomstenbron of hij die maand is ingevuld (recurring_income). Zonder month = huidige maand.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } } }, annotations: { readOnlyHint: true } },
  { name: 'list_expenses', description: 'Transacties (uitgaven, inkomen, spaaracties) opzoeken, nieuwste eerst.',
    inputSchema: { type: 'object', properties: {
      from: { type: 'string', description: 'Vanaf YYYY-MM-DD' }, to: { type: 'string', description: 'T/m YYYY-MM-DD' },
      category: { type: 'string' }, search: { type: 'string', description: 'Zoek in omschrijving (een bedrag zoals "33,85" zoekt op bedrag)' },
      ...amountProps,
      type: { type: 'string', enum: ['alle', 'uitgave', 'inkomen', 'sparen', 'gepland'], description: 'Standaard alle' },
      limit: { type: 'number', description: 'Max. aantal (standaard 100, max 500)' } } }, annotations: { readOnlyHint: true } },
  { name: 'get_budget_config', description: 'Instellingen: maandbudget, budget per categorie, categorieën (ook eigen), spaardoel, min. saldo, terugbetaalmaanden, vakantiemodus + eerdere vakanties, vaste inkomsten en maand-aanpassingen. recurring_income_status: per vaste inkomstenbron de lopende periode, verwachte datum, ingevuld ja/nee (met de boeking en banktransactie), volgende betaaldatum en possible_match (losse boeking die er waarschijnlijk bij hoort).',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'add_expense', description: 'Nieuwe transactie toevoegen (standaard een gewone uitgave van vandaag).',
    inputSchema: { type: 'object', properties: expenseProps, required: ['amount', 'category'] } },
  { name: 'update_expense', description: 'Een bestaande transactie aanpassen. Alleen de meegegeven velden veranderen; de rest blijft zoals het was (de output toont before/after). Inkomen omzetten naar een terugbetaling: is_income=false + negatief amount + de categorie waarvoor je voorschoot.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...expenseProps }, required: ['id'] } },
  { name: 'delete_expense', description: 'Een transactie definitief verwijderen. Kwam hij van de bank, dan wordt die banktransactie op ignored gezet (komt niet terug bij een sync); was hij aan een banktransactie gekoppeld (matched), dan gaat die terug naar de inbox. Vraag de gebruiker eerst om bevestiging.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, annotations: { destructiveHint: true } },
  { name: 'get_bank_balances', description: 'Actuele saldo\'s van de gekoppelde bankrekeningen (ING, alleen-lezen): betaal- en spaarrekeningen, totaal spaargeld, wanneer bijgewerkt, hoe lang de toestemming nog geldt en hoeveel banktransacties nog in de inbox staan.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'list_bank_transactions', description: 'Transacties zoals ze op het ING-afschrift staan (tegenpartij, omschrijving, boekdatum, IBAN). status: new = nog te verwerken (inbox), added = als uitgave/inkomen toegevoegd, ignored, matched = stond er al. amount: + bij, − af. Gebruik search om bv. alle uitgaven bij de PLUS te vinden, en group_by=counterparty voor totalen per winkel.',
    inputSchema: { type: 'object', properties: {
      status: { type: 'string', enum: ['new', 'added', 'ignored', 'matched', 'pending', 'alle'], description: 'Standaard new; met search, bedrag of group_by standaard alle. pending = reservering (nog niet geboekt)' },
      search: { type: 'string', description: 'Zoek in tegenpartij en omschrijving, bv. "plus", "albert heijn", "thuisbezorgd", "geldautomaat". Een bedrag ("33,85") zoekt op bedrag' },
      ...amountProps,
      direction: { type: 'string', enum: ['af', 'bij', 'alle'], description: 'af = uitgaven, bij = ontvangsten (standaard alle)' },
      group_by: { type: 'string', enum: ['counterparty'], description: 'Totalen per tegenpartij (winkel) i.p.v. losse transacties' },
      from: { type: 'string', description: 'Vanaf YYYY-MM-DD' }, to: { type: 'string', description: 'T/m YYYY-MM-DD' },
      limit: { type: 'number', description: 'Max. aantal (standaard 50, max 300)' } } }, annotations: { readOnlyHint: true } },
  { name: 'process_bank_transaction', description: 'Een banktransactie verwerken of opnieuw verwerken. add = toevoegen als uitgave/inkomen/spaaractie (optioneel andere soort of categorie; een afwijkende categorie wordt onthouden voor die tegenpartij). Op een al toegevoegde transactie (status added) zet add de gekoppelde uitgave om, bv. inkomen → terugbetaling (output: before/after). ignore = negeren; bij status added wordt de gekoppelde uitgave dan verwijderd. Werkt ook voor ignored en matched. Vraag eerst bevestiging.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string' }, action: { type: 'string', enum: ['add', 'ignore'] },
      kind: { type: 'string', enum: ['uitgave', 'inkomen', 'terugbetaling', 'spaarstorting', 'spaaropname'], description: 'terugbetaling = Tikkie/terugbetaling van iemand: negatieve uitgave in de categorie waarvoor je voorschoot' },
      category: { type: 'string', description: 'Categorie-id (zie get_budget_config)' } }, required: ['id', 'action'] } },
  { name: 'update_budget_config', description: 'Budgetinstellingen aanpassen. category_budgets en month_adjustments worden samengevoegd met de bestaande waarden (zet een maand op 0 om de aanpassing te wissen). recurring_income wijzigt de bronnen zelf (naam, bedrag, dag); een betaling invullen doe je met fill_recurring_income.',
    inputSchema: { type: 'object', properties: {
      monthly_budget: { type: 'number' }, savings_goal: { type: 'number' }, min_balance: { type: 'number' },
      recovery_months: { type: 'number', description: 'Over hoeveel maanden een overschrijding wordt terugbetaald (1–12)' },
      category_budgets: { type: 'object', additionalProperties: { type: 'number' }, description: '{ categorie-id: bedrag }' },
      month_adjustments: { type: 'object', additionalProperties: { type: 'number' }, description: '{ "YYYY-MM": extra bedrag (+/−) }' },
      recurring_income: { type: 'array', description: 'Vaste inkomsten toevoegen/wijzigen/verwijderen (samengevoegd op id; zonder id = nieuw). Bestaande ids: zie get_budget_config.',
        items: { type: 'object', properties: {
          id: { type: 'string', description: 'Id van een bestaande bron (weglaten = nieuwe bron)' },
          name: { type: 'string' }, amount: { type: 'number', description: 'Bedrag per keer' },
          type: { type: 'string', enum: ['monthly', 'interval'], description: 'monthly = elke maand op day; interval = elke interval_days dagen vanaf ref_date' },
          day: { type: 'number', description: 'Dag van de maand (1–31) bij monthly' },
          interval_days: { type: 'number' }, ref_date: { type: 'string', description: 'Laatste betaaldatum YYYY-MM-DD bij interval' },
          emoji: { type: 'string' }, category: { type: 'string', description: 'Inkomenscategorie (standaard salaris)' },
          remove: { type: 'boolean', description: 'true = deze bron verwijderen' } } } },
    } } },
  { name: 'fill_recurring_income', description: 'Terugkerend inkomen invullen, precies zoals de knop "Invullen" / "Nu invullen" in Geld → Inkomsten & sparen → Terugkerend: maakt een inkomen met de naam en categorie van de bron en markeert de bron voor die periode als ingevuld (de app toont dan "Ingevuld" en schuift "volgende" door). Periode: maandelijks = kalendermaand van date, interval = rond de betaaldag. Met bank_transaction_id wordt de banktransactie gekoppeld: was die al als inkomen toegevoegd, dan wordt díe boeking de invulling (geen tweede inkomen); anders komt hij op matched. Met expense_id neem je een bestaande losse inkomensboeking over. Staat er in de periode al een losse boeking die erop lijkt, dan weigert de tool en noemt die boeking (geef dan expense_id/bank_transaction_id mee, of force). Weigert als de bron voor die periode al is ingevuld. undo: true draait de invulling terug (een overgenomen boeking krijgt zijn oude naam/bedrag terug, een nieuwe wordt verwijderd). Kijk eerst bij get_budget_config → recurring_income_status (possible_match) en vraag ALTIJD bevestiging (bron, bedrag, datum, welke boeking) voordat je invult of terugdraait.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id van de bron, bv. rec_1776029038292 (zie get_budget_config)' },
      amount: { type: ['number', 'string'], description: 'Ontvangen bedrag als dat afwijkt (standaard het bedrag van de banktransactie, anders dat van de bron)' },
      date: { type: 'string', description: 'YYYY-MM-DD; bepaalt ook de periode. Standaard: datum van de banktransactie, anders de verwachte betaaldag (of vandaag als die nog moet komen)' },
      bank_transaction_id: { type: 'string', description: 'Banktransactie (ontvangst) die bij deze betaling hoort' },
      expense_id: { type: 'string', description: 'Bestaande inkomensboeking die de invulling wordt (wordt hernoemd naar de bron)' },
      force: { type: 'boolean', description: 'Toch een aparte boeking maken als er al een gelijkende losse boeking staat' },
      undo: { type: 'boolean', description: 'Invulling voor die periode terugdraaien' } }, required: ['id'] } },
  { name: 'manage_category', description: 'Eigen uitgavencategorie toevoegen, hernoemen (ook emoji/kleur) of verwijderen. De vaste categorieën (eten, boodschappen, transport, kleding, abonnementen, sport, overig) kunnen niet hernoemd of verwijderd worden. Bij verwijderen gaan de uitgaven in die categorie naar overig. Vraag eerst bevestiging.',
    inputSchema: { type: 'object', properties: {
      action: { type: 'string', enum: ['add', 'rename', 'delete'] },
      id: { type: 'string', description: 'Categorie-id (bij rename/delete)' },
      label: { type: 'string', description: 'Naam (bij add/rename)' },
      emoji: { type: 'string' }, color: { type: 'string', description: 'Hex-kleur, bv. #10B981' },
      budget: { type: 'number', description: 'Maandbudget voor deze categorie (bij add, optioneel)' } }, required: ['action'] } },
  { name: 'update_savings_account', description: 'Een spaarrekening/spaarpotje (zie get_bank_balances) hernoemen of het spaardoel aanpassen. Bij een zelf bijgehouden spaarrekening kan ook het saldo opnieuw worden gezet (startsaldo per vandaag). Zoek op huidige naam of IBAN. Vraag eerst bevestiging.',
    inputSchema: { type: 'object', properties: {
      account: { type: 'string', description: 'Huidige naam (of deel ervan) of IBAN' },
      name: { type: 'string', description: 'Nieuwe naam' },
      goal: { type: ['number', 'null'], description: 'Spaardoel in euro (null = geen doel)' },
      balance: { type: 'number', description: 'Alleen zelf bijgehouden spaarrekeningen: saldo per vandaag' } }, required: ['account'] } },
]

/** Eindtoestand controleren: een negatief bedrag mag alleen bij een gewone uitgave (terugbetaling), maar één soort tegelijk. */
function checkExpense(row) {
  const kinds = ['is_income', 'is_savings_withdrawal', 'is_savings_contribution', 'is_loan_repayment'].filter(k => row[k])
  if (kinds.length > 1) throw new Error(`Een transactie kan maar één soort zijn (nu: ${kinds.join(', ')})`)
  if (Number(row.amount) < 0 && (kinds.length || row.is_planned)) throw new Error('Een negatief bedrag (terugbetaling) kan alleen bij een gewone uitgave: zet is_income/spaarvlaggen op false')
  if (row.paid_from_savings && kinds.length) throw new Error('paid_from_savings kan alleen bij een uitgave')
}

function cleanExpense(args, cfg, partial, base) {
  const out = {}
  for (const k of EXPENSE_FIELDS) if (args[k] !== undefined) out[k] = args[k]
  if (!partial && out.date === undefined) out.date = todayTZ()
  if (out.amount !== undefined && (typeof out.amount !== 'number' || !isFinite(out.amount) || out.amount === 0)) throw new Error('amount moet een getal zijn (niet 0)')
  if (out.amount !== undefined) out.amount = r2(out.amount)
  if (out.date !== undefined && !isDate(out.date)) throw new Error('date moet YYYY-MM-DD zijn')
  if (out.category !== undefined) {
    const income = out.is_income ?? base?.is_income
    const ok = income ? INCOME_CATEGORIES.includes(out.category) || allCategories(cfg).some(c => c.id === out.category)
      : allCategories(cfg).some(c => c.id === out.category)
    if (!ok) throw new Error(`Onbekende categorie "${out.category}". Gebruik get_budget_config voor de lijst.`)
  }
  if (out.description !== undefined) out.description = String(out.description).slice(0, 300)
  return out
}

async function saveConfig(uid, cfg, patch) {
  patch.updated_at = new Date().toISOString()
  const res = cfg.user_id
    ? await supabase.from('budget_config').update(patch).eq('user_id', uid)
    : await supabase.from('budget_config').insert({ user_id: uid, ...patch })
  if (res.error) throw new Error(res.error.message)
}

async function manageCategory(uid, args) {
  const cfg = await getConfig(uid)
  const custom = [...(cfg.custom_categories || [])]
  const builtIn = (id) => CATEGORIES.some(c => c.id === id)
  const color = (c) => { if (c === undefined) return undefined; if (!/^#[0-9a-f]{6}$/i.test(c)) throw new Error('color moet een hex-kleur zijn, bv. #10B981'); return c }
  const label = (l) => { const s = String(l || '').trim().slice(0, 40); if (!s) throw new Error('label ontbreekt'); return s }
  if (args.action === 'add') {
    const name = label(args.label)
    if (allCategories(cfg).some(c => c.label.toLowerCase() === name.toLowerCase())) throw new Error(`Categorie "${name}" bestaat al`)
    const cat = { id: `cat_${Date.now()}`, label: name, emoji: args.emoji || '🏷️', color: color(args.color) || CAT_COLORS[custom.length % CAT_COLORS.length] }
    if (args.budget !== undefined && (typeof args.budget !== 'number' || args.budget < 0)) throw new Error('budget moet een positief getal zijn')
    await saveConfig(uid, cfg, { custom_categories: [...custom, cat], category_budgets: { ...(cfg.category_budgets || DEFAULT_CAT_BUDGETS), [cat.id]: r2(args.budget || 0) } })
    return { added: cat, budget: r2(args.budget || 0) }
  }
  if (!args.id) throw new Error('id ontbreekt (zie get_budget_config → categories)')
  if (builtIn(args.id)) throw new Error(`"${args.id}" is een vaste categorie en kan niet hernoemd of verwijderd worden; maak eventueel een eigen categorie`)
  const at = custom.findIndex(c => c.id === args.id)
  if (at < 0) throw new Error(`Categorie "${args.id}" niet gevonden`)
  if (args.action === 'rename') {
    const before = custom[at]
    const next = { ...before, ...(args.label !== undefined ? { label: label(args.label) } : {}), ...(args.emoji ? { emoji: args.emoji } : {}), ...(args.color !== undefined ? { color: color(args.color) } : {}) }
    custom[at] = next
    await saveConfig(uid, cfg, { custom_categories: custom })
    return { renamed: { before, after: next } }
  }
  if (args.action === 'delete') {
    const { data: moved, error } = await supabase.from('expenses').update({ category: 'overig' }).eq('user_id', uid).eq('category', args.id).eq('is_income', false).select('id')
    if (error) throw new Error(error.message)
    const budgets = { ...(cfg.category_budgets || DEFAULT_CAT_BUDGETS) }; delete budgets[args.id]
    await saveConfig(uid, cfg, { custom_categories: custom.filter(c => c.id !== args.id), category_budgets: budgets })
    return { deleted: custom[at], expenses_moved_to_overig: (moved || []).length }
  }
  throw new Error('action moet add, rename of delete zijn')
}

async function updateSavingsAccount(uid, args) {
  const { data: accs, error } = await supabase.from('bank_accounts').select('*').eq('user_id', uid)
  if (error) throw new Error(/bank_accounts|does not exist/i.test(error.message) ? 'Bankkoppeling nog niet ingesteld' : error.message)
  const term = String(args.account || '').trim().toLowerCase()
  const norm = (s) => String(s || '').replace(/\s/g, '').toLowerCase()
  const exact = (accs || []).filter(a => (a.name || '').toLowerCase() === term || (a.iban && norm(a.iban) === norm(term)))
  const hits = exact.length ? exact : (accs || []).filter(a => (a.name || '').toLowerCase().includes(term))
  if (!hits.length) throw new Error(`Geen rekening gevonden voor "${args.account}". Namen: ${(accs || []).map(a => a.name).filter(Boolean).join(', ')}`)
  if (hits.length > 1) throw new Error(`Meerdere rekeningen passen bij "${args.account}": ${hits.map(a => a.name).join(', ')}`)
  const acc = hits[0]
  const patch = {}
  if (args.name !== undefined) { const n = String(args.name).trim().slice(0, 60); if (!n) throw new Error('name is leeg'); patch.name = n }
  if (args.goal !== undefined) {
    if (args.goal !== null && (typeof args.goal !== 'number' || args.goal < 0)) throw new Error('goal moet een positief getal of null zijn')
    patch.goal = args.goal ? r2(args.goal) : null
  }
  if (args.balance !== undefined) {
    if (!acc.manual) throw new Error('Het saldo van een bankrekening komt van ING en kan niet worden aangepast')
    if (typeof args.balance !== 'number') throw new Error('balance moet een getal zijn')
    Object.assign(patch, { base_balance: r2(args.balance), base_date: todayTZ(), balance: r2(args.balance), balance_at: new Date().toISOString() })
  }
  if (!Object.keys(patch).length) throw new Error('Geen velden om aan te passen (name, goal of balance)')
  patch.updated_at = new Date().toISOString()
  const { error: ue } = await supabase.from('bank_accounts').update(patch).eq('uid', acc.uid).eq('user_id', uid)
  if (ue) throw new Error(ue.message)
  const view = (a) => ({ name: a.name, kind: a.kind, balance: a.balance == null ? null : Number(a.balance), goal: a.goal ? Number(a.goal) : null })
  return { updated: { before: view(acc), after: view({ ...acc, ...patch }) }, ...(acc.manual ? {} : { note: 'Naam alleen in Hypex aangepast; bij ING blijft de naam hetzelfde.' }) }
}

async function callTool(name, args = {}) {
  const uid = await userId()
  if (planner.NAMES.has(name)) return planner.callTool(supabase, uid, name, args)
  if (study.NAMES.has(name)) return study.callTool(supabase, uid, name, args)
  if (name === 'get_overview') return overview(uid, args.month)
  if (name === 'get_budget_config') {
    const cfg = await getConfig(uid)
    return {
      monthly_budget: cfg.monthly_budget || 400, category_budgets: cfg.category_budgets || DEFAULT_CAT_BUDGETS,
      categories: allCategories(cfg), income_categories: INCOME_CATEGORIES, fixed_costs_category: FIXED_CAT,
      savings_goal: cfg.savings_goal || 0, min_balance: cfg.min_balance ?? 300, recovery_months: cfg.recovery_months || 3,
      vacation_mode: !!cfg.vacation_mode, vacation_budget: cfg.vacation_budget || 0, vacation_start: cfg.vacation_start || null, vacation_end: cfg.vacation_end || null,
      vacation_history: (cfg.vacation_history || []).map(v => ({ start: v.start, end: v.end || v.start, ...(v.budget ? { budget: v.budget } : {}) })),
      recurring_income: (cfg.recurring_income || []).map(({ filled, bank_match, ...s }) => s), month_adjustments: cfg.month_adjustments || {},
      recurring_income_status: await recurring.sourcesStatus(supabase, uid, cfg, todayTZ()).catch(() => []),
    }
  }
  if (name === 'fill_recurring_income') {
    if (!args.id) throw new Error('id ontbreekt (zie get_budget_config → recurring_income)')
    if (args.amount !== undefined) { const a = parseAmount(args.amount); if (a === null) throw new Error('amount is geen bedrag'); args.amount = a }
    return recurring.fillRecurring(supabase, uid, args, { getConfig, saveConfig, today: todayTZ })
  }
  if (name === 'list_expenses') {
    let q = supabase.from('expenses').select('*').eq('user_id', uid)
    if (args.from) { if (!isDate(args.from)) throw new Error('from moet YYYY-MM-DD zijn'); q = q.gte('date', args.from) }
    if (args.to) { if (!isDate(args.to)) throw new Error('to moet YYYY-MM-DD zijn'); q = q.lte('date', args.to) }
    if (args.category) q = q.eq('category', args.category)
    const searchAmount = parseAmount(args.search)
    if (args.search && searchAmount === null) q = q.ilike('description', `%${String(args.search).replace(/[%_]/g, '')}%`)
    q = amountFilter(q, searchAmount !== null && args.amount === undefined ? { ...args, amount: searchAmount } : args)
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
    const vh = (await getConfig(uid)).vacation_history || []
    return { count: list.length, total: r2(sum(list)), items: list.map(e => slim(e, vh)) }
  }
  if (name === 'add_expense') {
    const cfg = await getConfig(uid)
    const row = { is_income: false, is_savings_withdrawal: false, ...cleanExpense(args, cfg, false), user_id: uid }
    if (row.is_savings_withdrawal && !row.savings_type) row.savings_type = 'saved'
    if (!row.is_savings_withdrawal) delete row.savings_type // kolom-standaard; betekent alleen iets bij opnames
    checkExpense(row)
    const { data, error } = await supabase.from('expenses').insert(row).select().single()
    if (error) throw new Error(error.message)
    return { added: slim(data) }
  }
  if (name === 'update_expense') {
    if (!args.id) throw new Error('id ontbreekt')
    const cfg = await getConfig(uid)
    const { data: cur, error: ce } = await supabase.from('expenses').select('*').eq('id', args.id).eq('user_id', uid).maybeSingle()
    if (ce) throw new Error(ce.message)
    if (!cur) throw new Error('Transactie niet gevonden')
    // Alleen de meegegeven velden; niets anders wordt aangeraakt
    const patch = cleanExpense(args, cfg, true, cur)
    if (!Object.keys(patch).length) throw new Error('Geen velden om aan te passen')
    if (patch.is_savings_withdrawal === true && !cur.is_savings_withdrawal && !patch.savings_type) patch.savings_type = 'saved'
    checkExpense({ ...cur, ...patch })
    const { data, error } = await supabase.from('expenses').update(patch).eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Transactie niet gevonden')
    const vh = cfg.vacation_history || []
    const changed = Object.keys(patch).filter(k => String(cur[k] ?? null) !== String(data[k] ?? null))
    return { updated: slim(data, vh), changed, before: slim(cur, vh) }
  }
  if (name === 'delete_expense') {
    if (!args.id) throw new Error('id ontbreekt')
    const { data: cur } = await supabase.from('expenses').select('id').eq('id', args.id).eq('user_id', uid).maybeSingle()
    if (!cur) throw new Error('Transactie niet gevonden')
    const bank = await unlinkExpense(supabase, uid, args.id) // vóór het verwijderen (FK zet expense_id anders op null)
    const { data, error } = await supabase.from('expenses').delete().eq('id', args.id).eq('user_id', uid).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Transactie niet gevonden')
    return { deleted: slim(data), ...(bank.length ? { bank_transactions: bank } : {}) }
  }
  if (name === 'get_bank_balances') return bankBalances(uid)
  if (name === 'list_bank_transactions') {
    const searchAmount = parseAmount(args.search)
    const byAmount = searchAmount !== null || args.amount !== undefined || args.min_amount !== undefined || args.max_amount !== undefined
    const status = args.status || (args.search || args.group_by || byAmount ? 'alle' : 'new')
    let q = supabase.from('bank_transactions').select('id, booking_date, amount, counterparty, counterparty_iban, description, status, suggested_kind, suggested_category, expense_id, account_uid').eq('user_id', uid)
    if (status !== 'alle') q = q.eq('status', status)
    q = amountFilter(q, searchAmount !== null && args.amount === undefined ? { ...args, amount: searchAmount } : args)
    if (args.search && searchAmount === null && /geldautomaat|geldmaat|pinautomaat|\batm\b/i.test(args.search)) {
      q = q.or('counterparty.ilike.%geldautomaat%,description.ilike.%geldmaat%')
    } else if (args.search && searchAmount === null) {
      const term = String(args.search).replace(/[%_,()]/g, ' ').trim()
      if (term) q = q.or(`counterparty.ilike.%${term}%,description.ilike.%${term}%`)
    }
    if (args.direction === 'af') q = q.lt('amount', 0)
    if (args.direction === 'bij') q = q.gt('amount', 0)
    if (args.from) { if (!isDate(args.from)) throw new Error('from moet YYYY-MM-DD zijn'); q = q.gte('booking_date', args.from) }
    if (args.to) { if (!isDate(args.to)) throw new Error('to moet YYYY-MM-DD zijn'); q = q.lte('booking_date', args.to) }
    if (args.group_by === 'counterparty') {
      const { data, error } = await q.order('booking_date', { ascending: false }).limit(5000)
      if (error) throw new Error(error.message)
      const groups = new Map()
      for (const t of data || []) {
        // Interne overboekingen (bv. naar spaarrekeningen) niet als winkel meetellen
        if (t.suggested_kind === 'intern') continue
        const party = t.counterparty || atmCounterparty(t)
        const key = normalizeCounterparty(party) || '(onbekend)'
        const g = groups.get(key) || { counterparty: party || '(onbekend)', count: 0, total_out: 0, total_in: 0, first: t.booking_date, last: t.booking_date }
        g.count++
        if (Number(t.amount) < 0) g.total_out += -Number(t.amount); else g.total_in += Number(t.amount)
        if (t.booking_date < g.first) g.first = t.booking_date
        if (t.booking_date > g.last) g.last = t.booking_date
        groups.set(key, g)
      }
      const list = [...groups.values()].map(g => ({ ...g, total_out: r2(g.total_out), total_in: r2(g.total_in) }))
        .sort((a, b) => b.total_out - a.total_out || b.total_in - a.total_in)
        .slice(0, Math.min(100, Math.max(1, Number(args.limit) || 30)))
      return { groups: list, note: 'Totalen per tegenpartij over de gekozen periode (alle statussen tenzij anders gekozen).' }
    }
    const limit = Math.min(300, Math.max(1, Number(args.limit) || 50))
    const { data, error } = await q.order('booking_date', { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    const list = (data || []).map(t => ({ ...t, amount: Number(t.amount), counterparty: t.counterparty || atmCounterparty(t) }))
    return { count: list.length, total_out: r2(list.filter(t => t.amount < 0).reduce((n, t) => n - t.amount, 0)), total_in: r2(list.filter(t => t.amount > 0).reduce((n, t) => n + t.amount, 0)), items: list }
  }
  if (name === 'process_bank_transaction') {
    if (!args.id || !args.action) throw new Error('id en action zijn verplicht')
    if (args.category) {
      const cfg = await getConfig(uid)
      const ok = INCOME_CATEGORIES.includes(args.category) || allCategories(cfg).some(c => c.id === args.category)
      if (!ok) throw new Error(`Onbekende categorie "${args.category}"`)
    }
    const res = await processTransaction(supabase, uid, args.id, { action: args.action, category: args.category, kind: args.kind })
    if (args.action === 'add' && (res.kind === 'inkomen' || !res.kind)) {
      const sug = await recurring.suggestForTransaction(supabase, uid, await getConfig(uid), args.id).catch(() => null)
      if (sug) res.recurring_income_suggestion = sug
    }
    return res
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
    if (args.recurring_income !== undefined) {
      if (!Array.isArray(args.recurring_income)) throw new Error('recurring_income moet een lijst zijn')
      const next = [...(cfg.recurring_income || [])]
      for (const [i, it] of args.recurring_income.entries()) {
        const at = it.id ? next.findIndex(r => r.id === it.id) : -1
        if (it.id && at < 0) throw new Error(`Vaste inkomstenbron "${it.id}" bestaat niet`)
        if (it.remove) { if (at < 0) throw new Error('remove heeft een id nodig'); next.splice(at, 1); continue }
        const src = { ...(at >= 0 ? next[at] : { id: `rec_${Date.now()}_${i}`, emoji: '💰', type: 'monthly' }) }
        for (const k of ['name', 'amount', 'type', 'day', 'interval_days', 'ref_date', 'emoji', 'category']) if (it[k] !== undefined) src[k] = it[k]
        if (!String(src.name || '').trim()) throw new Error('Vaste inkomsten: name ontbreekt')
        src.name = String(src.name).trim().slice(0, 60)
        if (typeof src.amount !== 'number' || !(src.amount > 0)) throw new Error(`Vaste inkomsten "${src.name}": amount moet positief zijn`)
        src.amount = r2(src.amount)
        if (src.type === 'monthly') {
          if (!Number.isInteger(src.day) || src.day < 1 || src.day > 31) throw new Error(`Vaste inkomsten "${src.name}": day moet 1–31 zijn`)
          delete src.interval_days; delete src.ref_date
        } else if (src.type === 'interval') {
          if (!Number.isInteger(src.interval_days) || src.interval_days < 1) throw new Error(`Vaste inkomsten "${src.name}": interval_days ontbreekt`)
          if (!isDate(src.ref_date)) throw new Error(`Vaste inkomsten "${src.name}": ref_date moet YYYY-MM-DD zijn`)
          delete src.day
        } else throw new Error('type moet monthly of interval zijn')
        if (src.category !== undefined && !INCOME_CATEGORIES.includes(src.category)) throw new Error(`Onbekende inkomenscategorie "${src.category}"`)
        if (at >= 0) next[at] = src; else next.push(src)
      }
      patch.recurring_income = next
    }
    if (!Object.keys(patch).length) throw new Error('Geen velden om aan te passen')
    await saveConfig(uid, cfg, patch)
    return { updated: patch }
  }
  if (name === 'manage_category') return manageCategory(uid, args)
  if (name === 'update_savings_account') return updateSavingsAccount(uid, args)
  throw new Error(`Onbekende tool: ${name}`)
}

// ── JSON-RPC / MCP ──────────────────────────────────────────────────────────
const GELD_INSTRUCTIONS = 'Geld-app van Fachri (Hypex Dash). Bedragen in euro. Gebruik get_overview voor de stand van een maand, ' +
  'list_expenses om transacties te vinden (ids nodig voor wijzigen/verwijderen) en get_budget_config voor categorieën en instellingen. ' +
  'Bankkoppeling (ING, alleen-lezen): get_bank_balances voor saldo\'s, spaarrekeningen en spaardoelen (spaarrekeningen worden door ING niet gedeeld en zijn zelf bijgehouden), ' +
  'list_bank_transactions voor de afschriften (zoeken op winkel met search, totalen per winkel met group_by=counterparty) en de inbox, process_bank_transaction om de inbox te verwerken. ' +
  'Vaste inkomsten (zorgtoeslag, studiefinanciering, salaris): get_budget_config → recurring_income_status laat per bron zien of de lopende periode is ingevuld. Vul een betaling in met fill_recurring_income (niet met add_expense of process_bank_transaction, anders blijft "Invullen" in de app open en ontstaat er snel een dubbele boeking); hoort er een banktransactie of losse boeking bij, geef die mee (bank_transaction_id / expense_id). Geeft process_bank_transaction een recurring_income_suggestion, stel dan voor om die bron zo in te vullen. ' +
  'paid_from_savings = uitgave van spaargeld (telt niet tegen het budget); savings_type geldt alleen voor spaaropnames. ' +
  'Uitgaven tijdens een eerdere vakantie (vacation_history) tellen niet tegen het maandbudget; get_overview toont ze onder vacation_excluded. ' +
  'Instellingen: update_budget_config (ook vaste inkomsten), manage_category (eigen categorieën), update_savings_account (spaarrekening hernoemen/doel). ' +
  'Vraag bevestiging voordat je transacties verwijdert, budgetten wijzigt, banktransacties verwerkt of vaste inkomsten invult/terugdraait.'
const INSTRUCTIONS = `${planner.INSTRUCTIONS}

${study.INSTRUCTIONS}

${GELD_INSTRUCTIONS}`
const ALL_TOOLS = [...planner.TOOLS, ...study.TOOLS, ...TOOLS]

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
        serverInfo: { name: 'hypex', version: '2.0.0' },
        instructions: INSTRUCTIONS,
      })
    }
    if (method === 'ping') return ok({})
    if (method === 'tools/list') return ok({ tools: ALL_TOOLS })
    if (method === 'tools/call') {
      const name = params?.name
      if (!ALL_TOOLS.some(t => t.name === name)) return fail(-32602, `Onbekende tool: ${name}`)
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
exports._internal = { overview, callTool, handleMessage, TOOLS: ALL_TOOLS }
