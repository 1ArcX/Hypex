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
  const own = (ctx.ownAccounts || []).find(a => a.iban && tx.counterparty_iban && a.iban.replace(/\s/g, '') === tx.counterparty_iban.replace(/\s/g, ''))
  // Bewegingen op een spaarrekening zelf: de tegenhanger staat al op de betaalrekening
  if (tx.account_kind === 'spaar') return { kind: 'intern', category: null, autoIgnore: true }
  if (own) {
    if (own.kind === 'spaar') return tx.amount < 0 ? { kind: 'spaarstorting', category: 'overig' } : { kind: 'spaaropname', category: 'overig' }
    return { kind: 'intern', category: null, autoIgnore: true } // tussen eigen betaalrekeningen
  }
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

/** Banktransactie → rij voor `expenses`. */
function toExpense(tx, kind, category, userId) {
  const amount = Math.round(Math.abs(Number(tx.amount)) * 100) / 100
  const who = (tx.counterparty || '').trim()
  const what = (tx.description || '').trim()
  const description = (who && what && !what.toLowerCase().includes(who.toLowerCase()) ? `${who} · ${what}` : who || what).slice(0, 120)
  const base = { user_id: userId, amount, date: tx.booking_date, is_income: false, is_savings_withdrawal: false }
  if (kind === 'inkomen') return { ...base, is_income: true, category: category || 'overig', description: description || 'Inkomen' }
  if (kind === 'spaarstorting') return { ...base, is_savings_contribution: true, category: 'overig', description: '🏦 Spaarstorting' }
  if (kind === 'spaaropname') return { ...base, is_savings_withdrawal: true, savings_type: 'saved', category: 'overig', description: description || 'Spaaropname' }
  return { ...base, category: category || 'overig', description }
}

/**
 * Transactie verwerken. action 'add' → uitgave aanmaken (+ categorie onthouden als die afwijkt van het voorstel),
 * 'ignore' → negeren. `db` = Supabase-client (service key of ingelogde gebruiker).
 */
async function processTransaction(db, userId, id, { action, category, kind } = {}) {
  const { data: tx, error } = await db.from('bank_transactions').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!tx) throw new Error('Banktransactie niet gevonden')
  if (tx.status === 'added' && action === 'add') throw new Error('Deze transactie is al toegevoegd')
  if (action === 'ignore') {
    const { error: e } = await db.from('bank_transactions').update({ status: 'ignored' }).eq('id', id)
    if (e) throw new Error(e.message)
    return { id, status: 'ignored' }
  }
  if (action !== 'add') throw new Error('action moet add of ignore zijn')
  const useKind = kind || tx.suggested_kind || (tx.amount > 0 ? 'inkomen' : 'uitgave')
  const useCat = category || tx.suggested_category || 'overig'
  const { data: exp, error: e1 } = await db.from('expenses').insert(toExpense(tx, useKind, useCat, userId)).select().single()
  if (e1) throw new Error(e1.message)
  const { error: e2 } = await db.from('bank_transactions').update({ status: 'added', expense_id: exp.id }).eq('id', id)
  if (e2) throw new Error(e2.message)
  // Andere categorie gekozen dan voorgesteld → onthouden voor deze tegenpartij
  const key = normalizeCounterparty(tx.counterparty)
  if (key && category && category !== tx.suggested_category && (useKind === 'uitgave' || useKind === 'inkomen')) {
    const { data: cfg } = await db.from('budget_config').select('bank_rules').eq('user_id', userId).maybeSingle()
    if (cfg) await db.from('budget_config').update({ bank_rules: { ...(cfg.bank_rules || {}), [key]: category } }).eq('user_id', userId)
  }
  return { id, status: 'added', expense_id: exp.id, kind: useKind, category: useCat }
}

module.exports = { suggest, toExpense, processTransaction, normalizeCounterparty }
