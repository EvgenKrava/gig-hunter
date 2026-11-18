import { describe, it, expect } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders, setAuth, mockAuth } from '../test/utils'
import { Landing } from './index'

describe('Landing', () => {
  it('sends a signed-out visitor straight to the shared sign-in, keeping returnTo', async () => {
    const auth = mockAuth({ isAuthenticated: false, user: undefined })
    setAuth(auth)
    sessionStorage.setItem('returnTo', '/jobs/freelancer/1')
    renderWithProviders(<Landing />)
    await waitFor(() => expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/jobs/freelancer/1' } }))
    expect(sessionStorage.getItem('returnTo')).toBeNull()
  })
  it('does not start a sign-in when already signed in', async () => {
    const auth = mockAuth()
    setAuth(auth)
    renderWithProviders(<Landing />)
    await new Promise((r) => setTimeout(r, 20))
    expect(auth.signinRedirect).not.toHaveBeenCalled()
  })
})
