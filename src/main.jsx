import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#0a0a1a', color: '#EF4444', minHeight: '100vh' }}>
          <h2 style={{ color: '#EF4444', marginBottom: 12 }}>App fout</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#FCA5A5' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Opnieuw laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// iOS Safari scrollt de window als een input gefocust wordt, zelfs als body
// overflow:hidden heeft. Dit is een PWA zonder window-scroll — dus alles wat
// de window probeert te scrollen resetten we direct.
window.addEventListener('scroll', () => {
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0)
  }
}, { passive: true })

// Extra zekerheid: na toetsenbord sluiten terugspringen
document.addEventListener('focusout', () => {
  setTimeout(() => window.scrollTo(0, 0), 50)
})

// Houd --app-height up-to-date met de visuele viewport.
// Als een input/textarea gefocust is (toetsenbord open), NIET updaten:
// het toetsenbord overlapt de app zodat de layout niet samenperst.
// Bij geen focus (toetsenbord dicht) wél updaten zodat de app correct past.
function updateAppHeight() {
  const active = document.activeElement
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}
updateAppHeight()
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateAppHeight)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
