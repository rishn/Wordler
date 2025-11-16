import { GuessResult, Pattern, PatternChar, SolveSummary } from './wordleTypes'
import answers from './data/answers.json'
import allowed from './data/allowed.json'

// Local fallback lists (always available for sync operations and local dev)
export const ANSWERS: string[] = answers
export const ALLOWED: string[] = allowed

// Runtime lists (will be populated by wordlistLoader or fallback to local)
let runtimeAnswers: string[] = answers
let runtimeAllowed: string[] = allowed

/**
 * Update runtime word lists (called by wordlistLoader after fetch)
 */
export function setWordLists(newAnswers: string[], newAllowed: string[]): void {
  if (newAnswers.length > 0) runtimeAnswers = newAnswers
  if (newAllowed.length > 0) runtimeAllowed = newAllowed
}

/**
 * Get current runtime answers list
 */
export function getAnswersList(): string[] {
  return runtimeAnswers
}

/**
 * Get current runtime allowed list
 */
export function getAllowedList(): string[] {
  return runtimeAllowed
}

function scorePattern(guessRaw: string, answerRaw: string): Pattern {
  const guess = guessRaw.toLowerCase()
  const answer = answerRaw.toLowerCase()
  const res: PatternChar[] = Array(5).fill('b')
  const freq: Record<string, number> = {}
  for (let i = 0; i < 5; i++) {
    const ch = answer[i]
    freq[ch] = (freq[ch] ?? 0) + 1
  }
  // First pass: greens
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'g'
      freq[guess[i]]!--
    }
  }
  // Second pass: yellows using remaining frequency
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'g') continue
    const ch = guess[i]
    if ((freq[ch] ?? 0) > 0) {
      res[i] = 'y'
      freq[ch]!--
    }
  }
  return res
}

export function patternToKey(p: Pattern): string {
  return p.join('')
}

export function consistent(guess: string, pattern: Pattern, candidate: string): boolean {
  const actual = scorePattern(guess, candidate)
  return patternToKey(actual) === patternToKey(pattern)
}

export function filterCandidates(history: GuessResult[]): string[] {
  return runtimeAnswers.filter(ans => history.every(h => consistent(h.guess, h.pattern, ans)))
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
  // If we still have candidate solutions, we try to pick a guess that BOTH
  // 1) Maximizes expected information (entropy) and
  // 2) Advances constraint satisfaction (places greens, covers yellows in new positions, introduces new letters).
  // We allow choosing a word outside the candidates (from ALLOWED) if it yields significantly higher information gain early on.

  if (candidates.length > 0) {
    if (candidates.length === 1) return candidates[0]

    const constraints = deriveConstraints(history)

    // Limit pools for performance; include candidates plus a sample of allowed words not yet guessed that fit constraints.
    const informativePool: string[] = []
    const maxCandidateSample = candidates.length > 120 ? 120 : candidates.length
    informativePool.push(...candidates.slice(0, maxCandidateSample))

    // Add exploratory allowed words (not necessarily candidates) to increase discrimination if candidate space is still large.
    if (candidates.length > 2) {
      const exploratoryAllowed = runtimeAllowed.filter(w => !constraints.prevGuesses.has(w) && fitsConstraints(w, constraints))
        .slice(0, 120) // cap
      for (const w of exploratoryAllowed) if (!informativePool.includes(w)) informativePool.push(w)
    }

    const scored = informativePool.map(word => scoreWordWithConstraints(word, candidates, constraints))

    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    // Prefer returning a candidate solution if its score is close (within small delta) to the best non-candidate.
    if (!candidates.includes(best.word)) {
      const bestCandidate = scored.find(s => candidates.includes(s.word))
      if (bestCandidate && best.score - bestCandidate.score < 0.35) {
        return bestCandidate.word
      }
    }
    return best.word
  }

  // Fallback mode: candidate space exhausted; construct an exploratory guess from ALLOWED
  return fallbackExplorationGuess(history)
}

type Constraints = {
  fixed: (string | null)[] // length 5, fixed greens
  forbiddenPos: Map<string, Set<number>> // letter -> set of indices not allowed (yellows positions)
  minCount: Map<string, number> // minimum occurrences required across word
  excluded: Set<string> // letters confirmed absent
  prevGuesses: Set<string>
  seenLetters: Set<string>
}

function deriveConstraints(history: GuessResult[]): Constraints {
  const fixed: (string | null)[] = [null, null, null, null, null]
  const forbiddenPos = new Map<string, Set<number>>()
  const minCount = new Map<string, number>()
  const seenAsGY = new Set<string>()
  const seenAsB = new Map<string, number>()
  const prevGuesses = new Set<string>()
  const seenLetters = new Set<string>()

  const addForbidden = (ch: string, idx: number) => {
    let s = forbiddenPos.get(ch)
    if (!s) { s = new Set<number>(); forbiddenPos.set(ch, s) }
    s.add(idx)
  }

  for (const step of history) {
    prevGuesses.add(step.guess)
    const guess = step.guess
    const counts: Record<string, { g: number; y: number; b: number }> = {}
    for (let i = 0; i < 5; i++) {
      const ch = guess[i]
      seenLetters.add(ch)
      const p = step.pattern[i]
      if (!counts[ch]) counts[ch] = { g: 0, y: 0, b: 0 }
      if (p === 'g') {
        fixed[i] = ch
        counts[ch].g++
        seenAsGY.add(ch)
      } else if (p === 'y') {
        addForbidden(ch, i)
        counts[ch].y++
        seenAsGY.add(ch)
      } else {
        counts[ch].b++
      }
    }
    // Update minCount for letters with g/y
    for (const [ch, tally] of Object.entries(counts)) {
      const need = tally.g + tally.y
      if (need > 0) {
        minCount.set(ch, Math.max(minCount.get(ch) ?? 0, need))
      } else {
        // record black-only sighting
        seenAsB.set(ch, (seenAsB.get(ch) ?? 0) + tally.b)
      }
    }
  }
  const excluded = new Set<string>()
  for (const [ch, bCount] of seenAsB.entries()) {
    if (!seenAsGY.has(ch)) excluded.add(ch)
  }
  return { fixed, forbiddenPos, minCount, excluded, prevGuesses, seenLetters }
}

function fitsConstraints(word: string, c: Constraints): boolean {
  word = word.toLowerCase()
  // Fixed positions
  for (let i = 0; i < 5; i++) {
    if (c.fixed[i] && word[i] !== c.fixed[i]) return false
  }
  // Forbidden positions for yellows
  for (const [ch, set] of c.forbiddenPos.entries()) {
    for (const idx of set) {
      if (word[idx] === ch) return false
    }
  }
  // Excluded letters
  for (const ch of c.excluded) {
    if (word.includes(ch)) return false
  }
  // Minimum counts for letters known present
  const wCount: Record<string, number> = {}
  for (const ch of word) wCount[ch] = (wCount[ch] ?? 0) + 1
  for (const [ch, need] of c.minCount.entries()) {
    if ((wCount[ch] ?? 0) < need) return false
  }
  return true
}

let LETTER_FREQ: Map<string, number> | null = null
function getLetterFreq(): Map<string, number> {
  if (LETTER_FREQ) return LETTER_FREQ
  const freq = new Map<string, number>()
  for (const w of runtimeAllowed) {
    const set = new Set(w)
    for (const ch of set) freq.set(ch, (freq.get(ch) ?? 0) + 1)
  }
  LETTER_FREQ = freq
  return freq
}

function scoreExploration(word: string, c: Constraints): number {
  const freq = getLetterFreq()
  let score = 0
  const used = new Set<string>()
  for (const ch of word) {
    if (used.has(ch)) continue
    used.add(ch)
    // prioritize unseen letters to maximize information
    const bonus = c.seenLetters.has(ch) ? 0.25 : 1
    score += (freq.get(ch) ?? 0) * bonus
  }
  // slight penalty if we've already guessed this word (should be filtered out anyway)
  if (c.prevGuesses.has(word)) score -= 1000
  return score
}

// Detailed scoring breakdown used for debugging and explanations
export type ScoreBreakdown = {
  word: string
  entropy: number
  coverage: number
  newLetterBonus: number
  positional: number
  penalty: number
  score: number
  constraints: {
    fixed: (string | null)[]
    forbiddenPos: Array<[string, number[]]>
    minCount: Array<[string, number]>
    excluded: string[]
  }
}

function scoreWordWithConstraints(word: string, candidates: string[], constraints: Constraints): ScoreBreakdown {
  const entropy = entropyForGuess(word, candidates)
  const requiredLetters = [...constraints.minCount.keys()].filter(l => !constraints.excluded.has(l))
  const letters = word.split('')
  const unique = new Set(letters)
  const coverage = requiredLetters.length === 0 ? 0 : requiredLetters.filter(r => unique.has(r)).length / requiredLetters.length
  let newLetterBonus = 0
  for (const ch of unique) if (!constraints.seenLetters.has(ch)) newLetterBonus += 1
  let positional = 0
  for (let i = 0; i < 5; i++) {
    const ch = word[i]
    if (constraints.fixed[i] && constraints.fixed[i] === ch) positional += 0.6
    const forb = constraints.forbiddenPos.get(ch)
    if (requiredLetters.includes(ch) && !(forb && forb.has(i))) positional += 0.15
  }
  let penalty = 0
  for (const ch of unique) if (constraints.excluded.has(ch)) penalty += 1.5
  if (unique.size < letters.length) penalty += 0.4
  const score = entropy + coverage * 1.1 + newLetterBonus * 0.2 + positional - penalty
  return {
    word,
    entropy,
    coverage,
    newLetterBonus,
    positional,
    penalty,
    score,
    constraints: {
      fixed: [...constraints.fixed],
      forbiddenPos: Array.from(constraints.forbiddenPos.entries()).map(([k,v]) => [k, Array.from(v.values())] as [string, number[]]),
      minCount: Array.from(constraints.minCount.entries()),
      excluded: Array.from(constraints.excluded.values()),
    }
  }
}

export function computePickDetails(word: string, candidates: string[], history: GuessResult[]): ScoreBreakdown {
  const constraints = deriveConstraints(history)
  return scoreWordWithConstraints(word, candidates, constraints)
}

function fallbackExplorationGuess(history: GuessResult[]): string {
  const c = deriveConstraints(history)
  // filter allowed by constraints and not previously guessed
  const pool = runtimeAllowed.filter(w => !c.prevGuesses.has(w) && fitsConstraints(w, c))
  if (pool.length === 0) {
    // as last resort, pick a high-coverage word not used yet and not containing excluded letters
    const alt = runtimeAllowed
      .filter(w => !c.prevGuesses.has(w) && !w.split('').some(ch => c.excluded.has(ch)))
      .sort((a,b) => scoreExploration(b, c) - scoreExploration(a, c))
    return (alt[0] ?? 'raise')
  }
  // score by letter coverage frequency
  pool.sort((a,b) => scoreExploration(b, c) - scoreExploration(a, c))
  return pool[0]
}

export function solve(answer?: string): SolveSummary {
  const theAnswer = (answer ?? runtimeAnswers[Math.floor(Math.random() * runtimeAnswers.length)]).toLowerCase()
  const steps: GuessResult[] = []
  let candidates = runtimeAnswers.slice()
  for (let turn = 0; turn < 6; turn++) { // Wordle allows 6 tries
    const guess = (turn === 0 ? 'roate' : pickNextGuess(candidates, steps)).toLowerCase()
    const pattern = scorePattern(guess, theAnswer)
    const remainingCandidates = filterCandidates([...steps, { guess, pattern, remaining: 0 }])
    const result: GuessResult = { guess, pattern, remaining: remainingCandidates.length }
    steps.push(result)
    if (guess.toLowerCase() === theAnswer) {
      return { success: true, answer: theAnswer, steps }
    }
    candidates = remainingCandidates
  }
  return { success: false, answer: theAnswer, steps }
}
