export const ALLE_VAKKEN = [
  'Aardrijkskunde', 'Bedrijfseconomie', 'Bewegen, sport en maatschappij (BSM)',
  'Biologie', 'Culturele & kunstzinnige vorming (CKV)', 'Duits', 'Economie',
  'Engels', 'Frans', 'Geschiedenis', 'Kunst Beeldend', 'Levensbeschouwelijke vorming',
  'Lichamelijke oefening', 'Loopbaanoriëntatie/begeleiding (LOB)', 'Maatschappijleer',
  'Natuurkunde', 'Nederlands', 'Profielwerkstuk (PWS)', 'Rekenen 3F',
  'Scheikunde', 'Wiskunde A', 'Wiskunde B'
]

// Explicit aliases for Magister names/abbreviations that don't auto-match
const ALIASES = {
  // Nederlands
  'ne': 'Nederlands', 'ned': 'Nederlands', 'nl': 'Nederlands',
  'nederlandse taal': 'Nederlands', 'nederlandse taal en literatuur': 'Nederlands',
  // Engels
  'en': 'Engels', 'eng': 'Engels', 'english': 'Engels',
  // Levensbeschouwelijke vorming
  'lb': 'Levensbeschouwelijke vorming', 'levo': 'Levensbeschouwelijke vorming',
  'levensbeschouwing': 'Levensbeschouwelijke vorming',
  'levensbeschouwelijke': 'Levensbeschouwelijke vorming',
  // Other common short abbreviations
  'wi': 'Wiskunde A', 'wis': 'Wiskunde A',
  'na': 'Natuurkunde', 'nat': 'Natuurkunde',
  'bi': 'Biologie', 'bio': 'Biologie',
  'sk': 'Scheikunde', 'schk': 'Scheikunde',
  'gs': 'Geschiedenis', 'gesc': 'Geschiedenis',
  'ec': 'Economie', 'econ': 'Economie',
  'du': 'Duits', 'dui': 'Duits',
  'fa': 'Frans', 'fr': 'Frans',
  'ak': 'Aardrijkskunde', 'aard': 'Aardrijkskunde',
  'lo': 'Lichamelijke oefening',
  'ckv': 'Culturele & kunstzinnige vorming (CKV)',
  'lob': 'Loopbaanoriëntatie/begeleiding (LOB)',
  'pws': 'Profielwerkstuk (PWS)',
  'bsm': 'Bewegen, sport en maatschappij (BSM)',
  'maatsch': 'Maatschappijleer', 'ml': 'Maatschappijleer',
}

// Match a Magister vak name/abbreviation to the closest ALLE_VAKKEN entry
export function matchVak(naam) {
  if (!naam) return null
  const lower = naam.toLowerCase().trim()
  // Alias lookup first (handles short abbreviations and known variants)
  if (ALIASES[lower]) return ALIASES[lower]
  // Exact match (case-insensitive)
  const exact = ALLE_VAKKEN.find(v => v.toLowerCase() === lower)
  if (exact) return exact
  // ALLE_VAKKEN entry starts with input (e.g. "Economie" → "Bedrijfseconomie")
  const startsWith = ALLE_VAKKEN.find(v => v.toLowerCase().startsWith(lower))
  if (startsWith) return startsWith
  // Input starts with ALLE_VAKKEN canonical name (e.g. "Levensbeschouwelijke vorming ..." → match)
  const inputStartsWith = ALLE_VAKKEN.find(v => lower.startsWith(v.toLowerCase()))
  if (inputStartsWith) return inputStartsWith
  // Any meaningful word (>3 chars) in the vak name matches a canonical entry
  const words = lower.split(/[\s,&()/+]+/).filter(w => w.length > 3)
  const partial = ALLE_VAKKEN.find(v =>
    words.some(w => v.toLowerCase().includes(w))
  )
  return partial || null
}
