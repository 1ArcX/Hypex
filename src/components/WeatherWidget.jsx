import React, { useState, useEffect } from 'react'
import { Cloud, Sun, CloudRain, Wind, Droplets, MapPin, RefreshCw } from 'lucide-react'

const WMO_CODES = {
  0: { label: 'Helder', icon: Sun },
  1: { label: 'Overwegend helder', icon: Sun },
  2: { label: 'Gedeeltelijk bewolkt', icon: Cloud },
  3: { label: 'Bewolkt', icon: Cloud },
  45: { label: 'Mist', icon: Cloud },
  48: { label: 'Rijpmist', icon: Cloud },
  51: { label: 'Lichte motregen', icon: CloudRain },
  61: { label: 'Lichte regen', icon: CloudRain },
  63: { label: 'Matige regen', icon: CloudRain },
  65: { label: 'Zware regen', icon: CloudRain },
  80: { label: 'Lichte buien', icon: CloudRain },
  81: { label: 'Matige buien', icon: CloudRain },
  95: { label: 'Onweer', icon: CloudRain },
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null)
  const [city, setCity] = useState('Dronten') // ← standaard Dronten
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchWeather = async () => {
    setLoading(true); setError('')
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=nl&format=json`)
      const geoData = await geoRes.json()
      if (!geoData.results?.length) { setError('Stad niet gevonden'); setLoading(false); return }
      const { latitude, longitude, name } = geoData.results[0]
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&timezone=auto`)
      const wData = await wRes.json()
      setWeather({ ...wData.current, city: name })
    } catch { setError('Kon weer niet laden') }
    setLoading(false)
  }

  useEffect(() => { fetchWeather() }, [])

  const code = weather?.weathercode
  const WeatherIcon = WMO_CODES[code]?.icon || Cloud
  const label = WMO_CODES[code]?.label || 'Onbekend'

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cloud size={16} style={{ color: '#00FFD1' }} />
          <h3 className="text-sm font-semibold text-white">Weer</h3>
        </div>
        <button onClick={fetchWeather}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={city}
          onChange={e => setCity(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchWeather()}
          className="glass-input flex-1"
          style={{ fontSize: '12px', padding: '6px 10px' }}
          placeholder="Stad..."
        />
        <button onClick={fetchWeather} className="btn-neon" style={{ padding: '6px 12px', fontSize: '12px' }}>
          Zoek
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: '#ff6b6b' }}>{error}</p>}

      {weather && !error && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <WeatherIcon size={32} style={{ color: '#00FFD1' }} />
            <div>
              <div className="text-3xl font-bold text-white">{Math.round(weather.temperature_2m)}°C</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <MapPin size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{weather.city}</span>
          </div>
          <div className="flex gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Wind size={12} style={{ color: 'rgba(0,255,209,0.6)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{Math.round(weather.windspeed_10m)} km/u</span>
            </div>
            <div className="flex items-center gap-1">
              <Droplets size={12} style={{ color: 'rgba(0,255,209,0.6)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{weather.relativehumidity_2m}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}