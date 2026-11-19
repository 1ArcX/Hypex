// Update-log: wat er nieuw is per update. Nieuwste bovenaan, `id` loopt op.
// Na elke update die de gebruiker merkt een nieuw item bovenaan toevoegen (id + 1);
// de app toont bij de eerstvolgende keer openen een popup met alle nog niet geziene updates.
//
// area: 'dashboard' | 'agenda' | 'taken' | 'spotify' | 'notities' | 'focus' | 'recap' | 'geld' | 'app'

export const RELEASES = [
  {
    id: 49,
    date: '2026-11-20',
    title: 'Reistijd per lesdag',
    items: [
      { area: 'agenda', text: "De standaard reistijd voor je rooster telt nu per lesdag: heen alleen vóór de eerste les en terug alleen na de laatste. Lessen met een pauze ertussen (zoals lunch) horen bij hetzelfde blok, tenzij er meer dan 2 uur tussen zit." },
    ],
  },
  {
    id: 48,
    date: '2026-11-19',
    title: 'Recap kijkt naar de klok',
    items: [
      { area: 'recap', text: "Wat later vandaag nog gepland staat telt niet meer als 'blijven liggen' maar staat onder 'Nog te gaan vandaag', en de dag in uren telt tot nu (met apart wat nog gepland staat)." },
      { area: 'recap', text: "Agenda-items die voorbij zijn, ook vaste blokken zoals sport, staan onder 'gedaan of overgeslagen?'. Taken die al te laat waren tellen mee bij 'blijven liggen'; Claude ziet precies dezelfde lijst bij de recap en bij dag afsluiten." },
    ],
  },
  {
    id: 47,
    date: '2026-11-19',
    title: 'Recap laat je hele dag zien',
    items: [
      { area: 'recap', text: "Nieuw in je dagrecap: wat gepland stond tegenover wat je deed, met 'naar morgen' voor wat bleef liggen, je dag in uren (school, werk, persoonlijk, slaap apart, vrij), deadlines van de komende 3 dagen en een aftelling naar je volgende toets." },
      { area: 'recap', text: "Doelen voor morgen kun je aan een taak koppelen: zodra die taak klaar is, vinkt het doel zichzelf af." },
      { area: 'recap', text: "Studeren per vak in plaats van één totaal, en (bij Geld) vandaag uitgegeven tegenover je dagbudget, wat er deze week nog over is en je geen-uitgaven-dagen." },
      { area: 'recap', text: "De weekrecap opent nu de huidige week en laat per dag je taken en focustijd zien, ook als je geen dagrecaps hebt ingevuld." },
    ],
  },
  {
    id: 46,
    date: '2026-11-19',
    title: 'Claude plant slimmer',
    items: [
      { area: 'app', text: "Claude ziet nu na het aanmaken het hele item (type, duur, reistijd, vertrektijd), kiest zelf een passend type zoals Sport als je er geen noemt, weet wat je vandaag al hebt afgerond en kan je dag afsluiten (open taken naar morgen, na jouw akkoord)." },
      { area: 'agenda', text: "Standaard reistijd per locatie voor je rooster (bijv. R29 = 15 minuten): stel het in via Claude, dan krijgen alle lessen op die locatie automatisch een vertrektijd. Een eigen reistijd op een les gaat altijd voor." },
    ],
  },
  {
    id: 45,
    date: '2026-11-19',
    title: 'Routines en streaks kloppen weer',
    items: [
      { area: 'recap', text: "Routines tellen in Recap goed mee: afgevinkte routines vallen niet meer weg (geen 0/4 meer) en ook gisteren laat zien wat je hebt gedaan in plaats van '–'." },
      { area: 'app', text: "Streaks hebben nu een naam: Recap-streak (dagen op rij een recap), Studie-streak (dagen op rij gestudeerd). De badges op Statistieken heten 'Gewoontes 7d' enz.: behaalde badges, geen lopende streak." },
      { area: 'geld', text: "Negatieve bedragen staan er netjes als −€41 in plaats van €-41." },
      { area: 'dashboard', text: "Het weer staat standaard op Arnhem. Een andere plaats kies je door op het weer te tikken." },
    ],
  },
  {
    id: 44,
    date: '2026-11-19',
    title: 'Focus past nu bij de rest van Hypex',
    items: [
      { area: 'focus', text: "Focus heeft nu dezelfde kop en tabs als Taken (Overzicht · Vakken · Kalender · Inzichten) met '+ Vak' / '+ Sessie' en een timerknop rechtsboven; de zwevende balk en het rode kruisje zijn weg, de gewone navigatie blijft zichtbaar." },
      { area: 'focus', text: "Vakken zijn kaarten in plaats van een boekenplank: per vak de toets die eraan komt, je uren deze week en de voortgang van je onderwerpen. Gesorteerd op de eerstvolgende toets, en een waarschuwing als je een vak meer dan een week hebt laten liggen." },
      { area: 'focus', text: "Bij een nieuwe sessie of de timer staat het vak van je geplande taak (of je laatst gebruikte vak) al klaar, en kun je meteen een onderwerp kiezen dat meetelt voor de doeluren." },
    ],
  },
  {
    id: 43,
    date: '2026-11-19',
    title: 'Taken via Claude krijgen de juiste lengte',
    items: [
      { area: 'agenda', text: "Een taak met een tijd die Claude inplant (bijv. 15 minuten) staat nu ook zo lang in de agenda, in plaats van standaard een uur." },
    ],
  },
  {
    id: 42,
    date: '2026-11-18',
    title: 'Claude als studiecoach',
    items: [
      { area: 'focus', text: "Claude ziet je vakken, toetsdatums, onderwerpen, cijfers en studiesessies, en kan (na jouw akkoord) sessies loggen, vakken, toetsen en onderwerpen aanmaken en cijfers invullen." },
      { area: 'recap', text: "Claude kan je dag- en weekrecap voorbereiden met wat je echt deed (taken, studietijd, agenda, werk, uitgaven) en hem na jouw akkoord opslaan, inclusief doelen voor morgen." },
    ],
  },
  {
    id: 41,
    date: '2026-11-17',
    title: 'Geld via Claude: meer kunnen en duidelijker',
    items: [
      { area: 'geld', text: "Verwijder je een uitgave die van ING kwam, dan wordt die banktransactie genegeerd en komt hij niet terug bij de volgende sync. Hoorde hij bij je eigen invoer, dan staat hij weer in de inbox." },
      { area: 'geld', text: "Opnames en stortingen bij de geldautomaat heten nu 'Geldautomaat (opname)' of 'Geldautomaat (storting)' in plaats van een lege naam." },
      { area: 'app', text: "Claude kan een al toegevoegde banktransactie opnieuw verwerken (bijv. inkomen → Tikkie-terugbetaling), zoeken op bedrag, vaste inkomsten en eigen categorieën beheren, spaarrekeningen hernoemen, en laat zien welke uitgaven van spaargeld of tijdens een vakantie waren." },
    ],
  },
  {
    id: 40,
    date: '2026-11-17',
    title: 'Claude kent nu je hele planning',
    items: [
      { area: 'app', text: "De Claude-connector heet nu Hypex: naast je geld kan Claude je agenda (ook MijnX en WDK, met jouw aanpassingen), je werkuren, taken, afgeronde taken en notities zien." },
      { area: 'agenda', text: "Claude kan vrije momenten zoeken en (na jouw akkoord) taken en agenda-items inplannen, verplaatsen, afvinken of feed-items aanpassen. Wijzigingen verschijnen vanzelf in de app." },
      { area: 'notities', text: "Claude kan notities lezen, maken en aanvullen, bijvoorbeeld iets op je boodschappenlijst zetten." },
    ],
  },
  {
    id: 39,
    date: '2026-11-17',
    title: 'Reserveringen tellen mee in je budget',
    items: [
      { area: 'geld', text: "Reserveringen bij ING staan nu meteen als uitgave in je budget, met het label 'Reservering'. Zodra ING ze boekt wordt het dezelfde uitgave met het definitieve bedrag en de datum; vervalt een reservering, dan verdwijnt de uitgave." },
    ],
  },
  {
    id: 38,
    date: '2026-11-17',
    title: 'Bank: reserveringen zien',
    items: [
      { area: 'geld', text: "Betalingen die bij ING nog in verwerking zijn (reserveringen) staan nu meteen in de bank-inbox, in een grijs lijstje. Ze tellen nog niet mee; zodra ING ze boekt komen ze als gewone transactie binnen." },
    ],
  },
  {
    id: 37,
    date: '2026-11-17',
    title: 'Geld: overschrijdingen spreiden vanaf november',
    items: [
      { area: 'geld', text: "Te veel uitgegeven vóór november wordt niet meer van je budget afgetrokken; vanaf november wordt een overschrijding weer over de maanden erna gespreid." },
    ],
  },
  {
    id: 36,
    date: '2026-11-17',
    title: 'Bank: echte betaaldatum (ook voor je vakantie)',
    items: [
      { area: 'geld', text: "Uitgaven van ING krijgen nu de dag waarop je betaalde in plaats van de boekdatum (die is vaak 1–3 dagen later, zeker in het buitenland). Zo vallen vakantie-uitgaven in je vakantieperiode en uitgaven aan het eind van de maand in de juiste maand." },
      { area: 'geld', text: "'Opschonen' in de bank-inbox zet de datum van eerder toegevoegde ING-uitgaven ook goed." },
    ],
  },
  {
    id: 35,
    date: '2026-11-17',
    title: 'Spaarrekeningen: overboekingen zien',
    items: [
      { area: 'geld', text: "Tik bij Rekeningen op een spaarrekening om de overboekingen erheen en ervandaan te zien. Nog niet gekoppeld? Kies dan met één tik het spaarnummer (bv. F12156498) dat erbij hoort; vanaf dan loopt het saldo mee." },
    ],
  },
  {
    id: 34,
    date: '2026-11-17',
    title: 'Bank: spaaroverboekingen en Tikkies goed geteld',
    items: [
      { area: 'geld', text: "Overboekingen met je Oranje spaarrekeningen tellen niet meer als uitgave of inkomen — het is alleen geld verschuiven. Daardoor waren je uitgaven (en inkomsten) veel te hoog." },
      { area: 'geld', text: "Tikkies en terugbetalingen van vrienden worden een 'Terugbetaling': die verlaagt de uitgave waarvoor je voorschoot (zelfde categorie) in plaats van als inkomen te tellen." },
      { area: 'geld', text: "Met 'Opschonen' in de bank-inbox zet je eerder verkeerd geïmporteerde regels in één keer recht." },
    ],
  },
  {
    id: 33,
    date: '2026-11-17',
    title: 'Alleen ING vervangt nu echt alles',
    items: [
      { area: 'geld', text: "'Alleen ING' vervangt nu ook je invoer die al aan een ING-transactie gekoppeld was, zodat je overal de omschrijving van ING ziet. Je categorie en 'van spaargeld' blijven daarbij behouden; spaaropnames, stortingen en leningen blijven van jou." },
      { area: 'geld', text: "De knop 'Oudere maanden ophalen' laat zien dat hij bezig is." },
    ],
  },
  {
    id: 32,
    date: '2026-11-17',
    title: 'Bank: oudere maanden ophalen',
    items: [
      { area: 'geld', text: "Bij 'Alleen ING' in de bank-inbox kun je nu oudere maanden ophalen (tot 12 maanden terug). ING geeft dat meestal alleen vlak na opnieuw inloggen; lukt het niet, dan zie je een knop om opnieuw te koppelen." },
    ],
  },
  {
    id: 31,
    date: '2026-11-17',
    title: 'Geld: Alleen ING per maand en snel categorie kiezen',
    items: [
      { area: 'geld', text: "'Alleen ING' werkt nu voor elke maand waarvan ING gegevens heeft: kies de maand, bekijk wat er verandert en bevestig. Eerder genegeerde transacties gaan ook mee." },
      { area: 'geld', text: "Tik in een transactie op het icoontje om meteen een andere categorie te kiezen. Bij uitgaven van de bank onthoudt Hypex die keuze voor die winkel." },
    ],
  },
  {
    id: 30,
    date: '2026-11-17',
    title: 'Bank-inbox: slim vergelijken met je eigen invoer',
    items: [
      { area: 'geld', text: "De inbox vergelijkt je eigen invoer met je ING-afschrift, ook als je meerdere betalingen onder één kopje zette (bv. 'Eten €15,70' = twee pinbetalingen min een Tikkie). Kies Klopt om te koppelen of Gebruik ING om je invoer te vervangen door de losse transacties." },
      { area: 'geld', text: "Per dag zie je je eigen invoer naast de transacties en kun je een transactie zelf koppelen. Eigen invoer zonder bijpassende transactie staat onder 'Niet op je afschrift' (Klopt of Verwijderen)." },
      { area: 'geld', text: "Nieuw: 'Alleen ING' — vervang je losse eigen invoer van deze maand in één keer door de transacties van ING (je ziet eerst wat er verwijderd wordt)." },
    ],
  },
  {
    id: 29,
    date: '2026-11-17',
    title: 'Geld: spaarrekeningen en ING-details',
    items: [
      { area: 'geld', text: "ING deelt spaarrekeningen niet met apps, dus je voegt ze zelf toe bij Rekeningen (saldo + optioneel doel met voortgangsbalk). Hypex werkt het saldo daarna bij met elke overboeking van of naar die rekening." },
      { area: 'geld', text: "Bij uitgaven die van de bank komen zie je een ING-label; tik erop voor de tegenpartij, omschrijving, boekdatum en IBAN zoals op je afschrift." },
      { area: 'geld', text: "Je Geldcoach in Claude kan nu je afschriften doorzoeken (bv. alles bij de PLUS) en totalen per winkel maken, en ziet je spaarrekeningen met doelen." },
    ],
  },
  {
    id: 28,
    date: '2026-11-17',
    title: 'Bank-inbox: oude transacties in één keer negeren',
    items: [
      { area: 'geld', text: "Na het koppelen staan de transacties van de afgelopen 90 dagen in de inbox. Met één knop negeer je alles van vóór deze maand, zodat je alleen nieuwe transacties hoeft te verwerken." },
    ],
  },
  {
    id: 27,
    date: '2026-11-17',
    title: 'Geld: ING automatisch gekoppeld',
    items: [
      { area: 'geld', text: "Koppel je ING-rekeningen (alleen-lezen) in Geld: je ziet het saldo van je betaal- en spaarrekeningen en hoeveel je in totaal hebt gespaard. Bijwerken gebeurt bij openen en elke ochtend." },
      { area: 'geld', text: "Nieuwe banktransacties komen in een inbox met een voorgestelde categorie: tik Toevoegen of Negeren. Kies je een andere categorie, dan onthoudt Hypex dat voor die winkel. Wat je al zelf had ingevoerd, wordt herkend." },
      { area: 'geld', text: "Bij inkomstendag staat je saldo al ingevuld, en Claude kan via de connector ook je saldo's en de inbox bekijken." },
    ],
  },
  {
    id: 26,
    date: '2026-11-17',
    title: 'Geld: praat met Claude over je financiën',
    items: [
      { area: 'geld', text: "Je Geld-app is nu als connector aan Claude te koppelen: Claude kan je budget en uitgaven bekijken, feedback geven en transacties of budgetten voor je toevoegen, aanpassen of verwijderen." },
    ],
  },
  {
    id: 25,
    date: '2026-11-13',
    title: 'Nieuw uiterlijk',
    items: [
      { area: 'app', text: "Dash heeft een rustiger, warmer uiterlijk in de stijl van Claude en Zen browser: warme grijstinten en effen kaarten in plaats van zwart met neon." },
      { area: 'app', text: "Op de computer loopt de zijbalk over in de achtergrond en staat de pagina als één afgerond paneel ernaast. Grote titels en de klok staan in een serif-letter." },
      { area: 'app', text: "Kies bij Instellingen → Stijl tussen Claude (warm oranje), Eigen kleur (je eigen accentkleur) en Zen (neutraal wit/grijs)." },
    ],
  },
  {
    id: 24,
    date: '2026-11-13',
    title: 'Dashboard: compactere kaarten naast Spotify',
    items: [
      { area: 'dashboard', text: "Op een liggend scherm zijn de Pomodoro- en Geld-kaart niet meer uitgerekt tot de hoogte van Spotify, maar zo hoog als hun inhoud." },
      { area: 'dashboard', text: "Werkuren staat nu in dezelfde kolom eronder en vult de rest van de ruimte; de staafjes groeien mee." },
    ],
  },
  {
    id: 23,
    date: '2026-11-13',
    title: 'Geld: tekort-aftrek telt vanaf september',
    items: [
      { area: 'geld', text: "Overschrijdingen van vóór september 2026 worden niet meer van je budget afgetrokken; vanaf september telt alleen wat je vanaf dan te veel uitgeeft." },
    ],
  },
  {
    id: 22,
    date: '2026-11-02',
    title: 'Werkuren per kalendermaand',
    items: [
      { area: 'dashboard', text: "De periode bij Werkuren loopt nu van de 1e t/m de laatste dag van de maand, in plaats van de 25e t/m de 24e." },
    ],
  },
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
