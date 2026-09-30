import { useState, useEffect, useCallback } from 'react'

// Per-apparaat navigatie-voorkeur (desktop): zijbalk links of balk bovenaan, en automatisch verbergen.
const KEY = 'nav_layout'
const EVENT = 'nav-layout-change'
const DEFAULT = { position: 'left', autoHide: false }

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return {
      position: v?.position === 'top' ? 'top' : 'left',
      autoHide: !!v?.autoHide,
    }
  } catch { return DEFAULT }
}

export function useNavLayout() {
  const [layout, setLayout] = useState(read)
  useEffect(() => {
    const sync = () => setLayout(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const update = useCallback((patch) => {
    const next = { ...read(), ...patch }
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return [layout, update]
}
