# HypexDash — Component Map

Fast lookup for resolving informal component references ("de sidebar", "de stats-kaart",
"het inlogscherm") to the right file(s). Keep this file in sync when components change.

## Stack

- **Framework:** React 18 + Vite (JSX, some TypeScript in `src/geld/`)
- **Routing:** *No router library.* Navigation is state-based via `activePage`
  (a string) in [App.jsx](../src/App.jsx). Pages are conditionally rendered, not URL-routed.
  Page key → title mapping lives in `PAGE_NAMES` / `PAGE_ORDER` in App.jsx.
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
| `dashboard` | [pages/DashboardPage.jsx](../src/pages/DashboardPage.jsx) | Dashboard / Home | Clock, FocusCard, SpotifyWidget, WeatherWidget | all |
| `agenda` | [pages/AgendaPage.jsx](../src/pages/AgendaPage.jsx) | Agenda | Timeline (desktop), AgendaList (mobile) | all |
| `taken` | [pages/TakenPage.jsx](../src/pages/TakenPage.jsx) | Taken | TasksWidget, TodayView | all |
| `pomodoro` | [pages/PomodoroPage.jsx](../src/pages/PomodoroPage.jsx) | Pomodoro / (in "Meer") | PomodoroTimer, StudieBuddiesWidget, PomodoroStats | all |
| `notities` | [pages/NotitiesPage.jsx](../src/pages/NotitiesPage.jsx) | Notities | NotesWidget | all |
| `statistieken` | [pages/StatsPage.jsx](../src/pages/StatsPage.jsx) | Statistieken / Stats | (self-contained SVG bar charts) | all |
| `jumbo` | [pages/JumboPage.jsx](../src/pages/JumboPage.jsx) | Jumbo ★ | WorkWidget, VrachttijdenWidget | admin or `werk_tab` profile |
| `geld` | [pages/GeldPage.jsx](../src/pages/GeldPage.jsx) → [geld/GeldPage.tsx](../src/geld/GeldPage.tsx) | Geld | Geld sub-app (see below) | admin only |
| `hypexai` | [pages/HypexAIPage.jsx](../src/pages/HypexAIPage.jsx) | Hypex AI | (chat/assistant UI) | admin only |
| `school` | [pages/SchoolPage.jsx](../src/pages/SchoolPage.jsx) | — | MagisterWidget | **INACTIVE** (hidden from nav, June 2026) |
| `gewoontes` | [pages/GewoontesPage.jsx](../src/pages/GewoontesPage.jsx) | — | HabitsWidget | **INACTIVE** |
| `gym` | [pages/GymPage.jsx](../src/pages/GymPage.jsx) | — | GymWidget | **INACTIVE** |

> Auth flow (before a session exists) renders [AuthPage.jsx](../src/components/AuthPage.jsx);
> password recovery renders [PasswordResetPage.jsx](../src/components/PasswordResetPage.jsx). See App.jsx guards.

## Layout & navigation

- **Sidebar** — [components/Sidebar.jsx](../src/components/Sidebar.jsx)
  - Aliases: "de sidebar", "left menu", "linker menu", "navigatie" (desktop), "zijbalk"
  - Where: desktop only (`hidden md:block` in App.jsx). Contains logo "Hypex", nav items, Instellingen/Admin/Uitloggen, VersionChecker, avatar.
  - Related: BottomNav (mobile equivalent), VersionChecker.

- **BottomNav** — [components/BottomNav.jsx](../src/components/BottomNav.jsx)
  - Aliases: "bottom nav", "tab bar", "onderbalk", "onderste menu", "de tabs", "Meer-menu" (the "…"/More sheet)
  - Where: mobile only. Primary tabs (Home/Agenda/Taken/Notities) + a "Meer" bottom sheet for the rest. Swipe between primary tabs.
  - Related: Sidebar.

- **Mobile header / top bar** — inline in [App.jsx](../src/App.jsx) (the `md:hidden` 52px bar)
  - Aliases: "top bar", "mobiele header", "titelbalk", "sync-knop", "settings-knop bovenaan"
  - Where: top of every page on mobile. Centered page title (`PAGE_NAMES`), sync dot, settings gear. No separate file.

## Feature components

### Dashboard
- **DashboardPage internals** — [pages/DashboardPage.jsx](../src/pages/DashboardPage.jsx)
  - `Clock` hero, `FocusCard` ("Nu bezig"/"Urgent"/"Vandaag" focus kaart), the 3-tile stats row
    ("Urgent" / "Te laat" / "Open"), "Schema vandaag" strip, "Volgende" + "Deadlines" cards, rain graph, "Nog in te plannen".
  - Aliases for the tiles/cards: "focus kaart", "stats-kaart", "urgent tile", "te laat tile", "open tile",
    "schema vandaag", "volgende gebeurtenis", "deadlines kaart", "regen grafiek". These are **inline in DashboardPage.jsx**, not separate files.
- **Clock** — [components/Clock.jsx](../src/components/Clock.jsx) — big dashboard clock; `isBreak` tints it. Aliases: "klok", "de tijd".
- **WeatherWidget** — [components/WeatherWidget.jsx](../src/components/WeatherWidget.jsx) — weather + PWA-install prompt trigger. Aliases: "weer", "weerwidget". Data: open-meteo/buienalarm, `weather_coords` in localStorage.
- **SpotifyWidget** — [components/SpotifyWidget.jsx](../src/components/SpotifyWidget.jsx) — Spotify now-playing/queue/recent. Aliases: "spotify", "muziek", "now playing". Data: Spotify OAuth via netlify function.

### Tasks / taken
- **TasksWidget** — [components/TasksWidget.jsx](../src/components/TasksWidget.jsx) — main task list with groups, drag-reorder, complete. Aliases: "takenlijst", "taken widget", "de takenlijst".
- **TodayView** — [components/TodayView.jsx](../src/components/TodayView.jsx) — mobile "today" heading + task view inside TakenPage. Aliases: "vandaag view", "vandaag-lijst".
- **TaskModal** — [components/TaskModal.jsx](../src/components/TaskModal.jsx) — create/edit a task (title, time, subject, priority, recurrence, daypart). Aliases: "taak toevoegen", "nieuwe taak", "taak bewerken", "task modal", "task popup".
- **TaskDetailModal** — [components/TaskDetailModal.jsx](../src/components/TaskDetailModal.jsx) — read-only task detail + start pomodoro + edit/delete. Aliases: "taak detail", "taakdetail popup".

### Agenda
- **Timeline** — [components/Timeline.jsx](../src/components/Timeline.jsx) — full week/day calendar grid (desktop agenda) with Magister/SOMtoday lessons, events, tasks, work shifts. Aliases: "timeline", "agenda grid", "week weergave", "kalender".
- **AgendaList** — [components/AgendaList.jsx](../src/components/AgendaList.jsx) — mobile agenda list ("Niets gepland de komende weken"). Aliases: "agenda lijst", "agenda mobiel".

### Pomodoro
- **PomodoroTimer** — [components/PomodoroTimer.jsx](../src/components/PomodoroTimer.jsx) — the timer (Focus/Pauze/Lange pauze), cycle settings, session complete. Aliases: "pomodoro timer", "de timer", "focus timer". State: `pomodoro_v3` in localStorage.
- **FocusMode** — [components/FocusMode.jsx](../src/components/FocusMode.jsx) — full-screen focus overlay (used by PomodoroTimer). Aliases: "focus mode", "focus overlay", "focus scherm".
- **PomodoroStats** — [components/PomodoroStats.jsx](../src/components/PomodoroStats.jsx) — weekly focus-minutes stats. Aliases: "pomodoro stats", "focus statistieken".
- **StudieBuddiesWidget** — [components/StudieBuddiesWidget.jsx](../src/components/StudieBuddiesWidget.jsx) — shows who is studying now (Supabase presence). Aliases: "studiebuddies", "wie is online", "study buddies".

### Notes / habits / gym
- **NotesWidget** — [components/NotesWidget.jsx](../src/components/NotesWidget.jsx) — notes list + editor ("Opgeslagen"/"Geen notities"). Aliases: "notities", "notes", "kladblok".
- **HabitsWidget** — [components/HabitsWidget.jsx](../src/components/HabitsWidget.jsx) — habits/streaks (Gewoontes page, INACTIVE). Aliases: "gewoontes", "habits", "streaks".
- **GymWidget** — [components/GymWidget.jsx](../src/components/GymWidget.jsx) — workout tracking, awards XP (Gym page, INACTIVE). Aliases: "gym", "workout", "training". State: `gym_active_workout` in localStorage.

### School (INACTIVE)
- **MagisterWidget** — [components/MagisterWidget.jsx](../src/components/MagisterWidget.jsx) — tabs: Vakken, Laatste cijfers, Huiswerk, Studiewijzer, Opdrachten. Aliases: "magister", "school widget", "cijfers", "huiswerk", "studiewijzer". Data: `magisterApi.js` / `somtodayApi.js`.
- **SubjectsWidget** — [components/SubjectsWidget.jsx](../src/components/SubjectsWidget.jsx) — "Mijn Vakken". **Appears unused (?)** — not rendered anywhere. Aliases: "vakken", "mijn vakken".

### Jumbo (work — admin/`werk_tab`)
- **WorkWidget** — [components/WorkWidget.jsx](../src/components/WorkWidget.jsx) — PMT/Jumbo work shifts. Aliases: "werk", "diensten", "rooster werk", "PMT". Data: `/.netlify/functions/pmt`, `pmt_work_shifts` in localStorage.
- **VrachttijdenWidget** — [components/VrachttijdenWidget.jsx](../src/components/VrachttijdenWidget.jsx) — freight/truck arrival times with a maplibre route map. Aliases: "vrachttijden", "vrachtwagen", "route map", "truck times".

### Settings / admin / onboarding / auth
- **ThemeSettings** — [components/ThemeSettings.jsx](../src/components/ThemeSettings.jsx) — "Instellingen": accent color, meldingen, external calendars. Aliases: "instellingen", "settings", "thema", "accentkleur".
- **CalendarConnections** — [components/CalendarConnections.jsx](../src/components/CalendarConnections.jsx) — "Agenda's koppelen" (Google / MyX). Opened from ThemeSettings. Aliases: "agenda koppelen", "calendar connections", "externe agenda's".
- **AdminPanel** — [components/AdminPanel.jsx](../src/components/AdminPanel.jsx) — "Admin Paneel": user management, push test, `werk_tab` toggle. Aliases: "admin", "admin paneel", "gebruikersbeheer".
- **OnboardingModal** — [components/OnboardingModal.jsx](../src/components/OnboardingModal.jsx) — first-login flow ("Welkom bij Dash", location, Magister, notifications). Aliases: "onboarding", "welkom scherm", "intro".
- **ProfileSetup** — [components/ProfileSetup.jsx](../src/components/ProfileSetup.jsx) — "Welkom! 👋" profile setup. **Appears unused (?)** — not rendered anywhere. Aliases: "profiel instellen".
- **AuthPage** — [components/AuthPage.jsx](../src/components/AuthPage.jsx) — login/signup ("Student Dashboard"). Aliases: "login", "inlogscherm", "auth", "aanmelden".
- **PasswordResetPage** — [components/PasswordResetPage.jsx](../src/components/PasswordResetPage.jsx) — "Nieuw wachtwoord" reset. Aliases: "wachtwoord reset", "password reset".

### Small / global
- **VersionChecker** — [components/VersionChecker.jsx](../src/components/VersionChecker.jsx) — shows/refreshes app version. Aliases: "versie", "version".
- **XPToast** — [components/XPToast.jsx](../src/components/XPToast.jsx) — floating "+XP" toast on task/pomodoro/gym completion. Aliases: "xp toast", "xp popup", "punten melding".

## Geld sub-app (`src/geld/`, admin only)

Self-contained money/budget app, mounted via [pages/GeldPage.jsx](../src/pages/GeldPage.jsx) →
[geld/GeldPage.tsx](../src/geld/GeldPage.tsx). Own Zustand store, own tab bar. TypeScript.

- **Tabs** (bottom [TabBar](../src/geld/components/TabBar.tsx), center + button opens ActionSheet):
  - `home` → [views/HomeView.tsx](../src/geld/views/HomeView.tsx) — "Home" (balance, this month). Aliases: "geld home", "budget overzicht".
  - `enveloppen` → [views/EnveloppenView.tsx](../src/geld/views/EnveloppenView.tsx) — "Enveloppen" (envelope budgeting). Aliases: "enveloppen", "envelopjes".
  - `jaar` → [views/JaarView.tsx](../src/geld/views/JaarView.tsx) — "Jaar" (yearly overview). Aliases: "jaar", "jaaroverzicht".
- **Sheets:** [AnalyseSheet](../src/geld/sheets/AnalyseSheet.tsx), [InkomstenSheet](../src/geld/sheets/InkomstenSheet.tsx),
  [UitgavenSheet](../src/geld/sheets/UitgavenSheet.tsx), [SearchSheet](../src/geld/sheets/SearchSheet.tsx). Aliases: "analyse", "inkomsten", "uitgaven", "zoeken".
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
  - `Card`, `CardHeader`, `CardLink` — [Card.jsx](../src/components/ui/Card.jsx). Aliases: "kaart", "card header", "Bekijk alles-link".
  - `KpiTile` — [KpiTile.jsx](../src/components/ui/KpiTile.jsx). Aliases: "KPI tegel", "stats tile".
  - `ListRow`, `CheckButton` — [ListRow.jsx](../src/components/ui/ListRow.jsx). Aliases: "lijstrij", "taakrij", "afvinkknop".
  - `Pill`, `CountBadge` — [Pill.jsx](../src/components/ui/Pill.jsx). Aliases: "pill", "badge", "datum pill", "teller".
  - `ProgressBar` — [ProgressBar.jsx](../src/components/ui/ProgressBar.jsx). Aliases: "voortgangsbalk".
  - `SectionHeader` — [SectionHeader.jsx](../src/components/ui/SectionHeader.jsx) (collapsible group header).
  - `FilterTabs` — [FilterTabs.jsx](../src/components/ui/FilterTabs.jsx) (pills or segmented). Aliases: "filter tabs", "Dag/Week/Maand".
  - `IconButton` — [IconButton.jsx](../src/components/ui/IconButton.jsx) (requires `label`). `EmptyState` — [EmptyState.jsx](../src/components/ui/EmptyState.jsx).
  - `toneColor` / `tint` — [tone.js](../src/components/ui/tone.js): tone name → token color.
- **Category colors** — [utils/category.js](../src/utils/category.js): `taskCategory`, `eventCategory`, `CATEGORIES`
  (School/Werk/Persoonlijk/Routine/Overig, derived from the item's source).
- `src/geld/components/ui/` — [Glass.tsx](../src/geld/components/ui/Glass.tsx) (glass card + `Spinner`),
  [Sheet.tsx](../src/geld/components/ui/Sheet.tsx) (bottom-sheet shell). Geld wrappers, now built on the same tokens.

## Hooks & utils (non-visual, for reference)

- App hooks: [hooks/useIsDesktop.js](../src/hooks/useIsDesktop.js), [hooks/useAmbientSound.js](../src/hooks/useAmbientSound.js).
- Utils (`src/utils/`): `magisterApi`, `somtodayApi` (school), `push` (web-push), `xp` (XP/level-up events),
  `recurrence` (recurring tasks), `calendarSync`, `daypart`, `alleVakken`, `openBook`, `openExternal`, `supabaseProfiles`.

## Known unused / naming notes

- **Unused components (verify before relying):** `SubjectsWidget`, `WeekBudgetWidget`
  ([components/WeekBudgetWidget.jsx](../src/components/WeekBudgetWidget.jsx), aliases "week budget", "budget widget"),
  and `ProfileSetup` — defined but not imported/rendered anywhere as of this map. (?)
- **Two GeldPage files:** [pages/GeldPage.jsx](../src/pages/GeldPage.jsx) is a re-export shim; the real one is
  [geld/GeldPage.tsx](../src/geld/GeldPage.tsx). "De geld pagina" = the `.tsx`.
- **INACTIVE pages** (school, gewoontes, gym) are hidden from nav but code is intact.
