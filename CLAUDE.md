# HypexDash

React 18 + Vite web app (dashboard for a student). UI language is Dutch.
Navigation is **state-based** (no router): pages switch via `activePage` in `src/App.jsx`.

## Component map (read this first when I mention a component)

@docs/components.md

When I refer to a component informally — by a Dutch or English name, by visible on-screen text,
or by its position ("de sidebar", "de stats-kaart op het dashboard", "het inlogscherm",
"de linker menu", "the login popup") — resolve it as follows:

1. **Look it up in `docs/components.md` first** (match on name, aliases, visible text, or location),
   then open the file(s) it points to. Do not scan the whole repo before consulting the map.
2. **If the reference matches multiple components**, list the candidates with their file paths and
   ask me which one I mean before editing.
3. **If nothing matches**, search the codebase for the exact visible text I used, then tell me which
   component it turned out to be (and consider adding it to the map).
4. Some cards/widgets are **inline** inside a page file (e.g. the dashboard focus/stats cards live in
   `src/pages/DashboardPage.jsx`), not separate components — the map notes these.

## Keep the map current

When a component is **added, renamed, moved, or removed**, update `docs/components.md` in the same change.

## Update-log

Bij elke wijziging die de gebruiker merkt: voeg in hetzelfde commit een item toe bovenaan `RELEASES` in
`src/changelog.js` (id + 1, datum, korte titel, per onderdeel een zin in het Nederlands). De app toont na de
update automatisch een popup met alle nog niet geziene updates.

