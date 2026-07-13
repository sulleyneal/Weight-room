// Lazy photo sync. GET returns per-machine hashes so the client only uploads
// changed images. PUT upserts one photo; DELETE removes one.
import { getPhotoHashes, putPhoto, deletePhoto } from '@/lib/state'
import { requireApiAuth } from '@/lib/apiAuth'
import { apiJson, apiPreflight } from '@/lib/http'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  return apiJson(req, { hashes: await getPhotoHashes() })
}

export async function PUT(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return apiJson(req, { error: 'invalid_json' }, 400)
  }
  const machineId = typeof body.machineId === 'string' ? body.machineId : ''
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
  const hash = typeof body.hash === 'string' ? body.hash : ''
  if (!machineId || !dataUrl) return apiJson(req, { error: 'missing machineId or dataUrl' }, 400)
  await putPhoto(machineId, dataUrl, hash)
  return apiJson(req, { ok: true, machineId })
}

export async function DELETE(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  const { searchParams } = new URL(req.url)
  const machineId = searchParams.get('machineId') || ''
  if (!machineId) return apiJson(req, { error: 'missing machineId' }, 400)
  await deletePhoto(machineId)
  return apiJson(req, { ok: true, machineId })
}
