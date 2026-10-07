import type { GradePart } from '../types'

/**
 * Welk cijfer heb je nodig op het tentamen (de onderdelen met is_final) om je doelcijfer te halen?
 * Gewogen gemiddelde: (Σ cijfer·weging + nodig·weging_tentamen) / Σ weging = doel.
 */
export function neededFinal(parts: GradePart[], target: number) {
  const finals = parts.filter(p => p.is_final)
  const others = parts.filter(p => !p.is_final)
  const totalW = parts.reduce((a, p) => a + (Number(p.weight) || 0), 0)
  const finalW = finals.reduce((a, p) => a + (Number(p.weight) || 0), 0)
  const graded = others.filter(p => p.grade != null)
  const earned = graded.reduce((a, p) => a + Number(p.grade) * Number(p.weight), 0)
  const missingW = others.filter(p => p.grade == null).reduce((a, p) => a + Number(p.weight), 0)
  const gradedW = graded.reduce((a, p) => a + Number(p.weight), 0)
  const current = gradedW > 0 ? earned / gradedW : null
  if (!totalW || !finalW) return { needed: null, current, missingW, reachable: null }
  // Onderdelen zonder cijfer (niet tentamen) rekenen we met je huidige gemiddelde
  const assumed = current != null ? missingW * current : 0
  const needed = (target * totalW - earned - assumed) / finalW
  return { needed, current, missingW, reachable: needed <= 10 }
}
