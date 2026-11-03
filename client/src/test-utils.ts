import type { Component } from 'vue'
import { render } from '@testing-library/vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import type { Guide } from '@utpost/shared'

// Riktig router i minnet: vyerna använder RouterLink, useRoute och useRouter.
const Blank = { render: () => null }

export async function renderWithRouter(component: Component, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guider/:slug', component: Blank },
      { path: '/turer/:id', component: Blank },
      { path: '/:pathMatch(.*)*', component: Blank },
    ],
  })
  router.push(path)
  await router.isReady()
  const utils = render(component, { global: { plugins: [router, createPinia()] } })
  return { ...utils, router }
}

// Typade fabriker: ändras kontraktet i @utpost/shared bryts testdatan i typkontrollen.
export const makeGuide = (overrides: Partial<Guide> = {}): Guide => ({
  id: 1,
  slug: 'kebnekaise',
  title: 'Kebnekaise',
  region: 'Lappland',
  difficulty: 'medel',
  length_km: 10.7,
  body_html: '<p>Sveriges tak</p>',
  hero_image: null,
  published: true,
  author_id: null,
  updated_at: '2026-10-01T10:00:00Z',
  ...overrides,
})
