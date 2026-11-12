// Relativ adress: browsern frågar samma server som skickade sidan. I containern är det nginx
// (client/nginx.conf), i utveckling Vites dev-server (proxy i vite.config.js). Båda skickar vidare till API:et.
import { getToken } from '@/lib/token'
export const API_URL = '/api'

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Generisk: anroparen säger vilken typ svaret har, t.ex. get<Guide[]>('/guides').
export const get = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`API svarade ${res.status}`)
  return res.json() as Promise<T>
}

// No Throw vid 4xx: API svarar { error: '...' } och anroparen hanterar.
// T behöver inkludera ApiError, t.ex. post<LoginResponse | ApiError>(...).
export const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}
