# Weight Room 🏋️

A personal, mobile-first gym workout tracker for **HOIST ROC-IT** selectorized
machines. Log weight/reps per set on each machine and track progress over time.
Runs entirely in your browser — no account, no server — and deploys as a static
site.

## Features

- **Machine library** — pre-seeded with a full-body split of HOIST ROC-IT
  machines (Chest Press RS-2301, Shoulder Press, Lat Pulldown, Seated Row,
  Biceps Curl, Triceps Extension, Leg Press, Leg Extension, Leg Curl,
  Abdominal, Lower Back). Add / edit / delete machines with name, model number,
  muscle group, notes (grip / seat settings) and a photo.
- **Add a machine from a photo** — snap or upload the machine's placard (model
  badge / instruction label). The image is stored in IndexedDB and shown on the
  machine's detail view so you can reference grip / seat settings at the gym.
- **Log a workout** — pick a date (defaults to today), add machines, and log
  sets with large number steppers. **Repeat last set** and **Copy last
  workout** buttons make entry fast. Multiple sets per machine, multiple
  machines per session.
- **Per-machine progress** — line chart of estimated 1RM (Epley:
  `weight × (1 + reps/30)`), top-set weight, and total volume per session, with
  a full history table and the stored placard photo.
- **Dashboard** — recent workouts, body-part split summary, and quick stats
  (workouts this week, weekly volume, PRs hit). PRs flag when top-set weight or
  estimated 1RM beats the prior best for a machine.
- **Settings** — toggle lbs / kg, and export / import all data as JSON (photos
  included as base64).

## Tech

- **React + Vite** single-page app
- **Tailwind CSS** — clean, dark-mode-default, mobile-first UI with large tap targets
- **Recharts** for progress graphs
- **LocalStorage** for app data; **IndexedDB** for machine photos (avoids the
  localStorage size cap)
- Hash-based routing so it works from any path (GitHub Pages, `file://`, etc.)

### Data layer

Data is normalized into `machines`, `workouts`, and `sets`, plus `settings`.
Photos live in IndexedDB keyed by machine id. All persistence goes through a
single module (`src/lib/persistence.js` for app data, `src/lib/idb.js` for
photos) behind a small repository-style API, so the storage backend could be
swapped for a real database later without touching the UI.

```
machines  { id, name, model, muscleGroup, notes, hasPhoto, archived, createdAt }
workouts  { id, date }                       // date = 'YYYY-MM-DD'
sets      { id, workoutId, machineId, weight, reps, order }
settings  { unit }                           // 'lbs' | 'kg'
photos    IndexedDB: machineId -> data-URL
```

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Build a static bundle:

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

The `dist/` folder is a self-contained static site — drop it on any static host
(GitHub Pages, Netlify, Vercel, S3, …).

## Notes

- All data stays on your device. Use **Settings → Export backup** to save a JSON
  copy (including photos) and **Import** to restore it on another device.
- The unit toggle is a display preference; pick lbs or kg and log in that unit.
- Use **Settings → Load sample history** to populate demo sessions and explore
  the charts before logging real workouts.
