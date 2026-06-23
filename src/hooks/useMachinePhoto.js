import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'

/**
 * Load a machine's photo (data-URL) from IndexedDB. Re-fetches when the machine
 * id or its hasPhoto flag changes.
 */
export function useMachinePhoto(machineId, hasPhoto) {
  const { getMachinePhoto } = useStore()
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(Boolean(hasPhoto))

  useEffect(() => {
    let active = true
    if (!machineId || !hasPhoto) {
      setPhoto(null)
      setLoading(false)
      return
    }
    setLoading(true)
    getMachinePhoto(machineId)
      .then((url) => {
        if (active) {
          setPhoto(url || null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setPhoto(null)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [machineId, hasPhoto, getMachinePhoto])

  return { photo, loading }
}
