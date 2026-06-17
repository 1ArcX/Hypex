// ============================================================================
//  Hypex — iOS home-screen widget (Scriptable)
// ----------------------------------------------------------------------------
//  1. Installeer de gratis app "Scriptable" uit de App Store.
//  2. Nieuw script (+), plak deze hele code.
//  3. Vul hieronder BASE en TOKEN in (TOKEN = dezelfde WIDGET_TOKEN als in Netlify).
//  4. Voeg op je beginscherm een Scriptable-widget toe (medium), kies dit script.
//  Tip: long-press de widget -> "Edit Widget" -> Script = dit script.
// ============================================================================

const BASE  = "https://hypexdash.netlify.app/.netlify/functions/widget"
const TOKEN = "ZET_HIER_JE_WIDGET_TOKEN"                                  // <-- jouw WIDGET_TOKEN
const APP_URL = "https://hypexdash.netlify.app/"                          // opent bij tikken

const ACCENT = new Color("#5EEAD4")
const BG     = new Color("#0b0b0f")
const RED    = new Color("#ff8080")

const data = await fetchData()
const widget = buildWidget(data)
widget.url = APP_URL

if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()

async function fetchData() {
  try {
    const req = new Request(`${BASE}?token=${encodeURIComponent(TOKEN)}`)
    req.timeoutInterval = 12
    return await req.loadJSON()
  } catch (e) {
    return null
  }
}

function buildWidget(d) {
  const w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(14, 16, 12, 16)

  if (!d || d.error) {
    const t = w.addText(d?.error ? `Fout: ${d.error}` : "Kon niet laden")
    t.font = Font.systemFont(13); t.textColor = Color.gray()
    return w
  }

  // Kop
  const head = w.addStack(); head.centerAlignContent()
  const title = head.addText("Vandaag")
  title.font = Font.boldSystemFont(16); title.textColor = Color.white()
  head.addSpacer()
  const date = head.addText(d.label || "")
  date.font = Font.systemFont(12); date.textColor = ACCENT
  w.addSpacer(7)

  // Te laat
  if (d.overdue > 0) {
    const o = w.addText(`⚠️ ${d.overdue} te laat`)
    o.font = Font.mediumSystemFont(11); o.textColor = RED
    w.addSpacer(5)
  }

  const items = (d.items || []).slice(0, 6)
  if (items.length === 0 && !d.overdue) {
    const e = w.addText("Niets gepland 🎉")
    e.font = Font.systemFont(13); e.textColor = Color.gray()
    return w
  }

  for (const it of items) {
    const row = w.addStack(); row.centerAlignContent(); row.spacing = 6
    const mark = it.done ? "✓" : it.kind === "routine" ? "🔁" : it.kind === "event" ? "•" : "○"
    const m = row.addText(mark)
    m.font = Font.systemFont(12)
    m.textColor = it.done ? ACCENT : it.kind === "event" ? ACCENT : Color.gray()
    const tt = row.addText(it.title)
    tt.font = Font.systemFont(13); tt.lineLimit = 1
    tt.textColor = it.done ? Color.gray() : Color.white()
    row.addSpacer()
    const right = it.time || (it.daypart ? it.daypart : "")
    if (right) {
      const r = row.addText(right)
      r.font = Font.systemFont(11); r.textColor = Color.gray()
    }
    w.addSpacer(5)
  }

  // Voettekst: routine-voortgang
  if (d.routinesTotal > 0) {
    w.addSpacer(2)
    const f = w.addText(`🔥 ${d.routinesDone}/${d.routinesTotal} routines`)
    f.font = Font.systemFont(10); f.textColor = Color.gray()
  }

  return w
}
