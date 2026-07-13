import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { loadShareFonts } from '../lib/share/fonts.js'
import {
  buildSessionMoment,
  buildPRMoments,
  buildProgressMoment,
  buildMuscleMoment,
  machinesTrainedOn,
} from '../lib/share/data.js'
import { CARD_RENDERERS } from '../lib/share/cards.js'
import { IconDownload } from './Icons.jsx'

/**
 * Share studio: pick a card (PR / session / progress), pick a format, share.
 *
 * The card is rendered EAGERLY whenever the selection changes and the PNG
 * blob is held ready, so the Share tap calls navigator.share() immediately —
 * iOS Safari requires the share call to stay inside the user-activation
 * window, and rendering on demand there would break it.
 */
export default function ShareModal({ open, onClose, date, initialMachineId = null }) {
  const { state } = useStore()
  const [format, setFormat] = useState('square')
  const [selectedKey, setSelectedKey] = useState(null)
  const [render, setRender] = useState(null) // { key, format, url, blob }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const urlRef = useRef(null)

  // Build the card menu for this date.
  const options = useMemo(() => {
    if (!open) return []
    const out = []
    const machineById = new Map(state.machines.map((m) => [m.id, m]))
    for (const pr of buildPRMoments(state, date)) {
      out.push({
        key: `pr:${pr.machineId}`,
        type: 'pr',
        label: `PR · ${pr.name}`,
        moment: pr,
      })
    }
    const session = buildSessionMoment(state, date)
    if (session) {
      out.push({ key: 'session', type: 'session', label: 'Session', moment: session })
    }
    const muscles = buildMuscleMoment(state, date)
    if (muscles) {
      out.push({ key: 'muscles', type: 'muscles', label: 'Muscle map', moment: muscles })
    }
    for (const machineId of machinesTrainedOn(state, date)) {
      const m = machineById.get(machineId)
      const moment = buildProgressMoment(state, machineId)
      if (m && moment) {
        out.push({
          key: `progress:${machineId}`,
          type: 'progress',
          label: `Trend · ${m.name}`,
          moment,
        })
      }
    }
    return out
  }, [open, state, date])

  // Default selection: requested machine's trend, else the headline PR, else session.
  useEffect(() => {
    if (!open || !options.length) return
    const preferred =
      (initialMachineId && options.find((o) => o.key === `progress:${initialMachineId}`)) ||
      options.find((o) => o.type === 'pr') ||
      options.find((o) => o.type === 'session')
    setSelectedKey((k) => (k && options.some((o) => o.key === k) ? k : preferred?.key || null))
  }, [open, options, initialMachineId])

  const selected = options.find((o) => o.key === selectedKey) || null

  // Eager render on any selection/format change.
  useEffect(() => {
    if (!open || !selected) return
    let cancelled = false
    setBusy(true)
    setMsg(null)
    ;(async () => {
      try {
        await loadShareFonts()
        const canvas = CARD_RENDERERS[selected.type](selected.moment, format)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (cancelled || !blob) return
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setRender({ key: selected.key, format, url, blob })
      } catch (err) {
        if (!cancelled) setMsg(`Couldn’t render the card: ${err.message}`)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selected, format])

  // Clean up the object URL when the modal closes for good.
  useEffect(() => {
    if (open) return
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setRender(null)
  }, [open])

  const ready = render && render.key === selectedKey && render.format === format

  function filename() {
    const slug = selectedKey?.replace(/[^a-z0-9]+/gi, '-') || 'card'
    return `weight-room-${date}-${slug}-${format}.png`
  }

  // Synchronous handler — navigator.share must run inside the tap's
  // user-activation window on iOS Safari (the blob is already prepared).
  function shareNow() {
    if (!ready) return
    const file = new File([render.blob], filename(), { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file] })
        .then(() => setMsg('Shared.'))
        .catch((err) => {
          if (err?.name !== 'AbortError') saveNow()
        })
    } else {
      saveNow()
    }
  }

  function saveNow() {
    if (!ready) return
    const a = document.createElement('a')
    a.href = render.url
    a.download = filename()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setMsg('Image saved.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share card"
      footer={
        <div className="space-y-2">
          {msg && <p className="text-sm text-center text-slate-400">{msg}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={saveNow} disabled={!ready}>
              <IconDownload size={20} /> Save
            </button>
            <button className="btn-primary flex-1" onClick={shareNow} disabled={!ready}>
              {busy ? 'Rendering…' : 'Share'}
            </button>
          </div>
        </div>
      }
    >
      {options.length === 0 ? (
        <p className="text-slate-400 text-center py-10 text-sm">
          Log a set first — then there’s something worth posting.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Card picker */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => setSelectedKey(o.key)}
                className={`chip px-3 py-2 whitespace-nowrap border shrink-0 ${
                  o.key === selectedKey
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-ink-700 text-slate-300 border-ink-600'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Format toggle */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ['square', 'Post · 1:1'],
              ['story', 'Story · 9:16'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`btn py-2 rounded-xl text-sm font-bold ${
                  format === key ? 'bg-ink-600 text-white ring-1 ring-brand-500' : 'bg-ink-700 text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Live preview */}
          <div
            className={`mx-auto w-full ${format === 'story' ? 'max-w-[240px]' : 'max-w-[340px]'}`}
          >
            {ready ? (
              <img
                src={render.url}
                alt="Share card preview"
                className="w-full rounded-xl border border-ink-600"
              />
            ) : (
              <div
                className={`w-full rounded-xl border border-ink-700 bg-ink-800 animate-pulse ${
                  format === 'story' ? 'aspect-[9/16]' : 'aspect-square'
                }`}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
