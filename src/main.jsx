import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Fix voor iOS Safari: na het sluiten van het toetsenbord scrollt de browser
// niet automatisch terug. Dit zorgt dat de pagina altijd terugspringt naar 0.
document.addEventListener('focusout', () => {
  setTimeout(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, 80)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
