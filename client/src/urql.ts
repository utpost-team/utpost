import { createClient, cacheExchange, fetchExchange } from '@urql/vue'
import { getToken } from './lib/token'

// M5: GraphQL-klienten. Ersätter gql() från M4 (ett fetch per anrop, ingen cache).
// Relativ adress som förut: nginx i containern och Vites dev-server skickar /graphql vidare.
//
// cacheExchange är urqls dokumentcache: samma fråga + samma variabler = svaret ur minnet, inget
// nätverksanrop. En mutation som returnerar en typ (t.ex. Tour) gör alla cachade frågor som
// innehåller den typen ogiltiga – därför lägger urql till __typename i varje fråga.
// Cachen lever i minnet; en omladdning av sidan tömmer den. fetchExchange skickar anropet.
export const client = createClient({
  url: '/graphql',
  exchanges: [cacheExchange, fetchExchange],
  // Alltid POST, som i M4: en metod, en adress, frågan i bodyn. GET /graphql är GraphiQL.
  preferGetMethod: false,
  // M9: redaktionens förhandsgranskning kräver inloggning. Token följer med varje GraphQL-anrop,
  // samma Bearer som i api.ts. Utan token är anropet anonymt, precis som förut.
  fetchOptions: () => {
    const token = getToken()
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  },
})
