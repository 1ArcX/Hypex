import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Fix: voorkom dat de pagina omhoog springt als toetsenbord opent op mobiel.
// visualViewport.resize updatet de root-hoogte zodat de layout nooit verder
// dan de zichtbare viewport scrollt.
if (window.visualViewport) {
  const root = document.getElementById('root')
  const update = () => {
    root.style.height = window.visualViewport.height + 'px'
  }
  window.visualViewport.addEventListener('resize', update)
  update()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)