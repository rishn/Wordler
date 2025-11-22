// Lazy-load canonical word lists from backend with fallback to local
import localAnswers from './data/answers.json'
import localAllowed from './data/allowed.json'

type WordlistCache = {
  answers: string[] | null
  allowed: string[] | null
  loading: boolean
  error: string | null
}

const cache: WordlistCache = {
  answers: null,
  allowed: null,
  loading: false,
  error: null
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''
const apiUrl = (path: string) => (API_BASE ? `${API_BASE.replace(/\/$/, '')}${path}` : path)

/**
 * Fetch word lists from backend or use local fallback.
 * Returns cached lists immediately if available.
 */
export async function getWordLists(): Promise<{ answers: string[]; allowed: string[] }> {
  // Return cached if available
  if (cache.answers && cache.allowed) {
    return { answers: cache.answers, allowed: cache.allowed }
  }

  // If already loading, wait for it
  if (cache.loading) {
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (!cache.loading) {
          clearInterval(check)
          resolve(null)
        }
      }, 100)
    })
    return { answers: cache.answers || localAnswers, allowed: cache.allowed || localAllowed }
  }

  cache.loading = true

  try {
    // Try to fetch from backend
    const [answersRes, allowedRes] = await Promise.all([
      fetch(apiUrl(`/wordlists/answers.json`), {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      }),
      fetch(apiUrl(`/wordlists/allowed.json`), {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      })
    ])

    if (answersRes.ok && allowedRes.ok) {
      const [answers, allowed] = await Promise.all([
        answersRes.json(),
        allowedRes.json()
      ])

      // Validate data structure
      if (Array.isArray(answers) && Array.isArray(allowed) &&
        answers.length > 0 && allowed.length > 0) {
        cache.answers = answers
        cache.allowed = allowed
        cache.loading = false
        return { answers, allowed }
      }
    }

    throw new Error('Invalid response from backend')
  } catch (err) {
    console.warn('Failed to load word lists from backend, using local fallback:', err)
    cache.error = err instanceof Error ? err.message : String(err)
    cache.answers = localAnswers
    cache.allowed = localAllowed
    cache.loading = false
    return { answers: localAnswers, allowed: localAllowed }
  }
}

/**
 * Preload word lists in the background (call on app init)
 */
export function preloadWordLists(): void {
  getWordLists().catch(() => {
    // Silent fail - already handled by getWordLists
  })
}

/**
 * Get answers list (loads on demand if needed)
 */
export async function getAnswers(): Promise<string[]> {
  const { answers } = await getWordLists()
  return answers
}

/**
 * Get allowed list (loads on demand if needed)
 */
export async function getAllowed(): Promise<string[]> {
  const { allowed } = await getWordLists()
  return allowed
}
