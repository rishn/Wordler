import { ANSWERS, filterCandidates, pickNextGuess } from './solver'
import type { GuessResult, Pattern, PatternChar, SolveSummary } from './wordleTypes'

/**
 * The function `compareGuess` compares a guess with an answer and returns a pattern indicating correct
 * positions with green, and correct colors in wrong positions with yellow.
 * @param {string} guessRaw - The `guessRaw` parameter is a string representing the player's guess in a
 * game. It is converted to lowercase and compared to the `answerRaw` parameter to determine the
 * pattern of the guess. The function then returns an array of characters representing the result of
 * the comparison, with 'g' for
 * @param {string} answerRaw - The `answerRaw` parameter in the `compareGuess` function represents the
 * raw string input of the answer to a guessing game. This string is converted to lowercase and used
 * for comparison with the guess input to determine the pattern of 'b' (blue), 'g' (green), and 'y
 * @returns The function `compareGuess` returns a `Pattern`, which is an array of `PatternChar` values.
 */
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

/**
 * This TypeScript function simulates a guessing game by making guesses based on a given answer and
 * returning a summary of the solving process.
 * @param {string} answer - The `simulate` function takes a string `answer` as input, which represents
 * the answer to be guessed. The function then simulates a guessing game where it tries to guess the
 * answer based on the provided input.
 * @returns The function `simulate` returns a `SolveSummary` object, which contains information about
 * the simulation process. The `SolveSummary` object includes a boolean `success` indicating whether
 * the simulation was successful, the `answer` string that was simulated, and an array of `GuessResult`
 * objects representing the steps taken during the simulation.
 */
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
