# Hypex Dash — handleiding voor Gemini

Je werkt in **Hypex Dash** ("Hypex"): een persoonlijk dashboard van één student/werkende.
Live: https://hypexdash.netlify.app. De UI-tekst is **Nederlands**; schrijf nieuwe teksten ook in het Nederlands.
Dit bestand legt uit hoe de app werkt, waar alles staat en welke regels gelden. De volledige componentenkaart
(elk scherm → bestand) staat in `docs/components.md` en wordt hieronder geïmporteerd.

## 1. Stack in één oogopslag

| Onderdeel | Wat |
|---|---|
| Frontend | React 18 + Vite (JSX; TypeScript in `src/geld/`, `src/focus/`, `src/recap/`) |
| Styling | Tailwind + veel inline styles + CSS-variabelen (tokens in `src/index.css` `:root`, gespiegeld in `tailwind.config.js`) |
| Data/auth | Supabase (`src/supabaseClient.js`): Postgres + auth + realtime/presence. Migraties in `supabase/migrations/*.sql` (handmatig uitgevoerd in de Supabase SQL-editor) |
| State | Lokale React-state + kleine module-stores; Zustand in de sub-apps Geld, Focus, Recap; localStorage voor per-apparaat-voorkeuren |
| Backend | Netlify Functions in `netlify/functions/*` (CommonJS). Geplande taken via **Supabase pg_cron**, niet via Netlify-schema's |
| Hosting | Netlify (`netlify.toml`, build = `npm run build`, publish = `dist`). Push naar `main` = deploy |
| Desktop | Tauri v2-shell in `desktop/` die de live site laadt (Windows-installer in `public/downloads/Hypex-Setup.exe`) |
| Iconen/grafieken | lucide-react; Recharts (Geld/Focus/Recap) en eigen SVG (dashboard, stats) |

Commando's: `npm run dev` (Vite op poort 3000), `npm run build`, `npm run typecheck`.

## 2. Hoe de app in elkaar zit

- **Geen router.** `src/App.jsx` is het hart: auth-check, laden van taken/agenda/types, `activePage` (string)
  bepaalt welke pagina rendert. `PAGE_NAMES` / `PAGE_ORDER` in App.jsx koppelen key → titel.
  Zware pagina's zijn `React.lazy`. Een periodieke `doSync` (elke ~30 s en bij terugkeren naar de tab) haalt data opnieuw op.
- **Navigatie:** desktop = `src/components/Sidebar.jsx` (links of boven, optioneel automatisch verbergen),
  mobiel = `src/components/BottomNav.jsx` + de mobiele header inline in App.jsx.
- **Pagina's** in `src/pages/` (Dashboard, Agenda, Taken, Notities, Statistieken, Jumbo, Geld-shim …) en drie
  **sub-apps** met eigen map, store en CSS:
  - `src/focus/` — studietracker/timer (vervangt de oude Pomodoro-pagina), styles `.fx-*`
  - `src/recap/` — dagelijkse/wekelijkse evaluatie + doelen, styles `.rc-*`
  - `src/geld/` — budget, enveloppen, bankkoppeling (alleen admin)
  - `src/notes/` — Apple-Notes-achtige notities, styles `.nx-*`
- **Gedeelde UI:** `src/components/ui/` (Card, KpiTile, FilterTabs, Pill, TypeSelect, …). Gebruik die in plaats van nieuwe varianten.
- **Gedeelde logica:** `src/utils/` — o.a. `recurrence.js` (herhaling, routines, `toISO`/`todayISO`), `taskStatus.js`
  (te laat/urgent/meerdaags), `itemSave.js` (taak/event opslaan), `externalEvents.js` (geïmporteerde agenda + overrides),
  `quickAdd.js` (NL-tekst → velden), `workHours.js`, `timeRange.js`, `category.js` (types/kleuren).
- **Events tussen onderdelen:** `window.dispatchEvent(new Event('refreshTasks'))`, `refreshCalendarEvents`,
  `refreshExternalCalendarEvents`, `notesChanged` …

## 3. Features (kort)

- **Dashboard** — begroeting, KPI-chips, zoeken (Ctrl K), klok, weer, *TodayFocusCard* (Vandaag + Volgende met vertrektijd),
  Pomodoro/Geld-mini-widgets, Spotify-bediening (OAuth PKCE in de browser), Werkuren, Deadlines, Komende dagen, regengrafiek.
- **Agenda** — week/dag/maand-rooster (`Timeline.jsx`) met eigen events, taken, lessen en werkdiensten; slepen; reistijd-blokken;
  geïmporteerde feeds (Google/MijnX via `calendar-sync`) die je via overrides aanpast; mobiel Dag/Lijst/Maand.
- **Taken** — Overzicht (per dag, slepen), Vandaag/Morgen, Gedaan (logboek `task_completions`), routines met streaks,
  één modal voor taak én event (`ItemModal.jsx`, met quick-add).
- **Focus** — stopwatch/pomodoro, vakken, onderwerpen met doeluren, kalender-heatmap, inzichten, cijfercalculator, herinneringen.
- **Recap** — dagrecap (scores, wat ging goed, doelen voor morgen, gepland vs gedaan), weekrecap, geschiedenis.
- **Notities** — mappen, vastzetten, afvinklijsten, inplannen als taak; inhoud blijft platte tekst.
- **Geld** (admin) — maandbudget, enveloppen, jaar, terugkerend inkomen, sparen, ING-koppeling via Enable Banking (alleen-lezen).
- **Jumbo** (admin/`werk_tab`) — PMT-diensten en vrachttijden met kaart.
- **Instellingen** — stijl/accentkleur, navigatie, types, agenda's koppelen, update-log, desktop-app.
- **Claude-connector (MCP)** — `netlify/functions/geld-mcp/` (planner.js, study.js, recurring.js, geld-tools):
  een AI-assistent kan agenda, taken, notities, focus, recap en geld lezen/bewerken. URL bevat een geheim token — nooit loggen of delen.
- Inactief maar nog in de code: School (Magister/SOMtoday), Gewoontes, Gym, Hypex AI, oude Pomodoro-pagina.

## 4. Een onderdeel vinden

Als de gebruiker informeel naar iets verwijst ("de sidebar", "de stats-kaart", "het inlogscherm", "Werkuren"):
1. **Zoek het eerst op in `docs/components.md`** (naam, alias, zichtbare tekst of plek) en open de genoemde bestanden.
   Scan niet eerst de hele repo.
2. Matcht het met meerdere onderdelen: noem de kandidaten met bestandspad en vraag welke bedoeld is.
3. Matcht niets: zoek op de exacte zichtbare tekst, vertel welk onderdeel het bleek te zijn en vul de kaart aan.
4. Sommige kaarten staan **inline** in een paginabestand (bv. dashboardkaarten in `src/pages/DashboardPage.jsx`).

## 5. Regels bij elke wijziging

- **Update-log:** bij elke wijziging die de gebruiker merkt, in dezelfde commit een item bovenaan `RELEASES` in
  `src/changelog.js` (id + 1, datum, korte titel, per onderdeel één zin in het Nederlands, `area` uit de lijst bovenin dat bestand).
  De app toont na de update automatisch een popup.
- **Componentenkaart bijhouden:** onderdeel toegevoegd/hernoemd/verplaatst/verwijderd of gedrag veranderd → `docs/components.md` bijwerken in dezelfde commit.
- **Datums:** gebruik `toISO(d)` / `todayISO()` (Geld: `toISODate`/`todayStr`). **Nooit** `toISOString().slice(0,10)` (UTC → verkeerde dag na middernacht).
  Server-code rekent in Europe/Amsterdam.
- **Gespiegelde logica:** de connector (CommonJS) kopieert regels uit de app (recurrence, workHours, budget, bankCore ↔ `src/geld/lib/bankRules.ts`,
  `recurring.js` ↔ `src/geld/lib/recurring.ts`, `complete_task` ↔ `handleToggleTask` in App.jsx). Wijzig je de ene kant, wijzig de andere mee.
- **Supabase-schema:** nieuwe kolommen/tabellen via een nieuw bestand in `supabase/migrations/`; code moet blijven werken als de migratie
  nog niet is gedraaid (val terug of toon een melding). Ga niet uit van kolommen die niet in een migratie staan.
- **Netlify-limiet:** gratis plan, elke functie-aanroep telt. Geen schema's in `netlify.toml`, client-polling zeldzaam en gepauzeerd als de tab verborgen is.
- **Geheimen:** nooit tokens, keys of de connector-URL committen of tonen. Grote secrets staan in de Supabase Vault.
- **Git:** commit lokaal met een duidelijke Engelse commit-message; **push alleen na expliciet akkoord** van de gebruiker
  (push = live deploy). `dist/` en `public/version.json` veranderen bij elke build — niet apart committen.
- **Testen:** `npm run build` moet slagen. Voor connector-logica: kleine node-scripts met een nep-Supabase. UI-wijzigingen controleer je in de dev-server
  (desktop én mobiele breedte).
- De losse `test-*.cjs`-bestanden in de root zijn oude experimenten (PMT/Magister), geen testsuite.

## 6. Componentenkaart

@./docs/components.md
