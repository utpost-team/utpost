import { it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@urql/vue'
import type { User } from '@utpost/shared'
import ProfileView from './ProfileView.vue'
import { renderWithRouter } from '@/test-utils'
import type { ProfilTurerQuery } from '@/gql/graphql'

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

// Sessionen läses ur localStorage när storen skapas, precis som efter en riktig inloggning.
const loggaIn = (user: User) => {
  localStorage.setItem('token', 't')
  localStorage.setItem('user', JSON.stringify(user))
}

beforeEach(() => {
  localStorage.clear()
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
  loggaIn(anna)
  await renderWithRouter(ProfileView, '/profil')

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
  loggaIn(anna)
  const { router } = await renderWithRouter(ProfileView, '/profil')

  await userEvent.click(await screen.findByRole('button', { name: 'Logga ut' }))

  expect(localStorage.getItem('token')).toBeNull()
  await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
})
