import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, unref } from 'vue'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { useQuery } from '@urql/vue'
import HomeView from './HomeView.vue'
import type { HomeQuery } from '../gql/graphql'
import { useAuthStore } from '../stores/auth'
import { setToken } from '../lib/token'

// Samma princip som GuidesView.test.ts: vi mockar gränsen mot nätverket, inte fetch.
// Sedan M5 är gränsen useQuery från urql – den får svara med färdiga refs.
vi.mock('@urql/vue', () => ({ useQuery: vi.fn() }))
const mockedUseQuery = vi.mocked(useQuery)

const svar = (data: HomeQuery | undefined, error?: Error) =>
  ({ data: ref(data), fetching: ref(false), error: ref(error) }) as unknown as ReturnType<
    typeof useQuery
  >

const renderView = () =>
  render(HomeView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })

// M9: vyn läser vem som är inloggad ur auth-storen – varje test får en egen, tom store.
beforeEach(() => {
  setActivePinia(createPinia())
  setToken(null)
  mockedUseQuery.mockReset()
})

describe('HomeView', () => {
  it('visar startsidan från ett enda GraphQL-anrop', async () => {
    mockedUseQuery.mockReturnValue(
      svar({
        notices: [
          {
            id: 'n1',
            title: 'Leden är avstängd',
            level: 'varning',
            status: 'published',
            guideSlug: null,
            body: [{ runs: [{ text: 'Bron lagas.', bold: false, italic: false, href: null }] }],
          },
        ],
        guides: [
          {
            slug: 'kebnekaise',
            title: 'Kebnekaise',
            region: 'Lappland',
            difficulty: 'svår',
            lengthKm: 18,
          },
        ],
        popularGuides: [{ slug: 'kebnekaise', title: 'Kebnekaise', region: 'Lappland' }],
        regions: ['Lappland', 'Småland'],
        tours: [{ id: '7', title: 'Kvällstur', distanceM: 8400 }],
      }),
    )
    renderView()

    expect(await screen.findByText('1 guider i 2 landskap.')).toBeInTheDocument()
    expect(screen.getByText('Kvällstur')).toBeInTheDocument()
    expect(screen.getByText('8.4 km')).toBeInTheDocument()
    // M9: notisen kommer i samma svar, och en anonym besökare får ingen förhandsgranskning
    expect(screen.getByRole('heading', { name: 'Leden är avstängd' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Förhandsgranska/)).toBeNull()
    expect(mockedUseQuery).toHaveBeenCalledTimes(1)
  })

  it('redaktören kan slå på förhandsgranskningen: frågan ställs om med preview och utan cache', async () => {
    mockedUseQuery.mockReturnValue(
      svar({ notices: [], guides: [], popularGuides: [], regions: [], tours: [] }),
    )
    const auth = useAuthStore()
    auth.user = {
      id: 1,
      email: 'redaktor@utpost.se',
      display_name: 'Redaktören',
      role: 'editor',
      created_at: '2026-11-18',
    }
    setToken('en-token')
    renderView()

    // useQuery fick reaktiva variabler: de ändras när rutan kryssas i, och urql frågar om
    const args = mockedUseQuery.mock.calls[0][0] as {
      variables: unknown
      requestPolicy: unknown
    }
    expect(unref(args.variables)).toEqual({ preview: false })
    await userEvent.click(await screen.findByLabelText(/Förhandsgranska/))
    expect(unref(args.variables)).toEqual({ preview: true })
    expect(unref(args.requestPolicy)).toBe('network-only')
  })

  it('visar felet när GraphQL svarar med errors', async () => {
    mockedUseQuery.mockReturnValue(
      svar(undefined, new Error('[GraphQL] Cannot query field "titel" on type "Guide".')),
    )
    renderView()

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot query field')
  })
})
