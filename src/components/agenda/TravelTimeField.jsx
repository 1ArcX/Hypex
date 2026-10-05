import { Car } from 'lucide-react'

// Reistijd heen (vóór het item) en terug (erna), in minuten. Gebruikt door ItemModal en ExternalEventModal.
const PRESETS = [0, 15, 30, 45, 60]
const fmt = m => m === 0 ? 'Geen' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}u${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

function Row({ label, value, onChange }) {
  const chip = (active) => ({
    padding: '4px 9px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--c-text-3)',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-3)', width: 40 }}>{label}</span>
      {PRESETS.map(m => (
        <button key={m} type="button" onClick={() => onChange(m)} style={chip((value || 0) === m)}>{fmt(m)}</button>
      ))}
      <input type="number" min={0} max={600} step={5} inputMode="numeric" aria-label={`Reistijd ${label.toLowerCase()} in minuten`}
        className="glass-input" value={value && !PRESETS.includes(value) ? value : ''} placeholder="min"
        onChange={e => onChange(Math.max(0, Math.min(600, parseInt(e.target.value, 10) || 0)))}
        style={{ width: 64, padding: '4px 8px', fontSize: 11 }} />
    </div>
  )
}

export default function TravelTimeField({ before, after, onChange }) {
  return (
    <div>
      <span style={{ color: 'var(--c-text-3)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Car size={11} aria-hidden="true" /> Reistijd
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Heen" value={before} onChange={v => onChange({ before: v, after })} />
        <Row label="Terug" value={after} onChange={v => onChange({ before, after: v })} />
      </div>
    </div>
  )
}
