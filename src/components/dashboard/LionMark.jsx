import { useState } from 'react'

// Leeuw als watermerk op de ING-stijl Geld-kaarten (.ing-lion in index.css).
// Gebruikt de leeuw uit het ING-app-icoon (public/brand/ing-lion.png: alleen de leeuw, in ING-oranje, transparant);
// lukt dat niet, dan een eigen geometrische leeuwenkop in ING-oranje (via `currentColor`).
const LOGO_SRC = '/brand/ing-lion.png'
const MANE = 'M50 6 L56.8 17.7 L67.6 9.5 L69.4 22.9 L82.5 19.5 L79.1 32.6 L92.5 34.4 L84.3 45.2 L96 52 L84.3 58.8 L92.5 69.6 L79.1 71.4 L82.5 84.5 L69.4 81.1 L67.6 94.5 L56.8 86.3 L50 98 L43.2 86.3 L32.4 94.5 L30.6 81.1 L17.5 84.5 L20.9 71.4 L7.5 69.6 L15.7 58.8 L4 52 L15.7 45.2 L7.5 34.4 L20.9 32.6 L17.5 19.5 L30.6 22.9 L32.4 9.5 L43.2 17.7 Z M24 52 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0 Z'

let logoMissing = false // één keer proberen per sessie

export default function LionMark({ className = 'ing-lion', style, src = LOGO_SRC }) {
  const [useLogo, setUseLogo] = useState(!logoMissing)
  if (useLogo) {
    return <img className={className} style={style} src={src} alt="" aria-hidden="true" draggable="false"
      onError={() => { logoMissing = true; setUseLogo(false) }} />
  }
  return (
    <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d={MANE} fill="currentColor" fillRule="evenodd" />
      <path d="M31 34 L37 28 L39 37 Z M69 34 L63 28 L61 37 Z" fill="currentColor" />
      <ellipse cx="41" cy="48" rx="3.2" ry="2.2" fill="currentColor" />
      <ellipse cx="59" cy="48" rx="3.2" ry="2.2" fill="currentColor" />
      <path d="M44.5 57 L55.5 57 L50 63.5 Z" fill="currentColor" />
      <path d="M50 63.5 V67.5 M43 68.5 Q50 74 57 68.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
