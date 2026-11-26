import React, { useState } from 'react'
import { Tv, Music, Check, X, Loader2 } from 'lucide-react'
import { tvPairLogin, handleTvPairCallback } from './spotify/spotifyApi'
import { clearTvPair } from '../utils/tvPairCallback'

/**
 * Modal voor het koppelen van de projector aan Spotify.
 * Stap 1: code weergeven + "Koppel Spotify" knop.
 * Stap 2 (na OAuth callback): bevestiging.
 */
export default function TvPairModal({ code, callbackResult, onClose }) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      await tvPairLogin(code)
      // Redirect naar Spotify — de pagina laadt opnieuw na de callback
    } catch {
      setLoading(false)
    }
  }

  const handleDone = () => {
    clearTvPair()
    onClose()
  }

  // Na de callback: toon resultaat
  if (callbackResult) {
    return (
      <div className="tv-pair-backdrop" onClick={handleDone}>
        <div className="tv-pair-modal" onClick={e => e.stopPropagation()}>
          {callbackResult.ok ? (
            <>
              <div className="tv-pair-icon tv-pair-icon--ok"><Check size={32} /></div>
              <h2>Spotify gekoppeld!</h2>
              <p>Je projector ontvangt nu de Spotify-tokens. Je kunt dit scherm sluiten.</p>
            </>
          ) : (
            <>
              <div className="tv-pair-icon tv-pair-icon--err"><X size={32} /></div>
              <h2>Koppeling mislukt</h2>
              <p>{callbackResult.error || 'Er ging iets mis. Probeer het opnieuw.'}</p>
            </>
          )}
          <button className="btn-primary" onClick={handleDone} style={{ marginTop: 16, width: '100%' }}>Sluiten</button>
        </div>
      </div>
    )
  }

  // Stap 1: toon code + koppelknop
  return (
    <div className="tv-pair-backdrop" onClick={handleDone}>
      <div className="tv-pair-modal" onClick={e => e.stopPropagation()}>
        <button className="tv-pair-close" onClick={handleDone} aria-label="Sluiten"><X size={18} /></button>
        <div className="tv-pair-icon"><Tv size={32} /></div>
        <h2>Projector koppelen</h2>
        <p>Koppel Spotify aan je projector met code:</p>
        <div className="tv-pair-code">{code}</div>
        <p className="tv-pair-hint">Dit maakt een aparte Spotify-verbinding voor je projector. Je eigen Dash-sessie blijft ongewijzigd.</p>
        <button className="btn-primary" onClick={handleConnect} disabled={loading} style={{ width: '100%', gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <Loader2 size={18} className="tv-pair-spin" /> : <Music size={18} />}
          {loading ? 'Even geduld…' : 'Koppel Spotify aan Projector'}
        </button>
      </div>
    </div>
  )
}
