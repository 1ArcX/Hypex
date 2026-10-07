// Datum- en duurnotatie voor Focus. Datums als lokale YYYY-MM-DD (nooit toISOString().slice: UTC).

export const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
export const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
export const DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
export const DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dayOf = (ts: string) => isoDate(new Date(ts))
export const parseDay = (iso: string) => new Date(iso + 'T12:00:00')
export const addDays = (iso: string, n: number) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return isoDate(d) }
export const todayISO = () => isoDate(new Date())
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)

/** 143 → "2u 23m", 45 → "45m", 120 → "2u" */
export function fmtDur(mins: number) {
  mins = Math.round(mins || 0)
  const h = Math.floor(mins / 60), m = mins % 60
  if (!h) return `${m}m`
  return m ? `${h}u ${m}m` : `${h}u`
}

/** Grote totalen zoals de app: "181u", onder het uur "45m" */
export function fmtHours(mins: number) {
  if (mins < 60) return `${Math.round(mins)}m`
  return `${Math.round(mins / 60)}u`
}

/** Uren met één decimaal: 6.4 → "6,4" (geen decimaal bij hele getallen) */
export function fmtDec(n: number, digits = 1) {
  const r = Math.round(n * 10 ** digits) / 10 ** digits
  return Number.isInteger(r) ? String(r) : r.toFixed(digits).replace('.', ',')
}

export const fmtTime = (ts: string) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

export function fmtDayLabel(iso: string) {
  const t = todayISO()
  if (iso === t) return 'Vandaag'
  if (iso === addDays(t, -1)) return 'Gisteren'
  const d = parseDay(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`
}

/** "Vandaag om 00:02" */
export const fmtWhen = (ts: string) => `${fmtDayLabel(dayOf(ts))} om ${fmtTime(ts)}`

export function fmtLongDate(iso: string) {
  const d = parseDay(iso)
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const fmtShortDate = (iso: string) => { const d = parseDay(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }

export function fmtPct(delta: number | null) {
  if (delta == null || !Number.isFinite(delta)) return null
  return `${Math.abs(Math.round(delta))}%`
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
