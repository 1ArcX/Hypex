import { useEffect, type FocusEvent, type RefObject } from 'react'

// iOS: scroll het gefocuste input-veld boven het toetsenbord
export const scrollFix = (e: FocusEvent<HTMLElement>) => {
  const t = e.target
  setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350)
}

// Blokkeer touchmove volledig (voor backdrops / niet-scrollbare overlays)
export function usePreventTouch(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current; if (!el) return
    const fn = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', fn, { passive: false })
    return () => el.removeEventListener('touchmove', fn)
  }, [ref])
}

// Scroll binnen el toestaan maar overscroll aan boven-/onderkant blokkeren
// zodat iOS de body niet kan laten stuiteren
export function useScrollContain(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current; if (!el) return
    let startY = 0
    const onStart = (e: TouchEvent) => { startY = e.touches[0].clientY }
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [ref])
}
