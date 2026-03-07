// src/utils/openExternal.js
export function openExternalUrl(raw) {
  if (!raw) return
  const url = String(raw).trim()

  // Als iemand per ongeluk de hele site-pad erin zet: laat het gewoon openen als absolute URL.
  const hasProtocol = /^https?:\/\//i.test(url)
  const finalUrl = hasProtocol ? url : `https://${url}`

  window.open(finalUrl, '_blank', 'noopener,noreferrer')
}