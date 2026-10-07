// Update-log: wat er nieuw is per update. Nieuwste bovenaan, `id` loopt op.
// Na elke update die de gebruiker merkt een nieuw item bovenaan toevoegen (id + 1);
// de app toont bij de eerstvolgende keer openen een popup met alle nog niet geziene updates.
//
// area: 'dashboard' | 'agenda' | 'taken' | 'spotify' | 'notities' | 'focus' | 'geld' | 'app'

export const RELEASES = [
  {
    id: 4,
    date: '2026-10-07',
    title: 'Focus in Dash-stijl en beter selecteren',
    items: [
      { area: 'focus', text: 'Focus gebruikt nu je themakleur en dezelfde stijl als de rest van Dash. De indeling blijft hetzelfde.' },
      { area: 'notities', text: 'Selecteer tekst over meerdere regels met de muis, of alles met Ctrl+A. Kopiëren, verwijderen en Ctrl+Z werken over de hele notitie.' },
      { area: 'notities', text: 'Rechtsklik in de mappenkolom om een nieuwe map te maken.' },
      { area: 'app', text: 'Nieuw: dit update-log. Na een update zie je meteen wat er veranderd is, ook als je een paar updates hebt gemist.' },
    ],
  },
  {
    id: 3,
    date: '2026-10-07',
    title: 'Notities in Apple-stijl',
    items: [
      { area: 'notities', text: 'Notities ziet eruit en werkt als Apple Notities: mappen, lijst en notitie, met dezelfde animaties op je telefoon.' },
      { area: 'notities', text: 'Afvinklijsten (bijvoorbeeld voor boodschappen), koppen, opsommingen en genummerde lijsten.' },
      { area: 'notities', text: 'Zet notities vast en veeg op je telefoon naar links om vast te zetten of te verwijderen, met Herstel.' },
      { area: 'notities', text: 'Maak een map afvinkbaar (zoals Updates) om hele notities af te vinken; ze gaan naar Afgerond.' },
      { area: 'notities', text: 'In je eigen themakleur, met een rode ✕ terug naar Home op de telefoon.' },
    ],
  },
  {
    id: 2,
    date: '2026-10-07',
    title: 'Mini Spotify op je dashboard',
    items: [
      { area: 'spotify', text: 'Grote Spotify-kaart naast Pomodoro en Geld, op elk scherm. Op een verticaal scherm staat hij groot eronder.' },
      { area: 'spotify', text: 'Zoeken, je bibliotheek (playlists, albums, gelikte nummers) en een hartje om nummers te liken.' },
      { area: 'spotify', text: 'Meelopende songtekst naast de speler; klik op een regel om erheen te spoelen. Sleep de scheidingslijn om hem breder of smaller te maken.' },
      { area: 'spotify', text: 'Skippen en pauzeren reageren direct en lopen beter synchroon met je telefoon.' },
    ],
  },
  {
    id: 1,
    date: '2026-10-07',
    title: 'Timer op elke tab en agenda-geschiedenis',
    items: [
      { area: 'dashboard', text: 'Loopt je focus-timer, dan staat de timerbalk nu bovenaan elke tab; op de telefoon compact op één regel.' },
      { area: 'agenda', text: 'Lessen van MijnX van vorige dagen blijven bewaard, ook al levert de feed alleen vanaf vandaag.' },
    ],
  },
]

export const LATEST_ID = RELEASES[0]?.id || 0
const SEEN_KEY = 'changelog_seen'

/** Updates die op dit apparaat nog niet gezien zijn (nieuwste eerst). */
export function unseenReleases() {
  let seen = null
  try { seen = localStorage.getItem(SEEN_KEY) } catch { return [] }
  if (seen === null) {
    // Eerste keer: alleen de updates van de laatste paar dagen, niet de hele geschiedenis
    const cutoff = Date.now() - 3 * 86400000
    return RELEASES.filter(r => new Date(r.date + 'T23:59:59').getTime() >= cutoff).slice(0, 5)
  }
  return RELEASES.filter(r => r.id > Number(seen))
}

export function markReleasesSeen() {
  try { localStorage.setItem(SEEN_KEY, String(LATEST_ID)) } catch {}
}
