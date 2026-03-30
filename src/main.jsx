import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
