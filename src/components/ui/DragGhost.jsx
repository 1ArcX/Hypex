import { createPortal } from 'react-dom'

// Zwevend label dat met de pointer meebeweegt tijdens slepen (zie hooks/usePointerDrag.js).
export function DragGhost({ drag, title, color = 'var(--accent)', hint }) {
  if (!drag) return null
  return createPortal(
    <div className="drag-ghost" aria-hidden="true" style={{ left: drag.x, top: drag.y, '--ghost': color }}>
      <span className="drag-ghost__dot" />
      <span className="drag-ghost__title">{title}</span>
      {hint && <span className="drag-ghost__hint">{hint}</span>}
    </div>,
    document.body,
  )
}
