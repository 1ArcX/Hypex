import React, { useState } from 'react'
import { MapPin, GraduationCap, ChevronRight, Check } from 'lucide-react'

export default function OnboardingModal({ user, onClose }) {
  const needsLocation = !localStorage.getItem('weather_coords')
  const needsMagister = !localStorage.getItem('magister_credentials')

  const steps = ['welcome']
  if (needsLocation) steps.push('location')
  if (needsMagister) steps.push('magister')
  steps.push('done')

  const [stepIndex, setStepIndex]     = useState(0)
  const [cityQuery, setCityQuery]     = useState('')
  const [cityResults, setCityResults] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [school, setSchool]           = useState('')
  const [leerlingnummer, setLeerlingnummer] = useState('')
  const [wachtwoord, setWachtwoord]   = useState('')

  const step = steps[stepIndex]
  const progress = ((stepIndex + 1) / steps.length) * 100

  const finish = () => {
    localStorage.setItem(`onboarding_done_${user?.id}`, '1')
    onClose()
  }

  const next = () => {
    if (stepIndex < steps.length - 1) setStepIndex(s => s + 1)
    else finish()
  }

  const searchCity = async (q) => {
    if (!q || q.length < 2) { setCityResults([]); return }
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=nl&format=json`
      )
      const data = await res.json()
      setCityResults(data.results || [])
    } catch {}
  }

  const pickCity = (city) => {
    localStorage.setItem('weather_coords', JSON.stringify({ lat: city.latitude, lon: city.longitude, city: city.name }))
    setSelectedCity(city)
    setCityResults([])
  }

  const saveMagister = () => {
    if (!school || !leerlingnummer || !wachtwoord) return
    localStorage.setItem('magister_credentials', JSON.stringify({
      school: school.trim(),
      username: leerlingnummer.trim(),
      password: wachtwoord,
    }))
    next()
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
    padding: '10px 12px', color: 'white', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const primaryBtn = (disabled) => ({
    flex: 2, padding: '11px', background: disabled ? 'rgba(255,255,255,0.07)' : 'var(--accent)',
    border: 'none', borderRadius: 10, color: disabled ? 'rgba(255,255,255,0.25)' : '#000',
    fontWeight: 700, fontSize: 14, cursor: disabled ? 'default' : 'pointer', transition: 'all 0.2s',
  })

  const secondaryBtn = {
    flex: 1, padding: '11px', background: 'none',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 2000, padding: 16,
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 28, position: 'relative', boxSizing: 'border-box' }}>

        {/* Voortgangsbalk */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 28 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.35s ease' }} />
        </div>

        {/* Overslaan knop */}
        {step !== 'done' && (
          <button onClick={finish} style={{
            position: 'absolute', top: 18, right: 18, background: 'none',
            border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 11,
          }}>
            Overslaan
          </button>
        )}

        {/* ─── Welkom ─── */}
        {step === 'welcome' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
            <h2 style={{ color: 'white', fontSize: 21, fontWeight: 700, margin: '0 0 8px' }}>Welkom bij Hypex</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.65, margin: '0 0 24px' }}>
              Laten we je dashboard even snel instellen. Dit duurt minder dan een minuut.
            </p>
            <button onClick={next} style={{ ...primaryBtn(false), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Start instellen <ChevronRight size={17} />
            </button>
          </div>
        )}

        {/* ─── Locatie ─── */}
        {step === 'location' && (
          <div>
            <MapPin size={26} style={{ color: 'var(--accent)', marginBottom: 10 }} />
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Jouw locatie</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 16px' }}>
              Zoek je stad voor het weerbericht.
            </p>
            <input
              value={cityQuery}
              onChange={e => { setCityQuery(e.target.value); searchCity(e.target.value) }}
              placeholder="Zoek stad of dorp..."
              style={inputStyle}
              autoFocus
            />

            {/* Zoekresultaten */}
            {cityResults.length > 0 && (
              <div style={{ marginTop: 6, background: 'rgba(15,15,30,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                {cityResults.map((city, i) => (
                  <button
                    key={i}
                    onClick={() => { pickCity(city); setCityQuery(city.name) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 14px', background: 'none', border: 'none',
                      borderBottom: i < cityResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      color: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                    }}
                  >
                    {city.name}
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginLeft: 6 }}>
                      {city.admin1}{city.country_code ? `, ${city.country_code}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Geselecteerde stad */}
            {selectedCity && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: 8, fontSize: 12, color: '#1DB954', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={13} />
                {selectedCity.name}{selectedCity.admin1 ? `, ${selectedCity.admin1}` : ''}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={next} style={secondaryBtn}>Overslaan</button>
              <button onClick={next} disabled={!selectedCity} style={primaryBtn(!selectedCity)}>
                Bevestigen
              </button>
            </div>
          </div>
        )}

        {/* ─── Magister ─── */}
        {step === 'magister' && (
          <div>
            <GraduationCap size={26} style={{ color: 'var(--accent)', marginBottom: 10 }} />
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Magister koppelen</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 16px' }}>
              Optioneel — je kunt dit ook later instellen via de Magister widget.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={school}
                onChange={e => setSchool(e.target.value)}
                placeholder="Schoolnaam (bijv. ssgn)"
                style={inputStyle}
                autoFocus
                autoCapitalize="none"
              />
              <input
                value={leerlingnummer}
                onChange={e => setLeerlingnummer(e.target.value)}
                placeholder="Leerlingnummer"
                style={inputStyle}
                autoCapitalize="none"
              />
              <input
                value={wachtwoord}
                onChange={e => setWachtwoord(e.target.value)}
                type="password"
                placeholder="Wachtwoord"
                style={inputStyle}
              />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
              Credentials worden alleen lokaal opgeslagen op dit apparaat.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={next} style={secondaryBtn}>Overslaan</button>
              <button
                onClick={saveMagister}
                disabled={!school || !leerlingnummer || !wachtwoord}
                style={primaryBtn(!school || !leerlingnummer || !wachtwoord)}
              >
                Koppelen
              </button>
            </div>
          </div>
        )}

        {/* ─── Klaar ─── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <h2 style={{ color: 'white', fontSize: 21, fontWeight: 700, margin: '0 0 8px' }}>Alles ingesteld!</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 24px' }}>
              Je dashboard is klaar voor gebruik. Veel succes vandaag!
            </p>
            <button onClick={finish} style={{ ...primaryBtn(false), width: '100%' }}>
              Naar dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
