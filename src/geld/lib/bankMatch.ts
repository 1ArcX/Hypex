// Eigen invoer (expenses) slim vergelijken met banktransacties (bank-inbox).
// Alles als "uitstroom van de betaalrekening": uitgave/spaarstorting = +, inkomen/spaaropname = −.
// Eén eigen invoer kan bij meerdere bankbetalingen horen (bv. "Eten €15,70" = twee pinbetalingen min een Tikkie):
// we zoeken een combinatie van transacties rond die dag die precies op het bedrag uitkomt.

import type { Expense } from '../types'

export interface MatchTx { id: string; booking_date: string; amount: number }
export interface GroupMatch<T extends MatchTx> { expense: Expense; txs: T[] }

const DAY = 86400000
const MAX_CANDIDATES = 14 // 2^14 combinaties per invoer is nog snel
const TOL = 0.005

const cents = (x: number) => Math.round(x * 100)
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY)

/** Uitstroom van de betaalrekening volgens je eigen invoer (+ = geld eruit). */
export function ownValue(e: Expense): number {
  const a = Math.abs(Number(e.amount))
  if (e.is_income || e.is_savings_withdrawal) return -a
  return Number(e.amount) // gewone uitgave, spaarstorting, aflossing (negatief = terugbetaling, dus instroom)
}
/** Uitstroom volgens de bank (bank: − = af). */
export const txValue = (t: MatchTx) => -Number(t.amount)

/** Bankboekingen komen vaak 0–2 dagen na de betaaldag binnen; een dag eerder kan ook (tijdzones/afronding). */
const inWindow = (expenseDate: string, bookingDate: string) => {
  const d = daysBetween(expenseDate, bookingDate)
  return d >= -1 && d <= 3
}

/** Kleinste combinatie van kandidaten waarvan de som op `target` uitkomt (in centen), of null. */
function subsetSum<T extends MatchTx>(cands: T[], target: number): T[] | null {
  const vals = cands.map(c => cents(txValue(c)))
  const goal = cents(target)
  let best: number[] | null = null
  const n = cands.length
  const walk = (i: number, sum: number, picked: number[]) => {
    if (best && picked.length >= best.length) return
    if (picked.length && Math.abs(sum - goal) <= cents(TOL)) { best = [...picked]; return }
    if (i >= n) return
    picked.push(i); walk(i + 1, sum + vals[i], picked); picked.pop()
    walk(i + 1, sum, picked)
  }
  walk(0, 0, [])
  return best ? (best as number[]).map(i => cands[i]) : null
}

/**
 * Voorstellen: welke banktransacties horen samen bij welke eigen invoer.
 * Ook 1-op-1 (de server koppelt alleen exact gelijke bedragen binnen 2 dagen), met minstens één transactie
 * in dezelfde richting als de invoer. Elke transactie hooguit één keer.
 */
export function suggestGroups<T extends MatchTx>(entries: Expense[], txs: T[]): GroupMatch<T>[] {
  const used = new Set<string>()
  const out: GroupMatch<T>[] = []
  const near = (e: Expense, t: T) => Math.abs(daysBetween(e.date, t.booking_date))
  // 1) Exact hetzelfde bedrag eerst (dichtstbijzijnde dag), zodat een samengestelde invoer die niet inpikt
  const rest: Expense[] = []
  for (const e of entries) {
    const target = cents(ownValue(e))
    const one = txs.filter(t => !used.has(t.id) && inWindow(e.date, t.booking_date) && cents(txValue(t)) === target)
      .sort((a, b) => near(e, a) - near(e, b))[0]
    if (one) { used.add(one.id); out.push({ expense: e, txs: [one] }) } else rest.push(e)
  }
  // 2) Combinaties; grootste bedragen eerst (die zijn het vaakst samengesteld)
  const sorted = rest.sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
  for (const e of sorted) {
    const target = ownValue(e)
    const cands = txs.filter(t => !used.has(t.id) && inWindow(e.date, t.booking_date))
      .sort((a, b) => Math.abs(daysBetween(e.date, a.booking_date)) - Math.abs(daysBetween(e.date, b.booking_date)))
      .slice(0, MAX_CANDIDATES)
    if (!cands.length) continue
    const hit = subsetSum(cands, target)
    if (!hit) continue
    if (!hit.some(t => Math.sign(txValue(t)) === Math.sign(target))) continue
    hit.forEach(t => used.add(t.id))
    out.push({ expense: e, txs: hit })
  }
  return out
}

/** Eigen invoer die bij een transactie zou kunnen horen (zelfde richting, rond dezelfde dag) — voor handmatig koppelen. */
export function entriesNear(entries: Expense[], tx: MatchTx): Expense[] {
  return entries.filter(e => inWindow(e.date, tx.booking_date) && Math.sign(ownValue(e)) === Math.sign(txValue(tx)))
}
