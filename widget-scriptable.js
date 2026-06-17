// ============================================================================
//  Hypex — iOS home-screen widget (Scriptable), iOS-Herinneringen-stijl
//  Beginscherm -> widget toevoegen -> Scriptable -> kies dit script
// ============================================================================

const BASE    = "https://hypexdash.netlify.app/.netlify/functions/widget"
const TOKEN   = "ZET_HIER_JE_WIDGET_TOKEN"   // <-- jouw WIDGET_TOKEN
const APP_URL = "https://hypexdash.netlify.app/"

const ACCENT = new Color("#5EEAD4")
const RED    = new Color("#ff8079")
const WHITE  = new Color("#f2f2f5")
const GRAY   = new Color("#8e8e93")

const family = config.widgetFamily || "medium"
const MAX_ROWS = family === "small" ? 3 : family === "large" ? 9 : 4

const data = await fetchData()
const widget = buildWidget(data)
widget.url = APP_URL
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

if (config.runsInWidget) Script.setWidget(widget)
else if (family === "small") await widget.presentSmall()
else if (family === "large") await widget.presentLarge()
else await widget.presentMedium()
Script.complete()

async function fetchData() {
  try {
    const req = new Request(`${BASE}?token=${encodeURIComponent(TOKEN)}`)
    req.timeoutInterval = 12
    return await req.loadJSON()
  } catch (e) { return null }
}

function sym(stack, name, color, size) {
  const sf = SFSymbol.named(name)
  sf.applyFont(Font.systemFont(size))
  const img = stack.addImage(sf.image)
  img.imageSize = new Size(size + 3, size + 3)
  img.tintColor = color
  img.resizable = false
  return img
}

function buildWidget(d) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [new Color("#1c1c1e"), new Color("#141416")]
  g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(14, 15, 12, 15)

  if (!d || d.error) {
    const t = w.addText(d?.error ? `Fout: ${d.error}` : "Kon niet laden")
    t.font = Font.systemFont(13); t.textColor = GRAY
    return w
  }

  // ── Kop: "Vandaag" + datum ──
  const head = w.addStack(); head.centerAlignContent()
  const title = head.addText("Vandaag")
  title.font = Font.boldSystemFont(family === "small" ? 15 : 17); title.textColor = WHITE
  head.addSpacer()
  if (family !== "small") {
    const date = head.addText(d.label || "")
    date.font = Font.mediumSystemFont(12); date.textColor = ACCENT
  }
  w.addSpacer(family === "small" ? 7 : 9)

  // ── Regels samenstellen ──
  const rows = []
  if (d.overdue > 0) rows.push({ overdue: true, title: `${d.overdue} te laat`, time: null })
  for (const it of (d.items || [])) rows.push(it)

  const shown = rows.slice(0, MAX_ROWS)
  if (shown.length === 0) {
    const e = w.addText("Niets gepland 🎉")
    e.font = Font.systemFont(14); e.textColor = GRAY
    return w
  }

  for (const it of shown) {
    const row = w.addStack(); row.centerAlignContent(); row.spacing = 8

    if (it.overdue) {
      sym(row, "exclamationmark.circle.fill", RED, 15)
    } else if (it.kind === "event") {
      sym(row, "circle.fill", ACCENT, 9)
    } else if (it.done) {
      sym(row, "checkmark.circle.fill", ACCENT, 15)
    } else {
      sym(row, "circle", it.kind === "routine" ? ACCENT : GRAY, 15)
    }

    const tt = row.addText(it.title)
    tt.font = Font.systemFont(14); tt.lineLimit = 1
    tt.textColor = it.overdue ? RED : it.done ? GRAY : WHITE
    row.addSpacer()

    let right = it.time
    if (!right && it.kind === "routine" && it.streak > 0) right = `🔥 ${it.streak}`
    else if (!right && it.daypart) right = it.daypart
    if (right) {
      const r = row.addText(right)
      r.font = Font.systemFont(12); r.textColor = GRAY
    }
    w.addSpacer(family === "small" ? 7 : 9)
  }

  // "+N meer" wanneer er meer is dan past
  const extra = rows.length - shown.length
  if (extra > 0) {
    const more = w.addText(`+${extra} meer`)
    more.font = Font.systemFont(11); more.textColor = GRAY
  }

  w.addSpacer() // alles bovenaan uitlijnen, nooit clippen
  return w
}
