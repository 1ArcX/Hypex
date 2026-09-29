# Hypex — Application Overview

Hypex (also called "Dash" / HypexDash) is a personal dashboard for a student who also works a part-time job.
It brings tasks, schedule, focus sessions, notes, money and progress together in one dark, accent-themed
web app. The UI is in Dutch. It runs as a web app and can be installed as a PWA on phones and desktops.

This document describes what the application does as of the Hypex v2 redesign (September 2026).
For a file-level map of components, see [components.md](components.md). For the redesign history and
design decisions, see [redesign/](redesign/).

---

## 1. At a glance

| Area | What it does |
|---|---|
| **Dashboard** | One-screen overview of the day: urgent and overdue tasks, next appointment, today's progress, Pomodoro, budget, music and weather |
| **Agenda** | Day / week / month calendar combining school lessons, imported calendars, own events, tasks and work shifts |
| **Taken** (tasks) | Task list with filters, priorities, groups, day parts, recurring routines with streaks, drag-and-drop and swipe actions |
| **Pomodoro** | Focus timer with presets, ambient sounds, focus mode, session log and weekly statistics |
| **Notities** (notes) | Notes with folders, search, sorting and autosave; split view on desktop |
| **Statistieken** | Personal XP / level / rank, weekly charts for focus, tasks, habits and work hours, and a leaderboard |
| **Jumbo** | Work tools: PMT work-shift schedule and live freight (truck) arrival times with a route map |
| **Geld** (money) | Monthly budget app: spending, envelopes, income, savings, forecasts and yearly overview |
| **Hypex AI** | Assistant that knows the user's Hypex data, gives a daily briefing and can add tasks, expenses and notes |
| **Instellingen** | Accent color theme with live preview, notifications and external calendar connections |

**Access:** every logged-in user gets Dashboard, Agenda, Taken, Pomodoro, Notities and Statistieken.
Jumbo is available to the admin and to users with the `werk_tab` profile flag. Geld and Hypex AI are admin-only.
An admin panel manages users.

---

## 2. Features by page

### 2.1 Dashboard
A "command center" laid out by importance:

1. **Header** — greeting with date, a search field ("Zoek in Hypex…", also Ctrl/⌘K), a large clock and a
   compact weather tile. Clicking the weather tile opens the full weather widget (city search, 2-hour rain
   radar, week forecast, rain notifications).
2. **KPI tiles** — counts for *Urgent*, *Te laat* (overdue), *Open* and *Vandaag* (open tasks today).
   Each tile opens the task list with the matching filter.
3. **Workspace** —
   - *Te laat & urgent*: compact rows with category dot, days late, date pill and a checkbox to complete.
   - *Volgende afspraak*: the next upcoming item from any source, with countdown ("Over 14 min"), readable
     title, course code, time range and location, a "Nu bezig" line when something is in progress,
     a filter (all / agenda / work / tasks), previous/next buttons and a link to the agenda.
4. **Widgets** — *Vandaag* (progress ring + quick complete), *Pomodoro* (current timer state, today's focus
   minutes), *Geld* (remaining monthly budget, admin only) and a compact *Spotify* player.
5. **Extras** — today's schedule, upcoming deadlines (next 3 days), unscheduled tasks and a rain chart when
   rain is expected.

On mobile the same content is stacked in order of importance, with Spotify last.

### 2.2 Agenda
- **Views:** day, week and month (desktop); day strip, list and month views (mobile). Swipe to change days/weeks.
- **Sources shown together:**
  - Magister / SOMtoday school lessons (cached per week).
  - Imported calendars: Google Calendar and the MyX (HAN) school roster via ICS.
  - Own events (create, edit, delete, recurring, all-day, color).
  - Tasks with a time (drag a task onto a time slot to schedule it) and routines.
  - PMT/Jumbo work shifts.
- **Category colors** with a legend: School (yellow), Werk (red), Persoonlijk (purple), Routine (green),
  Overig (blue). For MyX lessons the readable course name is shown with the course code underneath.
- A red "now" line with the current time, a highlighted current day, and a mini month calendar for quick
  navigation on wide screens.
- Other pages (dashboard, search, AI briefing) can jump to a specific item in the agenda and highlight it.

### 2.3 Taken (tasks)
- **Filters with counts:** Vandaag, Morgen, Week (next 7 days), Alles, Te laat, Urgent, Ongepland, plus one
  filter per task group.
- **Vandaag view:** a progress header ("X van Y voltooid") and collapsible sections for Urgent, Te laat,
  day parts (Ochtend / Middag / Avond / Overig) and Routines.
- **Task properties:** title, date, optional time range, day part, priority (urgent / normal / later),
  subject, group, due date, duration, description, color, and recurrence (daily, weekdays, weekly on chosen
  days, monthly).
- **Routines** (recurring tasks) track streaks; completing one advances it to the next due date.
- **Interaction:** click to open details, checkbox to complete (with undo), drag to reorder or move between
  groups, swipe right to complete / left to delete on mobile.
- Completing tasks awards XP (see Statistieken).

### 2.4 Pomodoro
- Focus / short break / long break timer with duration presets and a configurable cycle length.
- Optional task label ("Waar werk je aan?"), ambient sounds (focus, brown noise, rain, ocean) and sound/notification toggles.
- The timer keeps running across page switches and reloads; a server-side cron sends a push notification
  when a session ends even if the app is closed.
- Full-screen focus mode, today's session count and focus minutes, weekly focus chart and a session log.
- *Studiebuddies* shows which other users are studying right now.

### 2.5 Notities (notes)
- Create, edit and delete notes; changes are saved automatically.
- Folders (shown as colored tags), folder filter, full-text search and sorting (last edited, newest, title).
- Desktop: list on the left, selected note on the right. Mobile: list → detail.
- Notes can also be created by Hypex AI and found via the global search.

### 2.6 Statistieken
- **Personal progress:** level name, level number, XP progress bar, total XP, rank among all users and
  earned achievements.
- **This week** (navigable by week): focus minutes per day, completed tasks per day, habit completion and
  Jumbo work hours.
- **Leaderboard** of all users by XP.
- A level-up celebration appears when a new level is reached.

### 2.7 Jumbo (work)
- **Werkdiensten:** log in with a PMT (personeelstool) account to import the Jumbo work schedule. Shifts
  appear in the agenda and on the dashboard.
- **Vrachttijden:** live freight/truck arrival times for the store (via Simacan) with a route map
  (MapLibre), and optional push notifications for arrivals.

### 2.8 Geld (money, admin only)
A self-contained budget app (TypeScript) with its own tab bar:
- **Home:** remaining budget this month (with carryover and fixed costs), today's remaining day budget,
  this week's budget, income, forecast for the month, savings streak, alerts for savings withdrawals and
  emergency purchases, and recent transactions.
- **Enveloppen:** budget per category (envelope budgeting).
- **Jaar:** yearly overview.
- **Actions:** add expenses (also planned ones), income, savings withdrawals or loans; recurring income;
  budget settings, per-month adjustments and a vacation mode.
- **Sheets:** analysis (category donut, week bars, heatmap, balance line), income & savings, all expenses, search.

### 2.9 Hypex AI (admin only)
- **Dagbriefing:** structured tiles built from real data (urgent tasks, overdue tasks, next appointment,
  day budget) plus an AI-written summary that can be regenerated.
- **Quick actions:** "Plan mijn dag", "Wat is nu belangrijk?", "Hoe gaan mijn routines?", "Hoe staat mijn budget?".
- **Chat** with context about today's tasks, overdue items, routines and budget. When asked, the AI can
  perform actions: add a task, complete a task, mark a routine as done, log an expense, save a note.
  Each action is shown as a confirmation card.
- Uses Google Gemini through a Netlify function (the API key stays server-side).

### 2.10 Global features
- **Search (Ctrl/⌘K):** tasks, agenda items, notes, pages and "Nieuwe taak", from anywhere.
- **Instellingen:** accent color presets (Neon Cyan, Purple Dream, Sunset, Rose, Emerald, Sky Blue) or a
  custom color with a live preview; push notifications; connect Google Calendar or MyX; reset; log out.
- **Navigation:** sidebar on desktop (with an overdue badge on Taken), bottom tab bar with a "Meer" sheet on mobile.
- **Sync:** data refreshes automatically every 30 seconds and on demand; pull-to-refresh on mobile.
- **Onboarding** for new users (location, school account, notifications) and an **admin panel**
  (user management, push test, enabling the work tab).
- **XP system:** completing tasks, focus sessions and (inactive) gym workouts award XP.
- **Version check:** shows when a new deployment is available.
- **iOS home-screen widgets** via the Scriptable app (tasks/agenda and money), see [WIDGET.md](../WIDGET.md).

### 2.11 Inactive features
The code for these pages still exists but they are hidden from navigation: **School** (Magister grades,
homework, study guides), **Gewoontes** (habits with reminders) and **Gym** (workout tracking).

---

## 3. Data and integrations

| Integration | Used for | How |
|---|---|---|
| **Supabase** | Authentication and all app data | Tables: `tasks`, `subjects`, `calendar_events`, `external_calendar_events`, `calendar_connections`, `notes`, `note_folders`, `expenses`, `budget_config`, `pomodoro_sessions`, `timer_sessions`, `habits`, `habit_completions`, `habit_achievements`, `profiles`, `push_subscriptions`, `gym_*`, `simacan_*`. Row-level security per user. |
| **Magister / SOMtoday** | School lessons (and grades/homework on the inactive School page) | Netlify functions `magister`, `somtoday` |
| **Google Calendar / MyX** | Imported calendars | Netlify function `calendar` (OAuth for Google, ICS feed for MyX) |
| **PMT** | Jumbo work shifts | Netlify function `pmt` |
| **Simacan** | Freight arrival times | Netlify functions `simacan`, `simacan-check` (scheduled) |
| **Open-Meteo / Buienalarm** | Weather, 2-hour rain radar, rain alerts | Direct API + `buienalarm` proxy, `rain-check` (scheduled) |
| **Spotify** | Now playing, playback controls, queue, recently played | OAuth (PKCE) in the browser |
| **Google Gemini** | Hypex AI | Netlify function `ai-chat` |
| **Web Push** | Timer end, rain, habits, freight arrivals | `pomodoro-cron`, `pomodoro-notify`, `habit-reminder`, `rain-check`, `simacan-check` |

**Scheduled functions** (see `netlify.toml`): `pomodoro-cron` and `simacan-check` every minute,
`rain-check` every 15 minutes, `habit-reminder` every hour.

Some per-device state lives in the browser: Pomodoro timer state, theme, cached school schedules and work
shifts, dashboard filters and collapsed sections.

---

## 4. Technology

- **Frontend:** React 18 + Vite 5 (JavaScript; the Geld sub-app is TypeScript with a Zustand store).
- **Styling:** Tailwind CSS plus inline styles, built on design tokens in `src/index.css` (colors, category
  colors, radii, spacing, typography). All accent-colored styling follows the chosen theme.
- **Shared UI components:** `src/components/ui/` (card, KPI tile, list row, pill, progress bar, filter tabs,
  icon button, empty state).
- **Icons:** lucide-react. **Charts:** Recharts and hand-made SVG. **Maps:** MapLibre GL.
- **Navigation:** state-based (no router); `activePage` in `src/App.jsx` decides which page is shown.
- **Backend:** Supabase (database + auth) and Netlify Functions; hosted on Netlify.

---

## 5. Running the project

```bash
npm install
npm run dev        # Vite dev server on http://localhost:3000
npm run build      # production build into dist/
npm run typecheck  # TypeScript check
```

Plain `npm run dev` does **not** serve the Netlify functions, so Spotify token exchange, AI chat, PMT,
Simacan, Magister/SOMtoday and calendar sync will fail locally. Use `netlify dev` to run them.
The app needs Supabase and API credentials in environment variables (Vite `VITE_*` variables for the
frontend, server-side keys such as the Supabase service key, Gemini key and `WIDGET_TOKEN` in Netlify).
