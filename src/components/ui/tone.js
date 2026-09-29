// Semantische "tones" → CSS-variabelen uit de design tokens (src/index.css).
// Elke tone werkt met color-mix, dus ook met het accent van het gekozen thema.
const TONES = {
  accent:      'var(--accent)',
  neutral:     'var(--c-text-2)',
  success:     'var(--c-success)',
  warning:     'var(--c-warning)',
  danger:      'var(--c-danger)',
  info:        'var(--c-info)',
  school:      'var(--cat-school)',
  werk:        'var(--cat-werk)',
  persoonlijk: 'var(--cat-persoonlijk)',
  routine:     'var(--cat-routine)',
  overig:      'var(--cat-overig)',
}

/** Kleur voor een tone-naam; een losse kleur (hex / var()) wordt ongewijzigd teruggegeven. */
export function toneColor(tone = 'neutral') {
  return TONES[tone] || tone
}

/** color-mix tint van een kleur of tone, bv. tint('danger', 12). */
export function tint(tone, pct) {
  return `color-mix(in srgb, ${toneColor(tone)} ${pct}%, transparent)`
}
