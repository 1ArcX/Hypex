// Terugkerend inkomen invullen (Geld → Inkomsten & sparen → Terugkerend → "Invullen" / "Nu invullen").
// Spiegelt src/geld/lib/recurring.ts (periodOf / fillFor / nextPayDate / matchesSource) en de inkomensregel die
// IncomeDayModal aanmaakt: { amount, category: bron.category || 'salaris', description: bron.name, date, is_income: true }.
//
// "Ingevuld" = de bron heeft voor die periode een inkomensregel. Dat staat op de bron zelf in budget_config:
// recurring_income[].filled = { "<periode>": { expense_id, date, amount, before? } } (maandelijks: "2026-11",
// interval: de verwachte datum). Oudere invullingen zonder markering tellen ook: een inkomensregel met de naam van de
// bron in die periode (zoals de app altijd al keek).

const { paidDate, toExpense, unlinkExpense, normalizeCounterparty } = require('../bank/bankCore')

const DAY = 86400000
const pad = (n) => String(n).padStart(2, '0')
const r2 = (x) => Math.round(Number(x) * 100) / 100
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const utc = (s) => Date.parse(`${s}T00:00:00Z`)
const addDays = (s, n) => new Date(utc(s) + n * DAY).toISOString().slice(0, 10)
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const shortDate = (s) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`

/** De periode van een bron rond datum `ref`: maandelijks = kalendermaand, interval = rond de dichtstbijzijnde betaaldag. */
function periodOf(src, ref) {
  if (src.type === 'interval' && src.ref_date) {
    const n = src.interval_days || 28
    const k = Math.round((utc(ref) - utc(src.ref_date)) / DAY / n)
    const expected = addDays(src.ref_date, k * n)
    return { key: expected, from: addDays(expected, -Math.floor(n / 2)), to: addDays(expected, Math.ceil(n / 2) - 1), expected }
  }
  const [y, m] = ref.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const ym = `${y}-${pad(m)}`
  return { key: ym, from: `${ym}-01`, to: `${ym}-${pad(last)}`, expected: `${ym}-${pad(Math.min(src.day || 1, last))}` }
}
const nextPeriod = (src, p) => periodOf(src, addDays(p.to, 1))
const periodLabel = (src, p) => src.type === 'interval' ? `de betaling van ${shortDate(p.expected)}` : `${MONTHS[Number(p.key.slice(5)) - 1]} ${p.key.slice(0, 4)}`

const markOf = (src, key) => { const v = (src.filled || {})[key]; return typeof v === 'string' ? { expense_id: v } : v || null }

/** De inkomensregel waarmee de bron voor deze periode is ingevuld (of null). `incomes` = expenses met is_income. */
function fillFor(src, period, incomes) {
  const mark = markOf(src, period.key)
  if (mark?.expense_id) {
    const hit = incomes.find(e => e.id === mark.expense_id)
    if (hit) return hit
  }
  return incomes.find(e => e.description === src.name && e.date >= period.from && e.date <= period.to) || null
}

/** Volgende betaaldatum: deze periode als die nog moet komen en nog niet is ingevuld, anders de volgende. */
function nextPayDate(src, today, filledNow) {
  let p = periodOf(src, today)
  if (p.expected <= today || filledNow) p = nextPeriod(src, p)
  return p.expected
}

/** Hoort een bankontvangst (of een inkomensregel) waarschijnlijk bij deze bron? Zelfde IBAN/tegenpartij, of bedrag ±5% rond de betaaldag. */
function matchesSource(src, { amount, date, iban, counterparty }) {
  if (!(amount > 0)) return null
  const m = src.bank_match || {}
  if (iban && m.iban && iban.replace(/\s/g, '') === m.iban) return 'zelfde IBAN'
  if (counterparty && m.counterparty && normalizeCounterparty(counterparty) === m.counterparty) return 'zelfde tegenpartij'
  const p = periodOf(src, date)
  const near = Math.abs(utc(date) - utc(p.expected)) / DAY <= 5
  if (near && Math.abs(amount - src.amount) <= src.amount * 0.05) return 'bedrag ±5% rond de betaaldag'
  return null
}

const view = (e) => ({ id: e.id, date: e.date, amount: Number(e.amount), category: e.category, description: e.description || '' })

async function loadIncomes(db, uid, from, to) {
  const { data, error } = await db.from('expenses').select('*').eq('user_id', uid).eq('is_income', true).gte('date', from).lte('date', to)
  if (error) throw new Error(error.message)
  return data || []
}
async function linkedTx(db, uid, ids) {
  if (!ids.length) return []
  const { data } = await db.from('bank_transactions').select('id, expense_id, status, amount, counterparty, counterparty_iban, booking_date, paid_date, description, suggested_category')
    .eq('user_id', uid).in('expense_id', ids)
  return data || []
}

/**
 * Status per bron voor de periodes waarvan de betaaldag in [from, to] valt (standaard: de lopende periode).
 * Voor get_budget_config en get_overview.
 */
async function sourcesStatus(db, uid, cfg, today, range) {
  const sources = cfg.recurring_income || []
  if (!sources.length) return []
  const periods = []
  for (const src of sources) {
    if (!range) { periods.push([src, periodOf(src, today)]); continue }
    let p = periodOf(src, range.from)
    if (p.expected < range.from) p = nextPeriod(src, p)
    for (let i = 0; p.expected <= range.to && i < 10; i++, p = nextPeriod(src, p)) periods.push([src, p])
  }
  if (!periods.length) return []
  const lo = periods.reduce((a, [, p]) => (p.from < a ? p.from : a), periods[0][1].from)
  const hi = periods.reduce((a, [, p]) => (p.to > a ? p.to : a), periods[0][1].to)
  const incomes = await loadIncomes(db, uid, lo, hi)
  const fills = periods.map(([src, p]) => fillFor(src, p, incomes))
  const txs = await linkedTx(db, uid, [...new Set([...fills.filter(Boolean).map(f => f.id), ...incomes.map(e => e.id)])])
  return periods.map(([src, p], i) => {
    const f = fills[i]
    const tx = f && txs.find(t => t.expense_id === f.id)
    const out = {
      id: src.id, name: src.name, amount: src.amount, ...(src.emoji ? { emoji: src.emoji } : {}),
      schedule: src.type === 'interval' ? `elke ${src.interval_days} dagen` : `${src.day}e van de maand`,
      period: p.key, expected_date: p.expected, filled: !!f,
      ...(f ? { filled_expense: view(f), ...(tx ? { bank_transaction_id: tx.id } : {}), ...(markOf(src, p.key) ? {} : { note: 'ingevuld zonder markering (inkomen met de naam van de bron)' }) } : {}),
      next_pay_date: nextPayDate(src, today, !!f && p.key === periodOf(src, today).key),
    }
    if (!f) {
      // Losse boeking die er waarschijnlijk bij hoort (bv. via de bank toegevoegd onder de naam van de tegenpartij)
      const used = new Set(fills.filter(Boolean).map(x => x.id))
      const cand = incomes.filter(e => !used.has(e.id) && e.date >= p.from && e.date <= p.to).map(e => {
        const t = txs.find(x => x.expense_id === e.id)
        const why = matchesSource(src, { amount: Number(e.amount), date: e.date, iban: t?.counterparty_iban, counterparty: t?.counterparty || e.description })
        return why ? { expense_id: e.id, date: e.date, amount: Number(e.amount), description: e.description, ...(t ? { bank_transaction_id: t.id } : {}), why } : null
      }).filter(Boolean)
      if (cand.length) out.possible_match = cand
    }
    return out
  })
}

/**
 * Bron invullen voor een periode (of met undo terugdraaien). ctx: { getConfig, saveConfig, today }.
 */
async function fillRecurring(db, uid, args, ctx) {
  const cfg = await ctx.getConfig(uid)
  const sources = cfg.recurring_income || []
  const src = sources.find(s => s.id === args.id)
  if (!src) throw new Error(`Onbekende bron "${args.id}". Bestaande: ${sources.map(s => `${s.id} (${s.name})`).join(', ') || 'geen'}`)
  if (args.date !== undefined && !isDate(args.date)) throw new Error('date moet YYYY-MM-DD zijn')
  const t = ctx.today()

  let tx = null
  if (args.bank_transaction_id) {
    const { data, error } = await db.from('bank_transactions').select('*').eq('id', args.bank_transaction_id).eq('user_id', uid).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Banktransactie niet gevonden')
    if (!(Number(data.amount) > 0)) throw new Error('Die banktransactie is geen ontvangst (bedrag is negatief)')
    if (data.status === 'pending') throw new Error('Dat is een reservering (nog niet geboekt); wacht tot hij geboekt is')
    tx = data
  }
  const ref = args.date || (tx ? paidDate(tx) : t)
  const p0 = periodOf(src, ref)
  const date = args.date || (tx ? paidDate(tx) : (p0.expected <= t ? p0.expected : t))
  const period = periodOf(src, date)
  const incomes = await loadIncomes(db, uid, addDays(period.from, -10), addDays(period.to, 10))
  const existing = fillFor(src, period, incomes)
  const sourceView = { id: src.id, name: src.name }
  const periodView = { key: period.key, label: periodLabel(src, period), expected_date: period.expected }

  // ── terugdraaien ──
  if (args.undo) {
    if (!existing) throw new Error(`${src.name} is voor ${periodLabel(src, period)} niet ingevuld; er is niets terug te draaien.`)
    const mark = markOf(src, period.key)
    const [link] = await linkedTx(db, uid, [existing.id])
    let action
    if (mark?.before || (link && link.status === 'added')) {
      // De boeking bestond al (eigen invoer of via de bank toegevoegd): terug naar hoe die was
      const back = mark?.before || (() => { const f = toExpense(link, 'inkomen', link.suggested_category || 'overig', uid); return { amount: f.amount, category: f.category, description: f.description, date: f.date } })()
      const { error } = await db.from('expenses').update(back).eq('id', existing.id).eq('user_id', uid)
      if (error) throw new Error(error.message)
      action = { restored_expense: { ...view(existing), ...back } }
    } else {
      const unlinked = await unlinkExpense(db, uid, existing.id) // gekoppelde banktransactie: matched → new
      const { error } = await db.from('expenses').delete().eq('id', existing.id).eq('user_id', uid)
      if (error) throw new Error(error.message)
      action = { deleted_expense: view(existing), ...(unlinked.length ? { bank_transactions: unlinked } : {}) }
    }
    const filled = { ...(src.filled || {}) }; delete filled[period.key]
    const patch = { recurring_income: sources.map(s => (s.id === src.id ? { ...s, filled } : s)) }
    const conf = { ...(cfg.income_confirmed_dates || {}) }
    if (conf[t]?.includes(src.id)) { conf[t] = conf[t].filter(x => x !== src.id); patch.income_confirmed_dates = conf }
    await ctx.saveConfig(uid, cfg, patch)
    return { undone: true, source: sourceView, period: periodView, ...action, next_pay_date: nextPayDate(src, t, false) }
  }

  // ── invullen ──
  if (existing) {
    throw new Error(`${src.name} is voor ${periodLabel(src, period)} al ingevuld op ${existing.date} (€ ${Number(existing.amount).toFixed(2)}, expense ${existing.id}). Gebruik undo: true om dat eerst terug te draaien.`)
  }
  const amount = args.amount !== undefined ? r2(args.amount) : tx ? r2(Math.abs(tx.amount)) : r2(src.amount)
  if (!(amount > 0)) throw new Error('amount moet positief zijn')
  if (tx && args.expense_id && tx.expense_id && tx.expense_id !== args.expense_id) {
    throw new Error(`Die banktransactie hoort al bij expense ${tx.expense_id}; laat expense_id weg (die boeking wordt dan gebruikt).`)
  }
  const adoptId = args.expense_id || (tx?.expense_id && ['added', 'pending', 'matched'].includes(tx.status) ? tx.expense_id : null)
  if (!adoptId && !tx && !args.force) {
    const cand = incomes.filter(e => e.date >= period.from && e.date <= period.to)
      .filter(e => matchesSource(src, { amount: Number(e.amount), date: e.date, counterparty: e.description }))
    if (cand.length) {
      const list = cand.map(e => `${e.date} € ${Number(e.amount).toFixed(2)} "${e.description}" (expense ${e.id})`).join('; ')
      throw new Error(`Er staat in ${periodLabel(src, period)} al een inkomen dat bij ${src.name} lijkt te horen: ${list}. Geef expense_id (of bank_transaction_id) mee om die boeking als ${src.name} te gebruiken, of force: true voor een aparte boeking.`)
    }
  }

  const row = { amount, category: src.category || 'salaris', description: src.name, date, is_income: true, is_savings_withdrawal: false }
  let expense, before = null
  if (adoptId) {
    const { data: cur, error } = await db.from('expenses').select('*').eq('id', adoptId).eq('user_id', uid).maybeSingle()
    if (error) throw new Error(error.message)
    if (!cur) throw new Error(`Expense ${adoptId} niet gevonden`)
    if (!cur.is_income) throw new Error(`Expense ${adoptId} is geen inkomen`)
    before = { amount: Number(cur.amount), category: cur.category, description: cur.description, date: cur.date }
    const { data: upd, error: ue } = await db.from('expenses').update({ ...row, paid_from_savings: false }).eq('id', adoptId).eq('user_id', uid).select().single()
    if (ue) throw new Error(ue.message)
    expense = upd
  } else {
    const { data: ins, error } = await db.from('expenses').insert({ ...row, user_id: uid }).select().single()
    if (error) throw new Error(error.message)
    expense = ins
  }
  let txOut
  if (tx) {
    // Koppelen zodat de bank geen tweede inkomen maakt: eigen invulling = matched, al via de bank toegevoegd = added
    const status = tx.expense_id === expense.id && tx.status === 'added' ? 'added' : 'matched'
    if (tx.expense_id !== expense.id || tx.status !== status) {
      const { error } = await db.from('bank_transactions').update({ status, expense_id: expense.id }).eq('id', tx.id).eq('user_id', uid)
      if (error) throw new Error(error.message)
    }
    txOut = { id: tx.id, status, previous_status: tx.status }
  }

  const filled = { ...(src.filled || {}), [period.key]: { expense_id: expense.id, date, amount, ...(before ? { before } : {}) } }
  for (const k of Object.keys(filled).sort().slice(0, -24)) delete filled[k] // laatste 24 periodes bewaren
  const nextSrc = { ...src, filled, ...(tx ? { bank_match: { ...(tx.counterparty_iban ? { iban: tx.counterparty_iban.replace(/\s/g, '') } : {}), ...(tx.counterparty ? { counterparty: normalizeCounterparty(tx.counterparty) } : {}) } } : {}) }
  const patch = { recurring_income: sources.map(s => (s.id === src.id ? nextSrc : s)) }
  if (date === t) {
    // Betaaldag-popup van vandaag niet meer tonen (zoals confirmIncomeToday in de app)
    const conf = { ...(cfg.income_confirmed_dates || {}) }
    conf[t] = [...new Set([...(conf[t] || []), src.id])]
    for (const d of Object.keys(conf)) if (d < t) delete conf[d]
    patch.income_confirmed_dates = conf
  }
  await ctx.saveConfig(uid, cfg, patch)
  return {
    filled: true, source: sourceView, period: periodView, expense: view(expense),
    ...(before ? { used_existing_expense: { id: expense.id, before } } : {}),
    ...(txOut ? { bank_transaction: txOut } : {}),
    next_pay_date: nextPayDate(nextSrc, t, period.key === periodOf(src, t).key),
  }
}

/** Voor process_bank_transaction: bij welke bron hoort deze ontvangst waarschijnlijk? */
async function suggestForTransaction(db, uid, cfg, txId) {
  const sources = cfg.recurring_income || []
  if (!sources.length) return null
  const { data: tx } = await db.from('bank_transactions').select('*').eq('id', txId).eq('user_id', uid).maybeSingle()
  if (!tx || !(Number(tx.amount) > 0)) return null
  const date = paidDate(tx)
  for (const src of sources) {
    const why = matchesSource(src, { amount: Number(tx.amount), date, iban: tx.counterparty_iban, counterparty: tx.counterparty })
    if (!why) continue
    const p = periodOf(src, date)
    const incomes = await loadIncomes(db, uid, p.from, p.to)
    const f = fillFor(src, p, incomes)
    if (f && f.id === tx.expense_id) return null // is al deze invulling
    return {
      source_id: src.id, name: src.name, period: p.key, expected_date: p.expected, why,
      already_filled: f ? view(f) : false,
      hint: f
        ? `${src.name} is voor ${periodLabel(src, p)} al ingevuld (expense ${f.id}); kijk of dit een dubbele boeking is.`
        : `Dit lijkt ${src.name}. Vraag of je hem zo mag invullen: fill_recurring_income { id: "${src.id}", bank_transaction_id: "${tx.id}" } (de boeking wordt dan ${src.name}, de knop in de app staat op ingevuld).`,
    }
  }
  return null
}

module.exports = { periodOf, nextPeriod, fillFor, nextPayDate, matchesSource, sourcesStatus, fillRecurring, suggestForTransaction }
