export const ALLE_VAKKEN = [
  'Aardrijkskunde', 'Bedrijfseconomie', 'Bewegen, sport en maatschappij (BSM)',
  'Biologie', 'Culturele & kunstzinnige vorming (CKV)', 'Duits', 'Economie',
  'Engels', 'Frans', 'Geschiedenis', 'Kunst Beeldend', 'Levensbeschouwelijke vorming',
  'Lichamelijke oefening', 'Loopbaanoriëntatie/begeleiding (LOB)', 'Maatschappijleer',
  'Natuurkunde', 'Nederlands', 'Profielwerkstuk (PWS)', 'Rekenen 3F',
  'Scheikunde', 'Wiskunde A', 'Wiskunde B'
]

// Match a Magister vak name/abbreviation to the closest ALLE_VAKKEN entry
export function matchVak(naam) {
  if (!naam) return null
  const lower = naam.toLowerCase().trim()
  // Exact match (case-insensitive)
  const exact = ALLE_VAKKEN.find(v => v.toLowerCase() === lower)
  if (exact) return exact
  // First significant word match (e.g. "Economie" in "Bedrijfseconomie")
  const startsWith = ALLE_VAKKEN.find(v => v.toLowerCase().startsWith(lower))
  if (startsWith) return startsWith
  // Any meaningful word (>3 chars) in the vak name matches
  const words = lower.split(/[\s,&()/+]+/).filter(w => w.length > 3)
  const partial = ALLE_VAKKEN.find(v =>
    words.some(w => v.toLowerCase().includes(w))
  )
  return partial || null
}
