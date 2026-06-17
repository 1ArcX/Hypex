// ============================================================================
//  Hypex — iOS home-screen widget (Scriptable), iOS-Herinneringen-stijl
//  Groot formaat = rijke gesectioneerde weergave; klein/medium = compact.
// ============================================================================

const BASE    = "https://hypexdash.netlify.app/.netlify/functions/widget"
const TOKEN   = "ZET_HIER_JE_WIDGET_TOKEN"   // <-- jouw WIDGET_TOKEN
const APP_URL = "https://hypexdash.netlify.app/"

const ACCENT = new Color("#5EEAD4")
const RED    = new Color("#ff8079")
const AMBER  = new Color("#fbbf24")
const WHITE  = new Color("#f2f2f5")
const GRAY   = new Color("#8e8e93")
const DIM    = new Color("#5a5a5f")

const family = config.widgetFamily || "large"
const REFRESH_MIN = 5

const data = await fetchData()
const widget = family === "large" ? buildLarge(data) : buildCompact(data)
widget.url = APP_URL
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000)

if (config.runsInWidget) Script.setWidget(widget)
else if (family === "small") await widget.presentSmall()
else if (family === "medium") await widget.presentMedium()
else await widget.presentLarge()
Script.complete()

async function fetchData() {
  try {
    const req = new Request(`${BASE}?token=${encodeURIComponent(TOKEN)}`)
    req.timeoutInterval = 12
    return await req.loadJSON()
  } catch (e) { return null }
}

function bg(w) {
  const g = new LinearGradient()
  g.colors = [new Color("#1c1c1e"), new Color("#121214")]
  g.locations = [0, 1]
  w.backgroundGradient = g
}

function sym(stack, name, color, size) {
  const sf = SFSymbol.named(name)
  sf.applyFont(Font.systemFont(size))
  const img = stack.addImage(sf.image)
  img.imageSize = new Size(size + 3, size + 3)
  img.tintColor = color
  img.resizable = false
}

function lateLabel(n) { return n <= 1 ? "gisteren" : `${n}d` }

// ── Rij (gedeeld) ──
function addRow(w, it, gap) {
  const row = w.addStack(); row.centerAlignContent(); row.spacing = 9
  if (it._ov) sym(row, "exclamationmark.circle.fill", RED, 15)
  else if (it.kind === "event") sym(row, "circle.fill", ACCENT, 9)
  else if (it.done) sym(row, "checkmark.circle.fill", ACCENT, 15)
  else sym(row, "circle", it.kind === "routine" ? ACCENT : GRAY, 15)

  const tt = row.addText(it.title)
  tt.font = Font.systemFont(14); tt.lineLimit = 1
  tt.textColor = it._ov ? RED : it.done ? GRAY : WHITE
  row.addSpacer()

  let right = it._ov ? lateLabel(it.daysLate) : it.time
  if (!right && it.kind === "routine" && it.streak > 0) right = `🔥 ${it.streak}`
  else if (!right && it.daypart) right = it.daypart
  if (right) {
    const r = row.addText(right)
    r.font = Font.systemFont(12); r.textColor = it._ov ? RED : GRAY
  }
  w.addSpacer(gap)
}

function sectionLabel(w, text, color) {
  const l = w.addText(text)
  l.font = Font.heavySystemFont(10); l.textColor = color
  w.addSpacer(5)
}

// ── GROOT: gesectioneerd, toont (bijna) alles ──
function buildLarge(d) {
  const w = new ListWidget()
  bg(w)
  w.setPadding(16, 16, 14, 16)

  if (!d || d.error) return errorWidget(w, d)

  // Kop
  const head = w.addStack(); head.centerAlignContent()
  const left = head.addStack(); left.layoutVertically(); left.spacing = 1
  const title = left.addText("Vandaag"); title.font = Font.boldSystemFont(24); title.textColor = WHITE
  const date = left.addText(d.label || ""); date.font = Font.mediumSystemFont(12); date.textColor = GRAY
  head.addSpacer()
  if (d.routinesTotal > 0) {
    const badge = head.addStack(); badge.centerAlignContent(); badge.spacing = 3
    badge.setPadding(5, 9, 5, 9)
    badge.backgroundColor = new Color("#5EEAD4", 0.12)
    badge.cornerRadius = 11
    const fl = badge.addText("🔥"); fl.font = Font.systemFont(12)
    const c = badge.addText(`${d.routinesDone}/${d.routinesTotal}`); c.font = Font.boldSystemFont(13); c.textColor = ACCENT
  }
  w.addSpacer(13)

  const sections = [
    { label: "TE LAAT",  color: RED,    rows: (d.overdueItems || []).map(it => ({ ...it, _ov: true })) },
    { label: "AGENDA",   color: ACCENT, rows: (d.items || []).filter(i => i.kind === "event") },
    { label: "ROUTINES", color: AMBER,  rows: (d.items || []).filter(i => i.kind === "routine") },
    { label: "TAKEN",    color: GRAY,   rows: (d.items || []).filter(i => i.kind === "task") },
  ]

  let budget = 9
  let any = false
  for (const s of sections) {
    if (!s.rows.length || budget <= 0) continue
    any = true
    sectionLabel(w, s.label, s.color)
    const take = s.rows.slice(0, budget)
    for (const it of take) { addRow(w, it, 4); budget-- }
    const extra = s.rows.length - take.length
    if (extra > 0) { const m = w.addText(`  +${extra} meer`); m.font = Font.systemFont(11); m.textColor = DIM; w.addSpacer(2) }
    w.addSpacer(6)
  }

  if (!any) {
    w.addSpacer(24)
    const e = w.addText("Niets gepland vandaag 🎉")
    e.font = Font.systemFont(15); e.textColor = GRAY; e.centerAlignText()
  }
  w.addSpacer()
  return w
}

// ── KLEIN / MEDIUM: compacte vlakke lijst ──
function buildCompact(d) {
  const w = new ListWidget()
  bg(w)
  w.setPadding(14, 15, 12, 15)
  if (!d || d.error) return errorWidget(w, d)

  const small = family === "small"
  const MAX = small ? 3 : 5

  const head = w.addStack(); head.centerAlignContent()
  const title = head.addText("Vandaag")
  title.font = Font.boldSystemFont(small ? 15 : 17); title.textColor = WHITE
  head.addSpacer()
  if (!small) { const date = head.addText(d.label || ""); date.font = Font.mediumSystemFont(12); date.textColor = ACCENT }
  w.addSpacer(small ? 7 : 9)

  const rows = []
  for (const it of (d.overdueItems || [])) rows.push({ ...it, _ov: true })
  for (const it of (d.items || [])) rows.push(it)

  const shown = rows.slice(0, MAX)
  if (shown.length === 0) {
    const e = w.addText("Niets gepland 🎉"); e.font = Font.systemFont(14); e.textColor = GRAY
    w.addSpacer(); return w
  }
  for (const it of shown) addRow(w, it, small ? 7 : 8)
  const extra = rows.length - shown.length
  if (extra > 0) { const m = w.addText(`+${extra} meer`); m.font = Font.systemFont(11); m.textColor = DIM }
  w.addSpacer()
  return w
}

function errorWidget(w, d) {
  const t = w.addText(d?.error ? `Fout: ${d.error}` : "Kon niet laden")
  t.font = Font.systemFont(13); t.textColor = GRAY
  return w
}
