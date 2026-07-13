// Shared bearer guard for the JSON data API (the Weight Room client).
import { bearerFromRequest, verifyBearer } from './auth'
import { apiJson } from './http'

/** Returns a 401 Response if the request isn't authorized, else null. */
export async function requireApiAuth(req: Request): Promise<Response | null> {
  const ok = await verifyBearer(bearerFromRequest(req))
  if (ok) return null
  return apiJson(req, { error: 'unauthorized', message: 'Missing or invalid connector token.' }, 401)
}
