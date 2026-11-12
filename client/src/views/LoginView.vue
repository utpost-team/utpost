<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const email = ref('')
const password = ref('')
const error = ref('')

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

async function submit() {
  error.value = ''
  try {
    await session.login(email.value, password.value)
    const destination = route.query.redirect
    const redirectTo =
      typeof destination === 'string' && 
      destination.startsWith('/') &&
      !destination.startsWith('//')
        ? destination
        : '/'
    router.push(redirectTo)
  } catch (err) {
    // Storen kastar Error med API:ets meddelande.
    error.value = err instanceof Error ? err.message : 'Kunde inte logga in'
  }
}
</script>

<template>
  <div class="login-view">
    <h1>Logga in</h1>
    <form @submit.prevent="submit" class="login-form">
      <div>
        <label for="email">E-post</label>
        <input
          id="email"
          v-model="email"
          type="email"
          placeholder="jack.ripper@email.com"
          required
        />
      </div>
      <div>
        <label for="password">Lösenord</label>
        <input id="password" v-model="password" type="password" placeholder="hemligt123" required />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">Logga in</button>
    </form>
  </div>
</template>
<style scoped>
.login-view {
  max-width: 400px;
  margin: 2rem 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-form div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error {
  color: #e53e3e;
}
</style>
