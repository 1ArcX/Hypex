# Hypex v2 — Phase 1: analysis & design-system proposal

Status: **proposal, awaiting approval.** No UI code changed in this phase.
Branch: `redesign/hypex-v2`. Mockup description: [mockup-notes.md](mockup-notes.md).

---

## 1. What the code actually is

| Aspect | Finding |
|---|---|
| Framework | React 18 + Vite 5, JSX; Geld sub-app in TypeScript (`src/geld/`) |
| Routing | None. `activePage` string in [App.jsx](../../src/App.jsx); pages conditionally rendered |
| Styling | Tailwind 3 (mostly layout utilities) + **inline `style={{}}` objects everywhere** + a handful of global classes in [index.css](../../src/index.css) (`.card`, `.glass-card`, `.glass-input`, `.btn-neon`, `.subject-badge`, `.modal-*`) |
| Theming | [App.jsx:473](../../src/App.jsx) sets `--accent` (and legacy `--bg1/--bg2`) on `:root` from `theme` state, persisted in `localStorage.app_theme`. Presets in [ThemeSettings.jsx:7](../../src/components/ThemeSettings.jsx) (Neon Cyan, Purple Dream, Sunset, Rose, Emerald, Sky Blue) + custom hex. **Only `--accent` is truly dynamic**; derived tints use `color-mix(in srgb, var(--accent) N%, transparent)` — good, keep that pattern. |
| Data | Supabase (`tasks`, `calendar_events`, `external_calendar_events`, `subjects`, `notes`, `note_folders`, `expenses`, `budget_config`, `pomodoro_sessions`, `habit_achievements`, `profiles`, …). App.jsx loads tasks/subjects/events and passes them down as props. Geld has its own Zustand store + hooks. PMT shifts, weather, Spotify, AI via Netlify functions. |
| Validation tooling | `package.json` has **only `dev`, `build`, `preview`**. No lint, no typecheck script, no test runner. The `test-*.cjs` files in the root are ad-hoc PMT/Magister scripts that hit live services, not tests. → Per phase I'll run `npm run build` + `npx tsc --noEmit -p .` (Geld) + manual browser checks. Baseline `npm run build` ✅ passes (only the existing >500 kB chunk warning). |

## 2. UI audit — inconsistencies

Counts are over `src/**/*.jsx|tsx` inline styles.

### Radius — 21 different values
`8`(93×) `10`(69×) `50%`(54×) `12`(52×) `6`(35×) `14`(28×) `20`(27×) `16`(26×) `4`(22×) `2` `18` `5` `9` `7` `3` `22` `24` `99` `26` `13` `11`.
- `.card` uses `--radius: 18px`, `.btn-neon` 14px, `.glass-input` 12px ([index.css](../../src/index.css)).
- Geld uses Tailwind `rounded-3xl` (24px) / `rounded-2xl` (16px) ([Glass.tsx](../../src/geld/components/ui/Glass.tsx)).
- Timeline events 5px, all-day chips 4px, month cells 3px ([Timeline.jsx:563,737,861](../../src/components/Timeline.jsx)).

### Font size — 29 distinct values from 7px to 64px
Heavy clustering at 9/10/11/12/13/14 but also 12.5, 15, 17, 19, 21, 34, 42, 54…
Section labels vary between 9px uppercase ([DashboardPage.jsx:508,568](../../src/pages/DashboardPage.jsx)), 11px uppercase ([StatsPage.jsx:442](../../src/pages/StatsPage.jsx)) and 11px sentence case ([Glass.tsx SectionLabel](../../src/geld/components/ui/Glass.tsx)).
Font weights: 400/500/600/**700 (173×)**/800/900 — bold is the default, which flattens hierarchy.

### Color — hardcoded values bypassing tokens
- **Hardcoded cyan** (`#00FFD1` / `rgba(0,255,209,…)`) in 25 files; worst: Timeline (13), HypexAIPage (10), AuthPage (9), DashboardPage (8), PomodoroTimer (7). These **stay cyan under Purple Dream / Sunset**, e.g.
  - progress glow [DashboardPage.jsx:361](../../src/pages/DashboardPage.jsx), "Open" label [DashboardPage.jsx:402](../../src/pages/DashboardPage.jsx)
  - notification button [ThemeSettings.jsx:137](../../src/components/ThemeSettings.jsx)
  - AI send button gradient [HypexAIPage.jsx:468](../../src/pages/HypexAIPage.jsx)
  - bar chart dim color [StatsPage.jsx:35](../../src/pages/StatsPage.jsx)
  - `.task-flash` keyframes [index.css](../../src/index.css)
- **Geld sub-app ignores `--accent` entirely**: 23 Tailwind `teal-*` usages, fixed `white/…` opacities.
- **Raw `rgba(255,255,255,x)`** instead of `--text-*`/`--border`: HabitsWidget 105×, PomodoroTimer 50×, MagisterWidget 47×, Timeline 40×, WeatherWidget 37×, …; opacities used: .02 .025 .03 .04 .05 .06 .07 .08 .1 .12 .15 .18 .2 .22 .25 .3 .35 .4 .45 .5 .7 .75 .85 .9 — no scale.
- **Semantic colors are ad hoc**: red appears as `#FF6B6B`, `#FF453A`, `rgba(255,80,80)`, `rgba(255,50,50)`, `#F87171`; orange `#FF8C42`; yellow `#FACC15`/`#FBBF24`; green `#4ADE80`/`#34D399`/`#1DB954`; purple `#818CF8`/`#A78BFA`.
- Two parallel variable sets (`--text-1/2/3` and legacy `--text-primary/secondary/muted`, `--bg-card` vs `--glass-bg`).
- `:root.light-mode` block in index.css is **dead** — the class is never applied; body bg is hardcoded `#0b0b0f`.

### Glow / motion
- Resting cards all have `box-shadow: var(--card-shadow)` + `backdrop-filter: blur(20px)` — every card has equal weight.
- `.urgent-task` runs an **infinite pulsing** red shadow; `.neon-clock` has a 3-layer text-shadow; progress bars glow at rest.
- `.mesh-bg` / focus blobs animate indefinitely. **No `prefers-reduced-motion` handling anywhere.**
- Every `.card` plays `fadeSlideIn` on mount (also on every re-render that remounts), causing jitter on page switch.

### Spacing
Card padding varies: `20px 22px 18px`, `14px 15px`, `12px 14px`, Geld `px-6 pt-6`, `px-5 py-4`, `px-4 py-3.5`. Gaps 4/6/8/10/12/14/16 used interchangeably. Dashboard page padding `20px 16px`.

### Structure
- No shared UI primitives outside Geld: each widget re-implements its card header, pill, progress bar, empty state.
- Emoji used as icons in headings ("🔥 Deadlines", "📋 Nog in te plannen", "⏰ Te laat") mixed with lucide icons elsewhere.

## 3. Current UI vs mockup — main gaps per page

Before-screenshots: only the **login screen** could be captured (1440px) — every other page needs your
Supabase login, which I can't enter. See §7.

| Page | Current | Gap to mockup |
|---|---|---|
| **Sidebar** | Label list, accent active state, no badges | Add red count badge on "Taken" (overdue count, data exists); tighter rows; user chip at bottom already similar |
| **Dashboard** | Single column: hero card with centered clock + progress → FocusCard → 3 stat tiles → "Schema vandaag" → Volgende + Deadlines → rain → Spotify+Weather → Nog in te plannen → big "+ Taak toevoegen" | Needs the 4-row command-center grid. KPI row 3→4 tiles (add *Vandaag*). Clock moves into header row. Overdue list with quick action + "Volgende afspraak" side by side. Bottom row of 4 compact widgets (Vandaag, Pomodoro, Geld, Spotify). Weather shrinks to header chip. Search field → see proposals. |
| **Agenda** | Already a strong week grid, now line, all-day strip, day/week/month | Category colors + legend rail + mini month calendar (desktop). Subtler gridlines (currently daypart color bands). Code-under-name only if data allows. Events: lighter fill, clearer border. |
| **Taken** | TasksWidget groups, drag reorder; TodayView on mobile | Filter tabs with counts, progress header, standard sections Urgent/Te laat/Overig/Routines, compact row with date pill + flag + checkbox |
| **Notities** | Single pane: list OR editor (goBack), folder filter/select | Desktop split view, search, sort, colored dot per folder, preview line, date |
| **Geld** | Already has hero, dag, week, Inkomen, Opnames, Prognose, Spaarstreak, Analyse | Mostly re-hierarchy: hero "Beschikbaar deze maand" + progress; row Vandaag/Deze week/Inkomsten; row Prognose/Spaarstreak/Analyse. Make accent-aware. |
| **Instellingen** | Preset list + custom picker + meldingen + agenda koppelen | Add live preview mini-UI; 2×3 preset grid |
| **Pomodoro** | Timer + StudieBuddies + Stats | Minor: align to tokens; today's session count exists (`pomodoro_v3.totalSessions`/today mins) |
| **Hypex AI** | Quick actions + already an AI-written briefing from real data | Add a structured *Dagbriefing* card (deterministic, from real data) above the AI text; restyle |
| **Statistieken** | XPCard, Focus/Taken/Gewoontes weekly bars, Leaderboard | Reorder: personal first (already mostly), leaderboard last; tokens |
| **Jumbo** | WorkWidget + VrachttijdenWidget | Tokens only |

## 4. Design-system proposal

### 4.1 Where it lives
- **Tokens:** CSS custom properties in `src/index.css` `:root` (single source). Mirrored in `tailwind.config.js` `theme.extend` (colors/radius/fontSize pointing at `var(--…)`) so both inline styles and Tailwind classes (Geld) use the same tokens.
- **Components:** new folder `src/components/ui/` (plain JSX, inline-style + class conventions like the rest of the app):
  `Card`, `CardHeader` (icon + title + action), `KpiTile`, `ListRow`, `Pill`/`Badge`, `ProgressBar`, `SectionHeader` (collapsible), `FilterTabs`, `IconButton`, `EmptyState`.
  Geld's `GlassCard`/`ProgressBar`/`SectionLabel` will be re-pointed at the same tokens (kept as its own TS wrappers so its code doesn't churn).
- Old variables (`--text-primary`, `--glass-bg`, `--bg-card`, `--text-1`…) stay as **aliases** of the new tokens, so nothing breaks while migrating.

### 4.2 Color tokens (dark only; all accent-derived values via `color-mix`)

| Token | Value | Notes |
|---|---|---|
| `--c-bg` | `#08090c` | page background (subtle accent radial kept, but at ~3%) |
| `--c-surface` | `rgba(255,255,255,0.035)` | card |
| `--c-surface-2` | `rgba(255,255,255,0.06)` | elevated: rows, inputs, tiles-in-cards |
| `--c-surface-3` | `rgba(255,255,255,0.09)` | hover / pressed |
| `--c-surface-solid` | `#121419` | modals, selects, sticky headers (opaque) |
| `--c-border` | `rgba(255,255,255,0.07)` | hairline |
| `--c-border-strong` | `rgba(255,255,255,0.12)` | inputs, hover |
| `--c-text` | `rgba(255,255,255,0.92)` | primary |
| `--c-text-2` | `rgba(255,255,255,0.60)` | secondary (raised from .45 for contrast ≥ 4.5:1) |
| `--c-text-3` | `rgba(255,255,255,0.40)` | muted/metadata (≥ 3:1, used ≥ 11px only) |
| `--accent` | from theme | unchanged mechanism |
| `--accent-soft` | `color-mix(var(--accent) 12%, transparent)` | active fills |
| `--accent-border` | `color-mix(var(--accent) 40%, transparent)` | |
| `--accent-glow` | `0 0 16px color-mix(var(--accent) 35%, transparent)` | only where glow is allowed |
| `--on-accent` | `#000` | text on accent fill |
| `--c-success` | `#34D399` | |
| `--c-warning` | `#FF9F43` | "Te laat" orange |
| `--c-danger` | `#FF5A64` | urgent / delete / now-line |
| `--c-info` | `#60A5FA` | |
| `--cat-school` | `#FACC15` yellow | |
| `--cat-werk` | `#F43F5E` red(-rose) | see decision D2 |
| `--cat-persoonlijk` | `#A78BFA` purple | |
| `--cat-routine` | `#34D399` green | |
| `--cat-overig` | `#60A5FA` blue | |

Each semantic/category color gets `-soft` (≈12% tint) and `-border` (≈35%) variants via `color-mix`.

> Note: when the accent is Emerald or Sky Blue it collides with Routine/Overig. Categories are always shown with a dot/border + label, so it stays readable; I'd accept this rather than making category colors theme-dependent.

### 4.3 Radius
`--r-xs 6px` (pills, chips, calendar events) · `--r-sm 8px` (buttons, inputs, rows) · `--r-md 12px` (tiles, small cards) · `--r-lg 16px` (cards) · `--r-xl 20px` (modals, sheets) · `--r-full 999px`.
Deviation from your scale: I **added 6px** because the mockup's pills and event blocks are clearly smaller than 8px and the code already uses 4–6px there (57×). Current 18px card radius → 16px.

### 4.4 Typography (system font stack unchanged; `font-variant-numeric: tabular-nums` on all numbers)

| Role | Size / weight / line-height |
|---|---|
| Display (clock) | 44px / 700 / 1, letter-spacing -0.02em (mobile 36px) |
| KPI number | 24px / 700 / 1.1 |
| Page title | 20px / 700 / 1.2 |
| Section title | 15px / 600 / 1.3 |
| Card title | 13px / 600 / 1.3 |
| Body | 13px / 400–500 / 1.5 |
| Metadata | 11px / 500 / 1.4, `--c-text-3` |
| Badge / pill | 11px / 600 / 1 |
| Overline (rare) | 10px / 700 / uppercase / 0.08em |

Result: 9 sizes instead of 29. Default weight drops from 700 to 500/600 so bold means something.

### 4.5 Spacing
4-pt scale: `--s-1 4` · `--s-2 8` · `--s-3 12` · `--s-4 16` · `--s-5 20` · `--s-6 24` · `--s-8 32`.
Card padding 16 (compact widgets 14→ use 12/16), grid gap 12, page padding 24 desktop / 16 mobile, row height 36–40.

### 4.6 Elevation & glow rules
| State | Treatment |
|---|---|
| Resting card | surface + hairline border, **no shadow, no glow**; blur kept only on floating layers (nav, modals, sheets) |
| Hover (interactive card/row) | `--c-surface-3` + `--c-border-strong` + faint accent border tint |
| Focus-visible | 2px accent outline, 2px offset (all interactive elements) |
| Primary / active button | accent fill + `--accent-glow` |
| Urgent | `--c-danger-soft` fill + danger border + **static** faint red shadow (remove infinite pulse) |
| Running timer / active pomodoro | accent glow on ring |
| Clock | single soft text-shadow (1 layer, not 3) |
| Modals | `--c-surface-solid`, shadow `0 24px 64px rgba(0,0,0,.5)` |
Motion: 150ms (hover), 220ms (enter); everything wrapped with `@media (prefers-reduced-motion: reduce)` → no transforms/infinite animations.

### 4.7 Shared components

| Component | Replaces / used by |
|---|---|
| `Card` (variants: default, tinted `tone`, interactive) | `.card` + ad-hoc divs everywhere |
| `CardHeader` (icon, title, count, right action) | Dashboard, Taken, Notities, Stats, Geld headers |
| `KpiTile` (tone, icon, value, label, onClick) | Dashboard stats row, Geld StatCard, Stats |
| `ListRow` (dot color, title, subtitle, trailing pill, action) | task rows, overdue list, notes list, deadlines, unplanned |
| `Pill` (tone: neutral/accent/danger/warning/success/category) | date pills, counts, status, tags, `.subject-badge` |
| `ProgressBar` (value, max, tone, size) | dashboard progress, Geld, Taken header, XP bar |
| `SectionHeader` (title, count, tone, collapsible) | task groups, Stats sections |
| `FilterTabs` (items with counts, value, onChange) | Taken filters, Agenda Dag/Week/Maand, Next-event filter |
| `IconButton` (required `aria-label`) | all icon-only buttons |
| `EmptyState` (icon, text, action) | all empty lists |
| `categoryOf(item)` util in `src/utils/category.js` | one source for category → color mapping |

## 5. Category mapping (from existing data)

There is **no `category` field** on tasks or events. Existing classification signals:

| Source | Signal in data | Proposed category |
|---|---|---|
| Magister/SOMtoday lessons | `les.vak` (already yellow `#FACC15`) | **School** |
| MyX (school roster ICS) external events | `connection.provider === 'myx'` (already yellow) | **School** |
| Tasks with `subject_id` | linked to a school subject | **School** |
| PMT / Jumbo work shifts | shift objects (currently orange `#FF8C42`) | **Werk** |
| Tasks with `recurrence` | routine (currently teal `#5EEAD4`) | **Routine** |
| User-created `calendar_events` | user picked color from 7 swatches | **Persoonlijk** |
| Tasks without subject/recurrence | user picked `color` | **Persoonlijk**? or **Overig** |
| Google Calendar external events | provider `google` (currently `#4285F4`) | **Overig** |

The conflict: tasks and personal events have a **user-chosen color**. Mapping everything to category colors would silently make that color picker meaningless. → decision **D1**.

## 6. Proposals that need new data or behavior (please decide)

| # | Proposal | Why / what it needs | My recommendation |
|---|---|---|---|
| **D1** | How category colors relate to user-picked colors | See §5 | **Derive category from source** (table above) for the color of dot/border in Agenda + legend; keep the user's picked color only as the event/task's own swatch where it is shown in detail. Alternatively: add an optional `category` column (text) to `tasks` + `calendar_events` with a picker in TaskModal/event form — cleaner long-term but a schema change. |
| **D2** | Werk = red collides with danger red (Urgent, Te laat, now-line, delete) | Mockup uses red for both | Use a **rose-red `#F43F5E`** for Werk and a slightly warmer `#FF5A64` for danger; or keep Werk **orange** as today (overdue is orange too though). Your call. |
| **D3** | Readable course name + small code (Agenda) | MyX events store `title` = ICS `SUMMARY` and `description`; I can't see real data without your login. | In Phase 4 I'll inspect real events. If the name isn't in the data: a **user-editable code→name mapping** stored in `localStorage` (no schema) or a small Supabase table (syncs across devices). |
| **D4** | Global search "Zoek in Hypex ⌘K" (Dashboard header) | Doesn't exist | Either **omit** it, or build a client-side command palette over already-loaded tasks/notes/events + page navigation (no backend). Moderate scope. |
| **D5** | Note tags (Notities split view) | Notes only have `folder_id` (folders have a `name`, no color) | Show the **folder as the tag pill** + a deterministic color per folder (hash → palette). Real multi-tags would need a new column. |
| **D6** | Note colored dot | No color field | Same as D5: dot = folder color; no folder = neutral. |
| **D7** | Pomodoro session → task link | `pomodoro_sessions` has no task_id; TaskDetailModal already "starts a pomodoro" | Defer (not needed for the redesign). |
| **D8** | "XP gained this week" (Stats) | XP is a single running total in `habit_achievements.xp`; no history | Show only what exists (level, XP bar, weekly Focus/Taken bars). Alternatively log XP events with timestamps (new table) — defer. |
| **D9** | "Vandaag" KPI tile (Dashboard) | Count of today's tasks + today's events: exists | Implement, no decision needed — listed for transparency. |
| **D10** | "Te laat" quick action "Start" (Dashboard) | Mockup shows "Start" (start focus?) | Use existing actions: **complete checkbox** + open detail (which already has "start pomodoro"). No new behavior. |
| **D11** | Sidebar "Taken" count badge | Overdue count exists | Implement (overdue + urgent? I'd use overdue only). |
| **D12** | Light mode CSS | Dead code | Remove the unused `:root.light-mode` block in Phase 2 (or keep untouched). |
| **D13** | Tooling | No lint/typecheck/tests exist | Add a `typecheck` script (`tsc --noEmit`) — no new dependency. Adding ESLint would be a new dev dependency → only if you want it. |

## 7. Before-screenshots

Only the login screen could be captured: all other pages require your real Supabase login, and I'm
not allowed to type your password. If you **log in yourself in the browser pane** (dev server
`hypex-dev` on `http://localhost:3000`), I can capture every page at 1440px before Phase 2 starts.
