import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { PhotoUploadResponse } from '@utpost/shared'
import PhotoUpload from './PhotoUpload.vue'

const makeResponse = (overrides: Partial<PhotoUploadResponse> = {}): PhotoUploadResponse => ({
  id: 1,
  tour_id: 7,
  filename: 'topp.jpg',
  width: 4000,
  height: 3000,
  created_at: '2026-11-10T10:00:00Z',
  variants: [
    { size: 1600, signature: 'aaa' },
    { size: 800, signature: 'bbb' },
    { size: 400, signature: 'ccc' },
    { size: 160, signature: 'ddd' },
  ],
  processingMs: 312,
  coldStart: true,
  instance: 'inst-1',
  apiMs: 340,
  ...overrides,
})

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  // jsdom saknar createImageBitmap: browsern läser måtten, här låtsas vi.
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const upload = async () => {
  render(PhotoUpload, { props: { tourId: 7 } })
  const file = new File(['x'], 'topp.jpg', { type: 'image/jpeg' })
  await userEvent.upload(screen.getByLabelText('Välj en bild'), file)
}

// Fångar fel fält till API:et och att svaret (varianter, tider, kallstart) inte visas.
it('sends the image dimensions and shows variants, times and the cold start marker', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => makeResponse() })
  await upload()

  expect(await screen.findByText('Kallstart')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText(/312 ms/)).toBeInTheDocument()
  expect(screen.getByText(/340 ms/)).toBeInTheDocument()

  const [url, init] = fetchMock.mock.calls[0]!
  expect(url).toBe('/api/photos')
  expect(JSON.parse(init.body)).toEqual({
    tourId: 7,
    filename: 'topp.jpg',
    width: 4000,
    height: 3000,
  })
})

it('does not show the cold start marker on a warm call', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => makeResponse({ coldStart: false }) })
  await upload()

  expect(await screen.findByText(/312 ms/)).toBeInTheDocument()
  expect(screen.queryByText('Kallstart')).not.toBeInTheDocument()
})

// 502: funktionen svarar inte – användaren ska få ett begripligt fel, inte en tom sida.
it('shows an understandable error when the API answers 502', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 502,
    json: async () => ({ error: 'bildfunktionen svarar inte' }),
  })
  await upload()

  expect(await screen.findByRole('alert')).toHaveTextContent(/kunde inte bearbetas/)
})
