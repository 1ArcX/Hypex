import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { BookOpen, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function PasswordResetPage({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Wachtwoord moet minimaal 6 tekens zijn'); return }
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => onDone(), 2000)
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

        {success ? (
          <div className="text-center py-6">
            <CheckCircle size={48} color="#00FFD1" style={{ margin: '0 auto 16px' }} />
            <h2 className="text-xl font-bold text-white mb-2">Wachtwoord gewijzigd!</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Je wordt zo doorgestuurd...</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-1">Nieuw wachtwoord</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Kies een nieuw wachtwoord voor je account
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5"
                  style={{ color: 'rgba(0,255,209,0.8)' }}>
                  <Lock size={13} /> Nieuw wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimaal 6 tekens"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="glass-input pr-10" required autoFocus />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5"
                  style={{ color: 'rgba(0,255,209,0.8)' }}>
                  <Lock size={13} /> Bevestig wachtwoord
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Herhaal wachtwoord"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="glass-input" required />
              </div>

              {error && (
                <p className="text-sm px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff6b6b' }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-neon w-full flex items-center justify-center gap-2 py-3">
                {loading
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : 'Wachtwoord opslaan'
                }
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
