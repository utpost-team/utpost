import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GuidesView from '@/views/GuidesView.vue'
import GuideDetailView from '@/views/GuideDetailView.vue'
import ToursView from '@/views/ToursView.vue'
import LoginView from '@/views/LoginView.vue'
import TourDetailView from '@/views/TourDetailView.vue'
import ProfileView from '@/views/ProfileView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/guider',
      name: 'guides',
      component: GuidesView,
    },
    {
      path: '/guider/:slug',
      name: 'guide-detail',
      component: GuideDetailView,
    },
    {
      path: '/turer',
      name: 'tours',
      component: ToursView,
    },
    {
      path: '/turer/:id',
      name: 'tour-detail',
      component: TourDetailView,
    },
    {
      path: '/profil',
      name: 'profile',
      component: ProfileView,
    },
    {
      path: '/logga-in',
      name: 'login',
      component: LoginView,
    },
  ],
})

export default router
