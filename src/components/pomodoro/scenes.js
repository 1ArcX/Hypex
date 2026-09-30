// Geanimeerde achtergrondscènes voor de Pomodoro-hero (canvas 2D).
// Elke scène: init(w, h) → state, draw(ctx, state, t, dt, w, h, tint).
// t = seconden sinds start, dt = seconden sinds vorige frame (0 = stilstaand frame),
// tint = [r, g, b] van de huidige modus (accent / pauze / lange pauze).

const TAU = Math.PI * 2
const rnd = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`

/** '#abc', '#aabbcc', 'rgb()/rgba()' → [r, g, b]; onbekend → null */
export function parseColor(str) {
  const s = (str || '').trim()
  let m = s.match(/^#([0-9a-f]{3})$/i)
  if (m) return m[1].split('').map(c => parseInt(c + c, 16))
  m = s.match(/^#([0-9a-f]{6})/i)
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16))
  m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (m) return [+m[1], +m[2], +m[3]]
  return null
}

function vGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  stops.forEach(([o, c]) => g.addColorStop(o, c))
  return g
}

function glow(ctx, x, y, r, color, a, w, h) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, a))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// Heuvel-/bergsilhouet als som van sinussen
function ridge(w, baseY, amp, seed, step = 8) {
  const pts = []
  for (let x = 0; x <= w + step; x += step) {
    const n = 0.5 * Math.sin(x * 0.004 + seed) + 0.3 * Math.sin(x * 0.011 + seed * 2.1) + 0.2 * Math.sin(x * 0.027 + seed * 3.7)
    pts.push([x, baseY - amp * (0.5 + 0.5 * n)])
  }
  return pts
}
function fillRidge(ctx, pts, w, h, fill) {
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (const [x, y] of pts) ctx.lineTo(x, y)
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

// Rij dennenbomen op een basislijn
function treeline(w, minH, maxH) {
  const trees = []
  for (let x = -10; x < w + 10; x += rnd(5, 12)) trees.push({ x, th: rnd(minH, maxH), tw: rnd(0.28, 0.4) })
  return trees
}
function drawTrees(ctx, trees, baseY, fill) {
  ctx.beginPath()
  for (const { x, th, tw } of trees) {
    ctx.moveTo(x - th * tw, baseY)
    ctx.lineTo(x, baseY - th)
    ctx.lineTo(x + th * tw, baseY)
  }
  ctx.fillStyle = fill
  ctx.fill()
}

function makeStars(w, maxY, count) {
  return Array.from({ length: count }, () => ({
    x: rnd(0, w), y: rnd(0, maxY) * rnd(0.3, 1), r: rnd(0.4, 1.4), ph: rnd(0, TAU), sp: rnd(0.6, 2.2),
  }))
}
function drawStars(ctx, stars, t, alpha = 1) {
  for (const s of stars) {
    const a = alpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)))
    ctx.fillStyle = `rgba(230,236,255,${a})`
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, TAU)
    ctx.fill()
  }
}
const starCount = (w, h, k = 5000) => clamp(Math.round((w * h) / k), 40, 260)

// ── Nacht: sterren, maan, bomen, meer met maanreflectie, hutje ─────────────
const nacht = {
  init(w, h) {
    const horizon = h * 0.64
    const k = h / 800
    return {
      horizon, k,
      stars: makeStars(w, horizon * 0.9, starCount(w, h)),
      mountains: ridge(w, horizon - h * 0.015, h * 0.16, 1.3),
      trees: treeline(w, h * 0.03, h * 0.085),
      moon: { x: w * 0.78, y: h * 0.19, r: clamp(Math.min(w, h) * 0.05, 16, 46) },
      cabinX: w * 0.2,
      shoot: null, nextShoot: rnd(3, 8),
    }
  },
  draw(ctx, s, t, dt, w, h) {
    const { horizon, moon, k } = s
    ctx.fillStyle = vGrad(ctx, 0, horizon, [[0, '#040a1c'], [0.55, '#0a1a3d'], [1, '#1c3163']])
    ctx.fillRect(0, 0, w, horizon)
    glow(ctx, moon.x, moon.y, moon.r * 7, [255, 214, 160], 0.22, w, horizon)
    drawStars(ctx, s.stars, t)

    // Vallende ster
    if (dt > 0) {
      s.nextShoot -= dt
      if (!s.shoot && s.nextShoot <= 0) {
        s.shoot = { x: rnd(w * 0.1, w * 0.6), y: rnd(10, horizon * 0.35), life: 1 }
        s.nextShoot = rnd(7, 16)
      }
    }
    if (s.shoot) {
      const sh = s.shoot
      const len = 90 * k
      ctx.strokeStyle = vGrad(ctx, sh.y - 30, sh.y + 30, [[0, `rgba(255,255,255,0)`], [1, `rgba(255,255,255,${0.8 * sh.life})`]])
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(sh.x - len, sh.y - len * 0.35)
      ctx.lineTo(sh.x, sh.y)
      ctx.stroke()
      sh.x += 420 * k * dt; sh.y += 150 * k * dt; sh.life -= dt * 1.4
      if (sh.life <= 0) s.shoot = null
    }

    // Maan
    const mg = ctx.createRadialGradient(moon.x - moon.r * 0.3, moon.y - moon.r * 0.3, moon.r * 0.1, moon.x, moon.y, moon.r)
    mg.addColorStop(0, '#fff6dc'); mg.addColorStop(1, '#e2bf82')
    ctx.fillStyle = mg
    ctx.beginPath(); ctx.arc(moon.x, moon.y, moon.r, 0, TAU); ctx.fill()

    fillRidge(ctx, s.mountains, w, horizon + 2, '#0d1c3f')
    // nevel boven de horizon
    ctx.fillStyle = vGrad(ctx, horizon - h * 0.08, horizon, [[0, 'rgba(60,90,150,0)'], [1, 'rgba(60,90,150,0.18)']])
    ctx.fillRect(0, horizon - h * 0.08, w, h * 0.08)

    // Meer
    ctx.fillStyle = vGrad(ctx, horizon, h, [[0, '#0c1b3b'], [1, '#02060f']])
    ctx.fillRect(0, horizon, w, h - horizon)

    // Maanreflectie: glinsterende streepjes
    ctx.lineWidth = 1.6
    let i = 0
    for (let y = horizon + 5; y < h; y += 5 * Math.max(1, k), i++) {
      const d = (y - horizon) / (h - horizon)
      const width = moon.r * (0.6 + d * 2.4) * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 0.9))
      const off = Math.sin(t * 0.9 + i * 0.6) * 4 * k
      ctx.strokeStyle = `rgba(255,214,150,${0.38 * (1 - d * 0.75)})`
      ctx.beginPath()
      ctx.moveTo(moon.x - width / 2 + off, y)
      ctx.lineTo(moon.x + width / 2 + off, y)
      ctx.stroke()
    }
    // trage rimpelingen
    ctx.lineWidth = 1
    for (let r = 0; r < 14; r++) {
      const y = horizon + ((r * 41 + t * 7) % (h - horizon))
      ctx.strokeStyle = `rgba(150,180,255,${0.035 * (1 - (y - horizon) / (h - horizon))})`
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    drawTrees(ctx, s.trees, horizon, '#030812')
    ctx.fillStyle = '#030812'
    ctx.fillRect(0, horizon, w, 3 * k)

    // Hutje met warme ramen
    const cx = s.cabinX, cw = 34 * k, ch = 20 * k
    ctx.fillStyle = '#040915'
    ctx.fillRect(cx - cw / 2, horizon - ch, cw, ch)
    ctx.beginPath(); ctx.moveTo(cx - cw * 0.62, horizon - ch); ctx.lineTo(cx, horizon - ch - 16 * k); ctx.lineTo(cx + cw * 0.62, horizon - ch); ctx.fill()
    const fl = 0.8 + 0.2 * Math.sin(t * 3.1) * Math.sin(t * 1.3)
    glow(ctx, cx, horizon - ch / 2, 60 * k, [255, 170, 80], 0.22 * fl, w, h)
    ctx.fillStyle = `rgba(255,190,100,${0.9 * fl})`
    ctx.fillRect(cx - cw * 0.3, horizon - ch * 0.7, 6 * k, 6 * k)
    ctx.fillRect(cx + cw * 0.12, horizon - ch * 0.7, 6 * k, 6 * k)
    // raamlicht in het water
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = `rgba(255,180,90,${0.18 * fl * (1 - j / 6)})`
      ctx.fillRect(cx - cw * 0.3 + Math.sin(t * 2 + j) * 2, horizon + 6 * k + j * 6 * k, 6 * k, 2)
      ctx.fillRect(cx + cw * 0.12 + Math.sin(t * 2.3 + j) * 2, horizon + 6 * k + j * 6 * k, 6 * k, 2)
    }
  },
}

// ── Regen: vallende druppels, spatten, mist en af en toe weerlicht ─────────
const regen = {
  init(w, h) {
    const n = clamp(Math.round((w * h) / 2600), 80, 420)
    return {
      drops: Array.from({ length: n }, () => ({
        x: rnd(-w * 0.2, w), y: rnd(-h, h), len: rnd(10, 22), sp: rnd(650, 1050), near: Math.random() < 0.35, end: rnd(h * 0.8, h),
      })),
      ripples: [],
      hills: ridge(w, h * 0.8, h * 0.14, 2.1),
      city: Array.from({ length: Math.ceil(w / 26) }, (_, i) => ({ x: i * 26 + rnd(-4, 4), bw: rnd(14, 24), bh: rnd(h * 0.05, h * 0.16), lit: Math.random() < 0.5 })),
      fog: Array.from({ length: 5 }, () => ({ x: rnd(0, w), y: rnd(h * 0.4, h * 0.85), r: rnd(w * 0.2, w * 0.45), sp: rnd(6, 16) })),
      flash: 0, nextFlash: rnd(6, 14),
    }
  },
  draw(ctx, s, t, dt, w, h) {
    ctx.fillStyle = vGrad(ctx, 0, h, [[0, '#0a111c'], [0.55, '#142031'], [1, '#0a0f17']])
    ctx.fillRect(0, 0, w, h)

    if (dt > 0) {
      s.nextFlash -= dt
      if (s.nextFlash <= 0) { s.flash = 1; s.nextFlash = rnd(12, 26) }
      s.flash *= Math.exp(-dt * 5)
    }
    if (s.flash > 0.01) {
      ctx.fillStyle = `rgba(190,205,255,${s.flash * 0.22})`
      ctx.fillRect(0, 0, w, h)
    }

    // Skyline met enkele verlichte ramen
    const base = h * 0.8
    ctx.fillStyle = '#0b121c'
    for (const b of s.city) ctx.fillRect(b.x, base - b.bh, b.bw, b.bh + 2)
    for (const b of s.city) {
      if (!b.lit) continue
      ctx.fillStyle = `rgba(255,200,120,${0.25 + 0.1 * Math.sin(t * 0.5 + b.x)})`
      ctx.fillRect(b.x + b.bw * 0.3, base - b.bh * 0.7, 3, 3)
    }

    // Mist
    for (const f of s.fog) {
      f.x += f.sp * dt
      if (f.x - f.r > w) f.x = -f.r
      glow(ctx, f.x, f.y, f.r, [120, 140, 175], 0.07, w, h)
    }
    fillRidge(ctx, s.hills, w, h, '#060a11')

    // Druppels: twee lagen (ver/dichtbij) in één pad per laag
    const wind = 0.18 + 0.06 * Math.sin(t * 0.3)
    for (const near of [false, true]) {
      ctx.beginPath()
      for (const d of s.drops) {
        if (d.near !== near) continue
        d.y += d.sp * dt; d.x += wind * d.sp * dt
        if (d.y > d.end) {
          if (dt > 0 && s.ripples.length < 70) s.ripples.push({ x: d.x, y: d.end, r: 1, life: 1 })
          d.y = rnd(-h * 0.3, 0); d.x = rnd(-w * 0.2, w); d.end = rnd(h * 0.8, h)
        }
        const len = near ? d.len * 1.4 : d.len
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - wind * len, d.y - len)
      }
      ctx.strokeStyle = near ? 'rgba(180,205,235,0.42)' : 'rgba(160,185,215,0.2)'
      ctx.lineWidth = near ? 1.2 : 0.8
      ctx.stroke()
    }

    // Spatringetjes
    ctx.lineWidth = 1
    for (let i = s.ripples.length - 1; i >= 0; i--) {
      const r = s.ripples[i]
      r.r += 22 * dt; r.life -= dt * 1.8
      if (r.life <= 0) { s.ripples.splice(i, 1); continue }
      ctx.strokeStyle = `rgba(180,200,235,${0.35 * r.life})`
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, TAU); ctx.stroke()
    }
  },
}

// ── Oceaan: schemering, zon op de horizon, golflagen met parallax ──────────
const oceaan = {
  init(w, h) {
    const horizon = h * 0.52
    return {
      horizon,
      sun: { x: w * 0.68, y: horizon - h * 0.015, r: clamp(Math.min(w, h) * 0.06, 20, 56) },
      stars: makeStars(w, horizon * 0.5, Math.round(starCount(w, h) * 0.4)),
      sparkles: Array.from({ length: 70 }, () => ({ d: Math.random(), o: rnd(-1, 1), ph: rnd(0, TAU), sp: rnd(1.5, 4) })),
    }
  },
  draw(ctx, s, t, dt, w, h) {
    const { horizon, sun } = s
    ctx.fillStyle = vGrad(ctx, 0, horizon, [[0, '#06112a'], [0.5, '#16305c'], [0.82, '#4a5a8a'], [1, '#c98a72']])
    ctx.fillRect(0, 0, w, horizon)
    drawStars(ctx, s.stars, t, 0.6)
    glow(ctx, sun.x, sun.y, sun.r * 9, [255, 165, 115], 0.3, w, h)
    ctx.fillStyle = '#ffd3a0'
    ctx.beginPath(); ctx.arc(sun.x, sun.y, sun.r, 0, TAU); ctx.fill()

    ctx.fillStyle = vGrad(ctx, horizon, h, [[0, '#24406e'], [1, '#050d1f']])
    ctx.fillRect(0, horizon, w, h - horizon)

    // Zonreflectie: glinsteringen in een kolom die breder wordt naar voren
    for (const p of s.sparkles) {
      const y = horizon + p.d * (h - horizon) * 0.9 + 2
      const spread = sun.r * (0.6 + p.d * 3.2)
      const a = Math.pow(Math.max(0, Math.sin(t * p.sp + p.ph)), 3) * (0.9 - p.d * 0.5)
      if (a < 0.02) continue
      ctx.fillStyle = `rgba(255,205,150,${a})`
      ctx.fillRect(sun.x + p.o * spread, y, 3 + p.d * 5, 1.5)
    }

    // Golflagen (achter → voor)
    const layers = 5
    for (let i = 0; i < layers; i++) {
      const f = i / (layers - 1)
      const baseY = horizon + (h - horizon) * (0.1 + f * 0.72)
      const amp = (3 + f * 12) * (h / 800)
      const freq = 0.013 - f * 0.007
      const sp = 0.5 + f * 0.6
      ctx.beginPath()
      ctx.moveTo(0, h)
      const crest = []
      for (let x = 0; x <= w + 8; x += 8) {
        const y = baseY + amp * Math.sin(x * freq + t * sp + i * 1.7) + amp * 0.4 * Math.sin(x * freq * 2.3 - t * sp * 1.3 + i * 2.9)
        ctx.lineTo(x, y); crest.push([x, y])
      }
      ctx.lineTo(w, h); ctx.closePath()
      const c0 = [28 - f * 22, 54 - f * 40, 96 - f * 66].map(Math.round)
      ctx.fillStyle = rgba(c0, 0.92)
      ctx.fill()
      ctx.beginPath()
      crest.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
      ctx.strokeStyle = `rgba(200,220,255,${0.05 + f * 0.05})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  },
}

// ── Haardvuur: warm bos, flakkerende gloed, opstijgende vonken ─────────────
const vuur = {
  init(w, h) {
    return {
      stars: makeStars(w, h * 0.35, Math.round(starCount(w, h) * 0.35)),
      back: treeline(w, h * 0.12, h * 0.26),
      front: treeline(w, h * 0.08, h * 0.2),
      embers: [], acc: 0,
    }
  },
  draw(ctx, s, t, dt, w, h) {
    const fx = w * 0.5, fy = h * 0.8
    ctx.fillStyle = vGrad(ctx, 0, h, [[0, '#07050b'], [0.5, '#140b0b'], [1, '#231109']])
    ctx.fillRect(0, 0, w, h)
    drawStars(ctx, s.stars, t, 0.5)

    const fl = 0.78 + 0.12 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.1 + 1)
    glow(ctx, fx, fy, h * 0.75 * fl, [255, 120, 40], 0.28 * fl, w, h)
    drawTrees(ctx, s.back, h * 0.66, '#150c0b')
    ctx.fillStyle = '#150c0b'; ctx.fillRect(0, h * 0.66, w, h)
    glow(ctx, fx, fy, h * 0.45 * fl, [255, 140, 50], 0.22 * fl, w, h)
    drawTrees(ctx, s.front, h * 0.76, '#090505')
    ctx.fillStyle = '#090505'; ctx.fillRect(0, h * 0.76, w, h)

    // Vuurkern
    glow(ctx, fx, fy, h * 0.12, [255, 190, 100], 0.55 * fl, w, h)

    // Vonken
    if (dt > 0) {
      s.acc += dt * 38
      while (s.acc > 1 && s.embers.length < 260) {
        s.acc -= 1
        s.embers.push({ x: fx + rnd(-w * 0.05, w * 0.05), y: fy + rnd(-6, 6), vx: rnd(-18, 18), vy: rnd(-110, -45) * (h / 800), life: 1, dec: rnd(0.22, 0.55), r: rnd(0.8, 2.4), wob: rnd(0, TAU) })
      }
    }
    ctx.globalCompositeOperation = 'lighter'
    for (let i = s.embers.length - 1; i >= 0; i--) {
      const e = s.embers[i]
      e.x += (e.vx + Math.sin(t * 2 + e.wob) * 22) * dt
      e.y += e.vy * dt
      e.life -= e.dec * dt
      if (e.life <= 0) { s.embers.splice(i, 1); continue }
      ctx.fillStyle = `hsla(${22 + e.life * 22},100%,${55 + e.life * 15}%,${e.life * 0.9})`
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  },
}

// ── Aurora: noorderlicht-linten boven bergen ───────────────────────────────
const aurora = {
  init(w, h) {
    const cols = [[60, 255, 180], [72, 200, 255], [155, 123, 255]]
    return {
      stars: makeStars(w, h * 0.7, starCount(w, h)),
      far: ridge(w, h * 0.74, h * 0.22, 0.7),
      near: ridge(w, h * 0.86, h * 0.16, 4.2),
      ribbons: cols.map((c, i) => ({ c, base: h * (0.16 + i * 0.09), amp: h * rnd(0.04, 0.07), f: rnd(0.0025, 0.005), sp: rnd(0.12, 0.25), ph: rnd(0, TAU), hh: h * rnd(0.14, 0.22) })),
    }
  },
  draw(ctx, s, t, dt, w, h) {
    ctx.fillStyle = vGrad(ctx, 0, h, [[0, '#020611'], [0.6, '#061628'], [1, '#0a2032']])
    ctx.fillRect(0, 0, w, h)
    drawStars(ctx, s.stars, t, 0.8)

    ctx.globalCompositeOperation = 'lighter'
    for (const r of s.ribbons) {
      for (let pass = 0; pass < 2; pass++) {
        const top = [], bot = []
        for (let x = -20; x <= w + 20; x += 12) {
          const y = r.base + r.amp * Math.sin(x * r.f + t * r.sp + r.ph + pass * 0.4) + r.amp * 0.5 * Math.sin(x * r.f * 2.7 - t * r.sp * 0.7)
          top.push([x, y])
          bot.push([x, y + r.hh * (0.55 + 0.45 * Math.sin(x * 0.008 + t * 0.35 + r.ph))])
        }
        ctx.beginPath()
        top.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
        for (let j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j][0], bot[j][1])
        ctx.closePath()
        ctx.fillStyle = vGrad(ctx, r.base - r.amp, r.base + r.amp + r.hh, [[0, rgba(r.c, 0)], [0.55, rgba(r.c, 0.1)], [0.85, rgba(r.c, 0.22)], [1, rgba(r.c, 0)]])
        ctx.fill()
      }
    }
    ctx.globalCompositeOperation = 'source-over'

    fillRidge(ctx, s.far, w, h, '#050d1a')
    fillRidge(ctx, s.near, w, h, '#02060d')
  },
}

// ── Rustig: trage kleurvlekken in de modus-kleur ───────────────────────────
const rustig = {
  init() {
    return { blobs: Array.from({ length: 5 }, (_, i) => ({ rx: rnd(0.2, 0.4), ry: rnd(0.15, 0.3), sp: rnd(0.04, 0.1), ph: rnd(0, TAU), r: rnd(0.3, 0.55), alt: i % 2 })) }
  },
  draw(ctx, s, t, dt, w, h, tint) {
    ctx.fillStyle = '#060912'
    ctx.fillRect(0, 0, w, h)
    const base = tint || [0, 255, 209]
    const alt = [70, 100, 230]
    ctx.globalCompositeOperation = 'lighter'
    for (const b of s.blobs) {
      const x = w * (0.5 + b.rx * Math.sin(t * b.sp + b.ph))
      const y = h * (0.42 + b.ry * Math.cos(t * b.sp * 0.8 + b.ph))
      glow(ctx, x, y, Math.max(w, h) * b.r, b.alt ? alt : base, b.alt ? 0.16 : 0.13, w, h)
    }
    ctx.globalCompositeOperation = 'source-over'
  },
}

export const SCENES = [
  { id: 'nacht',  label: 'Nacht',     ...nacht },
  { id: 'regen',  label: 'Regen',     ...regen },
  { id: 'oceaan', label: 'Oceaan',    ...oceaan },
  { id: 'vuur',   label: 'Haardvuur', ...vuur },
  { id: 'aurora', label: 'Aurora',    ...aurora },
  { id: 'rustig', label: 'Rustig',    ...rustig },
]
export const SCENE_BY_ID = Object.fromEntries(SCENES.map(s => [s.id, s]))

/** "Automatisch": focusgeluid → scène */
export const SCENE_FOR_SOUND = { off: 'nacht', focus: 'nacht', brown: 'vuur', rain: 'regen', ocean: 'oceaan' }

// Stilstaande preview (voor tegels/kiezer), gecachet per scène
const thumbCache = new Map()
export function sceneThumb(id, tint) {
  const key = id === 'rustig' ? `${id}:${tint}` : id
  if (thumbCache.has(key)) return thumbCache.get(key)
  const sc = SCENE_BY_ID[id]
  if (!sc || typeof document === 'undefined') return ''
  const w = 240, h = 150
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  const st = sc.init(w, h)
  const rgb = tint ? parseColor(tint) : null
  // Een paar seconden simuleren zodat vonken/spatten al zichtbaar zijn
  for (let i = 0; i <= 90; i++) sc.draw(ctx, st, 3 + i / 30, 1 / 30, w, h, rgb)
  const url = c.toDataURL('image/jpeg', 0.82)
  thumbCache.set(key, url)
  return url
}
