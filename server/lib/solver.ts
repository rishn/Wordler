import { GuessResult, Pattern, PatternChar, SolveSummary } from './wordleTypes'
import answers from './data/answers.json'
import allowed from './data/allowed.json'

// Full NYT word lists copied into server/lib/data for parity with frontend solver.
export const ANSWERS: string[] = answers
export const ALLOWED: string[] = allowed

/**
 * The function `scorePattern` compares a guess with an answer and returns a pattern indicating correct
 * positions ('g'), incorrect positions ('y'), or no match ('b').
 * @param {string} guessRaw - The `guessRaw` parameter is a string representing the user's guess for a
 * pattern. It is converted to lowercase and compared to the `answerRaw` parameter to determine the
 * score of the pattern.
 * @param {string} answerRaw - The `answerRaw` parameter in the `scorePattern` function represents the
 * raw string input that contains the correct answer pattern. This pattern is used to compare against
 * the `guessRaw` parameter to determine the score of the guess.
 * @returns The function `scorePattern` returns a `Pattern`, which is an array of `PatternChar`
 * elements.
 */
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

/**
 * The functions provided are used for filtering candidate answers based on consistency with previous
 * guesses and patterns.
 * @param {Pattern} p - Pattern - an array of characters representing a pattern
 * @returns The `filterCandidates` function returns an array of strings that are filtered from the
 * `ANSWERS` array based on whether they are consistent with all the guesses in the `history` array.
 */
export function patternToKey(p: Pattern): string { return p.join('') }
export function consistent(guess: string, pattern: Pattern, candidate: string): boolean {
  return patternToKey(scorePattern(guess, candidate)) === patternToKey(pattern)
}
export function filterCandidates(history: GuessResult[]): string[] {
  return ANSWERS.filter(ans => history.every(h => consistent(h.guess, h.pattern, ans)))
}

/**
 * The function calculates the entropy of a guess based on a list of candidate answers.
 * @param {string} guess - The `guess` parameter is a string representing a guess at a solution or
 * answer. It is used in the `entropyForGuess` function to calculate the entropy based on this guess
 * and a list of candidate answers.
 * @param {string[]} candidates - The `candidates` parameter in the `entropyForGuess` function is an
 * array of strings representing possible answers or guesses. The function calculates the entropy of
 * the guesses based on a given guess and the list of candidates.
 * @returns The function `entropyForGuess` returns the entropy value calculated based on the guess and
 * candidates provided.
 */
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

/**
 * The function `pickNextGuess` selects the best guess from a list of candidates based on entropy
 * calculation.
 * @param {string[]} candidates - An array of strings representing the possible guesses that can be
 * made next in a game or application.
 * @param {GuessResult[]} history - The `history` parameter in the `pickNextGuess` function is an array
 * of `GuessResult` objects. This parameter is used to keep track of the results of previous guesses
 * made by the program. It helps in making informed decisions for the next guess based on the outcomes
 * of previous guesses.
 * @returns The function `pickNextGuess` returns a string, which is either the best guess from the
 * candidates list based on entropy calculation, or the string 'roate' if there is only one candidate
 * left in the list.
 */
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

/**
 * This TypeScript function implements a guessing game algorithm to solve a mystery answer within a
 * limited number of attempts.
 * @param {string} [answer] - The `answer` parameter in the `solve` function is an optional string
 * parameter that represents the correct answer to be guessed. If provided, the function will attempt
 * to solve the answer based on the input. If not provided, a random answer will be selected from a
 * predefined list of possible answers.
 * @returns The `solve` function returns a `SolveSummary` object, which contains information about the
 * outcome of the solving process. The `SolveSummary` object includes a boolean `success` indicating
 * whether the answer was successfully guessed, the correct `answer`, and an array of `steps` that were
 * taken during the solving process.
 */
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

/**
 * The function `computePickDetails` calculates the entropy of a word based on a list of candidates and
 * history of guesses.
 * @param {string} word - The `word` parameter is a string representing the target word that needs to
 * be guessed.
 * @param {string[]} candidates - The `candidates` parameter is an array of strings representing the
 * possible choices or options that can be selected or guessed from.
 * @param {GuessResult[]} history - The `history` parameter is an array of `GuessResult` objects. It
 * likely contains information about previous guesses made during a game or some other process. Each
 * `GuessResult` object may include details such as the guessed word, the number of correct letters,
 * the number of misplaced letters, or any
 * @returns The function `computePickDetails` is returning an object with the properties `word`,
 * `entropy`, and `score`. The `word` property is the input word passed to the function. The `entropy`
 * property is the result of calculating entropy for the input word and candidates. The `score`
 * property is also set to the value of `entropy`, which is provided for compatibility with previous
 * usage.
 */
export function computePickDetails(word: string, candidates: string[], history: GuessResult[]) {
  // Placeholder returning entropy only in backend subset; supply 'score' for compatibility with previous usage.
  const entropy = entropyForGuess(word, candidates)
  return { word, entropy, score: entropy }
}
