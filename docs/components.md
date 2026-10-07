# HypexDash — Component Map

Fast lookup for resolving informal component references ("de sidebar", "de stats-kaart",
"het inlogscherm") to the right file(s). Keep this file in sync when components change.

## Stack

- **Framework:** React 18 + Vite (JSX, some TypeScript in `src/geld/`)
- **Routing:** *No router library.* Navigation is state-based via `activePage`
  (a string) in [App.jsx](../src/App.jsx). Pages are conditionally rendered, not URL-routed.
  Page key → title mapping lives in `PAGE_NAMES` / `PAGE_ORDER` in App.jsx.
  Less-used/heavy pages (School, Gewoontes, Gym, Jumbo, Stats, Geld, Hypex AI) are `React.lazy`-loaded behind one `<Suspense>` in App.jsx.
- **Styling:** Tailwind CSS + heavy inline styles + CSS variables (`--accent`, `--bg-base`,
  `--text-1/2/3`, `--border`) defined in [index.css](../src/index.css) and set at runtime in App.jsx.
- **State/data:** Supabase ([supabaseClient.js](../src/supabaseClient.js)) for auth + DB;
  Zustand store only in the Geld sub-app; localStorage/sessionStorage for caching and per-device prefs.
- **Charts:** Recharts (Geld) + hand-rolled SVG (dashboard, stats). **Icons:** lucide-react. **Maps:** maplibre-gl (Vrachttijden).
- **Language:** UI text is Dutch. Aliases below list both Dutch and likely English references.

## Route / page overview

Pages switch via `activePage`; set in App.jsx. Desktop labels come from [Sidebar.jsx](../src/components/Sidebar.jsx),
mobile labels from [BottomNav.jsx](../src/components/BottomNav.jsx) (can differ — e.g. `dashboard` = "Dashboard" on desktop, "Home" on mobile).

| `activePage` | Page component | Nav label(s) | Main children | Access |
|---|---|---|---|---|
| `dashboard` | [pages/DashboardPage.jsx](../src/pages/DashboardPage.jsx) | Dashboard / Home | TodayFocusCard, Clock, SpotifyWidget, WeatherWidget | all |
| `agenda` | [pages/AgendaPage.jsx](../src/pages/AgendaPage.jsx) | Agenda | Timeline (desktop), mobile: Dag (WeekStrip + Timeline) / Lijst (AgendaList) / Maand (MonthGrid) | all |
| `taken` | [pages/TakenPage.jsx](../src/pages/TakenPage.jsx) | Taken | FilterTabs, TaskOverview (Overzicht, default), TodayView (Vandaag/Morgen), TasksWidget (other filters) | all |
| `focus` | [focus/FocusPage.tsx](../src/focus/FocusPage.tsx) | Focus / (in "Meer") | Focus sub-app (see below): Home, Vakken, Kalender, Inzichten, timer | all |
| `pomodoro` | [pages/PomodoroPage.jsx](../src/pages/PomodoroPage.jsx) | — (**INACTIVE**, replaced by Focus; a stored `activePage: 'pomodoro'` redirects to `focus`) | PomodoroTimer → PomodoroHero (+ Vandaag / SessionGoalCard / Focus playlist cards); below: StudieBuddiesWidget, PomodoroStats, sessie-log | all |
| `notities` | [pages/NotitiesPage.jsx](../src/pages/NotitiesPage.jsx) | Notities | NotesApp (Apple Notes, `src/notes/`) | all |
| `statistieken` | [pages/StatsPage.jsx](../src/pages/StatsPage.jsx) | Statistieken / Stats | (self-contained SVG bar charts) | all |
| `jumbo` | [pages/JumboPage.jsx](../src/pages/JumboPage.jsx) | Jumbo ★ | WorkWidget, VrachttijdenWidget | admin or `werk_tab` profile |
| `geld` | [pages/GeldPage.jsx](../src/pages/GeldPage.jsx) → [geld/GeldPage.tsx](../src/geld/GeldPage.tsx) | Geld | Geld sub-app (see below) | admin only |
| `hypexai` | [pages/HypexAIPage.jsx](../src/pages/HypexAIPage.jsx) | Hypex AI | DagbriefingStrip + AI briefing, chips, chat | admin only |
| `school` | [pages/SchoolPage.jsx](../src/pages/SchoolPage.jsx) | — | MagisterWidget | **INACTIVE** (hidden from nav, June 2026) |
| `gewoontes` | [pages/GewoontesPage.jsx](../src/pages/GewoontesPage.jsx) | — | HabitsWidget | **INACTIVE** |
| `gym` | [pages/GymPage.jsx](../src/pages/GymPage.jsx) | — | GymWidget | **INACTIVE** |

> Auth flow (before a session exists) renders [AuthPage.jsx](../src/components/AuthPage.jsx);
> password recovery renders [PasswordResetPage.jsx](../src/components/PasswordResetPage.jsx). See App.jsx guards.

## Layout & navigation

- **Sidebar** — [components/Sidebar.jsx](../src/components/Sidebar.jsx)
  - Aliases: "de sidebar", "left menu", "linker menu", "navigatie" (desktop), "zijbalk"
  - Where: desktop only (`hidden md:block` in App.jsx). Contains logo "Hypex", "Zoeken" (Ctrl K), nav items (`.hx-nav-item`, red overdue badge on Taken), Instellingen/Admin/Uitloggen, VersionChecker, avatar.
  - Layouts (per device, `nav_layout` in localStorage via [hooks/useNavLayout.js](../src/hooks/useNavLayout.js), set in ThemeSettings "Navigatie"):
    `orientation="vertical"` (left, 208px, always icon + text) or `orientation="horizontal"` (100px top bar `.hx-topbar`; nav buttons always with text, each in a `.hx-tilt-slot` and rotated 45° with the end bottom-right; only the active page is drawn as a pill, the others are plain slanted text; nav scrolls horizontally when narrow).
    **Auto-hide**: wrapper `.hx-nav-wrap.is-auto` slides in from a 6px hot-zone (`.hx-nav-hotzone`) at the left/top edge. Aliases: "taakbalk", "navigatie boven", "icoonbalk", "automatisch verbergen".
  - Related: BottomNav (mobile equivalent), VersionChecker.

- **BottomNav** — [components/BottomNav.jsx](../src/components/BottomNav.jsx)
  - Aliases: "bottom nav", "tab bar", "onderbalk", "onderste menu", "de tabs", "Meer-menu" (the "…"/More sheet)
  - Where: mobile only. Primary tabs (Home/Agenda/Taken/Notities) + a "Meer" bottom sheet for the rest. Swipe between primary tabs.
  - Hidden in the Focus and Geld sub-apps (their own tab bar has a red ✕ back to Home, `onHome` / `onClose` from App) and on Notities (own floating bar with red ✕).
  - Related: Sidebar.

- **Mobile header / top bar** — inline in [App.jsx](../src/App.jsx) (the `md:hidden` 52px bar)
  - Aliases: "top bar", "mobiele header", "titelbalk", "sync-knop", "settings-knop bovenaan"
  - Where: top of every page on mobile (not on Notities, which has its own iOS nav bar). Centered page title (`PAGE_NAMES`), sync dot, settings gear. Height includes `env(safe-area-inset-top)` (iOS status bar is black-translucent, so the app runs under the clock/Dynamic Island). No separate file.

## Feature components

### Dashboard (CSS grid classes `.dash-*` in index.css, container queries on `.dash-scroll` = container `dash`)
- **DashboardPage** — [pages/DashboardPage.jsx](../src/pages/DashboardPage.jsx), order top → bottom:
  1. (PomodoroBanner sits above the page, rendered by App.jsx — see below.)
  2. Header: greeting + date + KPI chips (`.dash-chip`: urgent / te laat / open → Taken), search ("Zoek in Hypex…", CommandPalette), inline `Clock`, compact `WeatherWidget`.
  3. **TodayFocusCard** (Vandaag + Volgende).
  4. Desktop: `.dash-media` row — left a stack of PomodoroMiniWidget (hidden while the timer banner shows) + GeldMiniWidget (admin), right `SpotifyWidget variant="hero"` (≈⅔ width, fixed height, scrolls inside). Portrait windows (`vp.portrait`, `.dash-media.is-column`): Pomodoro + Geld side by side, Spotify full width below. Mobile: `.dash-widgets` (Pomodoro, Geld) and `SpotifyWidget compact` at the bottom.
  5. Extras: "Deadlines", "Nog in te plannen", `RainCard` (regen grafiek).
  6. Tall: "Komende dagen" (next 6 days, `.dash-week`, 🚗 departure time).
  Cards use `Card glow` (Spotify-style colour glow, `.glow-card`). Aliases: "KPI's", "chips", "deadlines kaart", "regen grafiek", "komende dagen", "nog in te plannen".
- **Dashboard components** — `src/components/dashboard/`:
  [TodayFocusCard](../src/components/dashboard/TodayFocusCard.jsx) — top of the dashboard: "Vandaag" (accent glow: progress, "Eerst dit" = overdue + urgent, tasks per daypart, routines as tick chips, "Schema" timeline of today with now-line, 🚗 travel chips, tick boxes; "Alle taken" → Taken Overzicht) and "Volgende" (glow in the item's colour: countdown, or with reistijd "Vertrek over 12 min" / "Vertrek nu!" + "Vertrek om 18:40 · 20 min reistijd"; ‹ ›, filter Alle/Agenda/Werk/Taken, "Nu bezig"). On narrow widths Volgende comes first. Aliases: "vandaag kaart", "focus kaart", "volgende afspraak", "schema vandaag", "eerst dit", "vertrektijd".
  [PomodoroBanner](../src/components/dashboard/PomodoroBanner.jsx) — wide bar at the top of **every tab except Focus** while a Pomodoro/stopwatch runs (rendered in App.jsx between the mobile header and the page, wrapper `.app-pomo-banner`; one compact row on mobile): big time, mode + task, session dots, progress, Pauzeer/Hervat (writes `pomodoro_v3`, local only) and Open. Aliases: "pomodoro balk", "timer banner".
  [pomodoroState.js](../src/components/dashboard/pomodoroState.js) (`readPomodoro`, `pausePomodoro`, `resumePomodoro`) and [useToday.js](../src/components/dashboard/useToday.js) (`useTodayItems`, `useNextEvent`, `useCurrentItem`, `useMinuteTick`) are shared helpers.
  [PomodoroMiniWidget](../src/components/dashboard/PomodoroMiniWidget.jsx) (reads `pomodoro_v3`, opens Pomodoro page, glow in mode colour, streak-chip 🔥 + "vandaag / dagdoel" via useFocusProgress),
  [GeldMiniWidget](../src/components/dashboard/GeldMiniWidget.jsx) (reuses Geld hooks `useBudgetStats`, read-only; ING-style dark card `.ing-card` with orange accents and a lion watermark [LionMark](../src/components/dashboard/LionMark.jsx) (the lion from the ING app icon, `public/brand/ing-lion.png`, orange on transparent, bleeding off the bottom-right like the app; falls back to an own geometric lion), "Bijna op" under 15%, red rim when over budget). Aliases: "geld widget", "ing kaart".
- **Clock** — [components/Clock.jsx](../src/components/Clock.jsx) — clock; `variant="inline"` for the dashboard header, `isBreak` tints it. Aliases: "klok", "de tijd".
- **CommandPalette** — [components/CommandPalette.jsx](../src/components/CommandPalette.jsx) — "Zoek in Hypex" (Ctrl/⌘K, sidebar "Zoeken", dashboard search field): tasks, agenda items, notes, pages, "Nieuwe taak". Aliases: "zoeken", "search", "command palette", "cmd k".
- **WeatherWidget** — [components/WeatherWidget.jsx](../src/components/WeatherWidget.jsx) — weather + PWA-install prompt trigger; `compact` = header chip that opens the full widget in a popup. Aliases: "weer", "weerwidget". Data: open-meteo/buienalarm, `weather_coords` in localStorage.
- **SpotifyWidget** — [components/SpotifyWidget.jsx](../src/components/SpotifyWidget.jsx) — Spotify remote control ("mini Spotify"). `compact` = small card (mobile dashboard, Focus playlist: track + prev/play/next). `variant="hero"` = desktop dashboard card (right of the Pomodoro/Geld stack, `.dash-media`): tabs **Nu** (cover, seek, shuffle/repeat, volume, ♥ like, Wachtrij, Laatst afgespeeld) · **Zoeken** · **Bibliotheek** (Playlists / Albums / Gelikt), with **Songtekst** on the right when the card is ≥680px wide (otherwise a 4th tab); the divider `.sp-split` is draggable (also ←/→, double-click = default), ratio per device in `sp_split`. Styles `.sp-*`. Aliases: "spotify", "muziek", "now playing", "mini spotify", "songtekst", "lyrics".
  Code in `src/components/spotify/`: [spotifyApi.js](../src/components/spotify/spotifyApi.js) (OAuth **PKCE in the browser**, no Netlify function; `sp()` wrapper with token refresh, 429 back-off; Spotify API as of Feb 2026: `/me/library`, `/playlists/{id}/items` only for own playlists, search ≤10, no artist top tracks), [usePlayer.js](../src/components/spotify/usePlayer.js) (shared module store, one poller: 3s playing / 10s paused / stopped when hidden, refetch on focus; optimistic play/pause/skip confirmed by a short burst poll; actions run in sequence; no active device → transfers to the last device), [SearchView](../src/components/spotify/SearchView.jsx), [LibraryView](../src/components/spotify/LibraryView.jsx), [DetailView](../src/components/spotify/DetailView.jsx) (album/playlist/artist), [LyricsView](../src/components/spotify/LyricsView.jsx) (LRCLIB, synced lines, click = seek), [TrackRow](../src/components/spotify/TrackRow.jsx) (+ `MediaTile`). New scopes (library/playlists) → users with an older token see "Koppel opnieuw".

### Tasks / taken
- **TasksWidget** — [components/TasksWidget.jsx](../src/components/TasksWidget.jsx) — main task list with groups, drag-reorder, complete. Aliases: "takenlijst", "taken widget", "de takenlijst".
- **TaskOverview** — [components/tasks/TaskOverview.jsx](../src/components/tasks/TaskOverview.jsx) — Taken tab "Overzicht" (default): all tasks with their day. Left a highlighted "Vandaag" card (TodayView with `compactHeader` + `showDone` = "Afgerond vandaag") and under it "Nog in te plannen" (open tasks without a date), right "Komende dagen": per day (Morgen, Overmorgen, weekday + date, "over N dagen") the open one-off tasks + one compact routine line (next 14 days), week separators "Week 42". Taken slepen (niet routines) naar Vandaag, een dag of "Nog in te plannen" (= datum weg); tijdens slepen alle komende 14 dagen als drop-vak. Two columns via container query (≥820px), one column on mobile. Styles `.task-overview*`. Aliases: "overzicht", "taken overzicht", "alle taken per dag", "komende dagen".
- **TodayView** — [components/TodayView.jsx](../src/components/TodayView.jsx) — Vandaag/Morgen view inside TakenPage: progress header ("X van Y voltooid" + bar), collapsible sections Urgent / Te laat / dagdelen (Overig) / Routines. Aliases: "vandaag view", "vandaag-lijst", "voortgang".
- **TaskRow** — [components/tasks/TaskRow.jsx](../src/components/tasks/TaskRow.jsx) — shared compact task row (dot, title, subtitle, date/streak pill, flag, delete-on-hover, checkbox right); used by TodayView + TasksWidget. Styles `.task-row*` in index.css. Aliases: "taakrij", "task row".
- **ItemModal** — [components/ItemModal.jsx](../src/components/ItemModal.jsx) — one modal for tasks **and** own agenda items, with an **Event | Taak** switch for new items (formerly TaskModal + the inline Timeline event modal).
  From the agenda (Nieuw, spatie, klik in het rooster) it opens with a **keuzestap** (`chooseKind`): big Event | Taak switch with a glow, rest blurred; E / T or ←/→ + Enter. On desktop agenda (`preview`) it is a **paneel rechts** (`.item-panel`, width `--split-w`; split-screen): the grid stays visible on the left, starts in week view, jumps to day view once you pick a day (multi-day → week), a click in the grid while open takes over that slot (`pick`), closing restores the previous view.
  Shared: title with quick-add — also when editing; text already in the title is ignored (`utils/quickAdd.js`, e.g. "morgen 14:00-15:30 wiskunde #school !urgent", "19 t/m 25 okt", "19/10 - 25/10", dayparts "vanavond", "morgenochtend", "vrijdagavond", "'s middags" (task → daypart; event → time window 09–12 / 13–17 / 19–22), duration "1.5u" / "30m" / "2 uur" (also without a start time), reistijd "reis 20m" / "terug 15m"; recognised parts shown as removable chips, removing one restores the original value), `TypeSelect`, date chips (Vandaag/Morgen/Rest week ma–vr/Volgende week/Geen datum), Van + Tot en met (multi-day), Hele dag / Tijdslot + duration chips, overlap warning.
  Taak: reistijd bij een tijdslot (`tasks.travel_before/after`, migration `add_task_travel_time.sql`), dagdeel, prioriteit, herhaling, Meer opties (beschrijving, vak, deadline, groep), "Beschikbare momenten". Event: reistijd heen/terug ([agenda/TravelTimeField.jsx](../src/components/agenda/TravelTimeField.jsx), `calendar_events.travel_before/after`, migration `add_travel_time.sql`), beschrijving, event-herhaling. Edit mode: Dupliceer, verwijderen. Ctrl+Enter saves, Esc closes.
  Saving via [utils/itemSave.js](../src/utils/itemSave.js) (`saveTask`/`saveEvent`/…, dispatches `refreshTasks`/`refreshCalendarEvents`). Opened from App (Taak) and Timeline "Nieuw"/empty slot (Event, with `onDraftChange` live preview: dashed ghost block in the grid). Rendered in a portal on `<body>`. Free-slot/overlap helpers: [tasks/slotPlanning.js](../src/components/tasks/slotPlanning.js).
  Aliases: "taak toevoegen", "nieuwe taak", "taak bewerken", "task modal", "task popup", "event modal", "nieuw event", "event/taak modal", "quick add".
- **TaskDetailModal** — [components/TaskDetailModal.jsx](../src/components/TaskDetailModal.jsx) — read-only task detail + start pomodoro + edit/delete. Aliases: "taak detail", "taakdetail popup".

### Agenda
- **Timeline** — [components/Timeline.jsx](../src/components/Timeline.jsx) — full week/day/month calendar grid (desktop agenda) with Magister/SOMtoday lessons, events, tasks, work shifts. Hour height scales with window height (`hourHeight()`, ~15 h in view); ≥96px/h shows 15-min lines + ":30" labels and clicks snap to the quarter. Narrow-but-tall windows show the rail as a strip below the grid (`.agenda-shell`). Category-colored blocks (`blockStyle`), red now-line with time pill, right rail `SideRail` (legend "Kleuren" = all types + "Toon verborgen" toggle for hidden feed items, continuous scrolling mini month [agenda/MiniMonth.jsx](../src/components/agenda/MiniMonth.jsx) (weeks under each other, months flow into each other, other-month days dimmed, title follows scroll, ‹ › scroll a month and move the agenda, ISO week numbers: click = go to that week), `.agenda-rail`, ≥1280px). Tasks with a daypart (ochtend/middag/avond) and no time render as one compact dashed block per daypart per day (header "🌙 Avond · 2" + **+** = new task in that daypart, then the tasks), as tall as its content, placed in the first free gap inside the daypart (08–12 / 12–17 / 17–22, `DAYPART_RANGE`) at full column width; only when there is no gap it shares columns with events. Clicks next to the tasks fall through to the grid (new event). Events and timed tasks with reistijd get light striped blocks above/below (🚗, `travelStyle`) that also take up layout space. Timed tasks show their time under the title. **Slepen**: events/taken met tijd naar een andere tijd/dag (kwartier, gestippeld doelblok, duur blijft); hele-dag-/dagdeel-taken naar een andere dag, of in het rooster loslaten = krijgt die tijd; taak naar de DAG-strook = tijd eraf; routines/herhalende events alleen tijd; geïmporteerde items via overrides; auto-scroll bij de rand, Esc annuleert. Spatie (outside inputs) = Nieuw. Day strip ("DAG"): multi-day items (tasks with `end_date`, own all-day events over several days) render as one continuous bar in lanes above the per-day items (‹ › when they continue outside the week). Imported items load via `utils/externalEvents.js` (overrides applied; ✎ = edited) and open **ExternalEventModal**. Aliases: "timeline", "agenda grid", "week weergave", "kalender", "legenda", "mini kalender".
- **ExternalEventModal** — [components/agenda/ExternalEventModal.jsx](../src/components/agenda/ExternalEventModal.jsx) — imported (Google/MijnX) item: feed info (code, locatie, beschrijving) + edit title, type, hele dag/tijden, eigen notitie, Verbergen, Herstel origineel. Option "Ook toepassen op de N andere items met de titel …" (MijnX stores multi-day items per day, e.g. herfstvakantie). Edits (incl. reistijd heen/terug) are stored in `external_event_overrides` and survive every sync. Aliases: "geïmporteerd item", "feed item aanpassen", "verbergen".
- **WeekStrip** — [components/agenda/WeekStrip.jsx](../src/components/agenda/WeekStrip.jsx) — week day picker (busy dots, ‹ ›, swipe) above the mobile day view and the desktop day view (Timeline). Aliases: "weekstrook", "dagkiezer", "bovenbalk dagweergave".
- **MonthGrid** — [components/agenda/MonthGrid.jsx](../src/components/agenda/MonthGrid.jsx) — mobile month view in Apple/iCloud style: months under each other, coloured chips per day (events, lessons, work, tasks; "+N"), multi-day items as continuous bars. Zoom with the slim vertical rail on the right (in a 14px gutter next to Sunday; drag up = zoom in) or Ctrl+scroll (dots only → chips → two-line chips with times; `agenda_month_zoom` in localStorage), "Vandaag" button; tap a day = day view. AgendaPage loads all imported events itself for the mobile views. Aliases: "maandweergave mobiel", "maand", "icloud agenda", "uitzoomen".
- **AgendaList** — [components/AgendaList.jsx](../src/components/AgendaList.jsx) — mobile agenda list ("Niets gepland de komende weken"). Aliases: "agenda lijst", "agenda mobiel".

### Pomodoro
- **PomodoroTimer** — (page INACTIVE, see Focus) [components/PomodoroTimer.jsx](../src/components/PomodoroTimer.jsx) — UI on top of `usePomodoroEngine`; timer state/logic (Focus/Pauze/Lange pauze), cycle settings, session complete, cross-device sync (incl. sessie doel + checklist via a `goals` broadcast). Compact card variant for widgets; `fullPage` renders PomodoroHero. Aliases: "pomodoro timer", "de timer", "focus timer". State: `pomodoro_v3` (timer, goal, checklist) + `pomodoro_ambient` (focus sound, volume, background `scene`: `'auto'` or a scene id — per device). Durations: Focus ≤180, Pauze ≤60, Lange pauze ≤90 min, 1–12 sessies per cyclus in localStorage.
- **PomodoroHero** — [components/pomodoro/PomodoroHero.jsx](../src/components/pomodoro/PomodoroHero.jsx) — the Pomodoro page hero: animated background (SceneCanvas) + "Achtergrond" picker (top-right; Automatisch = follows focus sound), mode tabs, big ring (click the time to type minutes, scroll/↑↓ ±1, Shift ±5), "Waar werk je aan?", time chips (+ chip for a custom value), focus-sound tiles + volume, reset/Start focus/settings popover (eindsignaal, meldingen, sliders + number fields, sessies-per-cyclus stepper), card row slot. Styles `.pomo-*` in index.css. Aliases: "pomodoro hero", "sfeervolle achtergrond", "achtergrond kiezen", "focus modes", "tijdopties", "startknop".
- **SceneCanvas / scenes** — [components/pomodoro/SceneCanvas.jsx](../src/components/pomodoro/SceneCanvas.jsx) + [scenes.js](../src/components/pomodoro/scenes.js) — canvas-animated scenes (Nacht, Regen, Oceaan, Haardvuur, Aurora, Rustig), ~30 fps, paused when hidden/off-screen, static under reduced motion; `sceneThumb()` renders cached previews. Aliases: "achtergrond", "animatie", "scène".
- **SessionGoalCard** — [components/pomodoro/SessionGoalCard.jsx](../src/components/pomodoro/SessionGoalCard.jsx) — "Sessie doel": Doel (preset or a task) | Checklist (tasks + own items). Task items are synced with Taken (ticking completes the task; completed elsewhere = ticked). Aliases: "sessie doel", "intentie", "checklist".
- **Pomodoro layout** — ring size is `--ring` on `.pomo-page` (container `pomo`); tall windows (≥1300px high) drop the 100vh hero, enlarge the ring and put StudieBuddies + PomodoroStats side by side (`.pomo-below-grid`) so everything fits on one screen; short windows (≤820px) shrink the ring.
  StudieBuddies, PomodoroStats and the sessie-log are rendered **inside** the hero via `renderFooter` (PomodoroTimer → PomodoroHero `footer`, `.pomo-below`, glass cards). The scene layer `.pomo-bg` is sticky and `--scene-h` tall (= min(hero, visible height of `.pomo-page`), measured in PomodoroHero), so the background always reaches the bottom of the screen, also while scrolling. The hero uses `overflow: clip` (not hidden) so sticky works.
- **Pomodoro cards** — inline in [pages/PomodoroPage.jsx](../src/pages/PomodoroPage.jsx) via `renderCards`: `TodayCard` ("Vandaag": dagdoel-ring met live voortgang van de lopende sessie, streak-chip 🔥 (grijs = geen, gestippeld = "in gevaar"), sessies vandaag, week ↑%, cyclus dots), SessionGoalCard, `SpotifyWidget compact title="Focus playlist"`. Aliases: "voortgang vandaag", "focus playlist", "focus muziek".
- **RewardScreen** — [components/pomodoro/RewardScreen.jsx](../src/components/pomodoro/RewardScreen.jsx) — beloningsscherm na een **focus**sessie (vervangt dan `CompletionPopup`; pauze-einde blijft de simpele popup): "+25 min" telt op, dagdoel-ring loopt vol (groen bij doel), streak 🔥 +1 bij eerste sessie van de dag, laatste 7 dagen als heat-vakjes (vandaag kleurt bij), hoogtepunten alleen bij echte doorbraken (record langste focusdag, streak-mijlpaal 3/7/14/30…, totaal-uren 10/25/50/100…), "Deze week … ↑ x%" (of "nog … tot vorige week"), XP. Reduced motion = geen animatie. Styles `.reward-*`. Aliases: "beloningsscherm", "sessie klaar popup", "reward", "dopamine scherm".
- **useFocusProgress** — [hooks/useFocusProgress.js](../src/hooks/useFocusProgress.js) — gedeelde module-store voor focusvoortgang uit `pomodoro_sessions` (+ lokale `pomodoro_stats`, max per dag): `useFocusProgress(userId)` → `{ todayMins, goal, streak, longest, atRisk, week, prevWeek, weekDelta, bestBefore, totalMins, last7 }`; `recordFocusSession(mins)` (PomodoroTimer, vóór `pomodoro_stats` wordt bijgewerkt) → `{ before, after, highlights }`; `loadFocusDays(userId, {force})`; dagdoel `setDailyGoal` (localStorage `focus_daily_goal`, standaard 2u, instelbaar in de timer-instellingen "Dagdoel focus"); `fmtFocus(mins)`. Gebruikt door RewardScreen, Pomodoro "Vandaag"-kaart, PomodoroMiniWidget.
- **FocusMode** — [components/FocusMode.jsx](../src/components/FocusMode.jsx) — full-screen focus overlay (used by PomodoroTimer). Aliases: "focus mode", "focus overlay", "focus scherm".
- **PomodoroStats** — [components/PomodoroStats.jsx](../src/components/PomodoroStats.jsx) — weekly focus-minutes stats. Aliases: "pomodoro stats", "focus statistieken".
- **StudieBuddiesWidget** — [components/StudieBuddiesWidget.jsx](../src/components/StudieBuddiesWidget.jsx) — shows who is studying now (Supabase presence). Aliases: "studiebuddies", "wie is online", "study buddies".

### Notes / habits / gym
- **Notities (Apple Notes)** — [notes/NotesApp.jsx](../src/notes/NotesApp.jsx) via [pages/NotitiesPage.jsx](../src/pages/NotitiesPage.jsx), own styles [notes.css](../src/notes/notes.css) under `.nx` (Dash theme: accent = chosen theme colour `--accent`, Dash surfaces). **Desktop = Mac Notes**: folders sidebar | list | editor (right-click = menu; right-click anywhere in the folder column = "Nieuwe map"). **Phone = iPhone Notes**: stack Mappen → Lijst → Notitie with iOS push/pop animations, swipe back from the left edge, large titles that collapse, floating glass bottom bar (`FloatBar` in parts.jsx) with a red ✕ back to Home like Focus/Geld (in a note: the tools; with the keyboard open a toolbar above it); App hides the mobile header + BottomNav on this page.
  Folders: "Alle notities", "Notities" (no folder), user folders; folder menu (⋯ / long-press / right-click): rename, **Afvinkbaar** (`note_folders.checkable` → each note gets a circle, checked = `notes.done_at`, moves to "Afgerond"), delete. List: sections Vastgezet / Vandaag / Gisteren / Vorige 7 / 30 dagen / month / year, checklist progress "3/7", swipe left = Zet vast / Verwijder (full swipe deletes; "Herstel" toast). Editor [NoteEditor.jsx](../src/notes/NoteEditor.jsx): **one contentEditable document** (title = first line, every line a `.nx-line` div with `data-type`; circles/bullets/numbers are CSS `::before`, so mouse selection, Ctrl+A, copy and delete work across lines and copy gives plain text). Structural edits (Enter continues the list, empty item + Enter ends it, Backspace at line start removes formatting/merges, paste, multi-line delete) go through [docModel.js](../src/notes/docModel.js) via `beforeinput`; own undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), toolbar Aa (Kop, Tekst, opsomming, genummerd, afvinklijst), checklist button, pin, check off, new note; phone toolbar sits above the keyboard. Empty notes disappear when you leave them.
  Content stays **plain text** in `notes.content` ([noteFormat.js](../src/notes/noteFormat.js): `# kop`, `- [ ]`/`- [x]`, `- `, `1. `), so CommandPalette search and Hypex AI keep working. Data: [useNotes.js](../src/notes/useNotes.js) (debounced save, optimistic pin/done/move, `restoreNote` for undo); helpers in [parts.jsx](../src/notes/parts.jsx). Migration [add_notes_apple.sql](../supabase/migrations/add_notes_apple.sql) (`pinned`, `done_at`, `checkable`); without it pin/check-off show a notice.
  Aliases: "notities", "notes", "apple notes", "kladblok", "afvinklijst", "boodschappenlijst", "checklist", "updates afvinken", "vastzetten", "mappen".
- **HabitsWidget** — [components/HabitsWidget.jsx](../src/components/HabitsWidget.jsx) — habits/streaks (Gewoontes page, INACTIVE). Aliases: "gewoontes", "habits", "streaks".
- **GymWidget** — [components/GymWidget.jsx](../src/components/GymWidget.jsx) — workout tracking, awards XP (Gym page, INACTIVE). Aliases: "gym", "workout", "training". State: `gym_active_workout` in localStorage.

### School (INACTIVE)
- **MagisterWidget** — [components/MagisterWidget.jsx](../src/components/MagisterWidget.jsx) — tabs: Vakken, Laatste cijfers, Huiswerk, Studiewijzer, Opdrachten. Aliases: "magister", "school widget", "cijfers", "huiswerk", "studiewijzer". Data: `magisterApi.js` / `somtodayApi.js`.
- **SubjectsWidget** — [components/SubjectsWidget.jsx](../src/components/SubjectsWidget.jsx) — "Mijn Vakken". **Appears unused (?)** — not rendered anywhere. Aliases: "vakken", "mijn vakken".

### Jumbo (work — admin/`werk_tab`)
- **WorkWidget** — [components/WorkWidget.jsx](../src/components/WorkWidget.jsx) — PMT/Jumbo work shifts. Aliases: "werk", "diensten", "rooster werk", "PMT". Data: `/.netlify/functions/pmt`, `pmt_work_shifts` in localStorage.
- **VrachttijdenWidget** — [components/VrachttijdenWidget.jsx](../src/components/VrachttijdenWidget.jsx) — freight/truck arrival times with a maplibre route map. Aliases: "vrachttijden", "vrachtwagen", "route map", "truck times".

### Hypex AI
- **DagbriefingStrip** — [components/ai/DagbriefingStrip.jsx](../src/components/ai/DagbriefingStrip.jsx) — structured briefing tiles (Urgent, Te laat, Volgende afspraak, Dagbudget) from real data above the AI text. Aliases: "dagbriefing", "briefing".

### Settings / admin / onboarding / auth
- **ThemeSettings** — [components/ThemeSettings.jsx](../src/components/ThemeSettings.jsx) — "Instellingen": accent color presets + eigen kleur, "Live preview" mini-UI, "Navigatie" (links/boven + automatisch verbergen, desktop, per device), meldingen, "Types" (TypesManager), external calendars, "Desktop-app" download (Windows browsers only, hidden inside the app via `window.__HYPEX_DESKTOP__`). Aliases: "instellingen", "settings", "thema", "accentkleur".
- **TypesManager** — [components/TypesManager.jsx](../src/components/TypesManager.jsx) — "Types" in Instellingen: rename, recolour, reorder, add, delete (items move to Overig; Overig can't be deleted). Aliases: "types", "categorieën", "soorten", "kleur per type".
- **CalendarConnections** — [components/CalendarConnections.jsx](../src/components/CalendarConnections.jsx) — "Agenda's koppelen" (Google / MyX). Opened from ThemeSettings. Per connection a tag button opens
  [agenda/FeedTypeSettings.jsx](../src/components/agenda/FeedTypeSettings.jsx): standaardtype + titelregels ("titel bevat ___ → type"), stored on `calendar_connections.default_type_id` / `type_rules`.
  The sync **diffs** instead of delete+insert (`diffEvents`), and logs added/changed/removed items to `external_calendar_changes` (not on a feed's first sync). Items that started before today are never removed by a sync (MijnX only sends from today on), so history is kept; `loadExternalEvents` pages through >1000 rows.
  Sync: scheduled Netlify function `calendar-sync` (every 15 min, all users, via `syncAll` in `netlify/functions/calendar/calendar.js`) + `autoSyncCalendars()` in App `doSync` (max every 5 min per device, then `refreshExternalCalendarEvents`). Auto syncs skip a connection synced < 4 min ago; the refresh button forces. Aliases: "agenda koppelen", "calendar connections", "externe agenda's".
- **AdminPanel** — [components/AdminPanel.jsx](../src/components/AdminPanel.jsx) — "Admin Paneel": user management, push test, `werk_tab` toggle. Aliases: "admin", "admin paneel", "gebruikersbeheer".
- **OnboardingModal** — [components/OnboardingModal.jsx](../src/components/OnboardingModal.jsx) — first-login flow ("Welkom bij Dash", location, Magister, notifications). Aliases: "onboarding", "welkom scherm", "intro".
- **ProfileSetup** — [components/ProfileSetup.jsx](../src/components/ProfileSetup.jsx) — "Welkom! 👋" profile setup. **Appears unused (?)** — not rendered anywhere. Aliases: "profiel instellen".
- **AuthPage** — [components/AuthPage.jsx](../src/components/AuthPage.jsx) — login/signup ("Student Dashboard"). Aliases: "login", "inlogscherm", "auth", "aanmelden".
- **PasswordResetPage** — [components/PasswordResetPage.jsx](../src/components/PasswordResetPage.jsx) — "Nieuw wachtwoord" reset. Aliases: "wachtwoord reset", "password reset".

### Small / global
- **VersionChecker** — [components/VersionChecker.jsx](../src/components/VersionChecker.jsx) — shows/refreshes app version. Aliases: "versie", "version".
- **FeedChangesToast / FeedChangesSheet** — [components/FeedChanges.jsx](../src/components/FeedChanges.jsx) — "Agenda bijgewerkt: MijnX: 2 nieuw · 1 gewijzigd" toast after a sync with unseen `external_calendar_changes`; "Bekijk" opens the list (old → new, "Jouw aanpassing blijft actief"), "Gezien"/× sets `seen_at`, clicking an item jumps to it in the agenda. Rendered by App. Aliases: "feed wijzigingen", "agenda bijgewerkt", "wijzigingen melding".
- **WhatsNew / update-log** — [components/WhatsNew.jsx](../src/components/WhatsNew.jsx) + data in [changelog.js](../src/changelog.js) (`RELEASES`, newest first, `id` increments; `unseenReleases()` / `markReleasesSeen()`, per device in localStorage `changelog_seen`; first visit = only the last 3 days). After login App shows a popup "Wat is er nieuw" with **all** unseen updates stacked as a timeline (newest open, older collapsed with area chips + count, "Hele update-log"); also opened from Instellingen → "Wat is er nieuw (update-log)". Phone = bottom sheet, desktop = centred window. Styles `.wn-*` in index.css. Aliases: "update log", "changelog", "wat is er nieuw", "release notes", "update popup".
- **XPToast** — [components/XPToast.jsx](../src/components/XPToast.jsx) — floating "+XP" toast on task/pomodoro/gym completion. Aliases: "xp toast", "xp popup", "punten melding".

## Focus sub-app (`src/focus/`, replaces Pomodoro)

Rebuild of the iOS app **EstudyLog** ("Make your hard work visible"): study tracker with a stopwatch/pomodoro timer, courses, calendar heatmap and insights. TypeScript + Zustand, own styles in [focus.css](../src/focus/focus.css) under `.fx` (tokens `--fx-*`, `data-theme="dark|light"`, theme choice in Focus settings: **Dash** (default: Dash surfaces/text/typography, accent = chosen theme colour, tiles tinted with Dash colours, active filters as accent-soft) / Licht (EstudyLog look, orange `#F58A2C`) / Systeem). `--fx-orange` = the accent (`ORANGE` in meta.ts = `var(--fx-orange)`). Floating pill tab bar + floating timer button (bottom right). Aliases: "focus", "focus tab", "estudylog", "studietracker", "de nieuwe pomodoro".
- **Shell** — [FocusPage.tsx](../src/focus/FocusPage.tsx): internal tabs `home | courses | calendar | insights` (`focus_tab` in localStorage), course detail replaces the view, sheets, timer engine (`usePomodoroEngine`), migration banner when `add_focus_app.sql` hasn't run.
- **Views** (`src/focus/views/`): [HomeView](../src/focus/views/HomeView.tsx) "Overzicht" (streak 🔥 + Langste, Vandaag / Deze week, tiles Studietijd/Sessies/Gem. productiviteit/Actieve vakken, "Studievolume" area chart 7d/30d/90d/1j with ↑%, "Recente sessies"); [CoursesView](../src/focus/views/CoursesView.tsx) "Vakken" (status pills Actief/Gepauzeerd/Afgerond/Archief, total + colour bar, **boekenplank** `.fx-book`); [CourseDetail](../src/focus/views/CourseDetail.tsx) (course-colour header, "N dagen tot …" + timeline, Vakstatistieken: persoonlijk record, gem. sessie, sessies, gem. score, Sessie-verdeling donut, "Bestudeerd (N)" topic rings, Belangrijke datums, Cijfercalculator card, Sessies); [CalendarView](../src/focus/views/CalendarView.tsx) "Kalender" (Uren/Sessies/Daggem. with ↑% vs same days last month, month heatmap, course filter, sessions per day, Weekoverzicht bars); [InsightsView](../src/focus/views/InsightsView.tsx) "Inzichten" (Waar je tijd heen ging = streamgraph per vak, Wanneer je studeert = radial 24h clock + peak window, beste dag/uren by ★); [TimerSheet](../src/focus/views/TimerSheet.tsx) (vak/onderwerp/soort chips, Stopwatch | Pomodoro, ring, start/pause/stop, notities, focusgeluid).
- **Sheets** (`src/focus/sheets/`): [SessionDone](../src/focus/sheets/SessionDone.tsx) (★ + notitie → RewardScreen in orange), [SessionEditor](../src/focus/sheets/SessionEditor.tsx) (add manually / edit / delete), [CourseEditor](../src/focus/sheets/CourseEditor.tsx) (naam, code, kleur, status, start, eindtoets, onderwerpen + doeluren), [RemindersSheet](../src/focus/sheets/RemindersSheet.tsx) ("Herinner me" chips 1 dag/1 week…, om 09:00, volgende herinnering preview, datums tijdlijn), [GradeCalculator](../src/focus/sheets/GradeCalculator.tsx) (weging %, cijfers, T = tentamen → benodigd cijfer), [FocusSettings](../src/focus/sheets/FocusSettings.tsx).
- **Data** — [store/focusStore.ts](../src/focus/store/focusStore.ts) (courses, dates, topics, gradeParts, sessions of the last 400 days; CRUD; `needsMigration`). Tables `focus_courses`, `focus_course_dates`, `focus_topics`, `focus_grade_parts` + extra columns on `pomodoro_sessions` (`started_at, course_id, topic_id, kind, rating, note, task_id, timer_kind`) — migration [add_focus_app.sql](../supabase/migrations/add_focus_app.sql). Logic in `src/focus/lib/` (`stats.ts`, `grade.ts`, `reminders.ts`, `format.ts`, `meta.ts` = session kinds Lezen/Opdracht/Oefenen/Herhalen + course colours). Charts in `src/focus/charts/` (Recharts + own SVG `TopicRing`, `RadialClock`).
- **Timer engine** — [components/pomodoro/usePomodoroEngine.js](../src/components/pomodoro/usePomodoroEngine.js): all timer logic (formerly inside PomodoroTimer): pomodoro cycles **and** `timerKind: 'stopwatch'` (`swAccum`/`swStart`), session `meta` (course/topic/kind/note/taskId), cross-device sync, `pomodoro_v3`, `finishFocusSession` (insert with Focus fields, XP, `recordFocusSession`). Dashboard banner/widget/Clock show stopwatch time too.
- **Reminders** — scheduled Netlify function `focus-reminders` (every 15 min, Europe/Amsterdam, web-push, `sent_offsets` per date).

## Geld sub-app (`src/geld/`, admin only)

Self-contained money/budget app, mounted via [pages/GeldPage.jsx](../src/pages/GeldPage.jsx) →
[geld/GeldPage.tsx](../src/geld/GeldPage.tsx). Own Zustand store, own tab bar. TypeScript.

- **Tabs** (bottom [TabBar](../src/geld/components/TabBar.tsx), center + button opens ActionSheet):
  - `home` → [views/HomeView.tsx](../src/geld/views/HomeView.tsx) — "Home" (balance, this month; the "Nog over deze maand" hero is an ING-style dark `.ing-card` with LionMark). Aliases: "geld home", "budget overzicht".
  - `enveloppen` → [views/EnveloppenView.tsx](../src/geld/views/EnveloppenView.tsx) — "Enveloppen" (envelope budgeting). Aliases: "enveloppen", "envelopjes". Tapping a card opens EnvelopeSheet.
  - `jaar` → [views/JaarView.tsx](../src/geld/views/JaarView.tsx) — "Jaar" (yearly overview). Aliases: "jaar", "jaaroverzicht".
- **Sheets:** [AnalyseSheet](../src/geld/sheets/AnalyseSheet.tsx), [InkomstenSheet](../src/geld/sheets/InkomstenSheet.tsx),
  [UitgavenSheet](../src/geld/sheets/UitgavenSheet.tsx), [SearchSheet](../src/geld/sheets/SearchSheet.tsx). Aliases: "analyse", "inkomsten", "uitgaven", "zoeken".
  Tapping a day in the Analyse heatmap opens UitgavenSheet with `dayFilter` (that day only, "Hele maand" clears it).
- **EnvelopeSheet** — [sheets/EnvelopeSheet.tsx](../src/geld/sheets/EnvelopeSheet.tsx) — envelope/category detail: budget status, KPIs (aantal, gemiddeld, vorige maand), planned + transactions in the category, "+ Uitgave" (prefilled category) and "Budget aanpassen". Aliases: "envelop detail", "categorie detail".
- **Modals:** [ExpenseModal](../src/geld/modals/ExpenseModal.tsx) ("uitgave toevoegen"),
  [IncomeDayModal](../src/geld/modals/IncomeDayModal.tsx), [RecurringIncomeModal](../src/geld/modals/RecurringIncomeModal.tsx),
  [SavingsModal](../src/geld/modals/SavingsModal.tsx), [BudgetModal](../src/geld/modals/BudgetModal.tsx).
- **Charts** (`src/geld/charts/`): [BalanceLine](../src/geld/charts/BalanceLine.tsx), [CategoryDonut](../src/geld/charts/CategoryDonut.tsx),
  [DayHeatmap](../src/geld/charts/DayHeatmap.tsx), [WeekBars](../src/geld/charts/WeekBars.tsx).
- **Rows/headers:** [TransactionRow](../src/geld/components/TransactionRow.tsx), [MonthHeader](../src/geld/components/MonthHeader.tsx), [ActionSheet](../src/geld/components/ActionSheet.tsx).
- **Store/hooks/lib:** [store/geldStore.ts](../src/geld/store/geldStore.ts) (Zustand), hooks in `src/geld/hooks/`
  (`useExpenses`, `useBudgetConfig`, `useBudgetStats`, `useRecurringIncome`, `useSavingsData`, `useYearExpenses`, `useMonthNav`, …),
  logic in `src/geld/lib/` (`budget`, `categories`, `format`, `recurring`, `savings`, `weekBudget`, `year`), types in [types/index.ts](../src/geld/types/index.ts).
  Data: Supabase `expenses` table.

## UI primitives / design system (Hypex v2)

- **Tokens** live in [index.css](../src/index.css) `:root` (`--c-*` colors, `--accent*`, `--cat-*` category colors,
  `--r-*` radii, `--s-*` spacing, `--fs-*` type sizes). Legacy vars (`--text-1`, `--bg-card`, `--border`…) are aliases.
  Mirrored in [tailwind.config.js](../tailwind.config.js) (`bg-accent/20`, `bg-surface`, `border-line`, `rounded-r-lg`, `text-cat-school`…).
  Global classes: `.card`, `.card-interactive`, `.card-tone` (+ `--tone`), `.card-urgent`, `.btn-primary`, `.btn-ghost`, `.btn-neon`,
  typography roles `.t-display/.t-kpi/.t-page/.t-section/.t-card/.t-body/.t-meta/.t-badge/.t-overline`, `.tnum`.
- **Shared components** — [components/ui/](../src/components/ui/index.js) (import from `components/ui`):
  - `Card`, `CardHeader`, `CardLink` — [Card.jsx](../src/components/ui/Card.jsx). `Card glow="accent"|color` = Spotify-style blurred colour background (`.glow-card`, `--glow`; `.glow-card--soft` = fainter). For large or scrolling surfaces use the class `.glow-bg` (gradient background, no overflow) — used on the agenda grid, settings modal and Hypex AI briefing tiles. Statistieken cards each have their own glow colour. Aliases: "kaart", "card header", "Bekijk alles-link".
  - `KpiTile` — [KpiTile.jsx](../src/components/ui/KpiTile.jsx). Aliases: "KPI tegel", "stats tile".
  - `TypeSelect` — [TypeSelect.jsx](../src/components/ui/TypeSelect.jsx) — type dropdown (colour dot + name, "+ Nieuw type"); value = category (built-in key or custom type id). Aliases: "type dropdown", "type kiezen".
  - `ListRow`, `CheckButton` — [ListRow.jsx](../src/components/ui/ListRow.jsx). Aliases: "lijstrij", "taakrij", "afvinkknop".
  - `Pill`, `CountBadge` — [Pill.jsx](../src/components/ui/Pill.jsx). Aliases: "pill", "badge", "datum pill", "teller".
  - `ProgressBar` — [ProgressBar.jsx](../src/components/ui/ProgressBar.jsx). Aliases: "voortgangsbalk".
  - `SectionHeader` — [SectionHeader.jsx](../src/components/ui/SectionHeader.jsx) (collapsible group header).
  - `FilterTabs` — [FilterTabs.jsx](../src/components/ui/FilterTabs.jsx) (pills or segmented). Aliases: "filter tabs", "Dag/Week/Maand".
  - `DragGhost` — [DragGhost.jsx](../src/components/ui/DragGhost.jsx) — zwevend label bij de pointer tijdens slepen. Aliases: "sleeplabel".
  - `IconButton` — [IconButton.jsx](../src/components/ui/IconButton.jsx) (requires `label`). `EmptyState` — [EmptyState.jsx](../src/components/ui/EmptyState.jsx).
  - `toneColor` / `tint` — [tone.js](../src/components/ui/tone.js): tone name → token color.
- **Task status** — [utils/taskStatus.js](../src/utils/taskStatus.js): `isOverdue` (excl. routines, uses the last day), `isUrgent`, `daysLate`, `shortDate`, and multi-day helpers `taskOnDay(t, ds)` / `taskLastDate` / `isMultiDay` / `spanLabel` ("ma–vr") — one definition for Dashboard, Sidebar badge, Taken, Agenda. Tasks have an optional `end_date`: shown on every day, one checkbox completes the whole task.
- **Upcoming items** — [utils/upcoming.js](../src/utils/upcoming.js): `buildUpcoming()` (tasks, lessons, events, PMT shifts) + `countdownLabel()`; used by Dashboard and Hypex AI.
- **Event names** — [utils/eventTitle.js](../src/utils/eventTitle.js): `eventDisplay(ev)` → readable course name + code for MyX events.
- **Dates** — use `toISO(d)` / `todayISO()` from [utils/recurrence.js](../src/utils/recurrence.js) (Geld: `toISODate`/`todayStr`/`fmtDay` in `geld/lib/format.ts`) for YYYY-MM-DD keys — **never** `toISOString().slice(0,10)` (UTC → wrong day after midnight).
- **Greeting** — [utils/greeting.js](../src/utils/greeting.js): `greeting()` (Goedenacht/-morgen/-middag/-avond), used by Dashboard + Hypex AI.
- **Version check** — [utils/version.js](../src/utils/version.js): `fetchLatestVersion()` (deduped), used by App + VersionChecker.
- **Types / category colors** — [utils/category.js](../src/utils/category.js): `taskCategory`, `eventCategory`, `categoryColor`, `CATEGORIES`/`CATEGORY_ORDER` (live), `typeIdOf`, `categoryHex`.
  User types live in Supabase `item_types` (built-ins school/werk/persoonlijk/routine/overig by `key`, custom types by id), loaded by
  [hooks/useItemTypes.js](../src/hooks/useItemTypes.js) (`loadItemTypes` in App, `useItemTypes()` store) → `setTypes()`; built-in colours also set `--cat-<key>`.
  Resolution: item `type_id` → (imported: override type → feed title rule → feed default type) → legacy guess from source/colour. The type decides the colour.
  Schema: [supabase/migrations/add_types_feed_overrides.sql](../supabase/migrations/add_types_feed_overrides.sql) (`item_types`, `tasks.type_id/end_date`, `calendar_events.type_id`, feed overrides, change log).
- **Imported events** — [utils/externalEvents.js](../src/utils/externalEvents.js): `loadExternalEvents` (applies `external_event_overrides`, converts all-day UTC to local days, attaches `connection`), `saveOverrides`/`resetOverrides`, `loadUnseenChanges`/`markChangesSeen`.
- **Quick-add** — [utils/quickAdd.js](../src/utils/quickAdd.js): `parseQuickAdd(text)` → `{ title, fields, tokens }` (Dutch dates/days/ranges, times, durations → `fields.duration` (a bare "1u"–"4u" is a duration, "om 3u" a time), reistijd → `travelBefore`/`travelAfter`, "hele dag", `#type`, `!urgent`).
- `src/geld/components/ui/` — [Glass.tsx](../src/geld/components/ui/Glass.tsx) (glass card + `Spinner`),
  [Sheet.tsx](../src/geld/components/ui/Sheet.tsx) (bottom-sheet shell). Geld wrappers, now built on the same tokens.

## Hooks & utils (non-visual, for reference)

- App hooks: [hooks/useIsDesktop.js](../src/hooks/useIsDesktop.js), [hooks/useViewport.js](../src/hooks/useViewport.js) (`{ w, h, tall, portrait }`, for JS-driven sizes), [hooks/useNavLayout.js](../src/hooks/useNavLayout.js) (nav position/auto-hide), [hooks/usePointerDrag.js](../src/hooks/usePointerDrag.js) (slepen met muis/touch: `bind(item)`, drop-zones via `data-drop`, `dropKeyAt`; touch = eerst vasthouden), [hooks/useItemTypes.js](../src/hooks/useItemTypes.js) (types store), [hooks/useAmbientSound.js](../src/hooks/useAmbientSound.js).
- Utils (`src/utils/`): `magisterApi`, `somtodayApi` (school), `push` (web-push), `xp` (XP/level-up events),
  `recurrence` (recurring tasks), `calendarSync`, `daypart`, `alleVakken`, `openBook`, `openExternal`, `supabaseProfiles`.

## Desktop app (`desktop/`, Windows .exe)

- Tauri v2 shell that loads the **live site** `https://hypexdash.netlify.app` — no copy of the frontend,
  so every Netlify deploy appears in the app automatically. Logic in [desktop/src-tauri/src/lib.rs](../desktop/src-tauri/src/lib.rs):
  auth/`about:blank`/same-site popups open as in-app windows (keeps `window.opener`/`postMessage` working for
  Google agenda + Simacan), other `window.open` / `_blank` links go to the default browser; single instance; remembers window size.
- Build: `cd desktop && npm run release` → builds the NSIS installer and copies it to `public/downloads/Hypex-Setup.exe`
  (served by Netlify; linked from ThemeSettings). The app injects `window.__HYPEX_DESKTOP__ = true`.
  Only rebuild when the shell itself changes (icon, window behaviour). Aliases: "desktop app", "exe", "pc app", "tauri".

## Known unused / naming notes

- **Unused components (verify before relying):** `SubjectsWidget`, `WeekBudgetWidget`
  ([components/WeekBudgetWidget.jsx](../src/components/WeekBudgetWidget.jsx), aliases "week budget", "budget widget"),
  and `ProfileSetup` — defined but not imported/rendered anywhere as of this map. (?)
- **Two GeldPage files:** [pages/GeldPage.jsx](../src/pages/GeldPage.jsx) is a re-export shim; the real one is
  [geld/GeldPage.tsx](../src/geld/GeldPage.tsx). "De geld pagina" = the `.tsx`.
- **INACTIVE pages** (school, gewoontes, gym) are hidden from nav but code is intact.
