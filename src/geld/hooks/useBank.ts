import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useGeldStore, type BankDetail } from '../store/geldStore'
import type { Expense } from '../types'
import { suggestGroups, type GroupMatch } from '../lib/bankMatch'

// Bankkoppeling (ING via Enable Banking, alleen-lezen). Saldo's en de inbox komen rechtstreeks uit
// Supabase; koppelen en synchroniseren gaan via de Netlify-functie `bank` (netlify/functions/bank/bank.js).
// Bij openen max. één keer per uur een sync; 's ochtends synchroniseert pg_cron op de achtergrond.

export interface BankAccount {
  uid: string; name: string | null; iban: string | null; kind: 'betaal' | 'spaar'
  balance: number | null; currency: string | null; balance_at: string | null; hidden: boolean
  manual?: boolean; base_balance?: number | null; base_date?: string | null; match?: string | null; goal?: number | null
}
export interface BankTx {
  id: string; account_uid: string; booking_date: string; amount: number
  counterparty: string | null; description: string | null
  status: 'new' | 'added' | 'ignored' | 'matched'
  suggested_kind: 'uitgave' | 'inkomen' | 'spaarstorting' | 'spaaropname' | 'intern' | null
  suggested_category: string | null; expense_id: string | null
}
export interface BankConnection {
  status: 'none' | 'pending' | 'active' | 'expired' | 'error' | 'disconnected'
  valid_until: string | null; last_synced_at: string | null; last_error: string | null
}

interface MatchRow { booking_date: string; amount: number; counterparty: string | null; counterparty_iban: string | null; account_uid: string }
const norm = (s: string | null | undefined) => String(s || '').replace(/\s/g, '').toUpperCase()
/** Zelfde regels als matchesAccount/manualBalance in netlify/functions/bank/bankCore.js. */
function matchesAccount(t: MatchRow, a: BankAccount) {
  if (a.iban && t.counterparty_iban && norm(a.iban) === norm(t.counterparty_iban)) return true
  const m = String(a.match || '').trim().toLowerCase()
  if (!m) return false
  if (/^[a-z]{2}\d{2}[a-z0-9]{8,}$/.test(m.replace(/\s/g, ''))) return norm(m) === norm(t.counterparty_iban)
  return String(t.counterparty || '').toLowerCase().includes(m)
}
function manualBalance(a: BankAccount, txs: MatchRow[]) {
  let bal = Number(a.base_balance || 0)
  for (const t of txs) if (a.base_date && t.booking_date > a.base_date && matchesAccount(t, a)) bal -= Number(t.amount)
  return Math.round(bal * 100) / 100
}

const REVIEW_KEY = 'bank_reviewed_expenses'
const reviewedLocal = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]')) } catch { return new Set() } }
const saveReviewedLocal = (s: Set<string>) => { try { localStorage.setItem(REVIEW_KEY, JSON.stringify([...s].slice(-500))) } catch { /* privémodus */ } }

// Zie src/utils/bankCallback.js (App.jsx bewaart de code bij terugkeer uit de bank)
const CALLBACK_KEY = 'bank_callback'
const HOUR = 3600000

async function callBank(action: string, extra: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch('/.netlify/functions/bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...extra }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Bank: fout ${res.status}`)
  return json
}

/** Banktransactie → rij voor `expenses` (zelfde regels als bankCore.toExpense op de server). */
function toExpense(tx: BankTx, kind: string, category: string, userId: string) {
  const amount = Math.round(Math.abs(Number(tx.amount)) * 100) / 100
  const who = (tx.counterparty || '').trim(), what = (tx.description || '').trim()
  const description = (who && what && !what.toLowerCase().includes(who.toLowerCase()) ? `${who} · ${what}` : who || what).slice(0, 120)
  const base = { user_id: userId, amount, date: tx.booking_date, is_income: false, is_savings_withdrawal: false }
  if (kind === 'inkomen') return { ...base, is_income: true, category: category || 'overig', description: description || 'Inkomen' }
  if (kind === 'spaarstorting') return { ...base, is_savings_contribution: true, category: 'overig', description: '🏦 Spaarstorting' }
  if (kind === 'spaaropname') return { ...base, is_savings_withdrawal: true, savings_type: 'saved', category: 'overig', description: description || 'Spaaropname' }
  return { ...base, category: category || 'overig', description }
}
const ruleKey = (s: string | null) => String(s || '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ&.\- ]/g, ' ')
  .replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')

export function useBank(userId: string) {
  const refreshGeld = useGeldStore(s => s.refresh)
  const setBankByExpense = useGeldStore(s => s.setBankByExpense)
  const [conn, setConn] = useState<BankConnection>({ status: 'none', valid_until: null, last_synced_at: null, last_error: null })
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [inbox, setInbox] = useState<BankTx[]>([])
  const [matched, setMatched] = useState<BankTx[]>([])
  // Slim vergelijken: eigen invoer (expenses) die nog aan geen banktransactie hangt
  const [ownOpen, setOwnOpen] = useState<Expense[]>([])
  const [firstBankDate, setFirstBankDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false) // migratie add_bank_sync.sql nog niet gedraaid

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)
    const [c, a, t, m, linked] = await Promise.all([
      supabase.from('bank_connections').select('status, valid_until, last_synced_at, last_error').eq('user_id', userId).maybeSingle(),
      supabase.from('bank_accounts').select('*').eq('user_id', userId).order('kind').order('name'),
      supabase.from('bank_transactions').select('*').eq('user_id', userId).eq('status', 'new').order('booking_date', { ascending: false }).limit(200),
      supabase.from('bank_transactions').select('*').eq('user_id', userId).eq('status', 'matched').order('booking_date', { ascending: false }).limit(20),
      // Banktransacties die aan een uitgave hangen → ING-gegevens in de transactierijen
      supabase.from('bank_transactions').select('id, booking_date, amount, counterparty, counterparty_iban, description, expense_id, account_uid')
        .eq('user_id', userId).not('expense_id', 'is', null).gte('booking_date', since).limit(2000),
    ])
    if (c.error && /bank_connections|does not exist|PGRST205/i.test(`${c.error.message} ${c.error.code}`)) { setMissing(true); setLoading(false); return null }
    const next = (c.data as BankConnection) || { status: 'none', valid_until: null, last_synced_at: null, last_error: null }
    setConn(next)
    let accs = (a.data as BankAccount[]) || []
    const manual = accs.filter(x => x.manual && x.base_date)
    if (manual.length) {
      const from = manual.map(x => x.base_date as string).sort()[0]
      const real = new Set(accs.filter(x => !x.manual).map(x => x.uid))
      const { data: txs } = await supabase.from('bank_transactions').select('booking_date, amount, counterparty, counterparty_iban, account_uid')
        .eq('user_id', userId).gt('booking_date', from)
      const own = ((txs || []) as MatchRow[]).filter(t => real.has(t.account_uid))
      accs = accs.map(x => x.manual && x.base_date ? { ...x, balance: manualBalance(x, own) } : x)
    }
    setAccounts(accs)
    setInbox((t.data as BankTx[]) || [])
    setMatched((m.data as BankTx[]) || [])
    const inboxRows = (t.data as BankTx[]) || []
    const monthStart = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })()
    const minInbox = inboxRows.map(x => x.booking_date).sort()[0]
    const from = new Date(Date.parse((minInbox && minInbox < monthStart ? minInbox : monthStart)) - 4 * 86400000).toISOString().slice(0, 10)
    const [own, link, first] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId).gte('date', from).order('date', { ascending: false }).limit(1000),
      supabase.from('bank_transactions').select('expense_id').eq('user_id', userId).not('expense_id', 'is', null).gte('booking_date', from),
      supabase.from('bank_transactions').select('booking_date').eq('user_id', userId).order('booking_date', { ascending: true }).limit(1),
    ])
    const linkedIds = new Set(((link.data || []) as { expense_id: string }[]).map(x => x.expense_id))
    const checked = reviewedLocal()
    setOwnOpen(((own.data || []) as (Expense & { bank_checked?: boolean })[])
      .filter(e => !e.is_planned && !linkedIds.has(e.id) && !e.bank_checked && !checked.has(e.id)))
    setFirstBankDate(((first.data || []) as { booking_date: string }[])[0]?.booking_date || null)
    const names = new Map(((a.data as BankAccount[]) || []).map(x => [x.uid, x.name]))
    const byExp: Record<string, BankDetail[]> = {}
    for (const r of (linked.data || []) as (BankDetail & { expense_id: string; account_uid: string })[]) {
      (byExp[r.expense_id] ||= []).push({ ...r, amount: Number(r.amount), account_name: names.get(r.account_uid) || null })
    }
    setBankByExpense(byExp)
    setLoading(false)
    return next
  }, [userId])

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    await load()
    setBusy(false)
  }, [load])

  // Bij openen: eerst een eventuele terugkeer uit de bank-autorisatie afhandelen, anders zo nodig synchroniseren
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let cb: { code?: string; state?: string; error?: string } | null = null
      try { cb = JSON.parse(sessionStorage.getItem(CALLBACK_KEY) || 'null') } catch { cb = null }
      if (cb) {
        sessionStorage.removeItem(CALLBACK_KEY)
        if (cb.error || !cb.code) { setError(`Koppelen afgebroken${cb.error ? ` (${cb.error})` : ''}`); await load(); return }
        await run(() => callBank('callback', { code: cb!.code, state: cb!.state }))
        refreshGeld()
        return
      }
      const c = await load()
      if (cancelled || !c) return
      const stale = !c.last_synced_at || Date.now() - new Date(c.last_synced_at).getTime() > HOUR
      if (c.status === 'active' && stale) await run(() => callBank('sync'))
    })()
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = () => run(async () => {
    const { url } = await callBank('start')
    if (url) window.location.href = url
  })
  const refresh = () => run(() => callBank('sync', { force: true }))
  /** Oudere transacties (tot 12 maanden) ophalen. Banken staan dat vaak alleen vlak na opnieuw inloggen toe. */
  const [historyNote, setHistoryNote] = useState<string | null>(null)
  const fetchHistory = (from: string) => run(async () => {
    setHistoryNote(null)
    const r = await callBank('history', { from })
    const h = r?.history || {}
    setHistoryNote(h.history_limited
      ? 'ING gaf alleen de laatste 90 dagen. Koppel opnieuw (knop hieronder) en probeer het direct daarna nog eens.'
      : `${h.added || 0} oudere transacties opgehaald.`)
  })
  const disconnect = () => run(() => callBank('disconnect'))

  const addTx = async (tx: BankTx, category?: string, kind?: string) => {
    const useKind = kind || tx.suggested_kind || (tx.amount > 0 ? 'inkomen' : 'uitgave')
    const useCat = category || tx.suggested_category || 'overig'
    const { data: exp, error: e1 } = await supabase.from('expenses').insert(toExpense(tx, useKind, useCat, userId)).select().single()
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await supabase.from('bank_transactions').update({ status: 'added', expense_id: exp.id }).eq('id', tx.id)
    if (e2) throw new Error(e2.message)
    // Andere categorie gekozen → onthouden voor deze tegenpartij
    const key = ruleKey(tx.counterparty)
    if (key && category && category !== tx.suggested_category && (useKind === 'uitgave' || useKind === 'inkomen')) {
      const { data: cfg } = await supabase.from('budget_config').select('bank_rules').eq('user_id', userId).maybeSingle()
      if (cfg) await supabase.from('budget_config').update({ bank_rules: { ...((cfg as { bank_rules?: Record<string, string> }).bank_rules || {}), [key]: category } }).eq('user_id', userId)
    }
  }
  const add = (tx: BankTx, category?: string, kind?: string) => run(async () => { await addTx(tx, category, kind); refreshGeld() })

  // ── Slim vergelijken met je eigen invoer ──
  /** Klopt: deze banktransacties horen bij je eigen invoer (die blijft staan). */
  const linkTxs = (expense: Expense, txs: BankTx[]) => run(async () => {
    const { error: e } = await supabase.from('bank_transactions').update({ status: 'matched', expense_id: expense.id }).in('id', txs.map(x => x.id))
    if (e) throw new Error(e.message)
  })
  /** Gebruik ING: je eigen invoer verwijderen en de banktransacties los toevoegen (met hun voorgestelde categorie). */
  const replaceWithBank = (expense: Expense, txs: BankTx[]) => run(async () => {
    const { error: e } = await supabase.from('expenses').delete().eq('id', expense.id).eq('user_id', userId)
    if (e) throw new Error(e.message)
    for (const t of txs) await addTx(t)
    refreshGeld()
  })
  /** Eigen invoer die niet op het afschrift staat maar klopt (bv. contant): niet meer tonen. */
  const markChecked = (expense: Expense) => run(async () => {
    const { error: e } = await supabase.from('expenses').update({ bank_checked: true }).eq('id', expense.id)
    if (e) { const s = reviewedLocal(); s.add(expense.id); saveReviewedLocal(s) } // migratie nog niet gedraaid → op dit apparaat onthouden
  })
  const deleteOwn = (expense: Expense) => run(async () => {
    const { error: e } = await supabase.from('expenses').delete().eq('id', expense.id).eq('user_id', userId)
    if (e) throw new Error(e.message)
    refreshGeld()
  })
  /**
   * Alleen ING voor een periode: je losse eigen invoer in [from, to] verwijderen en alle open banktransacties
   * in die periode toevoegen. (Gekoppelde invoer, geplande uitgaven en wat je als "klopt" markeerde blijven staan.)
   */
  /** Wat "Alleen ING" voor maand `ym` (YYYY-MM) zou doen: welke eigen invoer weg, welke banktransacties erbij. */
  const previewMonth = async (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    const from = `${ym}-01`, to = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    const [txRes, ownRes, linkRes] = await Promise.all([
      // Ook eerder genegeerde transacties (bv. "alles vóór 1 nov negeren"); interne overboekingen niet
      supabase.from('bank_transactions').select('*').eq('user_id', userId).in('status', ['new', 'ignored'])
        .gte('booking_date', from).lte('booking_date', to).order('booking_date'),
      supabase.from('expenses').select('*').eq('user_id', userId).gte('date', from).lte('date', to),
      supabase.from('bank_transactions').select('expense_id').eq('user_id', userId).not('expense_id', 'is', null),
    ])
    const linked = new Set(((linkRes.data || []) as { expense_id: string }[]).map(x => x.expense_id))
    const checked = reviewedLocal()
    const add = ((txRes.data || []) as BankTx[]).filter(t => t.suggested_kind !== 'intern')
    const del = ((ownRes.data || []) as (Expense & { bank_checked?: boolean })[])
      .filter(e => !e.is_planned && !linked.has(e.id) && !e.bank_checked && !checked.has(e.id))
    return { from, to, add, del }
  }
  const onlyBankMonth = (ym: string) => run(async () => {
    const { add: txs, del } = await previewMonth(ym)
    if (del.length) {
      const { error: e } = await supabase.from('expenses').delete().in('id', del.map(x => x.id)).eq('user_id', userId)
      if (e) throw new Error(e.message)
    }
    for (const t of txs) await addTx(t)
    refreshGeld()
  })
  /** Maanden waarvan de bank gegevens heeft (eerste boeking t/m nu), nieuwste eerst. */
  const bankMonths = (() => {
    if (!firstBankDate) return [] as string[]
    const out: string[] = []
    const d = new Date(), first = firstBankDate.slice(0, 7)
    for (let i = 0; i < 24; i++) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      out.push(ym)
      if (ym <= first) break
      d.setMonth(d.getMonth() - 1)
    }
    return out
  })()

  const onlyBank = (from: string, to: string) => run(async () => {
    const del = ownOpen.filter(e => e.date >= from && e.date <= to)
    if (del.length) {
      const { error: e } = await supabase.from('expenses').delete().in('id', del.map(x => x.id)).eq('user_id', userId)
      if (e) throw new Error(e.message)
    }
    for (const t of inbox.filter(x => x.booking_date >= from && x.booking_date <= to)) await addTx(t)
    refreshGeld()
  })
  const ignore = (tx: BankTx) => run(async () => {
    const { error: e } = await supabase.from('bank_transactions').update({ status: 'ignored' }).eq('id', tx.id)
    if (e) throw new Error(e.message)
  })
  /** "Al ingevoerd" klopt niet → terug naar de inbox. */
  /** Alles in de inbox van vóór `date` (YYYY-MM-DD) negeren — bv. de geschiedenis van de eerste koppeling. */
  const ignoreBefore = (date: string) => run(async () => {
    const { error: e } = await supabase.from('bank_transactions').update({ status: 'ignored' })
      .eq('user_id', userId).eq('status', 'new').lt('booking_date', date)
    if (e) throw new Error(e.message)
  })
  const unmatch = (tx: BankTx) => run(async () => {
    const { error: e } = await supabase.from('bank_transactions').update({ status: 'new', expense_id: null }).eq('id', tx.id)
    if (e) throw new Error(e.message)
  })
  /**
   * Spaarrekening die de bank niet deelt: startsaldo + overboekingen die op de betaalrekening te zien zijn.
   * `match` = IBAN of (deel van de) naam van de tegenpartij. Opnieuw opslaan = saldo corrigeren (nieuwe startdatum).
   */
  const saveManualSavings = (input: { uid?: string; name: string; balance: number; match: string; goal?: number | null }) => run(async () => {
    const today = new Date().toLocaleDateString('en-CA')
    const row = { name: input.name.trim() || 'Spaarrekening', kind: 'spaar', manual: true, base_balance: input.balance, base_date: today,
      balance: input.balance, balance_at: new Date().toISOString(), match: input.match.trim() || null, goal: input.goal || null,
      iban: /^[A-Z]{2}\d{2}[A-Z0-9]{8,}$/i.test(input.match.replace(/\s/g, '')) ? input.match.replace(/\s/g, '').toUpperCase() : null,
      updated_at: new Date().toISOString() }
    const res = input.uid
      ? await supabase.from('bank_accounts').update(row).eq('uid', input.uid)
      : await supabase.from('bank_accounts').insert({ ...row, uid: `manual-${crypto.randomUUID()}`, user_id: userId })
    if (res.error) throw new Error(/manual|base_|match|goal/.test(res.error.message) ? 'Draai eerst de migratie add_bank_manual_savings.sql in Supabase.' : res.error.message)
  })
  const removeManualSavings = (acc: BankAccount) => run(async () => {
    if (!acc.manual) return
    const { error: e } = await supabase.from('bank_accounts').delete().eq('uid', acc.uid)
    if (e) throw new Error(e.message)
  })
  /** Tegenpartijen van overboekingen die op een spaarrekening lijken (voor "herkennen aan"). */
  const savingsCandidates = async (): Promise<string[]> => {
    const { data } = await supabase.from('bank_transactions').select('counterparty, counterparty_iban')
      .eq('user_id', userId).order('booking_date', { ascending: false }).limit(1000)
    const seen = new Map<string, number>()
    for (const r of (data || []) as { counterparty: string | null; counterparty_iban: string | null }[]) {
      const label = r.counterparty_iban || r.counterparty
      if (!label) continue
      const hint = /spaar|saving|rente|deposito|oranje/i.test(r.counterparty || '')
      seen.set(label, (seen.get(label) || 0) + (hint ? 100 : 1))
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k)
  }

  const setKind = (acc: BankAccount, kind: 'betaal' | 'spaar') => run(async () => {
    await supabase.from('bank_accounts').update({ kind }).eq('uid', acc.uid)
  })

  // Voorstellen en "niet op afschrift" (eigen invoer van deze maand, ouder dan 3 dagen, zonder bijpassende transactie)
  const groups: GroupMatch<BankTx>[] = suggestGroups(ownOpen, inbox)
  const inGroup = new Set(groups.map(g => g.expense.id))
  const today = new Date()
  const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toLocaleDateString('en-CA')
  const notOnStatement = ownOpen.filter(e => !inGroup.has(e.id) && e.date >= monthStartStr && e.date <= threeDaysAgo
    && (!firstBankDate || e.date >= firstBankDate) && !e.is_savings_withdrawal)

  const visible = accounts.filter(a => !a.hidden)
  const savingsTotal = visible.filter(a => a.kind === 'spaar').reduce((s, a) => s + Number(a.balance || 0), 0)
  const checking = visible.filter(a => a.kind === 'betaal')
  const checkingBalance = checking.length ? checking.reduce((s, a) => s + Number(a.balance || 0), 0) : null
  const daysLeft = conn.valid_until ? Math.ceil((new Date(conn.valid_until).getTime() - Date.now()) / 86400000) : null

  return {
    loading, busy, error, missing, conn, accounts: visible, inbox, matched, savingsTotal, checkingBalance, daysLeft,
    connected: conn.status === 'active' || conn.status === 'expired' || conn.status === 'error',
    connect, refresh, disconnect, add, ignore, ignoreBefore, unmatch, setKind, fetchHistory, historyNote,
    saveManualSavings, removeManualSavings, savingsCandidates,
    ownOpen, groups, notOnStatement, linkTxs, replaceWithBank, markChecked, deleteOwn, onlyBank,
    previewMonth, onlyBankMonth, bankMonths, firstBankDate,
  }
}
export type BankState = ReturnType<typeof useBank>
