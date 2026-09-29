// Categorie-mapping (Hypex v2, beslissing D1): de categorie wordt afgeleid uit de BRON van
// een item — er is geen `category`-kolom. Eén plek, zodat Agenda, Dashboard en Taken
// dezelfde kleuren tonen.
//
//   School       lessen (Magister/SOMtoday), MyX-rooster (ICS), taken met een vak
//   Werk         PMT/Jumbo-diensten
//   Persoonlijk  eigen agenda-items, taken zonder vak/herhaling
//   Routine      herhalende taken
//   Overig       Google Agenda en alles wat niet te plaatsen is

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

/** Agenda-event (calendar_events of geïmporteerd external_calendar_events). */
export function eventCategory(ev) {
  if (!ev) return 'overig'
  if (ev.external) {
    // Google-events bewaren het Google-object (kind: 'calendar#event'); MyX is een ICS-feed.
    const kind = ev.raw?.kind
    if (typeof kind === 'string' && kind.startsWith('calendar#')) return 'overig'
    return 'school'
  }
  return 'persoonlijk'
}

export const lessonCategory = () => 'school'
export const workCategory = () => 'werk'

export const categoryColor = (cat) => (CATEGORIES[cat] || CATEGORIES.overig).color
export const categoryLabel = (cat) => (CATEGORIES[cat] || CATEGORIES.overig).label
