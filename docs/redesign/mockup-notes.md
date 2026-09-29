# Hypex v2 — mockup notes

Written description of the reference mockup (a single image with six numbered panels), so the
direction survives even when the image is no longer available. **Direction, not a pixel spec.**
Example content in the mockup (names, amounts, times, course codes, song titles, tokens) is
illustrative only and must never be copied into the app.

## Global visual language (applies to every page)

- **Background:** near-black with a faint cool/teal tint (`~#07090c`–`#0b0e12`), no visible gradient blobs.
- **Surfaces:** cards are slightly lighter than the background (`~#0f1318`), 1px hairline border
  (`~rgba(255,255,255,0.06–0.08)`), radius ≈ 12–16px. No drop shadow; no glow on resting cards.
- **Accent (cyan `#00FFD1`-ish)** used sparingly: active nav item, primary buttons ("+ Nieuw", "+ Taak"),
  the large clock digits, progress bars, the active filter tab, the Pomodoro ring, the Spotify play button.
- **Glow:** only on a few Level-1 elements — the clock digits (soft text glow), the Pomodoro ring,
  the primary play buttons, and a faint red tint/glow on the urgent KPI + "Te laat" card.
- **Tinted KPI tiles:** each KPI tile has a very low-opacity background of its semantic color
  (red / orange / green / purple) with a matching thin border and a round tinted icon badge on the left.
- **Typography:** clean sans, three clear levels. Page/section titles ~15–16px semibold; row titles
  ~13px medium; metadata ~11px muted. KPI numbers ~22–26px bold. Clock ~48px bold, tabular.
- **Pills/badges:** small (height ~20px), radius ~6px, tinted background of the semantic color,
  11px text. Used for dates ("25 sep"), status ("Vandaag"), counts, tags, and "Start" quick actions.
- **List rows:** colored dot · title (+ optional one-line subtitle) · right-aligned date pill · action
  (button, flag or checkbox). Row height ~36–40px, subtle row background, no heavy borders.
- **Icons:** lucide-style outline icons, 14–16px, often in the section-title color.
- **Section headers inside cards:** icon + title left, link-style action right ("Bekijk alles →").

## Sidebar (visible in panel 1)

- Width ~145px. Top: logo mark (ring) + "Hypex" + small collapse icon.
- Nav: icon + label rows ~32px high; the active item ("Dashboard") gets an accent-tinted fill,
  an accent border and accent text. Others are muted grey.
- "Taken" has a small red count badge on the right. "Jumbo ★" keeps its star.
- Bottom: "Instellingen" row, then a user chip (avatar initial in accent circle + username).

## Panel 1 — Dashboard ("verbeterde hiërarchie")

Grid, four rows:

1. **Header row** (no card around greeting): "Goedendavond, Fachri" (bold ~16px) + date underneath
   (muted, small). Center: a search field "Zoek in Hypex…" with a `⌘K` hint. Then a **large accent
   clock** (~48px, with glow) standing free, not boxed. Right: a compact weather card
   (icon, temperature, place, condition).
2. **KPI row** — four equal tiles: *Urgent* (red, flame icon), *Te laat* (orange, clock icon),
   *Open* (green/accent, check icon), *Vandaag* (purple, calendar icon). Big number + label.
3. **Workspace row** — left (~⅔): **"Te laat (3)"** card with red tint and red border, rows with
   orange/red dot + title + red date pill + "Start" button; header link "Bekijk alles →".
   Right (~⅓): **"Volgende afspraak"** card: orange "In 14 min" countdown, title in bold,
   time range, location, a colored vertical bar on the left of the details, button "Bekijk agenda →".
4. **Widget row** — four compact cards with header (icon + title + small +/→ button):
   - *Vandaag*: progress ring "2/6" + list of 3 task names with checkboxes + "+3 meer".
   - *Pomodoro*: large accent ring with play button, "60:00", label "School".
   - *Geld*: "€22,79", "Nog deze maand", progress bar, "€1425 / €1650".
   - *Spotify*: album art, track + artist, prev / play (accent circle) / next.

## Panel 2 — Agenda ("duidelijkere weergave")

- **Toolbar:** "Vandaag" button, ‹ › arrows, range label "Sep – Okt 2026"; right: segmented control
  Dag / **Week** / Maand, and an accent "+ Nieuw" button.
- **Week grid:** 7 day columns with uppercase weekday abbreviation (MA, DI…) over the date number.
  Current day: accent-colored label and the date in a filled accent circle.
- All-day strip at the top (small blue "Traden" items).
- **Events:** tinted background of the category color (~15–20% opacity), a solid left border /
  outline in the category color, **readable title bold** (e.g. "Digital Circuits"), time range
  underneath, **technical course code smaller underneath** (e.g. an `EMBS…` code).
  School = yellow/olive, Werk = red, Persoonlijk = purple ("Bowlen?").
- Gridlines are faint; hour labels are small and muted on the left.
- **Now line:** red horizontal line across the grid with a red time pill ("18:36") on the left edge.
- **Right rail:** "Kleuren" legend (School yellow, Werk red, Persoonlijk purple, Routine green,
  Overig blue) and below it a **mini month calendar** ("September 2026") with today highlighted.

## Panel 3 — Taken ("meer context en voortgang")

- Header: icon + "Taken" + small icon button at the right.
- **Filter tabs (pills):** *Vandaag* (active, accent fill, with count), *Deze week 8*, *Alle 21*,
  *Te laat 3* (red count). Accent "+ Taak" button at the far right.
- **Progress line:** "3 van 6 voltooid" left, "50%" right, thin accent progress bar.
- **Grouped sections** with colored header + count: *Urgent (2)* (red), *Te laat (1)* (red),
  *Overig (3)* and *Routines (2)* collapsed with a chevron.
- **Task row:** colored dot · title with one-line muted subtitle · date/status pill ("Vandaag" in red
  tint, "28 sep") · priority flag icon (red/green) · checkbox on the far right.

## Panel 4 — Notities ("split view")

- Header: icon + "Notities", search field "Zoek notities…" with a filter icon, accent "+ Nieuw".
- **Left list (~40%):** rows with colored dot, bold title, date right-aligned, and a one-line muted
  preview beneath. The selected row has an accent-tinted background and accent left edge.
- **Right detail:** title large, date under it, **tag pills** ("School" yellow, "API" orange),
  edit and delete icon buttons top-right (delete in red), content in a slightly inset
  monospace-ish panel.

## Panel 5 — Geld ("duidelijkere structuur")

- Header: icon + "Geld", month switcher "‹ September 2026 ›".
- **Hero KPI card** (accent border, very subtle accent tint): amount large (~28px bold),
  "Beschikbaar deze maand", progress bar, "€1425 / €1650" right-aligned.
- **Row of 3 tiles:** *Vandaag* (yellow/orange tint, the only tinted one), *Deze week*, *Inkomsten*
  ("verwacht" subtitle, green).
- **Row of 3 tiles:** *Prognose* ("Op schema", green), *Spaarstreak* ("366d"), *Analyse →* (link tile).
- Each tile: small colored icon + label on top, bold amount, optional muted subtitle.

## Panel 6 — Instellingen ("live preview")

- Modal/card with title "Instellingen" and a close ✕.
- **Accentkleur:** 2×3 grid of preset pills (Neon Cyan, Purple Dream, Sunset, Rose, Emerald,
  Sky Blue) each with a color dot; the active one gets a tinted fill and border.
- **Eigen kleur:** color swatch + hex value (`#00FFD1`).
- **Live preview:** a mini mock of the UI in the chosen accent: a "Live preview" pill,
  a primary button ("Secundair knop" label in the mockup), a round icon button, and a mini
  bottom-nav with "Home / Agenda (Actief) / …" where the active tab is accent-colored.

## Style tokens read from the mockup (approximate)

| Token | Approx. value |
|---|---|
| Background | `#080a0d` |
| Surface (card) | `#0e1216` / `rgba(255,255,255,0.03)` |
| Surface elevated / row | `rgba(255,255,255,0.05)` |
| Border | `rgba(255,255,255,0.07)` |
| Text primary / secondary / muted | `~#EDEFF2` / `~#9AA3AD` / `~#5D6670` |
| Danger (urgent, te laat) | `#FF4D5E`-ish red; overdue KPI uses orange `#FF8C42` |
| Success / Open | green-cyan |
| Card radius | ~14px; tiles ~12px; pills ~6px |
| Gutter between cards | ~12px; card padding ~14–16px |
