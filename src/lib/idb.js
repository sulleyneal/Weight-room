// IndexedDB photo store.
//
// Photos are kept out of localStorage (which has a ~5MB cap) and live in their
// own object store keyed by machine id. The value is a data-URL string so it is
// trivial to render in an <img> and to serialize into a JSON export.
//
// This module exposes a tiny async key/value API. The rest of the app never
// touches IndexedDB directly, so the photo backend could be swapped (e.g. for a
// real blob store / S3) without changing callers.

const DB_NAME = 'weight-room'
const DB_VERSION = 1
const STORE = 'photos'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function withStore(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    let result
    const maybe = fn(store)
    if (maybe) {
      maybe.onsuccess = () => {
        result = maybe.result
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** Store (or replace) a photo data-URL for a machine id. */
export async function putPhoto(id, dataUrl) {
  return withStore('readwrite', (store) => store.put(dataUrl, id))
}

/** Get a photo data-URL for a machine id, or undefined if none. */
export async function getPhoto(id) {
  return withStore('readonly', (store) => store.get(id))
}

/** Delete a machine's photo. */
export async function deletePhoto(id) {
  return withStore('readwrite', (store) => store.delete(id))
}

/** Return every stored photo as a { [id]: dataUrl } map (used for export). */
export async function getAllPhotos() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const out = {}
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        out[cursor.key] = cursor.value
        cursor.continue()
      } else {
        resolve(out)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

/** Bulk replace photos from a { [id]: dataUrl } map (used for import). */
export async function replaceAllPhotos(map) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    for (const [id, dataUrl] of Object.entries(map || {})) {
      if (dataUrl) store.put(dataUrl, id)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
