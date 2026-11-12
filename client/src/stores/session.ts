import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApiError, LoginResponse, User } from '@utpost/shared'
import { post } from '@/api'
import { setToken } from '@/lib/token'

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  async function login(email: string, password: string): Promise<User> {
    const data = await post<LoginResponse | ApiError>('/auth/login', { email, password })

    if ('error' in data) {
      throw new Error(data.error || 'Kunde inte logga in')
    }

    token.value = data.token
    user.value = data.user
    setToken(data.token)

    return data.user
  }

  function logout() {
    token.value = null
    user.value = null
    setToken(null)
  }

  return { token, user, isAuthenticated, login, logout }
})