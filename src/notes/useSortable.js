import { useEffect, useRef, useState } from 'react'

// Verticale lijst op volgorde slepen. Andere items schuiven geanimeerd opzij; bij loslaten
// onReorder(nieuweIds). Muis: rij zelf slepen (na 5px bewegen, gewone klik blijft werken).
// Touch: via een greep (handle) die direct sleept.
//
//   const s = useSortable({ ids, onReorder })
//   <div ref={s.itemRef(id)} {...s.itemProps(id)}>…<span {...s.handleProps(id)}>≡</span></div>

export function useSortable({ ids, onReorder, disabled = false }) {
  const els = useRef(new Map())
  const st = useRef(null)
  const [dragging, setDragging] = useState(null)
  const suppressClick = useRef(false)

  // Klik direct na slepen negeren (anders opent de map die je net verplaatste)
  useEffect(() => {
    const stop = (e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false } }
    window.addEventListener('click', stop, true)
    return () => window.removeEventListener('click', stop, true)
  }, [])

  const reset = () => {
    for (const el of els.current.values()) { el.style.transform = ''; el.style.transition = ''; el.style.zIndex = ''; el.style.position = ''; el.classList.remove('is-sorting') }
  }

  const begin = (s) => {
    s.active = true
    s.rects = ids.map(id => els.current.get(id)?.getBoundingClientRect())
    const r = s.rects
    s.gap = r.length > 1 && r[0] && r[1] ? Math.max(0, r[1].top - r[0].bottom) : 0
    const el = els.current.get(ids[s.from])
    if (el) { el.style.position = 'relative'; el.style.zIndex = '5'; el.classList.add('is-sorting') }
    for (const [id, e] of els.current) if (id !== ids[s.from]) e.style.transition = 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)'
    setDragging(ids[s.from])
    navigator.vibrate?.(8)
  }

  const move = (e) => {
    const s = st.current
    if (!s || e.pointerId !== s.pointerId) return
    const dy = e.clientY - s.y0
    if (!s.active) {
      if (Math.abs(dy) < 5 && Math.abs(e.clientX - s.x0) < 5) return
      if (Math.abs(e.clientX - s.x0) > Math.abs(dy) * 1.5 && !s.handle) { st.current = null; return }
      begin(s)
    }
    e.preventDefault()
    const r = s.rects, from = s.from
    if (!r[from]) return
    const dragged = els.current.get(ids[from])
    if (dragged) dragged.style.transform = `translateY(${dy}px)`
    const mid = r[from].top + r[from].height / 2 + dy
    let to = from
    for (let i = 0; i < r.length; i++) {
      if (!r[i] || i === from) continue
      const m = r[i].top + r[i].height / 2
      if (i < from && mid < m) to = Math.min(to, i)
      if (i > from && mid > m) to = Math.max(to, i)
    }
    s.to = to
    const shift = r[from].height + s.gap
    ids.forEach((id, i) => {
      if (i === from) return
      const el = els.current.get(id)
      if (!el) return
      let t = 0
      if (to < from && i >= to && i < from) t = shift
      if (to > from && i <= to && i > from) t = -shift
      el.style.transform = t ? `translateY(${t}px)` : ''
    })
  }

  const end = (e) => {
    const s = st.current
    if (!s || (e && e.pointerId !== s.pointerId)) return
    st.current = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    if (!s.active) return
    suppressClick.current = true
    setTimeout(() => { suppressClick.current = false }, 0)
    reset()
    setDragging(null)
    if (s.to !== s.from) {
      const next = [...ids]
      const [m] = next.splice(s.from, 1)
      next.splice(s.to, 0, m)
      onReorder(next)
    }
  }

  const start = (id, e, handle) => {
    if (disabled || e.button !== 0 || st.current) return
    if (!handle && e.pointerType === 'touch') return // touch alleen via de greep
    if (!handle && e.target.closest?.('input, textarea, [data-no-drag]')) return
    const from = ids.indexOf(id)
    if (from < 0) return
    st.current = { from, to: from, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId, active: false, handle }
    if (handle) { e.preventDefault(); begin(st.current) }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  useEffect(() => () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    dragging,
    itemRef: (id) => (el) => { if (el) els.current.set(id, el); else els.current.delete(id) },
    itemProps: (id) => ({ onPointerDown: (e) => start(id, e, false) }),
    handleProps: (id) => ({ onPointerDown: (e) => { e.stopPropagation(); start(id, e, true) }, style: { touchAction: 'none', cursor: 'grab' }, 'data-no-drag': '' }),
  }
}
