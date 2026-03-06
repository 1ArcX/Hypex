import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { BookOpen, Mail, Lock, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check je e-mail voor een bevestigingslink!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
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
          {isLogin ? 'Welkom terug' : 'Account aanmaken'}
        </h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {isLogin ? 'Log in om je dashboard te openen' : 'Maak een gratis account aan'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,255,209,0.6)' }} />
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="glass-input pl-9"
              required
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,255,209,0.6)' }} />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Wachtwoord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="glass-input pl-9 pr-10"
              required
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff6b6b' }}>
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.3)', color: '#00FFD1' }}>
              {message}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-neon w-full flex items-center justify-center gap-2 py-3">
            {loading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isLogin ? (
              <><LogIn size={16} /> Inloggen</>
            ) : (
              <><UserPlus size={16} /> Registreren</>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {isLogin ? 'Nog geen account?' : 'Al een account?'}{' '}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage('') }}
            className="font-medium" style={{ color: '#00FFD1', background: 'none', border: 'none', cursor: 'pointer' }}>
            {isLogin ? 'Registreer hier' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}