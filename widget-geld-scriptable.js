// ============================================================================
//  Hypex — Geld-widget (Scriptable), medium formaat
//  Toont: nog te besteden deze maand, vandaag nog, en deze week.
//  Apart script + apart widget; gebruikt dezelfde WIDGET_TOKEN.
// ============================================================================

const BASE    = "https://hypexdash.netlify.app/.netlify/functions/widget-geld"
const TOKEN   = "ZET_HIER_JE_WIDGET_TOKEN"   // <-- jouw WIDGET_TOKEN
const APP_URL = "https://hypexdash.netlify.app/"

const ACCENT = new Color("#5EEAD4")
const GREEN  = new Color("#34D399")
const AMBER  = new Color("#FBBF24")
const RED    = new Color("#F87171")
const WHITE  = new Color("#f2f2f5")
const GRAY   = new Color("#8e8e93")

const data = await fetchData()
const widget = buildWidget(data)
widget.url = APP_URL
widget.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000)

if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()

async function fetchData() {
  try {
    const req = new Request(`${BASE}?token=${encodeURIComponent(TOKEN)}`)
    req.timeoutInterval = 12
    return await req.loadJSON()
  } catch (e) { return null }
}

function euro(n) { return (n < 0 ? "−€ " : "€ ") + Math.abs(Math.round(n)).toLocaleString("nl-NL") }
function colMonth(n, base) { return n < 0 ? RED : n < base * 0.2 ? AMBER : ACCENT }
function colDay(n) { return n < 0 ? RED : n < 5 ? AMBER : GREEN }
function colWeek(n) { return n < 0 ? RED : n < 10 ? AMBER : GREEN }

function barImage(pct, w, h, fill) {
  const ctx = new DrawContext()
  ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true
  const r = h / 2
  ctx.setFillColor(new Color("#ffffff", 0.10))
  const t = new Path(); t.addRoundedRect(new Rect(0, 0, w, h), r, r); ctx.addPath(t); ctx.fillPath()
  const fw = Math.max(h, Math.min(w, w * pct))
  ctx.setFillColor(fill)
  const f = new Path(); f.addRoundedRect(new Rect(0, 0, fw, h), r, r); ctx.addPath(f); ctx.fillPath()
  return ctx.getImage()
}

function buildWidget(d) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [new Color("#1c1c1e"), new Color("#121214")]; g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(15, 16, 14, 16)

  if (!d || d.error) {
    const t = w.addText(d?.error ? `Fout: ${d.error}` : "Kon niet laden")
    t.font = Font.systemFont(13); t.textColor = GRAY
    return w
  }

  // Kop
  const head = w.addStack(); head.centerAlignContent()
  const title = head.addText("💶 Budget")
  title.font = Font.boldSystemFont(15); title.textColor = WHITE
  head.addSpacer()
  const month = head.addText(d.label || "")
  month.font = Font.mediumSystemFont(11); month.textColor = GRAY
  w.addSpacer(9)

  // Groot: nog deze maand
  const lab = w.addText("Nog te besteden deze maand")
  lab.font = Font.systemFont(11); lab.textColor = GRAY
  w.addSpacer(2)
  const big = w.addText(euro(d.month))
  big.font = Font.boldSystemFont(34); big.textColor = colMonth(d.month, d.base || 1)
  w.addSpacer(9)

  // Voortgangsbalk (uitgegeven / budget)
  const base = d.base || 1
  const pct = Math.max(0, Math.min(1, (base - d.month) / base))
  const bar = w.addImage(barImage(pct, 320, 7, colMonth(d.month, base)))
  bar.imageSize = new Size(320, 7)
  w.addSpacer(3)
  const sub = w.addText(`${euro(d.spent)} uitgegeven van ${euro(d.base)}`)
  sub.font = Font.systemFont(10); sub.textColor = GRAY
  w.addSpacer(12)

  // Twee kolommen: vandaag | deze week
  const row = w.addStack(); row.centerAlignContent()
  const left = row.addStack(); left.layoutVertically(); left.spacing = 2
  const l1 = left.addText("Vandaag nog"); l1.font = Font.systemFont(11); l1.textColor = GRAY
  const v1 = left.addText(euro(d.today)); v1.font = Font.boldSystemFont(19); v1.textColor = colDay(d.today)
  row.addSpacer()
  const right = row.addStack(); right.layoutVertically(); right.spacing = 2
  const l2 = right.addText("Deze week"); l2.font = Font.systemFont(11); l2.textColor = GRAY; l2.rightAlignText()
  const v2 = right.addText(euro(d.week)); v2.font = Font.boldSystemFont(19); v2.textColor = colWeek(d.week); v2.rightAlignText()

  w.addSpacer()
  return w
}
