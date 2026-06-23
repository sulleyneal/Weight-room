import { useEffect } from 'react'
import { IconClose } from './Icons.jsx'

/** Bottom-sheet-style modal, mobile-first. */
export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-ink-800 border border-ink-700 rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-700 shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="btn-ghost p-2 w-10 h-10">
            <IconClose size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-ink-700 shrink-0 safe-bottom">{footer}</div>
        )}
      </div>
    </div>
  )
}
