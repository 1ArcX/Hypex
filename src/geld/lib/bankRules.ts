// Zelfde herkenning als netlify/functions/bank/bankCore.js (isSavingsTransfer / isRepayment), voor de app
// (opschonen van eerder verkeerd geïmporteerde transacties). Houd beide gelijk.

interface Tx { counterparty: string | null; description?: string | null; amount: number }

const SAVINGS_RE = /oranje\s*spaarrekening|spaarrekening\s+[a-z]\d{6,}|\bspaarrekening\b.*\b[a-z]\d{7,}\b/i
const COMPANY_RE = /\b(b\.?v\.?|n\.?v\.?|bv|duo|belastingdienst|gemeente|svb|uwv|adecco|connexxion|randstad|tempo-team|zorgverzeker|bank|stichting|vof|holding|salaris|loon)\b/i

/** Overboeking met een eigen ING-spaarrekening ("Oranje spaarrekening F12156498"): alleen geld verschuiven. */
export const isSavingsTransfer = (tx: Tx) => SAVINGS_RE.test(`${tx.counterparty || ''} ${tx.description || ''}`)

/** Terugbetaling van iemand (Tikkie of overboeking van een persoon) — geen bedrijf/instantie. */
export function isRepayment(tx: Tx) {
  if (tx.amount <= 0) return false
  const text = `${tx.counterparty || ''} ${tx.description || ''}`
  if (COMPANY_RE.test(text) || isSavingsTransfer(tx)) return false
  if (/tikkie/i.test(text)) return true
  return /^(hr|mw|dhr|mevr|mr|mrs)\.?\s|^([a-z]\.){1,4}\s?[a-z]/i.test((tx.counterparty || '').trim()) && Math.abs(tx.amount) < 250
}
