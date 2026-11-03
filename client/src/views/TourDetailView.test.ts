import { it, expect, vi } from 'vitest'
import { ref, toValue } from 'vue'
import { screen } from '@testing-library/vue'
import { useQuery } from '@urql/vue'
import TourDetailView from './TourDetailView.vue'
import { renderWithRouter } from '@/test-utils'
import type { TurQuery } from '@/gql/graphql'

vi.mock('@urql/vue', () => ({ useQuery: vi.fn() }))
const mockedUseQuery = vi.mocked(useQuery)

const svar = (data: TurQuery | undefined, error?: Error) =>
  ({ data: ref(data), fetching: ref(false), error: ref(error) }) as unknown as ReturnType<
    typeof useQuery
  >

type Tur = NonNullable<TurQuery['tour']>
const makeTour = (overrides: Partial<Tur> = {}): Tur => ({
  id: '7',
  title: 'Kvällstur',
  distanceM: 8400,
  notes: null,
  logs: [
    { recordedAt: '2026-09-01T08:00:00.000Z', elevationM: 100, heartRate: 110 },
    { recordedAt: '2026-09-01T08:05:00.000Z', elevationM: 130, heartRate: 120 },
    { recordedAt: '2026-09-01T08:10:00.000Z', elevationM: 120, heartRate: 115 },
    { recordedAt: '2026-09-01T08:15:00.000Z', elevationM: 150, heartRate: 125 },
  ],
  ...overrides,
})

// C13 – fångar att id:t från routen inte når frågan, och fel i km och höjdmeter.
it('shows the tour for the id in the route with distance, log count and climb', async () => {
  mockedUseQuery.mockReturnValue(svar({ tour: makeTour() }))
  await renderWithRouter(TourDetailView, '/turer/7')

  expect(await screen.findByRole('heading', { name: 'Kvällstur' })).toBeInTheDocument()
  // 30 upp, 10 ner, 30 upp: bara stigningen räknas
  expect(screen.getByText(/8\.4 km · 4 mätpunkter · 60 höjdmeter/)).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)

  expect(toValue(mockedUseQuery.mock.calls[0]![0].variables)).toEqual({ id: '7' })
})

// C14 – tour(id) är nullable i schemat: ett okänt id får inte lämna sidan på "Laddar...".
it('says so when the tour does not exist', async () => {
  mockedUseQuery.mockReturnValue(svar({ tour: null }))
  await renderWithRouter(TourDetailView, '/turer/999')

  expect(await screen.findByText('Turen finns inte')).toBeInTheDocument()
  expect(screen.queryByText('Laddar...')).not.toBeInTheDocument()
})

// C15 – ett API-fel visar ett fel.
it('shows an error when the API fails', async () => {
  mockedUseQuery.mockReturnValue(svar(undefined, new Error('[Network] Failed to fetch')))
  await renderWithRouter(TourDetailView, '/turer/7')

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte hämta turen')
})
