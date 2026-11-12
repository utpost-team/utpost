<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@urql/vue'
import { graphql } from '../gql'
import { useAuthStore } from '@/stores/auth'

// M6: portad från web/src/pages/Profile.jsx. Som där hämtas alla turer och användarens egna
// filtreras fram i klienten (skuld 20) – ett fält som Query.myTours vore rätt fix, men det är
// en API-ändring och hör inte till att ta bort web/.
const ProfilTurerDocument = graphql(/* GraphQL */ `
  query ProfilTurer {
    tours {
      id
      title
      user {
        id
      }
    }
  }
`)

const auth = useAuthStore()
const router = useRouter()

const { data } = useQuery({
  query: ProfilTurerDocument,
  pause: computed(() => !auth.user),
})

// User.id är number i @utpost/shared, ID är string i GraphQL
const myTours = computed(() =>
  (data.value?.tours ?? []).filter((t) => t.user.id === String(auth.user?.id)),
)

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<template>
  <p v-if="!auth.user">Du är inte inloggad.</p>
  <div v-else>
    <h1>{{ auth.user.display_name }}</h1>
    <p class="muted">{{ auth.user.email }} · {{ auth.user.role }}</p>
    <h2>Mina turer ({{ myTours.length }})</h2>
    <ul class="list">
      <li v-for="t in myTours" :key="t.id">
        <RouterLink :to="`/turer/${t.id}`">{{ t.title }}</RouterLink>
      </li>
    </ul>
    <button @click="handleLogout">Logga ut</button>
  </div>
</template>


