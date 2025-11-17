export type PatternChar = 'g' | 'y' | 'b'
export type Pattern = PatternChar[] // length 5

export interface GuessResult {
  guess: string
  pattern: Pattern
  remaining: number
}

/**
 * Summary of a single Wordle solver attempt.
 *
 * Describes the overall outcome of running the solver against a target word.
 *
 * @property success - True when the solver found the correct answer within the allowed number of guesses; false otherwise.
 * @property answer - The target word that the solver attempted to discover.
 * @property steps - Ordered list of GuessResult entries representing each guess made and the corresponding feedback for that guess.
 *
 * @remarks
 * The GuessResult type is expected to capture the guessed word and per-letter feedback (e.g., correct/close/absent).
 * The steps array reflects the chronological sequence of guesses; it may be empty if no guesses were recorded.
 */
export interface SolveSummary {
  success: boolean
  answer: string
  steps: GuessResult[]
}
