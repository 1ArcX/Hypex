// Update-log: wat er nieuw is per update. Nieuwste bovenaan, `id` loopt op.
// Na elke update die de gebruiker merkt een nieuw item bovenaan toevoegen (id + 1);
// de app toont bij de eerstvolgende keer openen een popup met alle nog niet geziene updates.
//
// area: 'dashboard' | 'agenda' | 'taken' | 'spotify' | 'notities' | 'focus' | 'recap' | 'geld' | 'app'

export const RELEASES = [
  {
    id: 21,
    date: '2026-10-21',
    title: 'Werkuren: vanaf je start bij WDK',
    items: [
      { area: 'dashboard', text: "Werkuren telt nu pas vanaf 12 oktober (je eerste dag bij WDK); oude Jumbo-diensten tellen niet meer mee in de week- en periodetotalen." },
      { area: 'dashboard', text: "De kaart pakt automatisch je WDK-feed als rooster. Onder 'Bekijk diensten' zie je precies welke diensten meetellen, met de bron, en kun je de bron wijzigen." },
    ],
  },
  {
    id: 20,
    date: '2026-10-21',
    title: 'Werkuren op het dashboard',
    items: [
      { area: 'dashboard', text: "Nieuwe kaart Werkuren: zie hoeveel uur je werkt per week (ma–zo) en per periode van de 25e t/m de 24e, met wat al gewerkt is en wat nog gepland staat." },
      { area: 'dashboard', text: "Vergelijk met de vorige week of periode, blader met ‹ › en tik op een staafje om die dag of week in de agenda te openen." },
      { area: 'dashboard', text: "De uren komen uit je rooster in de agenda (alles van het type Werk, bv. je WDK-feed). Staat er niets? Zet het standaardtype van die feed op Werk of kies de feed in de kaart." },
    ],
  },
  {
    id: 19,
    date: '2026-10-20',
    title: 'Recap: bericht aan jezelf',
    items: [
      { area: 'recap', text: "In je dagrecap kun je nu een bericht voor morgen schrijven, als motivatie voor jezelf. De volgende dag staat het bovenaan Recap, boven je doelen." },
      { area: 'recap', text: "In de weekrecap kan dat ook: je bericht voor volgende week staat dan bovenaan de Week-weergave." },
    ],
  },
  {
    id: 18,
    date: '2026-10-19',
    title: 'Spotify betrouwbaarder op meerdere apparaten',
    items: [
      { area: 'spotify', text: "Luister je op een ander apparaat (bv. je telefoon), dan haalt Dash eerst de echte stand op voordat play/pauze iets stuurt, zodat de knop niet meer het omgekeerde doet." },
      { area: 'spotify', text: "Dash laat niet meer zien dat er iets speelt als er niets afspeelt, en meldt het als het apparaat niet reageert." },
      { area: 'spotify', text: "Was je apparaat even inactief, dan speelt Dash weer af op het apparaat waarop je luisterde in plaats van op een willekeurig ander apparaat." },
      { area: 'spotify', text: "Een vastgelopen verzoek blokkeert de knoppen niet meer, en wat je op een ander apparaat verandert zie je sneller in Dash." },
    ],
  },
  {
    id: 17,
    date: '2026-10-18',
    title: 'Nieuw: Recap',
    items: [
      { area: 'recap', text: "Nieuwe tab Recap: sluit je dag af met scores voor energie, focus en stemming, wat ging goed, wat kan beter, je hoogtepunt en je top 3 doelen voor morgen." },
      { area: 'recap', text: "Bovenaan zie je automatisch wat je die dag gedaan hebt (taken, focustijd, routines) en de doelen die je gisteren voor vandaag koos, om af te vinken. Gisteren vergeten? Dan kun je die eerst nog invullen." },
      { area: 'recap', text: "Op zondag de weekrecap: gemiddelde scores, gehaalde doelen, focustijd en taken vergeleken met vorige week, plus je grootste winst, lessen en 3 doelen voor volgende week." },
      { area: 'recap', text: "Geschiedenis: kalender met je dagscores en een grafiek van energie, focus en stemming. Na 20:00 zie je een stip bij Recap als je hem nog niet hebt ingevuld." },
    ],
  },
  {
    id: 16,
    date: '2026-10-14',
    title: 'Agenda: tijden rond de wintertijd',
    items: [
      { area: 'agenda', text: "Op zondag 25 oktober (de klok gaat een uur terug) stonden items een uur te laat in de agenda, bv. 07:00–17:00 als 08:00–18:00. Ze staan nu weer op de juiste tijd." },
    ],
  },
  {
    id: 15,
    date: '2026-10-14',
    title: 'Tijden tot na middernacht',
    items: [
      { area: 'agenda', text: "Items die tot na middernacht lopen (bv. 15:30–01:00) staan nu goed in de agenda: op de eerste dag tot 24:00 en op de volgende dag van 00:00 tot de eindtijd. Dat geldt ook voor gekoppelde agenda's en werkdiensten." },
      { area: 'agenda', text: "Bij een nieuw event of taak kun je gewoon 15:30–01:00 invullen: de eindtijd telt dan als de volgende dag (je ziet '+1 dag'). Eerder werd dat stilletjes 15:30–16:30." },
      { area: 'agenda', text: "In de maandweergave staat zo'n avond-item op de begindag in plaats van als balk over twee dagen, en in de lijst staat het op de volgende dag als 'tot 01:00'." },
    ],
  },
  {
    id: 14,
    date: '2026-10-12',
    title: 'Zuiniger met de server',
    items: [
      { area: 'app', text: "Achtergrondtaken (pomodoro-, regen- en toetsherinneringen) draaien nu alleen als er echt iets te melden is, zodat Hypex niet meer tegen de serverlimiet aanloopt en offline gaat." },
      { area: 'agenda', text: "Gekoppelde agenda's (Google/MijnX) worden elk kwartier bijgewerkt. Meteen nodig? Gebruik de vernieuwknop bij Agenda's koppelen." },
      { area: 'app', text: "Vrachttijden: de pushmeldingen bij vertraging of aankomst zijn uitgezet. De vrachttijden zelf zie je nog gewoon in de Jumbo-tab." },
    ],
  },
  {
    id: 13,
    date: '2026-10-11',
    title: 'Afgeronde taken blijven bewaard',
    items: [
      { area: 'taken', text: "Nieuw filter Gedaan: per dag zie je wat je hebt afgerond (ook routines), met je voortgang van de laatste 14 dagen, deze week tegenover vorige week en je reeks dagen op rij." },
      { area: 'taken', text: "Per taak de knop Terugzetten: hij staat dan weer open op de dag waar hij gepland stond, ook als je hem dagen geleden afrondde." },
      { area: 'taken', text: "Een taak die je te laat of juist eerder afrondt, wordt bewaard bij de dag waarop je hem deed." },
      { area: 'agenda', text: "Afgeronde taken blijven in de agenda staan (doorgestreept) in plaats van te verdwijnen." },
    ],
  },
  {
    id: 12,
    date: '2026-10-11',
    title: 'Notities inplannen als taak',
    items: [
      { area: 'notities', text: "Plan een notitie in op een dag (bv. Boodschappen op zaterdag middag, eventueel elke week) met de kalenderknop in de notitie. Je ziet dan bovenaan: Gepland, met Verplaats en Uit planning." },
      { area: 'taken', text: "De taak staat in Taken, de agenda en op je dashboard met de voortgang van de lijst (bv. 2/7). Open de taak om de lijst meteen af te vinken; de vinkjes gaan ook in de notitie." },
      { area: 'taken', text: "Alles afgevinkt? Dan is de taak automatisch klaar. Bij een wekelijkse taak of opnieuw inplannen staan de vinkjes daarna weer uit." },
    ],
  },
  {
    id: 11,
    date: '2026-10-11',
    title: 'Agenda: routines verbergen',
    items: [
      { area: 'agenda', text: "Met de knop Routines bovenin de agenda verberg of toon je al je routines, zodat je de rest van je dag beter ziet. Werkt in elke weergave en wordt per apparaat onthouden." },
    ],
  },
  {
    id: 10,
    date: '2026-10-08',
    title: 'Focus op de computer',
    items: [
      { area: 'focus', text: 'Focus heeft op de computer een eigen indeling: een zijbalk met Overzicht, Vakken, Kalender en Inzichten, en "Terug naar Dash" onderaan.' },
      { area: 'focus', text: "Pagina's gebruiken de breedte: bijvoorbeeld de grafiek links en je recente sessies rechts, of de kalender naast het weekoverzicht." },
      { area: 'focus', text: 'Op brede schermen staat de timer vast rechts in beeld; op kleinere schermen start en pauzeer je hem vanuit de zijbalk.' },
      { area: 'focus', text: 'Op je telefoon blijft Focus zoals het was.' },
    ],
  },
  {
    id: 9,
    date: '2026-10-08',
    title: 'Focus: altijd een weg terug',
    items: [
      { area: 'focus', text: 'De rode ✕ naast de onderbalk van Focus staat nu ook op de computer, zodat je altijd terug kunt naar het dashboard (ook met een ingeklapte zijbalk).' },
    ],
  },
  {
    id: 8,
    date: '2026-10-08',
    title: 'Agenda: lessen van vorige dagen blijven echt staan',
    items: [
      { area: 'agenda', text: 'MijnX-lessen van gisteren werden elke nacht rond 00:05 toch nog gewist (tijdzonefout). Dat is opgelost: wat al begonnen of voorbij is, blijft altijd staan.' },
      { area: 'agenda', text: 'De lessen die zo zijn verdwenen (5 t/m 7 oktober) worden bij de volgende synchronisatie teruggezet.' },
    ],
  },
  {
    id: 7,
    date: '2026-10-08',
    title: 'Kleine verbeteringen',
    items: [
      { area: 'notities', text: 'Het menu bij rechtsklikken verschijnt nu bij je muis in plaats van ergens in het midden.' },
      { area: 'spotify', text: 'Afspelen vanuit zoeken begint nu altijd met het nummer dat je zocht, ook als shuffle aan staat; daarna volgt de radio.' },
    ],
  },
  {
    id: 6,
    date: '2026-10-07',
    title: 'Spotify: recent gezocht en radio',
    items: [
      { area: 'spotify', text: 'Onder de zoekbalk zie je wat je eerder zocht: nummers die je afspeelde en artiesten, albums en playlists die je opende. Tik om ze meteen weer te openen of af te spelen.' },
      { area: 'spotify', text: 'Speel je een nummer af vanuit zoeken, dan gaat de muziek daarna door met aanbevolen nummers: andere nummers van de artiest en vergelijkbare nummers uit hetzelfde genre.' },
    ],
  },
  {
    id: 5,
    date: '2026-10-07',
    title: 'Notities: links, mappen ordenen en sneller typen',
    items: [
      { area: 'notities', text: 'Links in notities zijn klikbaar en openen in je browser.' },
      { area: 'notities', text: 'Sleep mappen in de volgorde die jij wilt. Op je telefoon via Wijzig bij Mappen.' },
      { area: 'notities', text: 'Voeg scheidingslijnen tussen mappen toe, eventueel met een label, om ze te groeperen.' },
      { area: 'notities', text: 'Op je telefoon gaat bij een nieuwe notitie meteen het toetsenbord open.' },
      { area: 'app', text: 'Hypex AI is uit het menu gehaald.' },
    ],
  },
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
