import { describe, it, expect } from 'vitest'
import { createApp } from './app'
import { makeApiDeps, authed, anonymous } from './test-utils'

describe('app', () => {
  it('401 without JWT claims', async () => {
    const res = await createApp(makeApiDeps()).request('/me', {}, anonymous())
    expect(res.status).toBe(401)
  })
  it('/me returns sub and email from claims', async () => {
    const res = await createApp(makeApiDeps()).request('/me', {}, authed('abc', 'a@b.c'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sub: 'abc', email: 'a@b.c', groups: ['gighunter-user'] })
  })
  it('403 no_access for a signed-in Only Tools user without the gighunter-user role', async () => {
    const res = await createApp(makeApiDeps()).request('/me', {}, authed('abc', 'a@b.c', '[carlog-user foodlog-user]'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'no_access' })
  })
  it('answers OPTIONS preflight with 204 without auth', async () => {
    const res = await createApp(makeApiDeps()).request('/matches', { method: 'OPTIONS' }, anonymous())
    expect(res.status).toBe(204)
  })
  it('404 JSON for unknown routes', async () => {
    const res = await createApp(makeApiDeps()).request('/nope', {}, authed())
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
  })
})
