// Tijden die over middernacht lopen (bv. een dienst of feed-item van 15:30 tot 01:00).

/** Einde vóór of gelijk aan het begin = eindigt de volgende dag. Klopt het dan nog niet, dan 1 uur na het begin. */
export function rollEnd(start, end) {
  if (end > start) return end
  const e = new Date(end)
  e.setDate(e.getDate() + 1)
  return e > start ? e : new Date(start.getTime() + 3600000)
}

/** Eindtijd ("HH:MM") vóór of gelijk aan de begintijd = loopt door na middernacht. */
export const crossesMidnight = (startStr, endStr) => !!startStr && !!endStr && endStr <= startStr

/** Duur in minuten tussen twee "HH:MM"-tijden, over middernacht heen (01:00 na 15:30 = 570). */
export function spanMinutes(startStr, endStr) {
  const toM = s => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0) }
  const d = toM(endStr) - toM(startStr)
  return d > 0 ? d : d + 24 * 60
}

/** Laatste dag waarop een item staat: een einde om precies 00:00 telt niet als extra dag. */
export function lastDay(start, end) {
  const e = new Date(end)
  return e > start && e.getHours() === 0 && e.getMinutes() === 0 && e.getSeconds() === 0 ? new Date(e.getTime() - 1) : e
}

/**
 * Het deel van [start, end] dat op `day` valt, in minuten vanaf 00:00 van die dag
 * (null = niet op die dag). fromPrev/toNext: loopt door vanaf de vorige / naar de volgende dag.
 */
export function minutesOnDay(start, end, day) {
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const d1 = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  const s = Math.max(+start, +d0), e = Math.min(+end, +d1)
  if (e < s || (e === s && +start !== s)) return null
  return { start: Math.round((s - d0) / 60000), end: Math.round((e - d0) / 60000), fromPrev: +start < +d0, toNext: +end > +d1 }
}
