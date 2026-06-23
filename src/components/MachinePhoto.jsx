import { useMachinePhoto } from '../hooks/useMachinePhoto.js'
import { IconImage } from './Icons.jsx'

/** Renders a machine's stored placard photo (from IndexedDB), or a placeholder. */
export default function MachinePhoto({ machine, className = '', rounded = 'rounded-2xl' }) {
  const { photo, loading } = useMachinePhoto(machine?.id, machine?.hasPhoto)

  if (loading) {
    return <div className={`bg-ink-700 animate-pulse ${rounded} ${className}`} />
  }
  if (!photo) {
    return (
      <div
        className={`bg-ink-700 ${rounded} ${className} flex items-center justify-center text-slate-600`}
      >
        <IconImage size={28} />
      </div>
    )
  }
  return (
    <img
      src={photo}
      alt={`${machine.name} placard`}
      className={`object-cover ${rounded} ${className}`}
    />
  )
}
