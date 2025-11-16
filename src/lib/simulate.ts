import { ANSWERS, filterCandidates, pickNextGuess } from './solver'
import type { GuessResult, Pattern, PatternChar, SolveSummary } from './wordleTypes'

function compareGuess(guessRaw: string, answerRaw: string): Pattern {
  const guess = guessRaw.toLowerCase()
  const answer = answerRaw.toLowerCase()
  const res: PatternChar[] = ['b','b','b','b','b']
  const freq: Record<string, number> = {}
  for (let i = 0; i < 5; i++) freq[answer[i]] = (freq[answer[i]] ?? 0) + 1
  // greens
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) { res[i] = 'g'; freq[guess[i]]!-- }
  }
  // yellows
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'g') continue
    const ch = guess[i]
    if ((freq[ch] ?? 0) > 0) { res[i] = 'y'; freq[ch]!-- }
  }
  return res
}

export function simulate(answer: string): SolveSummary {
  const theAnswer = answer.toLowerCase()
  const steps: GuessResult[] = []
  let candidates = ANSWERS.slice()
  for (let turn = 0; turn < 6; turn++) {
    const rawGuess = (turn === 0 ? 'roate' : pickNextGuess(candidates, steps)) || 'raise'
    const guess = rawGuess.toLowerCase()
    const pattern = compareGuess(guess, theAnswer)
    const remainingCandidates = filterCandidates([...steps, { guess, pattern, remaining: 0 }])
    steps.push({ guess, pattern, remaining: remainingCandidates.length })
    if (guess === theAnswer) return { success: true, answer: theAnswer, steps }
    candidates = remainingCandidates
  }
  return { success: false, answer: theAnswer, steps }
}
