export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api' + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: body !== undefined || method === 'DELETE' ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch { throw new Error('Cannot reach Spring Boot. Start the backend and try again.') }
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw new Error('Spring Boot is unavailable. Check the backend on port 4318.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.')
  return data as T
}

export function relativeTime(value?: string | null) {
  if (!value) return 'Not checked yet'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago'
  return Math.floor(seconds / 86400) + 'd ago'
}

export function shortNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
