import React, { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const CURRENT = __BUILD_TIME__
const INTERVAL = 5 * 60 * 1000  // 5 minuten

function fmt(ts) {
  return new Date(ts).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latest, setLatest] = useState(null)

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/version.json?_=' + Date.now())
        if (!r.ok) return
        const { t } = await r.json()
        setLatest(t)
        if (t && t !== CURRENT) setUpdateAvailable(true)
      } catch (_) {}
    }
    check()
    const id = setInterval(check, INTERVAL)
    return () => clearInterval(id)
  }, [])

  if (!updateAvailable) return (
    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', padding: '4px 0', userSelect: 'none' }}>
      v {fmt(CURRENT)}
    </div>
  )

  return (
    <button
      onClick={() => window.location.reload()}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#FACC15', fontSize: 11, fontWeight: 600, width: '100%' }}>
      <RefreshCw size={11} /> Update beschikbaar
      <span style={{ fontSize: 9, color: 'rgba(250,204,21,0.6)', marginLeft: 'auto' }}>{fmt(latest)}</span>
    </button>
  )
}
