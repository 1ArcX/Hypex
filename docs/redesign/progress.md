# Hypex v2 — progress log

Branch `redesign/hypex-v2`, one commit per phase. Analysis & proposal: [phase1-analysis.md](phase1-analysis.md).

## Decisions (approved 29 sep 2026: "do everything you recommend")

| # | Decision |
|---|---|
| D1 | Category derived from source ([utils/category.js](../../src/utils/category.js)); user-picked colors stay on the item itself where shown in detail |
| D2 | Werk = rose-red `#F43F5E`, danger = `#FF5A64` |
| D3 | Readable course name: inspect real data in Phase 4; fallback = user-editable code→name mapping in localStorage |
| D4 | Client-side command palette ("Zoek in Hypex", Ctrl/⌘K) over loaded tasks/notes/events + page navigation |
| D5/D6 | Note tag + dot = folder name + deterministic color per folder |
| D7 | Pomodoro↔task link: deferred |
| D8 | "XP this week": deferred (no XP history) |
| D9–D11 | Vandaag KPI, overdue quick actions (complete + open detail), sidebar overdue badge: implement |
| D12 | Dead light-mode CSS removed |
| D13 | `npm run typecheck` added (no new deps) |

## Validation environment notes

- Only `npm run build` + `npm run typecheck` exist; there are no lint rules or unit tests in the repo.
- Local dev is plain Vite: **Netlify functions are not served** (`/.netlify/functions/*` → 404), so Spotify,
  PMT/Jumbo, Vrachttijden, AI chat and SOMtoday can't be exercised locally. Their UI states (logged-out / error)
  were checked; the calls themselves are unchanged. Buienalarm also fails from localhost (CORS).
- Browser pane screenshots under viewport emulation are unreliable; visual checks at the pane's native ~800px
  width, larger breakpoints verified via DOM measurements.

## Phase 2 — design system

- Tokens in `src/index.css` (+ legacy aliases), Tailwind mapping in `tailwind.config.js`.
- Shared components in `src/components/ui/`, category util in `src/utils/category.js`.
- Hardcoded cyan → `var(--accent)` / `color-mix` in 27 files (theme presets and data palettes intentionally kept).
- Pomodoro/Focus mode colors no longer use `rgb` triplets → accent-aware.
- Geld: `teal-300` → `accent` classes, cards on shared tokens (radius 24 → 16).
- ~430 inline white-alpha text/border colors mapped to `--c-text*` / `--c-border*`.
- Cards: no resting shadow/blur; urgent pulse → static glow; single-layer clock glow; focus-visible outlines;
  `prefers-reduced-motion` support.

## Phase 3 — Dashboard

- Command-center grid: header (greeting/date, search, inline clock, weather chip) → 4 KPI tiles →
  workspace ("Te laat & urgent" + "Volgende afspraak") → widgets (Vandaag, Pomodoro, Geld*, Spotify) → extras
  (Schema vandaag, Deadlines, Nog in te plannen, regen). *Geld only for admin, same as the Geld page.
- CommandPalette (D4), sidebar restyle + overdue badge (D11), "Vandaag" KPI (D9), complete/open quick actions (D10).
- Existing features kept: next-event filter + ‹ ›, "Nu bezig", schema strip, deadlines, unplanned list, rain chart
  (dismissable), full weather widget (popup from chip), Spotify controls, PWA prompt trigger.
- **Behavior note:** "Te laat" now uses one definition everywhere (`utils/taskStatus.js`), matching the
  existing Taken filter: routines are not counted. Before, the Dashboard counted missed routines (3) while
  Taken showed 1.
- **Deviation:** the Pomodoro widget's play button opens the Pomodoro page instead of starting the timer
  there — starting would need a second copy of the timer logic.
- Approved follow-up: App now also loads `external_calendar_events` (read-only, from yesterday onward) for the
  Dashboard ("Volgende afspraak", "Schema vandaag") and search. The Timeline keeps its own list.
- **D3 resolved from real data:** MyX `description` = "<code> <opleiding> <periode> <cursusnaam>", so the readable
  name is parsed by `utils/eventTitle.js` (no mapping needed). Items without a name (e.g. "MATH0") keep the code.
- Verified in the browser with real data: dashboard rows, next appointment (name + code + location), search
  (Ctrl K, event → Agenda with highlight, "Nieuwe taak"), Geld widget matches the Geld page.

## Phase 4 — Agenda

- Timeline (week/day/month): category colors via `utils/category.js`, light tinted blocks with a clear border
  and 3px left edge; MyX events show the readable course name, time, and the code small underneath (D3).
- Calmer grid: day-part color bands removed, lighter hour/half-hour/column lines; today's column and date
  stronger (accent circle with a soft glow).
- Now line kept and made clearer: red line + red time pill in the hour column (as in the mockup).
- Right rail (≥1280px): "Kleuren" legend + mini month calendar (click a day to jump; ‹ › per month).
- Toolbar on shared components (btn-ghost "Vandaag", labelled icon buttons, segmented Dag/Week/Maand, btn-primary "Nieuw").
- Mobile list (AgendaList) uses the same categories and readable names.
- **D1 refinement (from real data):** own agenda items get their category from the palette color the user
  picked (red/orange = Werk, yellow = School, green = Routine, cyan/blue = Overig, purple/pink = Persoonlijk).
  The user already uses color as category ("Werk" events are red). Tasks stay source-based.
- **Bugs fixed on the way (pre-existing):**
  - Week/day events were positioned as a % of the full width instead of the day-column width, so they drifted
    right and Sunday's blocks were clipped.
  - Month grid columns grew with long titles (`1fr` → `minmax(0, 1fr)`), so dates landed under the wrong weekday.
  - Sticky all-day row was translucent; events showed through when scrolling.

## Phase 5 — Taken

- Page header "Taken" + "+ Taak" (desktop), shared `FilterTabs` with counts: Vandaag · Morgen · Week · Alles ·
  Te laat · Urgent · Ongepland + task groups (all existing filters kept; red counts for Te laat/Urgent).
- Vandaag: progress header "X van Y voltooid" + % + bar (routines + today's one-off tasks, open and done);
  collapsible sections Urgent → Te laat → dagdelen (tasks without a day part = "Overig") → Routines.
  Collapse state remembered per device (localStorage).
- Shared compact `TaskRow` for every list: category dot, title, one-line subtitle, date/streak pill, urgent flag,
  delete on hover (desktop), checkbox on the right. Drag-reorder, drag-to-group, swipe complete/delete kept.
- **Bug fixed (pre-existing):** Taken used UTC dates (`toISOString`), so between 00:00 and 02:00 local time
  "Vandaag" showed yesterday. Now local dates, same as the rest of the app.
- **Deviation:** mockup filter "Deze week" is labelled "Week" because the existing filter is the next 7 days,
  not the calendar week.
- Not exercised against the database: completing/deleting tasks (would change real data). The handlers passed
  to the rows are the same functions as before.

## Phase 6 — remaining pages

- **Notities:** desktop split view (list: search, folder filter pills with colored dots, sort; detail: title,
  "Bewerkt …", folder tag + folder select, delete, monospace content panel); mobile keeps list → detail.
  Tags = folders with deterministic colors (D5/D6).
  - Bug fixed: autosave cancelled earlier pending edits (title then content within 0.6 s, or switching
    notes) — now merged per note and flushed before switching/unmount.
  - Delete now asks for confirmation (irreversible).
  - iOS "inputs 16px" rule in index.html scoped to touch devices (it forced 16px inputs on desktop too).
- **Geld:** hero "Nog over deze maand" (amount, progress, spent / budget, breakdown) → row Vandaag · Deze week ·
  Inkomsten → row Prognose · Spaarstreak · Analyse; withdrawals warning clickable (opens Inkomsten);
  "Opnames" tile folded into that warning. Fixed breakdown text "… − = €225" → "… = €225".
  Label kept as existing copy "Nog over deze maand" (mockup: "Beschikbaar deze maand").
- **Instellingen:** 3×2 preset grid (radio semantics), eigen kleur, **Live preview** (nav item, KPI card, pill,
  progress bar, primary/secondary button, bottom nav) — all on `var(--accent)`, updates instantly.
- **Pomodoro:** "Start focus", today summary (focus sessions + minutes from the session log), token styling,
  ring glows only while running. Session→task link deferred (D7).
- **Hypex AI:** structured Dagbriefing strip (Urgent, Te laat, Volgende afspraak, Dagbudget) above the existing
  AI briefing; AI prompt/backend unchanged. Removed an always-visible debug overlay ("iH:… appH:…").
  - Known inconsistency (not changed): the AI budget line uses its own rough sum (e.g. €1617 of €1650),
    unlike the Geld page (carryover/fixed costs). Aligning it would change data sent to the AI → your call.
- **Statistieken:** XP card first with rank ("Rang #1 van 7", from the same leaderboard data), week grid
  (Focus/Taken/Gewoontes/Jumbo), leaderboard last. "XP this week" deferred (D8, no history). Routines per-day
  bars not possible (no per-day completion history) — Gewoontes card kept as is.
- **Jumbo & other widgets:** v1 "colored left border + gradient" card pattern removed from Work, Vrachttijden,
  PomodoroStats, StudieBuddies, Weather, Spotify, Magister; uppercase 10px titles → card-title style.

## Phase 7 — Responsive

Checked at 375 (mobile preset), 768 (tablet), 1024, 1440 and 1920 px — no horizontal page scroll on any page
(automated check over all nav pages; the only horizontal scrollers are the intended chip rows: Hypex AI
suggestions and, on mobile, the Taken filters).

- Mobile keeps the existing bottom nav + "Meer" sheet (no sidebar). Page titles that duplicated the mobile
  top bar are hidden on mobile (`.hide-mobile`).
- Dashboard mobile order = hierarchy: header → KPIs (2×2) → Te laat/Urgent → Volgende afspraak → Vandaag,
  Pomodoro, Geld → Schema/Deadlines/Nog in te plannen → Spotify (Level 3 last; single instance, no double
  polling) → "Taak toevoegen". Clock hidden on mobile (top bar + OS clock); Ctrl K hint hidden.
- Dashboard grid: 4-col KPIs/widgets ≥1280, 2-col widgets and wrapped search 768–1280, workspace stacks <1100.
- Agenda legend rail only ≥1280; Taken filters wrap on desktop, scroll on mobile; Notities split view on
  desktop, list → detail on mobile; Statistieken week cards 2-col when ≥ ~760px content width.
- "Schema vandaag" past items are dimmed instead of struck through (strike-through read as "done").

## Phase 8 — Polish & final check

- Contrast: `--c-text-3` 0.40 → 0.50 (≈5.3:1 on the background, ≈4.8:1 on raised surfaces, AA for small
  text); `--c-text-2` 0.60 → 0.66 to keep the hierarchy step.
- Keyboard: global `:focus-visible` outline (accent); Agenda blocks (lessons, events, tasks) now focusable with
  Enter/Space; list rows, task rows, notes rows, KPI tiles, palette options are buttons/role=button.
- Labels: `aria-label` added to 13 icon-only close buttons (TaskModal, TaskDetailModal, AdminPanel, Calendar,
  FocusMode, Geld sheets/modals, …), mobile settings button, all new `IconButton`s (label required).
- Motion: all new transitions use `--t-fast/--t-base`; `prefers-reduced-motion` disables animations,
  infinite pulses and press-scale.
- Glow rules applied: resting cards no shadow; hover = light accent border; primary/active = glow; urgent =
  subtle static red glow; Pomodoro ring glows only while running; chart bars no glow.
- Final run: no JS errors on any page (only known network failures: Netlify functions not served by Vite,
  Buienalarm CORS from localhost).

## Final comparison with the mockup

| Panel | Result | Deviations (why) |
|---|---|---|
| 1 Dashboard | Header row, 4 KPI tiles, overdue/urgent + next appointment, 4 compact widgets, sidebar with badge | "Vandaag" KPI counts open tasks for today (data); Pomodoro play opens the Pomodoro page (no second timer engine); extra Level-2 row (Schema vandaag, Deadlines, Nog in te plannen, regen) kept because those features exist; search is Ctrl K (not ⌘K) on Windows |
| 2 Agenda | Category colors, readable name + code, legend + mini month, calmer grid, now-pill, today circle | Legend rail only ≥1280 px; "Werk"/"Persoonlijk" for own events follow the user's chosen palette color |
| 3 Taken | Progress header, filter tabs with counts, Urgent / Te laat / dagdelen / Routines, compact rows | Extra filters (Morgen, Urgent, Ongepland, groups) kept; "Deze week" = "Week" (next 7 days) |
| 4 Notities | Split view, search, sort, colored dots, folder tag, edit/delete | Tags = folders (no tag data); edits save automatically (no separate edit button) |
| 5 Geld | Hero KPI + progress + spent/budget, Vandaag/Deze week/Inkomsten, Prognose/Spaarstreak/Analyse | Hero label keeps existing copy "Nog over deze maand"; hero turns red when <15% left (existing rule) |
| 6 Instellingen | Preset grid, eigen kleur, live preview mini-UI | Preview is a mini dashboard (nav, KPI, pill, progress, buttons, bottom nav) rather than an exact copy |

## Deferred / open

- D7 Pomodoro session → task link, D8 "XP this week" (need new data).
- Hypex AI budget line vs Geld numbers (would change AI prompt data) — your call.
- Routines per-day chart in Statistieken (no per-day completion history).
- Not exercised against the database (would change real data): completing/deleting tasks, creating notes,
  saving events. The handlers are unchanged; opening/reading was verified.
