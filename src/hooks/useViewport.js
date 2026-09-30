import { useState, useEffect } from 'react'

// Vensterafmetingen voor JS-gestuurde maten (Timeline-uurhoogte, lijstlengtes).
// Layout zelf loopt via CSS (media/container queries); dit alleen waar CSS niet kan.
function read() {
  if (typeof window === 'undefined') return { w: 1280, h: 800, tall: false, portrait: false }
  const w = window.innerWidth
  const h = window.innerHeight
  return { w, h, tall: h >= 1100, portrait: h > w }
}

export function useViewport() {
  const [v, setV] = useState(read)
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = read()
        setV(prev => (prev.w === next.w && prev.h === next.h ? prev : next))
      })
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [])
  return v
}
