export function fmt(n: number): string {
  return `€${Number(n).toFixed(2).replace('.', ',')}`
}

export function fmtShort(n: number): string {
  return `€${Math.round(n)}`
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// m is 0-based (zoals Date.getMonth())
export function monthStartOf(y: number, m: number): string {
  return `${y}-${pad2(m + 1)}-01`
}

export function monthEndOf(y: number, m: number): string {
  const last = new Date(y, m + 1, 0)
  return toISODate(last)
}

export function monthLabelOf(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}

export function monthStart(): string {
  const d = new Date()
  return monthStartOf(d.getFullYear(), d.getMonth())
}

export function monthEnd(): string {
  const d = new Date()
  return monthEndOf(d.getFullYear(), d.getMonth())
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100
}

// Afronden naar beneden op €5 (voor spaaradvies)
export function rd5(n: number): number {
  return Math.floor(n / 5) * 5
}

export function parseAmount(input: string | number): number {
  return parseFloat(String(input).replace(',', '.')) || 0
}
