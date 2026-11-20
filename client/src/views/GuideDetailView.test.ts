import { it, expect, vi, beforeEach } from 'vitest'
import { ref, unref } from 'vue'
import { screen } from '@testing-library/vue'
import { useQuery } from '@urql/vue'
import GuideDetailView from './GuideDetailView.vue'
import type { GuideQuery } from '../gql/graphql'
import { renderWithRouter } from '@/test-utils'

vi.mock('@urql/vue', () => ({ useQuery: vi.fn() }))
const mockedUseQuery = vi.mocked(useQuery)

const svar = (data: GuideQuery | undefined, error?: Error) =>
  ({ data: ref(data), fetching: ref(false), error: ref(error) }) as unknown as ReturnType<
    typeof useQuery
  >

const guideData = (overrides: Partial<NonNullable<GuideQuery['guide']>> = {}): GuideQuery => ({
  guide: {
    slug: 'kebnekaise',
    title: 'Kebnekaise',
    region: 'Lappland',
    difficulty: 'medel',
    lengthKm: 10.7,
    bodyHtml: '<p>Sveriges tak</p>',
    notices: [],
    ...overrides,
  },
})

beforeEach(() => {
  mockedUseQuery.mockReset()
})

// C5 – fångar att sluggen från routen inte når GraphQL-frågan, och att guidens notiser visas.
it('loads the guide and its notices for the slug in the route', async () => {
  mockedUseQuery.mockReturnValue(
    svar(
      guideData({
        notices: [
          {
            id: 'n1',
            title: 'Storforsbron är avstängd',
            level: 'varning',
            status: 'published',
            body: [
              { runs: [{ text: 'Räkna med omväg.', bold: false, italic: false, href: null }] },
            ],
          },
        ],
      }),
    ),
  )
  await renderWithRouter(GuideDetailView, '/guider/kebnekaise')

  expect(await screen.findByRole('heading', { name: 'Kebnekaise' })).toBeInTheDocument()
  expect(screen.getByText('Sveriges tak')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Storforsbron är avstängd' })).toBeInTheDocument()
  const args = mockedUseQuery.mock.calls[0][0] as { variables: unknown }
  expect(unref(args.variables)).toEqual({ slug: 'kebnekaise' })
})

// C6 – fångar att en saknad guide lämnar sidan på "Laddar…" för alltid.
it('shows a message instead of loading forever when the guide is missing', async () => {
  mockedUseQuery.mockReturnValue(svar({ guide: null }))
  await renderWithRouter(GuideDetailView, '/guider/finns-inte')

  expect(await screen.findByText('Det finns ingen guide som heter så.')).toBeInTheDocument()
  expect(screen.queryByText('Laddar…')).not.toBeInTheDocument()
})

// C7 – Debt 7 (#9): redaktionell HTML renderas renad (tills den flyttas till CMS i steg 4).
it('strips event handlers from guide HTML', async () => {
  mockedUseQuery.mockReturnValue(
    svar(guideData({ bodyHtml: '<p>Sveriges tak</p><img src="x" onerror="alert(1)">' })),
  )
  const { container } = await renderWithRouter(GuideDetailView, '/guider/kebnekaise')

  expect(await screen.findByText('Sveriges tak')).toBeInTheDocument()
  expect(container.querySelector('[onerror]')).toBeNull()
})
