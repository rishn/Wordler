export type PatternChar = 'g' | 'y' | 'b'
export type Pattern = PatternChar[] // length 5

export interface GuessResult {
  guess: string
  pattern: Pattern
  remaining: number
}

export interface SolveSummary {
  success: boolean
  answer: string
  steps: GuessResult[]
}
