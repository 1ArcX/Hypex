// Gedeelde logica voor de bankkoppeling (functie `bank`) en de Claude-connector (`geld-mcp`):
// voorstellen voor banktransacties, omzetten naar een uitgave en verwerken (toevoegen / negeren).

const KEYWORDS = [
  ['boodschappen', /albert heijn|\bah\b|jumbo|lidl|aldi|\bplus\b|\bdirk\b|\bcoop\b|\bspar\b|ekoplaza|vomar|hoogvliet|picnic|crisp|kruidvat|etos|action/],
  ['eten', /thuisbezorgd|uber ?eats|deliveroo|mcdonald|burger king|\bkfc\b|subway|domino|new york pizza|starbucks|febo|caf[eé]|restaurant|snackbar|bakkerij|lunchroom/],
  ['transport', /\bns\b|ns groep|ov-?chip|ovpay|translink|arriva|connexxion|breng|keolis|q-park|\bshell\b|esso|\bbp\b|tango|tinq|total ?energies|\buber\b|\bbolt\b|swapfiets|donkey|parkeren|tanken/],
  ['kleding', /zara|h&m|\bhm\b|primark|zalando|nike|adidas|uniqlo|jack ?& ?jones|snipes|about ?you|bershka|pull ?& ?bear/],
  ['sport', /basic-?fit|sportcity|anytime fitness|decathlon|myprotein|bulk ?powders|sportschool|fitness/],
  ['abonnementen', /spotify|netflix|disney|videoland|hbo|vodafone|\bkpn\b|odido|t-?mobile|ziggo|simyo|lebara|youfone|apple\.com|icloud|google ?(one|storage)|zorgverzeker|\bcz\b|\bvgz\b|zilveren kruis|menzis|\bduo\b|huur|vattenfall|eneco|essent|energie|verzekering/],
]

/** Overboeking met een eigen ING-spaarrekening ("Oranje spaarrekening F12156498"): alleen geld verschuiven. */
const SAVINGS_RE = /oranje\s*spaarrekening|spaarrekening\s+[a-z]\d{6,}|\bspaarrekening\b.*\b[a-z]\d{7,}\b/i
const isSavingsTransfer = (tx) => SAVINGS_RE.test(`${tx.counterparty || ''} ${tx.description || ''}`)
/**
 * Terugbetaling van iemand anders (je schoot voor): Tikkie-ontvangst of een overboeking van een persoon.
 * Bedrijven/instanties (DUO, Belastingdienst, salaris…) tellen niet.
 */
const COMPANY_RE = /\b(b\.?v\.?|n\.?v\.?|bv|duo|belastingdienst|gemeente|svb|uwv|adecco|connexxion|randstad|tempo-team|zorgverzeker|bank|stichting|vof|holding|salaris|loon)\b/i
function isRepayment(tx) {
  if (tx.amount <= 0) return false
  const text = `${tx.counterparty || ''} ${tx.description || ''}`
  if (COMPANY_RE.test(text) || isSavingsTransfer(tx)) return false
  if (/tikkie/i.test(text)) return true
  // Persoonsnaam: "Hr L Vonk", "Mw …", "B.A. de Lange", "Hr W J E van Hunen en/of …"
  return /^(hr|mw|dhr|mevr|mr|mrs)\.?\s|^([a-z]\.){1,4}\s?[a-z]/i.test((tx.counterparty || '').trim()) && Math.abs(tx.amount) < 250
}

/**
 * Geldautomaat: ING geeft bij opnames/stortingen ("GELDMAAT …", "STORTING ING Geldmaat …") geen tegenpartij.
 * → "Geldautomaat (opname)" / "Geldautomaat (storting)", anders null.
 */
function atmCounterparty(tx) {
  if (tx.counterparty) return null
  const d = String(tx.description || '')
  if (!/geldmaat|geldautomaat|\bchipknip\b/i.test(d)) return null
  return /storting/i.test(d) || Number(tx.amount) > 0 ? 'Geldautomaat (storting)' : 'Geldautomaat (opname)'
}

/** "ALBERT HEIJN 1234 ARNHEM NLD" → "albert heijn arnhem": sleutel voor geleerde regels. */
function normalizeCounterparty(s) {
  return String(s || '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ&.\- ]/g, ' ')
    .replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')
}

/**
 * Voorstel voor een banktransactie.
 * tx: { amount, counterparty, counterparty_iban, description, account_kind }
 * ctx: { ownAccounts: [{ iban, kind }], rules: { sleutel: categorie } }
 * → { kind, category, autoIgnore }
 */
function suggest(tx, ctx) {
  const own = (ctx.ownAccounts || []).find(a => matchesAccount(tx, a))
  // Bewegingen op een spaarrekening zelf: de tegenhanger staat al op de betaalrekening
  if (tx.account_kind === 'spaar') return { kind: 'intern', category: null, autoIgnore: true }
  // Geld verschuiven tussen eigen rekeningen (ook ING-spaarrekeningen die de bank niet deelt) telt nergens mee;
  // spaarsaldo's volgen deze overboekingen via de zelf toegevoegde spaarrekeningen.
  if (own || isSavingsTransfer(tx)) return { kind: 'intern', category: null, autoIgnore: true }
  // Tikkie / terugbetaling van iemand: verlaagt de uitgave waarvoor je voorschoot (zelfde categorie)
  if (isRepayment(tx)) return { kind: 'terugbetaling', category: ctx.repaymentCategory?.(tx) || 'eten' }
  const key = normalizeCounterparty(tx.counterparty)
  const text = `${tx.counterparty || ''} ${tx.description || ''}`.toLowerCase()
  const learned = key && ctx.rules ? ctx.rules[key] : null
  if (tx.amount > 0) {
    return { kind: 'inkomen', category: learned || (/salaris|loon|salary|wage/.test(text) ? 'salaris' : 'overig') }
  }
  if (learned) return { kind: 'uitgave', category: learned }
  const hit = KEYWORDS.find(([, re]) => re.test(text))
  return { kind: 'uitgave', category: hit ? hit[0] : 'overig' }
}

/** Hoort een transactie bij (overboeking van/naar) deze eigen rekening? Op IBAN, of op (deel van de) naam (`match`). */
function matchesAccount(tx, acc) {
  const norm = (s) => String(s || '').replace(/\s/g, '').toUpperCase()
  if (acc.iban && tx.counterparty_iban && norm(acc.iban) === norm(tx.counterparty_iban)) return true
  const m = String(acc.match || '').trim().toLowerCase()
  if (!m) return false
  if (/^[a-z]{2}\d{2}[a-z0-9]{8,}$/.test(m.replace(/\s/g, ''))) return norm(m) === norm(tx.counterparty_iban)
  return String(tx.counterparty || '').toLowerCase().includes(m)
}

/** Saldo van een zelf toegevoegde spaarrekening: startsaldo + overboekingen vanaf de betaalrekening na de startdatum. */
function manualBalance(acc, txs) {
  let bal = Number(acc.base_balance || 0)
  for (const t of txs) {
    if (!acc.base_date || t.booking_date <= acc.base_date) continue
    if (matchesAccount(t, acc)) bal -= Number(t.amount) // −50 van de betaalrekening = +50 op de spaarrekening
  }
  return Math.round(bal * 100) / 100
}

/**
 * Saldo zelf invullen (nieuw potje of corrigeren). booking_date heeft geen tijd, dus "alles na vandaag" zou overboekingen
 * van vandaag die later binnenkomen missen, en "alles vanaf vandaag" telt de overboekingen die al in het ingevulde saldo
 * zitten dubbel. Daarom: startdatum = gisteren, en de overboekingen van vandaag die we nu al kennen (`txs`, van de
 * betaalrekening) worden in het startsaldo verrekend. Alles wat hierna binnenkomt telt mee, Van én Naar.
 */
function rebaseManual(acc, balance, txs, today) {
  const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1)
  const base_date = d.toISOString().slice(0, 10)
  let base = Number(balance)
  for (const t of txs || []) if (t.booking_date > base_date && matchesAccount(t, acc)) base += Number(t.amount)
  return { base_date, base_balance: Math.round(base * 100) / 100 }
}

/**
 * Geboekte tegenhanger van een reservering kiezen uit `cands` (geboekte transacties van dezelfde rekening die nog
 * aan geen uitgave hangen). Zelfde teken; zelfde winkel of zelfde bedrag; geboekt 1 dag vóór t/m 7 dagen na de
 * reservering. `strict` (reservering staat nog bij de bank): zelfde bedrag én winkel en betaaldag ±1 dag.
 */
function pendingCounterpart(p, cands, { strict = false, claimed = new Set() } = {}) {
  const DAYMS = 86400000
  const pDay = Date.parse(p.booking_date)
  const same = (b) => normalizeCounterparty(b.counterparty) === normalizeCounterparty(p.counterparty)
  const eq = (b) => Math.abs(Number(b.amount) - Number(p.amount)) < 0.005
  const hits = (cands || []).filter(b => {
    if (claimed.has(b.id) || Math.sign(Number(b.amount)) !== Math.sign(Number(p.amount))) return false
    if (strict) {
      // Zelfde aankoop, niet een tweede aankoop van hetzelfde bedrag: zelfde betaaldag, en zelfde tijd als beide die noemen
      if (!eq(b) || !same(b) || paidDate(b) !== paidDate(p)) return false
      const tb = timeOf(b), tp = timeOf(p)
      return !tb || !tp || tb === tp
    }
    const diff = (Date.parse(b.booking_date) - pDay) / DAYMS
    return diff >= -1 && diff <= 7 && (same(b) || eq(b))
  })
  const score = (b) => (eq(b) ? 0 : 2) + (same(b) ? 0 : 1) + Math.abs(Number(b.amount) - Number(p.amount)) / 1000
  return hits.sort((a, b) => score(a) - score(b))[0] || null
}

const timeOf = (tx) => (String(tx.description || '').match(/Tijd:\s*(\d{1,2}:\d{2})/i) || [])[1] || null

/** Soort van een bestaande uitgave terugrekenen (voor toExpense). */
function expenseKind(e) {
  if (e.is_income) return 'inkomen'
  if (e.is_savings_contribution) return 'spaarstorting'
  if (e.is_savings_withdrawal) return 'spaaropname'
  return Number(e.amount) < 0 ? 'terugbetaling' : 'uitgave'
}

/**
 * Reservering is geboekt: de uitgave van de reservering hoort voortaan bij de geboekte transactie (zelfde id).
 * Bedrag en datum komen van de boeking; categorie, soort, "van spaargeld" en een zelf aangepaste omschrijving blijven.
 */
function carryOverPatch(exp, p, booked) {
  const kind = expenseKind(exp)
  const fresh = toExpense(booked, kind, exp.category, exp.user_id)
  const auto = toExpense(p, kind, exp.category, exp.user_id).description
  return { amount: fresh.amount, date: fresh.date, ...(exp.description === auto && fresh.description ? { description: fresh.description } : {}) }
}

/**
 * Echte betaaldatum: ING boekt pinbetalingen vaak 1–3 dagen later (buitenland, weekend). Gebruik de
 * transactiedatum van de bank, of de datum in de omschrijving ("Datum: 02-10-2026", "02-10-2026 15:56"),
 * mits die 0–10 dagen vóór de boekdatum ligt.
 */
function paidDate(tx) {
  const book = tx.booking_date
  const ok = (d) => d && d <= book && (Date.parse(book) - Date.parse(d)) / 86400000 <= 10
  if (ok(tx.paid_date)) return tx.paid_date
  const m = String(tx.description || '').match(/(?:datum:?\s*)?\b(\d{2})-(\d{2})-(\d{4})\b(?=\s*(?:tijd|\d{2}:\d{2}|$|\s))/i)
  if (m) { const d = `${m[3]}-${m[2]}-${m[1]}`; if (ok(d)) return d }
  return book
}

/** Banktransactie → rij voor `expenses`. */
function toExpense(tx, kind, category, userId) {
  const amount = Math.round(Math.abs(Number(tx.amount)) * 100) / 100
  const who = (tx.counterparty || '').trim()
  const what = (tx.description || '').trim()
  const description = (who && what && !what.toLowerCase().includes(who.toLowerCase()) ? `${who} · ${what}` : who || what).slice(0, 120)
  const base = { user_id: userId, amount, date: paidDate(tx), is_income: false, is_savings_withdrawal: false }
  if (kind === 'inkomen') return { ...base, is_income: true, category: category || 'overig', description: description || 'Inkomen' }
  if (kind === 'spaarstorting') return { ...base, is_savings_contribution: true, category: 'overig', description: '🏦 Spaarstorting' }
  if (kind === 'spaaropname') return { ...base, is_savings_withdrawal: true, savings_type: 'saved', category: 'overig', description: description || 'Spaaropname' }
  // Terugbetaling: negatieve uitgave in de categorie waarvoor je voorschoot (verlaagt die uitgaven)
  if (kind === 'terugbetaling') return { ...base, amount: -amount, category: category || 'overig', description: `↩ ${description || 'Terugbetaling'}`.slice(0, 120) }
  return { ...base, category: category || 'overig', description }
}

/**
 * Transactie verwerken. action 'add' → uitgave aanmaken (+ categorie onthouden als die afwijkt van het voorstel),
 * 'ignore' → negeren. `db` = Supabase-client (service key of ingelogde gebruiker).
 * Al toegevoegd (status added) + 'add' = opnieuw verwerken: de gekoppelde uitgave wordt omgezet naar de nieuwe
 * soort/categorie (datum en "van spaargeld" blijven). Al toegevoegd + 'ignore' = gekoppelde uitgave weg, negeren.
 */
async function processTransaction(db, userId, id, { action, category, kind } = {}) {
  const { data: tx, error } = await db.from('bank_transactions').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!tx) throw new Error('Banktransactie niet gevonden')
  if (action === 'ignore') {
    let removed = null
    // Door de bank aangemaakte uitgave (added/reservering) opruimen; bij matched hoort de uitgave bij je eigen invoer en blijft hij
    if (tx.expense_id && (tx.status === 'added' || tx.status === 'pending')) {
      const { data: gone, error: ed } = await db.from('expenses').delete().eq('id', tx.expense_id).eq('user_id', userId).select('id').maybeSingle()
      if (ed) throw new Error(ed.message)
      removed = gone?.id || null
    }
    const { error: e } = await db.from('bank_transactions').update({ status: 'ignored', expense_id: null }).eq('id', id)
    if (e) throw new Error(e.message)
    return { id, status: 'ignored', previous_status: tx.status, ...(removed ? { deleted_expense_id: removed } : {}) }
  }
  if (action !== 'add') throw new Error('action moet add of ignore zijn')
  const useKind = kind || tx.suggested_kind || (tx.amount > 0 ? 'inkomen' : 'uitgave')
  const useCat = category || tx.suggested_category || 'overig'
  if (useKind === 'intern') throw new Error('Interne overboeking: gebruik ignore, of geef een kind mee')

  // Opnieuw verwerken: bestaande gekoppelde uitgave omzetten (alle soort-vlaggen expliciet, zodat er geen oude blijft hangen)
  if (tx.status === 'added' && tx.expense_id) {
    const { data: cur } = await db.from('expenses').select('*').eq('id', tx.expense_id).eq('user_id', userId).maybeSingle()
    if (cur) {
      const fresh = toExpense(tx, useKind, useCat, userId)
      const patch = { amount: fresh.amount, category: fresh.category, description: fresh.description,
        is_income: !!fresh.is_income, is_savings_withdrawal: !!fresh.is_savings_withdrawal,
        is_savings_contribution: !!fresh.is_savings_contribution, is_loan_repayment: false,
        ...(fresh.savings_type ? { savings_type: fresh.savings_type } : {}) }
      // Inkomen/spaaracties zijn nooit "van spaargeld betaald"
      if (useKind !== 'uitgave' && useKind !== 'terugbetaling') patch.paid_from_savings = false
      const { data: upd, error: eu } = await db.from('expenses').update(patch).eq('id', cur.id).eq('user_id', userId).select().single()
      if (eu) throw new Error(eu.message)
      await learnRule(db, userId, tx, category, useKind)
      const view = (e) => ({ amount: Number(e.amount), category: e.category, is_income: !!e.is_income, description: e.description })
      return { id, status: 'added', reprocessed: true, expense_id: cur.id, kind: useKind, category: upd.category, before: view(cur), after: view(upd) }
    }
  }
  const { data: exp, error: e1 } = await db.from('expenses').insert(toExpense(tx, useKind, useCat, userId)).select().single()
  if (e1) throw new Error(e1.message)
  const { error: e2 } = await db.from('bank_transactions').update({ status: 'added', expense_id: exp.id }).eq('id', id)
  if (e2) throw new Error(e2.message)
  await learnRule(db, userId, tx, category, useKind)
  return { id, status: 'added', expense_id: exp.id, kind: useKind, category: useCat, previous_status: tx.status }
}

async function learnRule(db, userId, tx, category, useKind) {
  // Andere categorie gekozen dan voorgesteld → onthouden voor deze tegenpartij
  const key = normalizeCounterparty(tx.counterparty)
  if (key && category && category !== tx.suggested_category && (useKind === 'uitgave' || useKind === 'inkomen')) {
    const { data: cfg } = await db.from('budget_config').select('bank_rules').eq('user_id', userId).maybeSingle()
    if (cfg) await db.from('budget_config').update({ bank_rules: { ...(cfg.bank_rules || {}), [key]: category } }).eq('user_id', userId)
  }
}

/**
 * Uitgave wordt verwijderd → gekoppelde banktransacties bijwerken, zodat ze niet "added" blijven zonder uitgave:
 * added/reservering → ignored (een volgende sync voegt ze niet opnieuw toe), matched → new (weer in de inbox,
 * want je eigen invoer bestaat niet meer). Aanroepen vóór het verwijderen (de FK zet expense_id anders op null).
 */
async function unlinkExpense(db, userId, expenseId) {
  const { data: txs } = await db.from('bank_transactions').select('id, status').eq('user_id', userId).eq('expense_id', expenseId)
  const out = []
  for (const t of txs || []) {
    const status = t.status === 'matched' ? 'new' : 'ignored'
    await db.from('bank_transactions').update({ status, expense_id: null }).eq('id', t.id)
    out.push({ id: t.id, from: t.status, to: status })
  }
  return out
}

module.exports = { paidDate, suggest, toExpense, processTransaction, unlinkExpense, atmCounterparty, normalizeCounterparty, matchesAccount, manualBalance, rebaseManual, pendingCounterpart, carryOverPatch, expenseKind, isSavingsTransfer, isRepayment }
