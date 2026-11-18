import type { MiddlewareHandler } from 'hono'
import type { LambdaEvent } from 'hono/aws-lambda'

export interface AuthUser { sub: string; email: string; groups: string[] }

/** Role in the shared Only Tools pool that lets a user into GigHunter (granted by an admin: invite-only). */
export const ACCESS_GROUP = 'gighunter-user'

/** API Gateway passes array claims as the string "[a b c]". */
export function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String)
  if (typeof claim !== 'string' || !claim) return []
  return claim.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
}
export type ApiEnv = { Bindings: { event: LambdaEvent }; Variables: { user: AuthUser } }

/** Reads Cognito claims injected by the API Gateway JWT authorizer. Never trust anything else for identity. */
export function claimsFrom(event: unknown): AuthUser | null {
  const claims = (event as { requestContext?: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } } })?.requestContext?.authorizer?.jwt?.claims
  const sub = claims?.sub
  if (typeof sub !== 'string' || !sub) return null
  return { sub, email: typeof claims?.email === 'string' ? claims.email : '', groups: parseGroups(claims?.['cognito:groups']) }
}

export const requireAuth: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const user = claimsFrom(c.env?.event)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (!user.groups.includes(ACCESS_GROUP)) return c.json({ error: 'no_access' }, 403)
  c.set('user', user)
  await next()
}
