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
- **Open question:** "Volgende afspraak" doesn't include MyX/Google events (App doesn't load
  `external_calendar_events`; only the Agenda does). Adding that read query needs approval.
