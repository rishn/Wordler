import { GuessResult, Pattern, PatternChar, SolveSummary } from './wordleTypes'
import answers from './data/answers.json'
import allowed from './data/allowed.json'

// Full NYT word lists copied into server/lib/data for parity with frontend solver.
export const ANSWERS: string[] = answers
export const ALLOWED: string[] = allowed

function scorePattern(guessRaw: string, answerRaw: string): Pattern {
  const guess = guessRaw.toLowerCase()
  const answer = answerRaw.toLowerCase()
  const res: PatternChar[] = Array(5).fill('b')
  const freq: Record<string, number> = {}
  for (let i = 0; i < 5; i++) freq[answer[i]] = (freq[answer[i]] ?? 0) + 1
  for (let i = 0; i < 5; i++) if (guess[i] === answer[i]) { res[i] = 'g'; freq[guess[i]]!-- }
  for (let i = 0; i < 5; i++) if (res[i] !== 'g' && (freq[guess[i]] ?? 0) > 0) { res[i] = 'y'; freq[guess[i]]!-- }
  return res
}

export function patternToKey(p: Pattern): string { return p.join('') }
export function consistent(guess: string, pattern: Pattern, candidate: string): boolean {
  return patternToKey(scorePattern(guess, candidate)) === patternToKey(pattern)
}
export function filterCandidates(history: GuessResult[]): string[] {
  return ANSWERS.filter(ans => history.every(h => consistent(h.guess, h.pattern, ans)))
}

export function entropyForGuess(guess: string, candidates: string[]): number {
  const map = new Map<string, number>()
  for (const ans of candidates) {
    const key = patternToKey(scorePattern(guess, ans))
    map.set(key, (map.get(key) || 0) + 1)
  }
  const total = candidates.length
  let entropy = 0
  for (const count of map.values()) {
    const p = count / total
    entropy += -p * Math.log2(p)
  }
  return entropy
}

export function pickNextGuess(candidates: string[], history: GuessResult[]): string {
  if (candidates.length <= 1) return candidates[0] || 'roate'
  // Simple entropy-only selection for reduced list
  let best = candidates[0]
  let bestScore = -Infinity
  for (const w of candidates.slice(0, 50)) { // limit for speed
    const e = entropyForGuess(w, candidates)
    if (e > bestScore) { bestScore = e; best = w }
  }
  return best
}

export function solve(answer?: string): SolveSummary {
  const theAnswer = (answer ?? ANSWERS[Math.floor(Math.random() * ANSWERS.length)]).toLowerCase()
  const steps: GuessResult[] = []
  let candidates = ANSWERS.slice()
  for (let turn = 0; turn < 6; turn++) {
    const guess = (turn === 0 ? 'roate' : pickNextGuess(candidates, steps)).toLowerCase()
    const pattern = scorePattern(guess, theAnswer)
    const remaining = filterCandidates([...steps, { guess, pattern, remaining: 0 }]).length
    const result: GuessResult = { guess, pattern, remaining }
    steps.push(result)
    if (guess === theAnswer) return { success: true, answer: theAnswer, steps }
    candidates = filterCandidates(steps)
  }
  return { success: false, answer: theAnswer, steps }
}

export function computePickDetails(word: string, candidates: string[], history: GuessResult[]) {
  // Placeholder returning entropy only in backend subset; supply 'score' for compatibility with previous usage.
  const entropy = entropyForGuess(word, candidates)
  return { word, entropy, score: entropy }
}
