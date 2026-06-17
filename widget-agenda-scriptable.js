// ============================================================================
//  Hypex — Agenda-widget (Scriptable), groot formaat
//  Tijdlijn van vandaag (events + taken/routines), automatisch geschaald naar
//  het eerstvolgende/drukste deel zodat je het meeste ziet.
//  (Magister-lessen & werk staan niet in Supabase en dus niet in deze widget.)
// ============================================================================

const BASE    = "https://hypexdash.netlify.app/.netlify/functions/widget-agenda"
const TOKEN   = "ZET_HIER_JE_WIDGET_TOKEN"   // <-- jouw WIDGET_TOKEN
const APP_URL = "https://hypexdash.netlify.app/"

const ACCENT = new Color("#5EEAD4")
const WHITE  = new Color("#f2f2f5")
const GRAY   = new Color("#8e8e93")

const family = config.widgetFamily || "large"
const data = await fetchData()
const widget = buildWidget(data)
widget.url = APP_URL
widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)

if (config.runsInWidget) Script.setWidget(widget)
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

function pad(n) { return String(n).padStart(2, "0") }

// Side-by-side layout voor overlappende items (zoals de website-agenda)
function layoutOverlaps(items) {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => a.startMin !== b.startMin ? a.startMin - b.startMin : b.endMin - a.endMin)
  const colEnds = []
  for (const it of sorted) {
    let placed = false
    for (let c = 0; c < colEnds.length; c++) { if (colEnds[c] <= it.startMin) { it._col = c; colEnds[c] = it.endMin; placed = true; break } }
    if (!placed) { it._col = colEnds.length; colEnds.push(it.endMin) }
  }
  for (const it of sorted) {
    let mx = it._col
    for (const o of sorted) if (o.startMin < it.endMin && o.endMin > it.startMin) mx = Math.max(mx, o._col)
    it._colTotal = mx + 1
  }
  return sorted
}

function timelineImage(timed, nowMin, W, H) {
  const LEFT = 28
  const ctx = new DrawContext()
  ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = true

  // venster bepalen (auto-scroll naar het beste deel)
  let windowStart, windowMin
  if (!timed.length) {
    windowStart = Math.max(0, Math.min(1440 - 480, nowMin - 60)); windowMin = 480
  } else {
    const upcoming = timed.filter(i => i.endMin >= nowMin)
    const anchor = upcoming.length ? Math.min(...upcoming.map(i => i.startMin)) : Math.min(...timed.map(i => i.startMin))
    windowStart = Math.max(0, anchor - 30)
    const maxEnd = Math.max(...timed.map(i => i.endMin))
    windowMin = Math.min(660, Math.max(240, maxEnd - windowStart))
    if (windowStart + windowMin > 1440) windowStart = Math.max(0, 1440 - windowMin)
  }
  const ppm = H / windowMin
  const winEnd = windowStart + windowMin

  // uurlijnen + labels
  for (let m = Math.ceil(windowStart / 60) * 60; m < winEnd; m += 60) {
    const y = (m - windowStart) * ppm
    ctx.setStrokeColor(new Color("#ffffff", 0.07)); ctx.setLineWidth(1)
    const p = new Path(); p.move(new Point(LEFT, y)); p.addLine(new Point(W, y)); ctx.addPath(p); ctx.strokePath()
    ctx.setFont(Font.systemFont(9)); ctx.setTextColor(new Color("#ffffff", 0.30)); ctx.setTextAlignedRight()
    ctx.drawTextInRect(`${pad(Math.floor(m / 60))}`, new Rect(0, y - 6, LEFT - 5, 12))
  }

  // nu-lijn
  if (nowMin >= windowStart && nowMin <= winEnd) {
    const y = (nowMin - windowStart) * ppm
    ctx.setStrokeColor(new Color("#FF453A")); ctx.setLineWidth(1.5)
    const p = new Path(); p.move(new Point(LEFT, y)); p.addLine(new Point(W, y)); ctx.addPath(p); ctx.strokePath()
    ctx.setFillColor(new Color("#FF453A")); ctx.fillEllipse(new Rect(LEFT - 3, y - 3, 6, 6))
  }

  // blokken
  const vis = timed.filter(i => i.endMin > windowStart && i.startMin < winEnd)
  for (const it of layoutOverlaps(vis)) {
    const top = Math.max(0, (it.startMin - windowStart) * ppm)
    const bot = Math.min(H, (it.endMin - windowStart) * ppm)
    const h = Math.max(15, bot - top)
    const cT = it._colTotal || 1
    const colW = (W - LEFT - 4) / cT
    const x = LEFT + 4 + (it._col || 0) * colW
    const wB = colW - 3
    ctx.setFillColor(new Color(it.color, 0.20))
    const r = new Path(); r.addRoundedRect(new Rect(x, top, wB, h), 4, 4); ctx.addPath(r); ctx.fillPath()
    ctx.setFillColor(new Color(it.color))
    const b = new Path(); b.addRoundedRect(new Rect(x, top, 2.5, h), 1, 1); ctx.addPath(b); ctx.fillPath()
    ctx.setFont(Font.boldSystemFont(9)); ctx.setTextColor(new Color(it.color)); ctx.setTextAlignedLeft()
    ctx.drawTextInRect(it.title, new Rect(x + 6, top + 2, wB - 8, Math.min(h - 3, 22)))
  }

  // indicatoren voor items buiten het venster
  const earlier = timed.filter(i => i.endMin <= windowStart).length
  const later = timed.filter(i => i.startMin >= winEnd).length
  ctx.setFont(Font.systemFont(9)); ctx.setTextColor(new Color("#ffffff", 0.45)); ctx.setTextAlignedRight()
  if (earlier > 0) ctx.drawTextInRect(`↑ ${earlier} eerder`, new Rect(W - 80, 0, 80, 11))
  if (later > 0) ctx.drawTextInRect(`↓ ${later} later`, new Rect(W - 80, H - 12, 80, 11))

  return ctx.getImage()
}

function buildWidget(d) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [new Color("#1c1c1e"), new Color("#121214")]; g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(12, 14, 10, 14)

  if (!d || d.error) {
    const t = w.addText(d?.error ? `Fout: ${d.error}` : "Kon niet laden")
    t.font = Font.systemFont(13); t.textColor = GRAY
    return w
  }

  // Kop
  const head = w.addStack(); head.centerAlignContent()
  const title = head.addText("Agenda")
  title.font = Font.boldSystemFont(17); title.textColor = WHITE
  head.addSpacer()
  const date = head.addText(d.label || "")
  date.font = Font.mediumSystemFont(12); date.textColor = ACCENT
  w.addSpacer(6)

  // Hele dag
  if ((d.allDay || []).length) {
    const ad = w.addText("📌 " + d.allDay.map(a => a.title).join("  ·  "))
    ad.font = Font.systemFont(11); ad.textColor = GRAY; ad.lineLimit = 1
    w.addSpacer(6)
  }

  if (!(d.timed || []).length && !(d.allDay || []).length) {
    w.addSpacer()
    const e = w.addText("Niets in de agenda vandaag 🌤️")
    e.font = Font.systemFont(14); e.textColor = GRAY; e.centerAlignText()
    w.addSpacer()
    return w
  }

  // Tijdlijn
  const W = family === "medium" ? 300 : 300
  const H = family === "medium" ? 110 : ((d.allDay || []).length ? 250 : 262)
  const wrap = w.addStack(); wrap.addSpacer()
  const img = wrap.addImage(timelineImage(d.timed || [], d.nowMin ?? 0, W, H))
  img.imageSize = new Size(W, H)
  wrap.addSpacer()
  return w
}
