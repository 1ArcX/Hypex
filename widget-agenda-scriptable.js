// ============================================================================
//  Hypex — Agenda-widget (Scriptable), groot — iOS "Volgende"-stijl
//  Twee kolommen (vandaag + morgen), elk een tijdraster dat auto-schuift naar
//  het beste deel, met een "N taken"-chip en de rode nu-lijn.
//  (Magister-lessen & werk staan niet in Supabase en dus niet in deze widget.)
// ============================================================================

const BASE    = "https://hypexdash.netlify.app/.netlify/functions/widget-agenda"
const TOKEN   = "ZET_HIER_JE_WIDGET_TOKEN"   // <-- jouw WIDGET_TOKEN
const APP_URL = "https://hypexdash.netlify.app/"

const RED    = new Color("#FF453A")
const AMBER  = new Color("#FBBF24")
const WHITE  = new Color("#f2f2f5")
const GRAY   = new Color("#8e8e93")

const data = await fetchData()
const widget = buildWidget(data)
widget.url = APP_URL
widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)

if (config.runsInWidget) Script.setWidget(widget)
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
  const LEFT = 34
  const ctx = new DrawContext()
  ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = true

  let windowStart, windowMin
  if (!timed.length) {
    windowStart = nowMin >= 0 ? Math.max(0, Math.min(1440 - 480, nowMin - 60)) : 480
    windowMin = 480
  } else {
    const ref = nowMin >= 0 ? nowMin : -1
    const upcoming = timed.filter(i => i.endMin >= ref)
    const anchor = upcoming.length ? Math.min(...upcoming.map(i => i.startMin)) : Math.min(...timed.map(i => i.startMin))
    windowStart = Math.max(0, anchor - 30)
    const maxEnd = Math.max(...timed.map(i => i.endMin))
    windowMin = Math.min(660, Math.max(240, maxEnd - windowStart))
    if (windowStart + windowMin > 1440) windowStart = Math.max(0, 1440 - windowMin)
  }
  const ppm = H / windowMin
  const winEnd = windowStart + windowMin

  for (let m = Math.ceil(windowStart / 60) * 60; m < winEnd; m += 60) {
    const y = (m - windowStart) * ppm
    ctx.setStrokeColor(new Color("#ffffff", 0.07)); ctx.setLineWidth(1)
    const p = new Path(); p.move(new Point(LEFT, y)); p.addLine(new Point(W, y)); ctx.addPath(p); ctx.strokePath()
    ctx.setFont(Font.systemFont(8.5)); ctx.setTextColor(new Color("#ffffff", 0.30)); ctx.setTextAlignedLeft()
    ctx.drawTextInRect(`${pad(Math.floor(m / 60))}:00`, new Rect(0, y - 6, LEFT - 3, 12))
  }

  if (nowMin >= windowStart && nowMin <= winEnd) {
    const y = (nowMin - windowStart) * ppm
    ctx.setStrokeColor(RED); ctx.setLineWidth(1.5)
    const p = new Path(); p.move(new Point(LEFT, y)); p.addLine(new Point(W, y)); ctx.addPath(p); ctx.strokePath()
    ctx.setFillColor(RED); ctx.fillEllipse(new Rect(LEFT - 3, y - 3, 6, 6))
  }

  const vis = timed.filter(i => i.endMin > windowStart && i.startMin < winEnd)
  for (const it of layoutOverlaps(vis)) {
    const top = Math.max(0, (it.startMin - windowStart) * ppm)
    const bot = Math.min(H, (it.endMin - windowStart) * ppm)
    const h = Math.max(16, bot - top)
    const cT = it._colTotal || 1
    const colW = (W - LEFT - 3) / cT
    const x = LEFT + 3 + (it._col || 0) * colW
    const wB = colW - 2
    ctx.setFillColor(new Color(it.color, 0.22))
    const r = new Path(); r.addRoundedRect(new Rect(x, top, wB, h), 4, 4); ctx.addPath(r); ctx.fillPath()
    ctx.setFillColor(new Color(it.color))
    const b = new Path(); b.addRoundedRect(new Rect(x, top, 2.5, h), 1, 1); ctx.addPath(b); ctx.fillPath()
    ctx.setFont(Font.boldSystemFont(9)); ctx.setTextColor(new Color(it.color)); ctx.setTextAlignedLeft()
    ctx.drawTextInRect(it.title, new Rect(x + 5, top + 2, wB - 7, Math.min(h - 3, 22)))
    if (h >= 26) {
      ctx.setFont(Font.systemFont(8)); ctx.setTextColor(new Color(it.color, 0.8))
      ctx.drawTextInRect(`${pad(Math.floor(it.startMin / 60))}:${pad(it.startMin % 60)}`, new Rect(x + 5, top + 13, wB - 7, 11))
    }
  }

  const earlier = timed.filter(i => i.endMin <= windowStart).length
  const later = timed.filter(i => i.startMin >= winEnd).length
  ctx.setFont(Font.systemFont(8)); ctx.setTextColor(new Color("#ffffff", 0.45)); ctx.setTextAlignedRight()
  if (earlier > 0) ctx.drawTextInRect(`↑${earlier}`, new Rect(W - 26, 0, 26, 10))
  if (later > 0) ctx.drawTextInRect(`↓${later}`, new Rect(W - 26, H - 11, 26, 10))

  return ctx.getImage()
}

function chip(parent, n) {
  const c = parent.addStack(); c.centerAlignContent(); c.spacing = 3
  const sf = SFSymbol.named("list.bullet"); sf.applyFont(Font.systemFont(9))
  const img = c.addImage(sf.image); img.imageSize = new Size(11, 11); img.tintColor = AMBER
  const t = c.addText(`${n} taken`); t.font = Font.systemFont(10); t.textColor = GRAY
}

function column(parent, day, colW, gridH) {
  const col = parent.addStack(); col.layoutVertically(); col.spacing = 1; col.size = new Size(colW, 0)
  if (day.big) {
    const wd = col.addText(day.label); wd.font = Font.boldSystemFont(10.5); wd.textColor = RED
    const num = col.addText(String(day.dayNum)); num.font = Font.boldSystemFont(26); num.textColor = WHITE
  } else {
    const wd = col.addText(day.label); wd.font = Font.boldSystemFont(12); wd.textColor = GRAY
  }
  if (day.remCount > 0) chip(col, day.remCount)
  col.addSpacer(4)
  const img = col.addImage(timelineImage(day.timed || [], day.nowMin ?? -1, colW, gridH))
  img.imageSize = new Size(colW, gridH)
}

function buildWidget(d) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [new Color("#1c1c1e"), new Color("#121214")]; g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(12, 14, 10, 14)

  if (!d || d.error || !d.days) {
    const t = w.addText(d?.error ? `Fout: ${d.error}` : "Kon niet laden")
    t.font = Font.systemFont(13); t.textColor = GRAY
    return w
  }

  const colW = 144
  const gridH = 225
  const cols = w.addStack(); cols.topAlignContent(); cols.spacing = 12
  column(cols, d.days[0], colW, gridH)
  column(cols, d.days[1], colW, gridH)
  return w
}
