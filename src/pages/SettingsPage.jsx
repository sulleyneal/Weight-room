import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { unitLabel } from '../lib/units.js'
import { downloadJSON } from '../lib/download.js'
import PageHeader from '../components/PageHeader.jsx'
import { IconImage, IconTrash, IconDownload } from '../components/Icons.jsx'

export default function SettingsPage() {
  const {
    state,
    setUnit,
    setBodyweight,
    exportData,
    importData,
    importWorkout,
    resetAll,
    loadSampleHistory,
    addCommonExercises,
  } = useStore()
  const fileRef = useRef(null)
  const dayFileRef = useRef(null)
  const [status, setStatus] = useState(null)

  const machineCount = state.machines.length
  const workoutCount = state.workouts.length
  const setCount = state.sets.length

  async function handleExport() {
    try {
      const payload = await exportData()
      downloadJSON(`weight-room-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
      setStatus({ ok: true, msg: 'Backup downloaded.' })
    } catch (err) {
      setStatus({ ok: false, msg: `Export failed: ${err.message}` })
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (
      !confirm(
        'Importing will REPLACE all current data (machines, workouts, photos) with the backup. Continue?',
      )
    )
      return
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      await importData(payload)
      setStatus({ ok: true, msg: 'Backup imported.' })
    } catch (err) {
      setStatus({ ok: false, msg: `Import failed: ${err.message}` })
    }
  }

  async function handleImportDayFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      if (payload?.type !== 'workout' || !payload?.workout?.date) {
        throw new Error('Not a single-day file. Use “Import backup” for a full backup.')
      }
      const date = payload.workout.date
      const existing = state.workouts.find((w) => w.date === date)
      const dayHasData = existing && state.sets.some((s) => s.workoutId === existing.id)
      const warn = dayHasData
        ? `\n\nHeads up: you already have sets logged on ${date}. Imported sets will be ADDED to that day (not replaced).`
        : ''
      const unitWarn =
        payload.unit && payload.unit !== state.settings.unit
          ? `\n\nNote: this file was logged in ${payload.unit}; weights import as-is (no conversion).`
          : ''
      if (
        !confirm(
          `Merge the workout from ${date} into your log? Machines are matched by name/model and created if new.${warn}${unitWarn}`,
        )
      )
        return
      const r = importWorkout(payload)
      const parts = [`${r.setsAdded} sets added for ${r.date}`]
      if (r.machinesAdded) parts.push(`${r.machinesAdded} new machine${r.machinesAdded > 1 ? 's' : ''}`)
      setStatus({ ok: true, msg: `Imported: ${parts.join(', ')}.` })
    } catch (err) {
      setStatus({ ok: false, msg: `Import failed: ${err.message}` })
    }
  }

  function handleReset() {
    if (
      confirm(
        'Reset everything? This deletes all workouts and photos and restores the default machine library. This cannot be undone.',
      )
    ) {
      resetAll()
      setStatus({ ok: true, msg: 'Reset to a fresh library.' })
    }
  }

  function handleSample() {
    if (confirm('Add a few weeks of sample workout history so you can explore the charts?')) {
      loadSampleHistory()
      setStatus({ ok: true, msg: 'Sample history added.' })
    }
  }

  function handleAddCommon() {
    const n = addCommonExercises()
    setStatus({
      ok: true,
      msg: n
        ? `Added ${n} common exercise${n > 1 ? 's' : ''}.`
        : 'All common exercises are already in your library.',
    })
  }

  return (
    <div>
      <PageHeader title="Settings" />

      {status && (
        <div
          className={`card p-3 mb-4 text-sm ${
            status.ok ? 'text-green-400 border-green-500/40' : 'text-red-400 border-red-500/40'
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Units */}
      <section className="mb-6">
        <h2 className="font-bold mb-2 px-1">Units</h2>
        <div className="card p-2 grid grid-cols-2 gap-2">
          {['lbs', 'kg'].map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`btn py-3 rounded-xl font-bold ${
                state.settings.unit === u
                  ? 'bg-brand-500 text-white'
                  : 'bg-ink-700 text-slate-300'
              }`}
            >
              {unitLabel(u)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2 px-1">
          Weights you log are stored as entered and displayed in {unitLabel(state.settings.unit)}.
        </p>

        <div className="card p-4 mt-3">
          <label className="label" htmlFor="set-bw">
            Body weight ({unitLabel(state.settings.unit)})
          </label>
          <input
            id="set-bw"
            type="number"
            inputMode="decimal"
            className="input"
            placeholder="optional"
            value={state.settings.bodyweight || ''}
            onChange={(e) => setBodyweight(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-2">
            Used to prefill the weight on bodyweight exercises (pull-ups, dips…). Leave blank to
            skip.
          </p>
        </div>
      </section>

      {/* Data */}
      <section className="mb-6">
        <h2 className="font-bold mb-2 px-1">Data</h2>
        <div className="card divide-y divide-ink-700">
          <Row
            title="Library summary"
            desc={`${machineCount} exercises · ${workoutCount} workouts · ${setCount} sets`}
          />
          <button className="w-full p-4 text-left hover:bg-ink-700/50 transition" onClick={handleExport}>
            <div className="font-semibold">Export backup (JSON)</div>
            <div className="text-sm text-slate-400">
              Downloads all data including photos as base64.
            </div>
          </button>
          <button
            className="w-full p-4 text-left hover:bg-ink-700/50 transition flex items-center gap-3"
            onClick={() => fileRef.current?.click()}
          >
            <IconImage size={20} className="text-slate-400 shrink-0" />
            <div>
              <div className="font-semibold">Import backup</div>
              <div className="text-sm text-slate-400">Replaces all current data.</div>
            </div>
          </button>
          <button
            className="w-full p-4 text-left hover:bg-ink-700/50 transition flex items-center gap-3"
            onClick={() => dayFileRef.current?.click()}
          >
            <IconDownload size={20} className="text-slate-400 shrink-0 rotate-180" />
            <div>
              <div className="font-semibold">Import a day (merge)</div>
              <div className="text-sm text-slate-400">
                Adds a single “Export this day” file into your log without replacing anything.
              </div>
            </div>
          </button>
          <button
            className="w-full p-4 text-left hover:bg-ink-700/50 transition"
            onClick={handleAddCommon}
          >
            <div className="font-semibold">Add common exercises</div>
            <div className="text-sm text-slate-400">
              Free-weight & bodyweight staples (bench, squat, deadlift, pull-up…). Skips any you
              already have.
            </div>
          </button>
          <button
            className="w-full p-4 text-left hover:bg-ink-700/50 transition"
            onClick={handleSample}
          >
            <div className="font-semibold">Load sample history</div>
            <div className="text-sm text-slate-400">Adds demo sessions to explore charts.</div>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
        <input
          ref={dayFileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportDayFile}
        />
      </section>

      {/* Danger zone */}
      <section className="mb-6">
        <h2 className="font-bold mb-2 px-1 text-red-400">Danger zone</h2>
        <div className="card p-4">
          <button className="btn-danger w-full" onClick={handleReset}>
            <IconTrash size={18} /> Reset all data
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Deletes everything and restores the default HOIST machine library.
          </p>
        </div>
      </section>

      <p className="text-center text-xs text-slate-600 pb-4">
        Weight Room · data stored locally on this device
      </p>
    </div>
  )
}

function Row({ title, desc }) {
  return (
    <div className="p-4">
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-slate-400">{desc}</div>
    </div>
  )
}
