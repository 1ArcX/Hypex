// Categorie-mapping (Hypex v2, beslissing D1): de categorie wordt afgeleid uit de BRON van
// een item — er is geen `category`-kolom. Eén plek, zodat Agenda, Dashboard en Taken
// dezelfde kleuren tonen.
//
//   School       lessen (Magister/SOMtoday), MyX-rooster (ICS), taken met een vak
//   Werk         PMT/Jumbo-diensten
//   Persoonlijk  taken zonder vak/herhaling
//   Routine      herhalende taken
//   Overig       Google Agenda en alles wat niet te plaatsen is
//   Eigen agenda-items: categorie volgt de gekozen paletkleur (zie EVENT_COLOR_CATEGORY).

export const CATEGORIES = {
  school:      { label: 'School',      color: 'var(--cat-school)' },
  werk:        { label: 'Werk',        color: 'var(--cat-werk)' },
  persoonlijk: { label: 'Persoonlijk', color: 'var(--cat-persoonlijk)' },
  routine:     { label: 'Routine',     color: 'var(--cat-routine)' },
  overig:      { label: 'Overig',      color: 'var(--cat-overig)' },
}
export const CATEGORY_ORDER = ['school', 'werk', 'persoonlijk', 'routine', 'overig']

export function taskCategory(task) {
  if (!task) return 'overig'
  if (task.recurrence) return 'routine'
  if (task.subject_id) return 'school'
  return 'persoonlijk'
}

// Eigen agenda-items: de gebruiker kiest zelf een kleur uit het vaste palet van het
// event-formulier en gebruikt die als categorie (bv. "Werk" = rood). Die keuze respecteren
// we door elke paletkleur op de dichtstbijzijnde categorie te mappen.
const EVENT_COLOR_CATEGORY = {
  '#ff6b6b': 'werk', '#ff8c42': 'werk',
  '#facc15': 'school',
  '#4ade80': 'routine',
  '#00ffd1': 'overig', '#38bdf8': 'overig',
  '#818cf8': 'persoonlijk', '#f472b6': 'persoonlijk',
}

/** Agenda-event (calendar_events of geïmporteerd external_calendar_events). */
export function eventCategory(ev) {
  if (!ev) return 'overig'
  if (ev.external) {
    // Google-events bewaren het Google-object (kind: 'calendar#event'); MyX is een ICS-feed.
    const kind = ev.raw?.kind
    if (typeof kind === 'string' && kind.startsWith('calendar#')) return 'overig'
    return 'school'
  }
  if (ev.description?.startsWith('pmt:')) return 'werk'
  return EVENT_COLOR_CATEGORY[(ev.color || '').toLowerCase()] || 'persoonlijk'
}

export const lessonCategory = () => 'school'
export const workCategory = () => 'werk'

export const categoryColor = (cat) => (CATEGORIES[cat] || CATEGORIES.overig).color
export const categoryLabel = (cat) => (CATEGORIES[cat] || CATEGORIES.overig).label
