import { useEffect, useState } from 'react'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/seed.js'
import { useStore } from '../store/StoreContext.jsx'
import { useMachinePhoto } from '../hooks/useMachinePhoto.js'
import PhotoInput from './PhotoInput.jsx'
import Modal from './Modal.jsx'

/**
 * Add / edit a machine. When `machine` is provided it edits in place; otherwise
 * it creates a new one. A photo can be attached during creation or editing —
 * the workflow supports snapping the placard first, then typing name/model.
 */
export default function MachineForm({ open, onClose, machine }) {
  const { addMachine, updateMachine, setMachinePhoto, removeMachinePhoto } = useStore()
  const editing = Boolean(machine)
  const { photo: existingPhoto } = useMachinePhoto(machine?.id, machine?.hasPhoto)

  const [form, setForm] = useState(blank())
  const [photo, setPhoto] = useState(null)

  function blank() {
    return { name: '', model: '', muscleGroup: 'Chest', type: 'Machine', notes: '' }
  }

  // Reset form whenever the modal opens for a (possibly different) exercise.
  useEffect(() => {
    if (!open) return
    if (machine) {
      setForm({
        name: machine.name || '',
        model: machine.model || '',
        muscleGroup: machine.muscleGroup || 'Chest',
        type: machine.type || 'Machine',
        notes: machine.notes || '',
      })
    } else {
      setForm(blank())
      setPhoto(null)
    }
  }, [open, machine])

  // For editing, seed the photo control with the stored image.
  useEffect(() => {
    if (open && machine) setPhoto(existingPhoto || null)
  }, [open, machine, existingPhoto])

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (editing) {
      updateMachine(machine.id, {
        name: form.name.trim() || 'Untitled Exercise',
        model: form.model.trim(),
        muscleGroup: form.muscleGroup,
        type: form.type,
        notes: form.notes.trim(),
      })
      // Reconcile photo changes.
      if (photo && photo !== existingPhoto) {
        await setMachinePhoto(machine.id, photo)
      } else if (!photo && machine.hasPhoto) {
        await removeMachinePhoto(machine.id)
      }
    } else {
      addMachine(form, photo)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit exercise' : 'Add exercise'}
      footer={
        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={handleSave}>
            {editing ? 'Save' : 'Add exercise'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">Photo {form.type === 'Machine' ? '(placard)' : '(optional)'}</span>
          <p className="text-xs text-slate-500 mb-2 -mt-1">
            {form.type === 'Machine'
              ? 'Snap the model badge / instruction label, then fill in the details below.'
              : 'Optional — a photo of the setup or your grip, if useful.'}
          </p>
          <PhotoInput value={photo} onChange={setPhoto} />
        </div>

        <div>
          <label className="label" htmlFor="mf-name">
            Name
          </label>
          <input
            id="mf-name"
            className="input"
            placeholder="e.g. Chest Press, Barbell Bench, Pull-up"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>

        <div>
          <span className="label">Equipment</span>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update('type', t)}
                className={`chip px-3 py-2 border ${
                  form.type === t
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-ink-700 text-slate-300 border-ink-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="mf-model">
            Model number {form.type === 'Machine' ? '' : '(optional)'}
          </label>
          <input
            id="mf-model"
            className="input"
            placeholder="e.g. RS-2301"
            value={form.model}
            onChange={(e) => update('model', e.target.value)}
          />
        </div>

        <div>
          <span className="label">Muscle group</span>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update('muscleGroup', g)}
                className={`chip px-3 py-2 border ${
                  form.muscleGroup === g
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-ink-700 text-slate-300 border-ink-600'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="mf-notes">
            Notes (grip, seat setting…)
          </label>
          <textarea
            id="mf-notes"
            className="input min-h-[88px] resize-none"
            placeholder="Seat height 4, neutral grip…"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
