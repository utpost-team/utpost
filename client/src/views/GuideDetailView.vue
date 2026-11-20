<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@urql/vue'
import DOMPurify from 'dompurify'
import { graphql } from '../gql'
import NoticeList from '../components/NoticeList.vue'

// Detaljvyn: frågan tar en variabel ($slug) och hämtar guiden samt dess notiser ur GraphQL-API:et.
// Codegen genererar typen för variablerna och svaret ur schemat.
const GuideDocument = graphql(/* GraphQL */ `
  query Guide($slug: String!) {
    guide(slug: $slug) {
      slug
      title
      region
      difficulty
      lengthKm
      bodyHtml
      notices {
        id
        title
        level
        status
        body {
          runs {
            text
            bold
            italic
            href
          }
        }
      }
    }
  }
`)

const route = useRoute()
// Variablerna är reaktiva: byter adressen slug kör urql frågan igen (eller svarar ur cachen).
const variables = computed(() => ({ slug: route.params.slug as string }))
const { data, fetching, error } = useQuery({ query: GuideDocument, variables })
</script>

<template>
  <p v-if="error" role="alert">Kunde inte hämta guiden: {{ error.message }}</p>
  <p v-else-if="fetching || !data">Laddar…</p>
  <p v-else-if="!data.guide" role="alert">Det finns ingen guide som heter så.</p>
  <article v-else class="guide">
    <h1>{{ data.guide.title }}</h1>
    <p class="muted">
      {{ data.guide.region }} · {{ data.guide.difficulty }} · {{ data.guide.lengthKm }} km
    </p>
    <!-- M9: notiserna för den här guiden kommer ur CMS:et, som data. Jämför med raden under. -->
    <NoticeList :notices="data.guide.notices" />
    <!-- Redaktionens HTML ur databasen (skuld 10). Rå HTML från servern – flyttar till CMS i steg 4. -->
    <div class="body" v-html="DOMPurify.sanitize(data.guide.bodyHtml)" />
  </article>
</template>

<style scoped>
.muted {
  color: #777;
  font-size: 14px;
}
.body {
  max-width: 70ch;
}
</style>
