
import { it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@urql/vue'
import { createPinia } from 'pinia'
import type { User } from '@utpost/shared'
import ProfileView from './ProfileView.vue'
import { renderWithRouter } from '@/test-utils'
import type { ProfilTurerQuery } from '@/gql/graphql'
import { setToken } from '@/lib/token'
import { useAuthStore } from '@/stores/auth'

vi.mock('@urql/vue', () => ({ useQuery: vi.fn() }))
const mockedUseQuery = vi.mocked(useQuery)

const svar = (data: ProfilTurerQuery | undefined) =>
  ({ data: ref(data), fetching: ref(false), error: ref(undefined) }) as unknown as ReturnType<
    typeof useQuery
  >

const anna: User = {
  id: 1,
  email: 'anna@example.com',
  display_name: 'Anna',
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
}

// Inloggningen använder Pinia och en token som bara lagras i minnet.
const loggaIn = (pinia: ReturnType<typeof createPinia>, user: User) => {
  setToken('t')
  useAuthStore(pinia).user = user
}

beforeEach(() => {
  setToken(null)

  mockedUseQuery.mockReturnValue(
    svar({
      tours: [
        { id: '1', title: 'Annas tur', user: { id: '1' } },
        { id: '2', title: 'Någon annans tur', user: { id: '2' } },
      ],
    }),
  )
})

// C16 – fångar att andras turer visas, eller att number/string-jämförelsen av id missar alla.
it('shows the user and only their own tours', async () => {
  const pinia = createPinia()
  loggaIn(pinia, anna)
  await renderWithRouter(ProfileView, '/profil', pinia)

  expect(await screen.findByRole('heading', { name: 'Anna' })).toBeInTheDocument()
  expect(screen.getByText('anna@example.com · member')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mina turer (1)' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Annas tur' })).toHaveAttribute('href', '/turer/1')
  expect(screen.queryByText('Någon annans tur')).not.toBeInTheDocument()
})

// C17 – utloggad: inget namn, ingen lista.
it('says so when nobody is logged in', async () => {
  await renderWithRouter(ProfileView, '/profil')

  expect(await screen.findByText('Du är inte inloggad.')).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

// C18 – utloggningen tömmer sessionen och lämnar sidan.
it('logs out and leaves the page', async () => {
  const pinia = createPinia()
  loggaIn(pinia, anna)
  const { router } = await renderWithRouter(ProfileView, '/profil', pinia)

  await userEvent.click(await screen.findByRole('button', { name: 'Logga ut' }))

  expect(router.currentRoute.value.path).toBe('/')
  expect(useAuthStore(pinia).isLoggedIn).toBe(false)
})
