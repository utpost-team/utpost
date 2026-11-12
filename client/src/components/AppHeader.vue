<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push('/logga-in')
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="logo">Utpost</RouterLink>
    <nav>
      <RouterLink to="/guider">Guider</RouterLink>
      <RouterLink to="/turer">Turer</RouterLink>

      <template v-if="session.isAuthenticated">
        <RouterLink to="/profil" class="user-greeting"
          >Inloggad som {{ session.user?.display_name }}</RouterLink
        >
        <button class="btn-logout" @click="handleLogout">Logga ut</button>
      </template>
      <template v-else>
        <RouterLink to="/logga-in">Logga in</RouterLink>
      </template>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #ddd;
}
.logo {
  font-weight: bold;
  font-size: 1.25rem;
  text-decoration: none;
  color: inherit;
}
nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.user-greeting {
  font-size: 0.9rem;
  color: #555;
}
.btn-logout {
  cursor: pointer;
}
</style>
