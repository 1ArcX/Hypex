import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { BookOpen, Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff, KeyRound } from 'lucide-react'

export default function AuthPage() {
  // 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const reset = (m) => { setMode(m); setError(''); setMessage('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)

    } else if (mode === 'register') {
      if (!name.trim()) { setError('Vul je naam in'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name.trim() } }
      })
      if (error) setError(error.message)
      else setMessage('Check je e-mail voor een bevestigingslink!')

    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
      if (error) setError(error.message)
      else setMessage('Er is een resetlink naar je e-mail gestuurd!')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 relative z-10" style={{ minHeight: '100%' }}>
      <div className="glass-card p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,255,209,0.15)', border: '1px solid rgba(0,255,209,0.3)' }}>
            <BookOpen size={20} color="#00FFD1" />
          </div>
          <h1 className="text-xl font-semibold text-white">Student Dashboard</h1>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">
          {mode === 'login' ? 'Welkom terug' : mode === 'register' ? 'Account aanmaken' : 'Wachtwoord vergeten'}
        </h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {mode === 'login' ? 'Log in om je dashboard te openen'
            : mode === 'register' ? 'Maak een gratis account aan'
            : 'We sturen je een resetlink per e-mail'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Naam — alleen bij registratie */}
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5"
                style={{ color: 'rgba(0,255,209,0.8)' }}>
                <User size={13} /> Volledige naam
              </label>
              <input type="text" placeholder="Jan de Vries"
                value={name} onChange={e => setName(e.target.value)}
                className="glass-input" required />
            </div>
          )}

          {/* E-mail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: 'rgba(0,255,209,0.8)' }}>
              <Mail size={13} /> E-mailadres
            </label>
            <input type="email" placeholder="jouw@email.nl"
              value={email} onChange={e => setEmail(e.target.value)}
              className="glass-input" required />
          </div>

          {/* Wachtwoord — niet bij forgot */}
          {mode !== 'forgot' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5"
                style={{ color: 'rgba(0,255,209,0.8)' }}>
                <Lock size={13} /> Wachtwoord
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimaal 6 tekens"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="glass-input pr-10" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Wachtwoord vergeten link */}
              {mode === 'login' && (
                <button type="button" onClick={() => reset('forgot')}
                  style={{ alignSelf: 'flex-end', fontSize: '12px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '2px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00FFD1'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>
                  Wachtwoord vergeten?
                </button>
              )}
            </div>
          )}

          {/* Fout / succes */}
          {error && (
            <p className="text-sm px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff6b6b' }}>
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm px-3 py-2 rounded-xl"
              style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.3)', color: '#00FFD1' }}>
              {message}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-neon w-full flex items-center justify-center gap-2 py-3">
            {loading
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : mode === 'login' ? <><LogIn size={16} /> Inloggen</>
              : mode === 'register' ? <><UserPlus size={16} /> Registreren</>
              : <><KeyRound size={16} /> Resetlink versturen</>
            }
          </button>
        </form>

        {/* Onderaan navigatie */}
        <div className="text-center mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {mode === 'forgot' ? (
            <button onClick={() => reset('login')}
              style={{ color: '#00FFD1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
              ← Terug naar inloggen
            </button>
          ) : (
            <>
              {mode === 'login' ? 'Nog geen account?' : 'Al een account?'}{' '}
              <button onClick={() => reset(mode === 'login' ? 'register' : 'login')}
                style={{ color: '#00FFD1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                {mode === 'login' ? 'Registreer hier' : 'Log in'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
