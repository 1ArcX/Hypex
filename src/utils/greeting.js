// Begroeting op basis van het uur van de dag (Dashboard + Hypex AI).
export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 6) return 'Goedenacht'
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'
}
