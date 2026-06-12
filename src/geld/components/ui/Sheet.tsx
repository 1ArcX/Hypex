import { useRef, type ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { X } from 'lucide-react'
import { usePreventTouch, useScrollContain } from '../../hooks/useIosScroll'

// Slide-up sheet (iOS-stijl) — voor zoeken, analyse, inkomsten, uitgaven en formulieren
export function Sheet({ onClose, title, children, accentColor }: {
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  accentColor?: string
}) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  usePreventTouch(backdropRef)
  useScrollContain(panelRef)

  return ReactDOM.createPortal(
    <div className="fixed left-0 right-0 top-0 z-[9999] flex items-end justify-center"
      style={{ bottom: 'var(--keyboard-height, 0px)' }}>
      <div ref={backdropRef} className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div ref={panelRef}
        className="relative w-full max-w-[480px] max-h-[88%] overflow-y-auto rounded-t-[28px] border border-white/10 border-b-0 bg-[#141419]/90 backdrop-blur-2xl shadow-[0_-12px_48px_rgba(0,0,0,0.6)]"
        style={{ padding: '14px 20px calc(28px + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch', animation: 'geldSheetUp 0.32s cubic-bezier(0.34,1.1,0.64,1)' }}>
        <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />
        {title !== undefined && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold m-0" style={{ color: accentColor || 'rgba(255,255,255,0.9)' }}>{title}</h3>
            <button onClick={onClose} className="bg-white/[0.06] border border-white/10 rounded-full p-1.5 text-white/40 cursor-pointer">
              <X size={15} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Gecentreerde glass-modal — voor bevestigingen en compacte formulieren
export function CenterModal({ onClose, children, borderClass = 'border-white/10' }: {
  onClose?: () => void
  children: ReactNode
  borderClass?: string
}) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  usePreventTouch(backdropRef)
  useScrollContain(cardRef)

  return ReactDOM.createPortal(
    <div className="fixed left-0 right-0 top-0 z-[9999] flex items-center justify-center p-4"
      style={{ bottom: 'var(--keyboard-height, 0px)' }}>
      <div ref={backdropRef} className="fixed inset-0 -z-10 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div ref={cardRef}
        className={`relative w-full max-w-[400px] max-h-[calc(100%-32px)] overflow-y-auto rounded-[28px] border ${borderClass} bg-[#141419]/90 backdrop-blur-2xl p-6 shadow-[0_16px_64px_rgba(0,0,0,0.6)]`}
        style={{ WebkitOverflowScrolling: 'touch', animation: 'geldSheetUp 0.28s cubic-bezier(0.34,1.1,0.64,1)' }}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
