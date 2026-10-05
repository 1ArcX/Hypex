// Types / categorieën (Hypex v2).
//
// De gebruiker beheert zijn types (naam + kleur) in Instellingen → Types; ze staan in de
// Supabase-tabel `item_types` en worden via setTypes() in deze module geregistreerd.
// Een item met `type_id` krijgt dat type. Zonder `type_id` (oude items, of vóór de migratie)
// wordt de categorie afgeleid uit de BRON van het item:
//
//   School       lessen (Magister/SOMtoday), MyX-rooster (ICS), taken met een vak
//   Werk         PMT/Jumbo-diensten
//   Persoonlijk  taken zonder vak/herhaling
//   Routine      herhalende taken
//   Overig       Google Agenda en alles wat niet te plaatsen is
//   Oude eigen agenda-items: categorie volgt de gekozen paletkleur (zie EVENT_COLOR_CATEGORY).
//
// Een categorie-waarde ("cat") is de `key` van een ingebouwd type ('school', …) of het `id`
// van een eigen type. Ingebouwde kleuren lopen via de CSS-variabelen --cat-<key>.

export const BUILTIN_TYPES = [
  { key: 'school',      name: 'School',      color: '#FACC15' },
  { key: 'werk',        name: 'Werk',        color: '#F43F5E' },
  { key: 'persoonlijk', name: 'Persoonlijk', color: '#A78BFA' },
  { key: 'routine',     name: 'Routine',     color: '#34D399' },
  { key: 'overig',      name: 'Overig',      color: '#60A5FA' },
]

const builtinCategories = () => Object.fromEntries(
  BUILTIN_TYPES.map(t => [t.key, { label: t.name, color: `var(--cat-${t.key})`, id: null, key: t.key }]))

// Live bindings: importeurs zien de nieuwe waarden na setTypes().
export let CATEGORIES = builtinCategories()
export let CATEGORY_ORDER = BUILTIN_TYPES.map(t => t.key)
let byId = {}

/** Registreer de types van de gebruiker (uit item_types). Lege lijst = terug naar de standaard. */
export function setTypes(list) {
  const types = [...(list || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  if (!types.length) {
    CATEGORIES = builtinCategories(); CATEGORY_ORDER = BUILTIN_TYPES.map(t => t.key); byId = {}
    return
  }
  const cats = {}, order = [], ids = {}
  for (const t of types) {
    const cat = t.key || t.id
    cats[cat] = { label: t.name, color: t.key ? `var(--cat-${t.key})` : t.color, id: t.id, key: t.key || null, raw: t.color }
    order.push(cat)
    ids[t.id] = cat
    if (t.key && typeof document !== 'undefined') document.documentElement.style.setProperty(`--cat-${t.key}`, t.color)
  }
  // 'overig' is de vangnet-categorie en moet altijd bestaan.
  if (!cats.overig) { cats.overig = builtinCategories().overig; order.push('overig') }
  CATEGORIES = cats; CATEGORY_ORDER = order; byId = ids
}

/** Categorie van een type_id, of null als het type (nog) niet bekend is. */
export const categoryOfTypeId = (typeId) => (typeId && byId[typeId]) || null
/** type_id van een categorie (null voor ingebouwde types als die nog niet in de database staan). */
export const typeIdOf = (cat) => CATEGORIES[cat]?.id || null

export function taskCategory(task) {
  if (!task) return 'overig'
  const explicit = categoryOfTypeId(task.type_id)
  if (explicit) return explicit
  if (task.recurrence) return 'routine'
  if (task.subject_id) return 'school'
  return 'persoonlijk'
}

// Oude eigen agenda-items (zonder type_id): de kleur uit het oude palet was de categorie.
const EVENT_COLOR_CATEGORY = {
  '#ff6b6b': 'werk', '#ff8c42': 'werk',
  '#facc15': 'school',
  '#4ade80': 'routine',
  '#00ffd1': 'overig', '#38bdf8': 'overig',
  '#818cf8': 'persoonlijk', '#f472b6': 'persoonlijk',
}

/** Eerste titelregel van een feed die past ({ contains, type_id }), anders null. */
export function ruleCategory(title, rules) {
  const t = (title || '').toLowerCase()
  for (const r of rules || []) {
    const needle = (r?.contains || '').trim().toLowerCase()
    if (needle && t.includes(needle)) {
      const cat = categoryOfTypeId(r.type_id)
      if (cat) return cat
    }
  }
  return null
}

/** Agenda-event (calendar_events of geïmporteerd external_calendar_events). */
export function eventCategory(ev) {
  if (!ev) return 'overig'
  const explicit = categoryOfTypeId(ev.type_id)
  if (explicit) return explicit
  if (ev.external) {
    // Volgorde: eigen aanpassing (type_id, hierboven) → titelregel → standaardtype van de feed → bron.
    const conn = ev.connection
    const byRule = ruleCategory(ev._original?.title ?? ev.title, conn?.type_rules)
    if (byRule) return byRule
    const byFeed = categoryOfTypeId(conn?.default_type_id)
    if (byFeed) return byFeed
    // Google-events bewaren het Google-object (kind: 'calendar#event'); MyX is een ICS-feed.
    const kind = ev.raw?.kind
    if (conn?.provider === 'google' || (typeof kind === 'string' && kind.startsWith('calendar#'))) return 'overig'
    return 'school'
  }
  if (ev.description?.startsWith('pmt:')) return 'werk'
  return EVENT_COLOR_CATEGORY[(ev.color || '').toLowerCase()] || 'persoonlijk'
}

export const lessonCategory = () => 'school'
export const workCategory = () => 'werk'

export const categoryColor = (cat) => (CATEGORIES[cat] || CATEGORIES.overig).color
export const categoryLabel = (cat) => (CATEGORIES[cat] || CATEGORIES.overig).label
/** Echte hex-kleur (voor opslaan in een `color`-kolom of een kleurkiezer). */
export const categoryHex = (cat) => {
  const c = CATEGORIES[cat] || CATEGORIES.overig
  return c.raw || BUILTIN_TYPES.find(t => t.key === (c.key || cat))?.color || '#60A5FA'
}
