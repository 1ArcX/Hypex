import React, { useEffect, useRef } from 'react'
import { SCENE_BY_ID, parseColor } from './scenes'

const FRAME_MS = 1000 / 30 // ~30 fps is genoeg voor een rustige achtergrond

/**
 * Geanimeerde achtergrond (canvas) voor de Pomodoro-hero.
 * - pauzeert als het tabblad verborgen is of de hero uit beeld is
 * - prefers-reduced-motion → één stilstaand frame
 * - cross-fade bij het wisselen van scène
 * De tint (modus-kleur) wordt uit `--pomo-mode` van de ouder gelezen.
 */
export default function SceneCanvas({ scene, height }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const fadeRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, fade = fadeRef.current
    const def = SCENE_BY_ID[scene] || SCENE_BY_ID.nacht
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // Cross-fade: huidige inhoud naar de fade-laag kopiëren en die laten vervagen
    if (canvas.width > 0 && canvas.height > 0) {
      fade.width = canvas.width; fade.height = canvas.height
      fade.getContext('2d').drawImage(canvas, 0, 0)
      fade.style.transition = 'none'
      fade.style.opacity = '1'
      void fade.offsetWidth
      fade.style.transition = 'opacity 0.8s ease'
      fade.style.opacity = '0'
    }

    let w = 0, h = 0, st = null
    let tint = null, lastTint = 0
    const readTint = () => { tint = parseColor(getComputedStyle(wrap).getPropertyValue('--pomo-mode')) }
    readTint()

    const t0 = performance.now()
    let last = 0, raf = 0, visible = true

    const draw = (t, dt) => { if (st) def.draw(ctx, st, t, dt, w, h, tint) }

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      if (!r.width || !r.height) return
      w = r.width; h = r.height
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      st = def.init(w, h)
      if (reduced) {
        // Stilstaand frame, maar met al opgebouwde vonken/spatten
        for (let i = 0; i <= 90; i++) draw(3 + i / 30, 1 / 30)
      } else {
        draw((performance.now() - t0) / 1000, 0)
      }
    }

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden) { last = now; return }
      if (now - last < FRAME_MS) return
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      if (now - lastTint > 500) { readTint(); lastTint = now }
      draw((now - t0) / 1000, dt)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
    io.observe(wrap)
    resize()
    if (!reduced) raf = requestAnimationFrame(loop)

    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [scene])

  return (
    <div ref={wrapRef} className="pomo-scene" aria-hidden="true" style={height ? { height, bottom: 'auto' } : undefined}>
      <canvas ref={canvasRef} className="pomo-scene-canvas" />
      <canvas ref={fadeRef} className="pomo-scene-canvas" style={{ opacity: 0 }} />
    </div>
  )
}
