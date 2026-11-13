// Stijlen voor het uiterlijk (Instellingen → Stijl). De warme basis (grijstinten, paneel, serif-titels)
// staat in index.css; een stijl bepaalt alleen het accent en kleine verschillen via data-theme-style.
//   claude — warm oranje accent (zoals Claude)
//   custom — eigen kleur (presets of kleurkiezer)
//   zen    — neutraal: wit/grijs als accent, kleur alleen voor categorieën en status

export const THEME_STYLES = [
  { id: 'claude', label: 'Claude', accent: '#D97757', hint: 'Warm oranje' },
  { id: 'custom', label: 'Eigen kleur', accent: null, hint: 'Kies je kleur' },
  { id: 'zen', label: 'Zen', accent: '#E9E6DF', hint: 'Neutraal' },
]

export const DEFAULT_THEME = { style: 'claude', accent: '#D97757' }

/** Leesbare tekstkleur op een accent: donker op lichte kleuren, wit op donkere. */
export function onAccentFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#1b1a18'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#1b1a18' : '#ffffff'
}

/** Accent dat bij een thema hoort (oude opgeslagen thema's zonder `style` = Claude). */
export function accentOf(theme) {
  const style = THEME_STYLES.find(s => s.id === (theme?.style || 'claude')) || THEME_STYLES[0]
  return style.accent || theme?.accent || DEFAULT_THEME.accent
}

/** Zet accent, tekst-op-accent en de stijl op <html>. */
export function applyTheme(theme) {
  const root = document.documentElement
  const accent = accentOf(theme)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--on-accent', onAccentFor(accent))
  root.dataset.themeStyle = theme?.style || 'claude'
}
