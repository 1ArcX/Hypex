// Quick-add: haalt datum, tijd, type en prioriteit uit een Nederlandse invoerregel.
//   "morgen 14:00-15:30 wiskunde huiswerk #school !urgent"
//   "ma-vr 9-17u stage #werk"      "vrijdag 10u presentatie"      "19 okt hele dag verjaardag"
// Geeft { title, fields, tokens } terug. `fields` bevat alleen wat herkend is;
// `tokens` ([{ key, label, text }]) zijn de herkende stukjes (voor chips in de UI).

const pad = n => String(n).padStart(2, '0')
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const DAYS = [
  ['zondag', 'zo'], ['maandag', 'ma'], ['dinsdag', 'di'], ['woensdag', 'wo'],
  ['donderdag', 'do'], ['vrijdag', 'vr'], ['zaterdag', 'za'],
]
const MONTHS = ['jan', 'feb', 'mrt|maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt|oct', 'nov', 'dec']
const DAY_FULL = DAYS.map(d => d[0]).join('|')
const DAY_ANY = DAYS.flatMap(d => d).join('|')
const MONTH_RE = MONTHS.map(m => `(?:${m})[a-z]*`).join('|')

const dayIndex = (word) => DAYS.findIndex(d => d.includes(word.toLowerCase()))
/** Eerstvolgende dag met deze weekdag (vandaag telt mee). */
const nextDow = (from, dow) => addDays(from, (dow - from.getDay() + 7) % 7)
const monthIndex = (word) => MONTHS.findIndex(m => new RegExp(`^(?:${m})`, 'i').test(word))

function toTime(h, m = 0) {
  h = +h; m = +m
  if (h > 23 || m > 59) return null
  return `${pad(h)}:${pad(m)}`
}
const minutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fromMinutes = (n) => `${pad(Math.min(23, Math.floor(n / 60)))}:${pad(n >= 24 * 60 ? 59 : n % 60)}`

/**
 * @param {string} text
 * @param {{ now?: Date, types?: { cat: string, label: string }[] }} opts
 */
export function parseQuickAdd(text, { now = new Date(), types = [], ignore = [] } = {}) {
  // `ignore`: stukjes tekst die niet herkend mogen worden (bij bewerken: wat al in de titel stond)
  const skip = new Set(ignore.map(t => t.toLowerCase()))
  let rest = ` ${text} `
  const fields = {}
  const tokens = []
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const take = (re, fn) => {
    rest = rest.replace(re, (...m) => {
      if (skip.has(m[0].trim().toLowerCase())) return m[0]
      const res = fn(...m)
      if (res === false) return m[0]
      tokens.push({ ...res, text: m[0].trim() })
      return ' '
    })
  }
  const B = '(?<=\\s)' // woordgrens links (spatie)
  const E = '(?=\\s)'  // woordgrens rechts

  // ── Type en prioriteit ──
  take(new RegExp(`${B}#([\\p{L}\\d_-]+)${E}`, 'giu'), (_, name) => {
    const n = name.toLowerCase()
    const t = types.find(t => t.label.toLowerCase() === n) || types.find(t => t.label.toLowerCase().startsWith(n))
    if (!t) return false
    fields.cat = t.cat
    return { key: 'type', label: `#${t.label}` }
  })
  take(new RegExp(`${B}!(urgent|1|normaal|2|later|3)${E}`, 'gi'), (_, p) => {
    const v = { urgent: 1, 1: 1, normaal: 2, 2: 2, later: 3, 3: 3 }[p.toLowerCase()]
    fields.priority = v
    return { key: 'priority', label: ['', 'Urgent', 'Normaal', 'Later'][v] }
  })

  // ── Hele dag ──
  take(new RegExp(`${B}(hele dag|de hele dag)${E}`, 'gi'), () => { fields.allDay = true; return { key: 'allDay', label: 'Hele dag' } })

  // ── Dagbereik: "ma-vr", "ma t/m vr", "maandag tot en met vrijdag" ──
  take(new RegExp(`${B}(${DAY_ANY})\\s*(?:-|–|t/m|tm|tot en met|tot)\\s*(${DAY_ANY})${E}`, 'gi'), (_, a, b) => {
    const start = nextDow(today, dayIndex(a))
    const end = addDays(start, (dayIndex(b) - dayIndex(a) + 7) % 7)
    fields.date = iso(start); fields.endDate = iso(end)
    return { key: 'date', label: `${a.slice(0, 2)}–${b.slice(0, 2)}` }
  })
  // "t/m vrijdag" (vanaf de al gekozen of vandaag)
  take(new RegExp(`${B}(?:t/m|tm|tot en met)\\s+(${DAY_ANY})${E}`, 'gi'), (_, b) => {
    const start = fields.date ? new Date(fields.date + 'T00:00') : today
    fields.date = fields.date || iso(start)
    fields.endDate = iso(nextDow(start, dayIndex(b)))
    return { key: 'endDate', label: `t/m ${b}` }
  })

  // ── Datumbereik: "19 okt tot 25 okt", "19 t/m 25 okt", "19-25 okt", "19/10 - 25/10", "van 19-10 t/m 25-10" ──
  const RANGE_SEP = '\\s*(?:-|–|t/m|tm|tot en met|tot)\\s*'
  const dateRange = (d1, m1, y1, d2, m2, y2) => {
    let start = new Date(y1 ?? today.getFullYear(), m1, d1)
    if (y1 == null && start < today && addDays(start, 1) <= today) start = new Date(today.getFullYear() + 1, m1, d1)
    let end = new Date(y2 ?? start.getFullYear(), m2, d2)
    if (end < start) end = new Date(end.getFullYear() + 1, m2, d2)
    if (start.getDate() !== d1 || end.getDate() !== d2 || end <= start) return false
    fields.date = iso(start); fields.endDate = iso(end)
    const f = d => `${d.getDate()} ${MONTHS[d.getMonth()].split('|')[0]}`
    return { key: 'date', label: `${f(start)} – ${f(end)}` }
  }
  take(new RegExp(`${B}(?:van\\s+)?(\\d{1,2})(?:\\s+(${MONTH_RE}))?${RANGE_SEP}(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?${E}`, 'gi'),
    (_, d1, m1, d2, m2, y) => {
      if (fields.date) return false
      const mi2 = monthIndex(m2), mi1 = m1 ? monthIndex(m1) : mi2
      return dateRange(+d1, mi1, y && m1 ? +y : null, +d2, mi2, y ? +y : null)
    })
  take(new RegExp(`${B}(?:van\\s+)?(\\d{1,2})[-/](\\d{1,2})${RANGE_SEP}(\\d{1,2})[-/](\\d{1,2})(?:[-/](\\d{2,4}))?${E}`, 'gi'),
    (_, d1, m1, d2, m2, y) => {
      if (fields.date || +m1 > 12 || +m2 > 12 || !+m1 || !+m2) return false
      const year = y ? (+y < 100 ? 2000 + +y : +y) : null
      return dateRange(+d1, +m1 - 1, null, +d2, +m2 - 1, year)
    })

  // ── Losse dag ──
  take(new RegExp(`${B}(vandaag|morgen|overmorgen)${E}`, 'gi'), (_, w) => {
    if (fields.date) return false
    fields.date = iso(addDays(today, { vandaag: 0, morgen: 1, overmorgen: 2 }[w.toLowerCase()]))
    return { key: 'date', label: w.toLowerCase() }
  })
  take(new RegExp(`${B}volgende week${E}`, 'gi'), () => {
    if (fields.date) return false
    fields.date = iso(nextDow(addDays(today, 1), 1))
    return { key: 'date', label: 'volgende week' }
  })
  take(new RegExp(`${B}(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?${E}`, 'gi'), (_, d, m, y) => {
    if (fields.date) return false
    const mi = monthIndex(m)
    let date = new Date(y ? +y : today.getFullYear(), mi, +d)
    if (!y && date < today) date = new Date(today.getFullYear() + 1, mi, +d)
    if (date.getDate() !== +d) return false
    fields.date = iso(date)
    return { key: 'date', label: `${+d} ${m.slice(0, 3)}` }
  })
  take(new RegExp(`${B}(\\d{1,2})([-/])(\\d{1,2})(?:[-/](\\d{2,4}))?${E}`, 'g'), (_, d, sep, m, y) => {
    if (fields.date || +m > 12 || +d > 31 || (+m <= 0)) return false
    // "10-12" is eerder een tijd (10:00–12:00) dan 10 december; alleen als datum als het geen geldige tijd is.
    if (sep === '-' && !y && +m > +d && +m <= 23) return false
    let year = y ? (+y < 100 ? 2000 + +y : +y) : today.getFullYear()
    let date = new Date(year, +m - 1, +d)
    if (!y && date < today) date = new Date(year + 1, +m - 1, +d)
    if (date.getDate() !== +d) return false
    fields.date = iso(date)
    return { key: 'date', label: `${+d}-${+m}` }
  })
  // Volledige dagnaam ("vrijdag"); korte vormen (ma, di, zo…) alleen in een bereik, want "zo"/"do" zijn ook gewone woorden.
  take(new RegExp(`${B}(?:op\\s+)?(${DAY_FULL})${E}`, 'gi'), (_, w) => {
    if (fields.date) return false
    fields.date = iso(nextDow(today, dayIndex(w)))
    return { key: 'date', label: w.toLowerCase() }
  })

  // ── Tijden ──
  const T = '(\\d{1,2})(?:[:.](\\d{2})|u(\\d{2})?)?'
  take(new RegExp(`${B}(?:van\\s+|om\\s+)?${T}\\s*(?:-|–|tot)\\s*${T}\\s*(?:u|uur)?${E}`, 'gi'), (_, h1, m1, u1, h2, m2, u2) => {
    const s = toTime(h1, m1 || u1 || 0), e = toTime(h2, m2 || u2 || 0)
    if (!s || !e) return false
    fields.startTime = s; fields.endTime = e; fields.allDay = false
    return { key: 'time', label: `${s}–${e}` }
  })
  take(new RegExp(`${B}(?:om\\s+)?(\\d{1,2})(?:[:.](\\d{2})|u(\\d{2})?)${E}`, 'gi'), (_, h, m, u) => {
    if (fields.startTime) return false
    const s = toTime(h, m || u || 0)
    if (!s) return false
    fields.startTime = s; fields.allDay = false
    return { key: 'time', label: s }
  })
  // Duur: "90m", "90 min", "1u30" (na een begintijd), "2 uur"
  take(new RegExp(`${B}(?:voor\\s+)?(?:(\\d{1,3})\\s*(?:m|min|minuten)|(\\d)(?:[,.](\\d))?\\s*(?:u|uur)(?:(\\d{2}))?)${E}`, 'gi'), (_, mins, h, frac, hm) => {
    if (!fields.startTime || fields.endTime) return false
    const total = mins ? +mins : (+h * 60 + (frac ? +frac * 6 : 0) + (hm ? +hm : 0))
    if (!total) return false
    fields.endTime = fromMinutes(minutes(fields.startTime) + total)
    return { key: 'duration', label: total >= 60 ? `${Math.floor(total / 60)}u${total % 60 ? pad(total % 60) : ''}` : `${total}m` }
  })
  if (fields.startTime && !fields.endTime) fields.endTime = fromMinutes(minutes(fields.startTime) + 60)

  const title = rest.replace(/\s+/g, ' ').trim()
  return { title, fields, tokens }
}

/** Haal een herkend stukje weer uit de invoer (chip-× in de UI). */
export function removeToken(text, token) {
  const i = text.toLowerCase().indexOf(token.text.toLowerCase())
  if (i < 0) return text
  return (text.slice(0, i) + text.slice(i + token.text.length)).replace(/\s{2,}/g, ' ').trim()
}
