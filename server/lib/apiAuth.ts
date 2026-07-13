// Shared bearer guard for the JSON data API (the Weight Room client).
//
// This API is the CLIENT sync surface (full read/write of the whole document),
// so it accepts ONLY the static connector secret — never an OAuth-issued token.
// That keeps the credential Claude holds off the full-overwrite endpoints
// (House Rule 4): Claude's token works on the MCP tools only.
import { bearerFromRequest, verifyStaticToken } from './auth'
import { apiJson } from './http'

/** Returns a 401 Response if the request isn't authorized, else null. */
export async function requireApiAuth(req: Request): Promise<Response | null> {
  if (verifyStaticToken(bearerFromRequest(req))) return null
  return apiJson(req, { error: 'unauthorized', message: 'Missing or invalid connector token.' }, 401)
}
