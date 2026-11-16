import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterContextProvider } from '@tanstack/react-router'
import { defaultSettings } from '@gighunter/core/schema'
import { renderWithProviders, setAuth, mockAuth } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { CostControls } from './CostControls'
import { TelegramBlock } from './TelegramBlock'
import { FreelancerBlock } from './FreelancerBlock'
import { FreelancehuntBlock } from './FreelancehuntBlock'
import type { PublicSettings } from '../../api/hooks'

const base = (): PublicSettings => defaultSettings('2026-09-21T10:00:00.000Z')
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('CostControls', () => {
  it('patches active and pollIntervalMinutes', async () => {
    const onPatch = vi.fn()
    renderWithProviders(<CostControls settings={base()} onPatch={onPatch} />)
    await userEvent.click(screen.getByRole('switch', { name: /job search/i }))
    expect(onPatch).toHaveBeenCalledWith({ active: true })
    await userEvent.selectOptions(screen.getByLabelText(/poll every/i), '60')
    expect(onPatch).toHaveBeenCalledWith({ pollIntervalMinutes: 60 })
  })
})

describe('TelegramBlock', () => {
  beforeEach(() => setAuth(mockAuth()))
  it('saves a token via PUT and clears the input', async () => {
    const fetchFn = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ...base(), telegram: { tokenSet: true, tokenHint: 'abcd', botUsername: 'gh_bot' } }))
    renderWithProviders(<TelegramBlock settings={base()} onPatch={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/123456789:/), '123456789:secret-abcd')
    await userEvent.click(screen.getByRole('button', { name: /save token/i }))
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    expect(String(fetchFn.mock.calls[0]![0])).toBe('https://api.test/settings/telegram/token')
    expect((fetchFn.mock.calls[0]![1] as RequestInit).method).toBe('PUT')
    fetchFn.mockRestore()
  })
  it('shows status when connected, removes after confirm, sends a test', async () => {
    const s: PublicSettings = { ...base(), telegram: { tokenSet: true, tokenHint: 'abcd', botUsername: 'gh_bot', chatId: '-100', chatTitle: 'My gigs' } }
    const fetchFn = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    renderWithProviders(<TelegramBlock settings={s} onPatch={vi.fn()} />)
    expect(screen.getByText(/@gh_bot/)).toBeInTheDocument()
    expect(screen.getByText(/My gigs/)).toBeInTheDocument()
    expect(screen.getByText(/···abcd/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /send test message/i }))
    await waitFor(() => expect(String(fetchFn.mock.calls[0]![0])).toBe('https://api.test/settings/telegram/test'))
    await userEvent.click(screen.getByRole('button', { name: /remove/i }))
    await userEvent.click(screen.getByRole('button', { name: /^remove token$/i }))
    await waitFor(() => expect(fetchFn.mock.calls.some((c) => (c[1] as RequestInit).method === 'DELETE')).toBe(true))
    fetchFn.mockRestore()
  })
})

describe('FreelancerBlock', () => {
  beforeEach(() => setAuth(mockAuth()))
  it('toggles enabled, saves the query on blur, and saves exactly once via Save query', async () => {
    const onPatch = vi.fn()
    const s: PublicSettings = { ...base(), platforms: { ...base().platforms, freelancer: { enabled: false, query: 'react', tokenSet: true, tokenHint: '1234', connectedAs: 'yev' } } }
    renderWithProviders(<FreelancerBlock settings={s} onPatch={onPatch} />)
    expect(screen.getByText(/connected as yev/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: /poll freelancer/i }))
    expect(onPatch).toHaveBeenCalledWith({ platforms: { freelancer: { enabled: true } } })
    const queryPatches = () => onPatch.mock.calls.filter(([p]) => p.platforms?.freelancer && 'query' in p.platforms.freelancer)
    const q = screen.getByLabelText(/search query/i)
    await userEvent.clear(q); await userEvent.type(q, 'typescript'); await userEvent.tab()
    expect(queryPatches()).toEqual([[{ platforms: { freelancer: { query: 'typescript' } } }]])
    // Clicking "Save query" blurs the input first (firing onBlur) and then fires its own
    // onClick — both call the same idempotent saveQuery, so this single interaction must add
    // exactly one query PATCH for the new value, not two.
    await userEvent.clear(q); await userEvent.type(q, 'node')
    await userEvent.click(screen.getByRole('button', { name: /save query/i }))
    expect(queryPatches()).toHaveLength(2)
    expect(queryPatches()[1]).toEqual([{ platforms: { freelancer: { query: 'node' } } }])
  })
  it('resyncs the search query when settings refetch with a new value', () => {
    const s: PublicSettings = { ...base(), platforms: { ...base().platforms, freelancer: { enabled: false, query: 'react', tokenSet: true, tokenHint: '1234', connectedAs: 'yev' } } }
    const { rerender, queryClient, router } = renderWithProviders(<FreelancerBlock settings={s} onPatch={vi.fn()} />)
    expect(screen.getByLabelText(/search query/i)).toHaveValue('react')
    const s2: PublicSettings = { ...s, platforms: { ...s.platforms, freelancer: { ...s.platforms.freelancer, query: 'node' } } }
    rerender(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterContextProvider router={router as never}>
            <FreelancerBlock settings={s2} onPatch={vi.fn()} />
          </RouterContextProvider>
        </ToastProvider>
      </QueryClientProvider>,
    )
    expect(screen.getByLabelText(/search query/i)).toHaveValue('node')
  })
})

describe('FreelancehuntBlock', () => {
  beforeEach(() => setAuth(mockAuth()))
  const fh = (enabled: boolean, skillIds: number[]): PublicSettings => ({ ...base(), platforms: { ...base().platforms, freelancehunt: { enabled, skillIds } } })
  it('toggles polling and needs no token', async () => {
    const onPatch = vi.fn()
    renderWithProviders(<FreelancehuntBlock settings={fh(false, [28, 99])} onPatch={onPatch} />)
    expect(screen.getByRole('heading', { name: 'Freelancehunt' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/token/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: /poll freelancehunt/i }))
    expect(onPatch).toHaveBeenCalledWith({ platforms: { freelancehunt: { enabled: true } } })
  })
  it('quick chip taps update at once and save both changes in one patch', async () => {
    const onPatch = vi.fn()
    renderWithProviders(<FreelancehuntBlock settings={fh(true, [28, 99])} onPatch={onPatch} />)
    const js = screen.getByRole('button', { name: 'Javascript and Typescript' })
    expect(js).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(js)
    expect(js).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'DevOps' }))
    expect(screen.getByRole('button', { name: 'DevOps' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith({ platforms: { freelancehunt: { skillIds: [99, 181] } } }))
    expect(onPatch.mock.calls.filter(([p]) => p.platforms?.freelancehunt?.skillIds)).toHaveLength(1)
  })
  it('saves a pending chip change when the card unmounts', async () => {
    const onPatch = vi.fn()
    const { unmount } = renderWithProviders(<FreelancehuntBlock settings={fh(true, [28])} onPatch={onPatch} />)
    await userEvent.click(screen.getByRole('button', { name: 'Python' }))
    unmount()
    expect(onPatch).toHaveBeenCalledWith({ platforms: { freelancehunt: { skillIds: [28, 22] } } })
  })
  it('asks for at least one skill when none is selected', () => {
    renderWithProviders(<FreelancehuntBlock settings={fh(true, [])} onPatch={vi.fn()} />)
    expect(screen.getByText(/pick at least one skill/i)).toBeInTheDocument()
  })
})
