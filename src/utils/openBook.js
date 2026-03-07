// src/utils/openBook.js
export function openBookLink(url) {
  if (!url) return
  // Zorg dat de URL altijd begint met http:// of https://
  const fullUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`
  window.open(fullUrl, '_blank', 'noopener,noreferrer')
}