import { useRef, useState } from 'react'
import { IconCamera, IconImage, IconTrash } from './Icons.jsx'

/**
 * Photo capture / upload control.
 * Downscales the chosen image to keep stored data-URLs small, then hands the
 * resulting data-URL back via onChange. `capture="environment"` asks mobile
 * browsers to open the rear camera so you can snap the machine's placard.
 */
export default function PhotoInput({ value, onChange, height = 'h-56' }) {
  const cameraRef = useRef(null)
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting same file
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await downscaleImage(file, 1280, 0.82)
      onChange(dataUrl)
    } catch (err) {
      console.error('Could not process image', err)
      alert('Sorry, that image could not be processed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Machine placard"
            className={`w-full ${height} object-cover rounded-2xl border border-ink-600`}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-danger absolute top-2 right-2 p-2 w-10 h-10"
            aria-label="Remove photo"
          >
            <IconTrash size={18} />
          </button>
        </div>
      ) : (
        <div
          className={`w-full ${height} rounded-2xl border-2 border-dashed border-ink-600 flex flex-col items-center justify-center text-slate-500 gap-2`}
        >
          <IconImage size={36} />
          <p className="text-sm">{busy ? 'Processing…' : 'No photo yet'}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
        >
          <IconCamera size={20} /> Snap
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <IconImage size={20} /> Upload
        </button>
      </div>
    </div>
  )
}

/** Read a File, draw it to a canvas scaled to maxDim, return a JPEG data-URL. */
function downscaleImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
