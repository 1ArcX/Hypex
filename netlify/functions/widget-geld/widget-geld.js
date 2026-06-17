// Geld-widget-eindpunt: nog te besteden deze maand / vandaag / deze week.
// Spiegelt de berekening uit src/geld (useBudgetStats + lib/budget + weekBudget).
// Beveiligd met dezelfde WIDGET_TOKEN. Tijd in Europe/Amsterdam.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const TOKEN = process.env.WIDGET_TOKEN
const USER_EMAIL = (process.env.WIDGET_USER_EMAIL || 'zhafirfachri@gmail.com').toLowerCase()

const TZ = 'Europe/Amsterdam'
const FIXED_CAT = 'abonnementen'
const DEFAULT_CAT_BUDGETS = { eten: 120, boodschappen: 80, transport: 40, kleding: 50, abonnementen: 30, sport: 20, overig: 60 }
const NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function pad(n) { return String(n).padStart(2, '0') }
function todayTZ() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }) }
function monthStart(y, m) { return `${y}-${pad(m + 1)}-01` }
function monthEnd(y, m) { return `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function sum(list) { return list.reduce((s, e) => s + Number(e.amount), 0) }

function isHistVac(e, vh) { return (vh || []).some(v => e.date >= v.start && e.date <= (v.end || v.start)) }
function filterRegular(list) {
  return list.filter(e => !e.is_savings_withdrawal && !e.is_income && !e.is_savings_contribution && !e.is_loan_repayment)
}
function filterBudget(regular, ctx) {
  return regular.filter(e =>
    !e.paid_from_savings &&
    (ctx.vac || e.category !== FIXED_CAT) &&
    (!e.is_planned || e.amount > 0) &&
    (!ctx.vac || !ctx.vacStart || e.date >= ctx.vacStart) &&
    (ctx.vac || !isHistVac(e, ctx.vh))
  )
}
function prevRegularFilter(list, vh) {
  return list.filter(e =>
    !e.is_savings_withdrawal && !e.is_income && !e.paid_from_savings &&
    !e.is_savings_contribution && !e.is_loan_repayment &&
    e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0) && !isHistVac(e, vh)
  )
}

function weekRemaining(budgetExp, adjustedRemaining, daysInMonth, selY, selM, todayStr) {
  const t = new Date(todayStr + 'T00:00:00')
  const dow = t.getDay()
  const ws = new Date(t); ws.setDate(t.getDate() - (dow === 5 ? 0 : dow === 6 ? 1 : dow + 2)); ws.setHours(0, 0, 0, 0)
  const weekStartStr = toISO(ws)
  const spentSoFar = sum(budgetExp.filter(e => e.date >= weekStartStr && e.date <= todayStr))
  const monthEndDate = new Date(selY, selM, daysInMonth)
  let weeksLeft = 0; const c = new Date(ws)
  while (c <= monthEndDate) { weeksLeft++; c.setDate(c.getDate() + 7) }
  const remainingWeeks = Math.max(1, weeksLeft)
  const allowance = Math.round((Math.max(0, adjustedRemaining) / remainingWeeks) * 100) / 100
  return Math.round((allowance - spentSoFar) * 100) / 100
}

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token
  if (!TOKEN) return resp(500, { error: 'WIDGET_TOKEN niet ingesteld' })
  if (token !== TOKEN) return resp(401, { error: 'unauthorized' })

  let uid = null
  try {
    const { data } = await supabase.auth.admin.listUsers()
    uid = data?.users?.find(u => (u.email || '').toLowerCase() === USER_EMAIL)?.id
  } catch { /* ignore */ }
  if (!uid) return resp(404, { error: 'gebruiker niet gevonden' })

  const todayStr = todayTZ()
  const selY = parseInt(todayStr.slice(0, 4), 10)
  const selM = parseInt(todayStr.slice(5, 7), 10) - 1
  const dayOfMonth = parseInt(todayStr.slice(8, 10), 10)

  const pY = selM - 1 < 0 ? selY - 1 : selY
  const pM = (selM - 1 + 12) % 12

  const [cfgRes, yearRes, prevRes] = await Promise.all([
    supabase.from('budget_config').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('expenses').select('*').eq('user_id', uid).gte('date', `${selY}-01-01`).lte('date', `${selY}-12-31`),
    supabase.from('expenses').select('*').eq('user_id', uid).gte('date', monthStart(pY, pM)).lte('date', monthEnd(pY, pM)),
  ])
  const config = cfgRes.data || {}
  const yearExpenses = yearRes.data || []
  const prevExpenses = prevRes.data || []

  const vac = !!config.vacation_mode
  const base = (vac && (config.vacation_budget || 0) > 0) ? config.vacation_budget : (config.monthly_budget || 400)
  const catBudgets = config.category_budgets || DEFAULT_CAT_BUDGETS
  const vh = config.vacation_history || []
  const recoveryMonths = config.recovery_months || 3
  const vasteLasten = catBudgets[FIXED_CAT] || 0
  const variableBase = Math.max(0, base - vasteLasten)

  const monthS = monthStart(selY, selM), monthE = monthEnd(selY, selM)
  const monthExp = yearExpenses.filter(e => e.date >= monthS && e.date <= monthE)
  const ctx = { vac, vacStart: config.vacation_start || null, vh }
  const budgetExp = filterBudget(filterRegular(monthExp), ctx)
  const totalSpent = sum(budgetExp)
  const todayTotal = sum(budgetExp.filter(e => e.date === todayStr))

  // carryover
  let carryover = 0
  if (!vac) {
    const prevSpent = sum(prevRegularFilter(prevExpenses, vh))
    for (let i = 1; i <= recoveryMonths; i++) {
      const ppY = (selM - i) < 0 ? selY - 1 : selY
      const ppM = ((selM - i) % 12 + 12) % 12
      if (ppY === 2026 && ppM <= 2) continue
      let pSpent = 0
      if (i === 1) pSpent = prevSpent
      else if (ppY === selY) {
        const s = monthStart(ppY, ppM), e2 = monthEnd(ppY, ppM)
        pSpent = sum(prevRegularFilter(yearExpenses.filter(e => e.date >= s && e.date <= e2), vh))
      }
      carryover += Math.max(0, pSpent - variableBase) / recoveryMonths
    }
  }

  const adjustedBase = vac ? base : Math.max(0, variableBase - carryover)
  const adjustedRemaining = adjustedBase - totalSpent

  // dagen
  let daysInMonth = new Date(selY, selM + 1, 0).getDate()
  let daysLeft = daysInMonth - dayOfMonth + 1
  if (vac && config.vacation_start && config.vacation_end) {
    const vs = new Date(config.vacation_start + 'T00:00:00'), ve = new Date(config.vacation_end + 'T00:00:00')
    const t = new Date(todayStr + 'T00:00:00')
    daysInMonth = Math.max(1, Math.round((ve - vs) / 86400000) + 1)
    daysLeft = Math.max(1, Math.round((ve - t) / 86400000) + 1)
  }
  const dagBudget = adjustedRemaining > 0 ? adjustedRemaining / daysLeft : 0

  return resp(200, {
    month: Math.round(adjustedRemaining),
    today: Math.round(dagBudget - todayTotal),
    week: Math.round(weekRemaining(budgetExp, adjustedRemaining, daysInMonth, selY, selM, todayStr)),
    base: Math.round(adjustedBase),
    spent: Math.round(totalSpent),
    daysLeft,
    vacation: vac,
    label: `${NL_MONTHS[selM]} ${selY}`,
    generatedAt: new Date().toISOString(),
  })
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    body: JSON.stringify(obj),
  }
}
