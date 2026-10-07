import { useEffect, useRef, useState } from 'react'

// Slepen met muis, pen of touch. Muis/pen: begint na een paar pixels bewegen. Touch: eerst even
// vasthouden (zodat gewoon scrollen blijft werken), daarna slepen zonder dat de pagina meescrollt.
//
//   const { drag, bind } = usePointerDrag({ onStart, onMove, onDrop })
//   <div {...bind(item)}>…</div>
//
// Tijdens slepen: drag = { item, x, y, x0, y0, el } (el = element onder de pointer, voor drop-zones).
// onDrop(item, drag) bij loslaten; Esc annuleert. De klik direct na het loslaten wordt genegeerd.

const MOVE_PX = 5
const HOLD_MS = 300
const TOUCH_SLOP = 8

export function usePointerDrag({ onStart, onMove, onDrop } = {}) {
  const [drag, setDrag] = useState(null)
  const st = useRef(null)
  const cbs = useRef({})
  cbs.current = { onStart, onMove, onDrop }

  // Tijdens een touch-sleep mag de pagina niet scrollen (moet een niet-passieve listener zijn)
  useEffect(() => {
    const block = e => { if (st.current?.active) e.preventDefault() }
    document.addEventListener('touchmove', block, { passive: false })
    return () => {
      document.removeEventListener('touchmove', block)
      st.current?.cleanup()
    }
  }, [])

  const bind = (item) => ({
    'data-draggable': '',
    onPointerDown: (e) => {
      if (e.button !== 0 || st.current) return
      if (e.target.closest?.('button, input, textarea, select, a, [data-no-drag]')) return
      const s = { item, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, touch: e.pointerType === 'touch', timer: 0 }
      st.current = s
      const snapshot = () => ({ item, x: s.x, y: s.y, x0: s.x0, y0: s.y0, el: document.elementFromPoint(s.x, s.y) })
      const begin = () => {
        s.active = true
        document.body.classList.add('is-dragging')
        if (s.touch) navigator.vibrate?.(8)
        const d = snapshot()
        cbs.current.onStart?.(item, d)
        setDrag(d)
      }
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        s.x = ev.clientX; s.y = ev.clientY
        if (!s.active) {
          const dist = Math.hypot(s.x - s.x0, s.y - s.y0)
          if (s.touch) { if (dist > TOUCH_SLOP) cleanup(); return } // bewogen vóór het vasthouden = scrollen
          if (dist < MOVE_PX) return
          begin()
        }
        const d = snapshot()
        cbs.current.onMove?.(item, d)
        setDrag(d)
      }
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        if (s.active) {
          s.x = ev.clientX; s.y = ev.clientY
          const d = snapshot()
          // De klik die op het loslaten volgt hoort niet bij een "openen"
          const eat = ce => { ce.stopPropagation(); ce.preventDefault() }
          window.addEventListener('click', eat, { capture: true, once: true })
          setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 0)
          cleanup()
          cbs.current.onDrop?.(item, d)
          return
        }
        cleanup()
      }
      const key = (ev) => { if (ev.key === 'Escape') cleanup() }
      function cleanup() {
        clearTimeout(s.timer)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cleanup)
        window.removeEventListener('keydown', key)
        if (st.current === s) st.current = null
        if (s.active) {
          s.active = false
          document.body.classList.remove('is-dragging')
          setDrag(null)
        }
      }
      s.cleanup = cleanup
      if (s.touch) s.timer = setTimeout(() => { if (st.current === s) begin() }, HOLD_MS)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cleanup)
      window.addEventListener('keydown', key)
    },
    // Lang indrukken op touch opent anders het contextmenu
    onContextMenu: (e) => { if (st.current?.touch) e.preventDefault() },
  })

  return { drag, bind }
}

/** Sleutel van de drop-zone (`data-drop="…"`) onder de pointer, of null. */
export const dropKeyAt = (drag) => drag?.el?.closest?.('[data-drop]')?.dataset.drop ?? null
