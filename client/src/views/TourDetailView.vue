<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@urql/vue'
import { graphql } from '../gql'
import { elevationGain } from '@/lib/elevation'

// M6: portad från web/src/pages/TourDetail.jsx. React-versionen hämtade /api/tours/:id
// (mätpunkterna ur Postgres tour_logs); här frågar vi GraphQL, som läser dem ur MongoDB.
const TurDocument = graphql(/* GraphQL */ `
  query Tur($id: ID!) {
    tour(id: $id) {
      id
      title
      distanceM
      notes
      logs {
        recordedAt
        elevationM
        heartRate
      }
    }
  }
`)

const route = useRoute()
// /turer/:id ger alltid en string. computed: byts id:t i routen körs frågan om.
const variables = computed(() => ({ id: String(route.params.id) }))

const { data, fetching, error } = useQuery({ query: TurDocument, variables })

const tour = computed(() => data.value?.tour ?? null)
const climb = computed(() =>
  tour.value ? elevationGain(tour.value.logs.map((l) => ({ elevation_m: l.elevationM }))) : 0,
)
const time = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE')
</script>

<template>
  <p v-if="error" role="alert">Kunde inte hämta turen</p>
  <p v-else-if="fetching || !data">Laddar...</p>
  <p v-else-if="!tour">Turen finns inte</p>
  <article v-else>
    <h1>{{ tour.title }}</h1>
    <p class="muted">
      {{ Math.round(tour.distanceM / 100) / 10 }} km · {{ tour.logs.length }} mätpunkter ·
      {{ climb }} höjdmeter
    </p>
    <p v-if="tour.notes">{{ tour.notes }}</p>
    <h2>Mätpunkter</h2>
    <ol class="logs">
      <li v-for="(log, i) in tour.logs" :key="i">
        {{ time(log.recordedAt) }} · {{ log.elevationM ?? '-' }} m ·
        {{ log.heartRate ?? '-' }} slag/min
      </li>
    </ol>
  </article>
</template>
