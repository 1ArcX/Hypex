import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useGeldStore } from '../store/geldStore'

// Bankkoppeling (ING via Enable Banking, alleen-lezen). Saldo's en de inbox komen rechtstreeks uit
// Supabase; koppelen en synchroniseren gaan via de Netlify-functie `bank` (netlify/functions/bank/bank.js).
// Bij openen max. één keer per uur een sync; 's ochtends synchroniseert pg_cron op de achtergrond.

export interface BankAccount {
  uid: string; name: string | null; iban: string | null; kind: 'betaal' | 'spaar'
  balance: number | null; currency: string | null; balance_at: string | null; hidden: boolean
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
  const [conn, setConn] = useState<BankConnection>({ status: 'none', valid_until: null, last_synced_at: null, last_error: null })
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [inbox, setInbox] = useState<BankTx[]>([])
  const [matched, setMatched] = useState<BankTx[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false) // migratie add_bank_sync.sql nog niet gedraaid

  const load = useCallback(async () => {
    const [c, a, t, m] = await Promise.all([
      supabase.from('bank_connections').select('status, valid_until, last_synced_at, last_error').eq('user_id', userId).maybeSingle(),
      supabase.from('bank_accounts').select('*').eq('user_id', userId).order('kind').order('name'),
      supabase.from('bank_transactions').select('*').eq('user_id', userId).eq('status', 'new').order('booking_date', { ascending: false }).limit(200),
      supabase.from('bank_transactions').select('*').eq('user_id', userId).eq('status', 'matched').order('booking_date', { ascending: false }).limit(20),
    ])
    if (c.error && /bank_connections|does not exist|PGRST205/i.test(`${c.error.message} ${c.error.code}`)) { setMissing(true); setLoading(false); return null }
    const next = (c.data as BankConnection) || { status: 'none', valid_until: null, last_synced_at: null, last_error: null }
    setConn(next)
    setAccounts((a.data as BankAccount[]) || [])
    setInbox((t.data as BankTx[]) || [])
    setMatched((m.data as BankTx[]) || [])
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
  const disconnect = () => run(() => callBank('disconnect'))

  const add = (tx: BankTx, category?: string, kind?: string) => run(async () => {
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
  const setKind = (acc: BankAccount, kind: 'betaal' | 'spaar') => run(async () => {
    await supabase.from('bank_accounts').update({ kind }).eq('uid', acc.uid)
  })

  const visible = accounts.filter(a => !a.hidden)
  const savingsTotal = visible.filter(a => a.kind === 'spaar').reduce((s, a) => s + Number(a.balance || 0), 0)
  const checking = visible.filter(a => a.kind === 'betaal')
  const checkingBalance = checking.length ? checking.reduce((s, a) => s + Number(a.balance || 0), 0) : null
  const daysLeft = conn.valid_until ? Math.ceil((new Date(conn.valid_until).getTime() - Date.now()) / 86400000) : null

  return {
    loading, busy, error, missing, conn, accounts: visible, inbox, matched, savingsTotal, checkingBalance, daysLeft,
    connected: conn.status === 'active' || conn.status === 'expired' || conn.status === 'error',
    connect, refresh, disconnect, add, ignore, ignoreBefore, unmatch, setKind,
  }
}
export type BankState = ReturnType<typeof useBank>
