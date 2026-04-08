import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'

export default function XPToast({ xp, icon = '⚡', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', bottom: 110, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999, pointerEvents: 'none',
      animation: 'xpToastAnim 1.8s cubic-bezier(0.34,1.56,0.64,1) forwards',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 99,
        background: 'rgba(10,10,26,0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(0,255,209,0.35)',
        boxShadow: '0 4px 24px rgba(0,255,209,0.15)',
        color: 'var(--accent)',
        fontWeight: 700,
        fontSize: 14,
        whiteSpace: 'nowrap',
      }}>
        <span>{icon}</span>
        <span>+{xp} XP</span>
      </div>
      <style>{`
        @keyframes xpToastAnim {
          0%   { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.85); }
          20%  { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);    }
          70%  { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);    }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
        }
      `}</style>
    </div>,
    document.body
  )
}
