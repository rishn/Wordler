import express from 'express'
import cors from 'cors'
import { chromium, Browser, Page } from 'playwright'
import { createHash } from 'crypto'
// Backend-local solver (moved from frontend to avoid rootDir compile errors)
import { ANSWERS, ALLOWED, filterCandidates, pickNextGuess, patternToKey, computePickDetails } from './lib/solver'
import type { GuessResult, Pattern, PatternChar } from './lib/wordleTypes'

const app = express()
// Allow CORS for client (Firebase Hosting) and local dev
const allowedOrigin = process.env.CORS_ORIGIN || '*'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json())

/**
 * The type `SolveResponse` represents the response object for a solving operation, including success
 * status, answer, steps, logs, and error message.
 * @property {boolean} success - This property indicates whether the solving process was successful or
 * not. If the value is `true`, it means the problem was solved successfully.
 * @property {string} answer - The `answer` property in the `SolveResponse` type represents the
 * solution to a problem or puzzle. It is a string that contains the answer to the problem if it was
 * successfully solved.
 * @property {GuessResult[]} steps - The `steps` property in the `SolveResponse` type represents an
 * array of `GuessResult` objects. Each `GuessResult` object likely contains information about a step
 * taken to solve a problem or reach a solution.
 * @property {string[]} logs - The `logs` property in the `SolveResponse` type represents an array of
 * strings that can be used to store any relevant information or messages during the solving process.
 * These strings can be used for debugging, tracking the steps taken, or providing additional context
 * about the solving process.
 * @property {string} error - The `error` property in the `SolveResponse` type is an optional string
 * that can be used to provide information about any errors that occurred during the solving process.
 * If there are no errors, this property may not be present in the response object.
 */
type SolveResponse = {
  success: boolean
  answer?: string
  steps: GuessResult[]
  logs: string[]
  error?: string
}

// Simple health check for uptime pings and client readiness
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nyt-solver', timestamp: Date.now() })
})

// Canonical word list endpoints for frontend lazy-loading
app.get('/wordlists/answers.json', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.json(ANSWERS)
})

/* The below code is setting the Cache-Control header for the response to allow caching of the
`/wordlists/allowed.json` endpoint. The Cache-Control header specifies caching directives for both
the client and intermediary caches along the request/response chain. In this case, the Cache-Control
header is set to allow public caching with a maximum age of 86400 seconds (1 day) for both the
client and shared caches (s-maxage). The response is then sent as JSON data containing the contents
of the `ALLOWED` variable. */
app.get('/wordlists/allowed.json', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.json(ALLOWED)
})

/* The above TypeScript code snippet defines a route in an Express application that responds to GET
requests to '/wordlists/meta.json'. When a request is made to this endpoint, the server will respond
with a JSON object containing metadata about word lists. */
app.get('/wordlists/meta.json', (_req, res) => {
  const answersStr = JSON.stringify(ANSWERS)
  const allowedStr = JSON.stringify(ALLOWED)
  const answersSha = createHash('sha256').update(answersStr).digest('hex')
  const allowedSha = createHash('sha256').update(allowedStr).digest('hex')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.json({
    version: process.env.WORDLISTS_VERSION || 'v1',
    answers: { count: ANSWERS.length, sha256: answersSha },
    allowed: { count: ALLOWED.length, sha256: allowedSha },
    generatedAt: Date.now()
  })
})

// Streaming (SSE) NYT solve endpoint for live grid/log updates
app.get('/api/nyt-sse', async (req, res) => {
  // Setup Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  let browser: Browser | null = null
  let page: Page | null = null
  let closed = false
  const safeClose = async () => {
    if (closed) return
    closed = true
    try { await browser?.close() } catch {}
    res.write('\n')
    res.end()
  }
  req.on('close', () => { safeClose() })

  const log = (msg: string) => {
    console.log('[SSE]', msg)
    send('log', { message: msg, ts: Date.now() })
  }

  try {
    const headless = true
    log(`Launching browser (headless=${headless})`)
    browser = await chromium.launch({ headless })
  // Use a fresh incognito context to avoid persisted state
  // Force timezone to Eastern (NYT uses ET for daily puzzle boundaries) and locale to en-US
  const context = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-US' })
    page = await context.newPage()
    log('Opening NYT Wordle')
    await page.goto('https://www.nytimes.com/games/wordle/index.html', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    // Clear service workers, storages, and caches to avoid stale puzzles, then reload
    await page.evaluate(async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) await reg.unregister();
        }
      } catch {}
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
      try {
        if (('caches' in window) && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch {}
    })
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {})

    await clickPlayIfPresent(page, log)
    await closeIntroModalIfPresent(page, log)

    try {
      const board = page.locator('div[class^="Board-module_board__"]')
      await board.waitFor({ state: 'visible', timeout: 10000 })
      await board.click().catch(()=>{})
    } catch {
      try { await page.click('body', { timeout: 2000 }) } catch {}
    }

    let steps: GuessResult[] = []
    let candidates = ANSWERS.slice()
    const blocked = new Set<string>()
    const selectGuess = (): string => {
      let g = pickNextGuess(candidates, steps)
      if (blocked.has(g)) {
        const pool = [
          ...candidates.slice(0, 150),
          ...ALLOWED.slice(0, 300)
        ]
        const unique: string[] = []
        const seen = new Set<string>()
        for (const w of pool) if (!seen.has(w)) { seen.add(w); unique.push(w) }
        const scored = unique
          .filter(w => !blocked.has(w))
          .map(w => computePickDetails(w, candidates, steps))
          .sort((a,b) => b.score - a.score)
        if (scored.length) g = scored[0].word
      }
      return g
    }

    const maxTries = 6
    send('init', { maxTries })

    for (let turn = 0; turn < maxTries; turn++) {
      const guess = (turn === 0 ? 'roate' : selectGuess()).toLowerCase()
      const { accepted, reason } = await submitGuess(page, guess, turn)
      if (!accepted) {
        blocked.add(guess)
        log(`Guess "${guess}" not accepted (${reason || 'unknown'}). Selecting alternative...`)
        turn--
        continue
      }
      const pattern = await readPatternForRow(page, turn)
      const remaining = filterCandidates([...steps, { guess, pattern, remaining: 0 }]).length
      const step: GuessResult = { guess, pattern, remaining }
      steps = [...steps, step]
      send('step', step)
      if (patternToKey(pattern) === 'ggggg') {
        log('Solved!')
        send('complete', { success: true, answer: guess, steps })
        await safeClose()
        return
      }
      if (remaining === 0) {
        log('Candidate list exhausted (truncated list likely).')
      }
      candidates = filterCandidates(steps)
    }
    send('complete', { success: false, error: 'Max tries reached', steps })
    await safeClose()
  } catch (err: any) {
    send('error', { message: err?.message || String(err) })
    await safeClose()
  }
})

// app.get('/api/nyt-solve', async (req, res) => {
//   const logs: string[] = []
//   function log(msg: string) { logs.push(msg); console.log(msg) }
//   let browser: Browser | null = null
//   let page: Page | null = null
//   try {
//     const headless = true
//     log(`Launching browser (headless=${headless})...`)
//     browser = await chromium.launch({ headless })
//   // Fresh context per run to avoid stale service worker or storage
//   // Force timezone to Eastern (NYT uses ET for daily puzzle boundaries) and locale to en-US
//   const context = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-US' })
//     page = await context.newPage()
//     log('Opening NYT Wordle...')
//     await page.goto('https://www.nytimes.com/games/wordle/index.html', { waitUntil: 'domcontentloaded' })
//     await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

//     // Clear SW, storage, and caches to force today's puzzle
//     await page.evaluate(async () => {
//       try {
//         if ('serviceWorker' in navigator) {
//           const regs = await navigator.serviceWorker.getRegistrations();
//           for (const reg of regs) await reg.unregister();
//         }
//       } catch {}
//       try { localStorage.clear(); sessionStorage.clear(); } catch {}
//       try {
//         if (('caches' in window) && caches.keys) {
//           const keys = await caches.keys();
//           await Promise.all(keys.map(k => caches.delete(k)));
//         }
//       } catch {}
//     })
//     await page.reload({ waitUntil: 'networkidle' }).catch(() => {})

//     // 1) Click the big Play button if present
//     await clickPlayIfPresent(page, log)

//     // 2) Close intro modal if it pops up
//     await closeIntroModalIfPresent(page, log)

//     // 3) Ensure the board is visible and focused so we can type right away
//     try {
//       const board = page.locator('div[class^="Board-module_board__"]')
//       await board.waitFor({ state: 'visible', timeout: 10000 })
//       await board.click().catch(()=>{})
//     } catch {
//       try { await page.click('body', { timeout: 2000 }) } catch {}
//     }

//     // Try to dismiss modals/popups and GDPR overlays
//     try {
//       // Close help modal or privacy prompts
//       await page.waitForTimeout(1000)
//       const closeButtonsGlobal = [
//         'button:has-text("Continue")',
//         'button:has-text("Play")',
//         'button:has-text("Got it")',
//         'button[aria-label="Close"]',
//         '[data-testid="gdpr-accept"]',
//         'button:has-text("I Agree")',
//       ]
//       for (const sel of closeButtonsGlobal) {
//         const btn = page.locator(sel)
//         if (await btn.count()) { await btn.first().click().catch(() => {}) }
//       }
//         // Specifically try data-testid Play again if it appeared after animations
//         const playAgain = page.locator('button[data-testid="Play"]')
//         if (await playAgain.isVisible().catch(()=>false)) {
//             log('Clicking Play button again...')
//             await playAgain.click().catch(()=>{})
//         }
//       // Try explicit close icon inside the modal class
//       const modalClose = page.locator('button.Modal-module_closeIcon__TcEKb[aria-label="Close"], button[class*="Modal-module_closeIcon"][aria-label="Close"]')
//       if (await modalClose.isVisible().catch(()=>false)) {
//         log('Closing intro modal via modal close icon...')
//         await modalClose.click().catch(()=>{})
//       }
//       // Try inside game-app shadow
//       const inAppButtons = page.locator('game-app').locator('button:has-text("Play"), button[aria-label="Close"]')
//       if (await inAppButtons.count()) { await inAppButtons.first().click().catch(()=>{}) }
//       // Also try clicking close inside shadow roots common for intro modal
//       await page.keyboard.press('Escape').catch(() => {})
//     } catch {}

//   // Ensure the game has focus (click somewhere on the page)
//   try { await page.click('body', { timeout: 2000 }) } catch {}

//     // Solver loop driven by observed patterns
//     let steps: GuessResult[] = []
//     let candidates = ANSWERS.slice()
//     const blocked = new Set<string>() // words rejected by game or failed to type
//     const selectGuess = (): string => {
//       // Prefer solver's pick; if it is blocked, choose best alternative using solver scoring
//       let g = pickNextGuess(candidates, steps)
//       if (blocked.has(g)) {
//         const pool = [
//           ...candidates.slice(0, 150),
//           ...ALLOWED.slice(0, 300)
//         ]
//         const unique: string[] = []
//         const seen = new Set<string>()
//         for (const w of pool) if (!seen.has(w)) { seen.add(w); unique.push(w) }
//         const scored = unique
//           .filter(w => !blocked.has(w))
//           .map(w => computePickDetails(w, candidates, steps))
//           .sort((a,b) => b.score - a.score)
//         if (scored.length) g = scored[0].word
//       }
//       return g
//     }
//     const maxTries = 6
//     for (let turn = 0; turn < maxTries; turn++) {
//       // Choose guess using current solver and lists; avoid previously blocked words
//       const guess = (turn === 0 ? 'roate' : selectGuess()).toLowerCase()
//       // Type with focus and verify letters; retry small number of times
//       const { accepted, reason } = await submitGuess(page, guess, turn)
//       if (!accepted) {
//         blocked.add(guess)
//         log(`Guess "${guess}" was not accepted (${reason || 'unknown'}). Trying alternative...`)
//         turn-- // do not advance row if nothing accepted
//         continue
//       }
//       const pattern = await readPatternForRow(page, turn)
//       const remaining = filterCandidates([...steps, { guess, pattern, remaining: 0 }]).length
//       steps.push({ guess, pattern, remaining })
//       // Skip detailed feedback/candidate logs; shown in UI grid instead.
//       if (remaining === 0 && patternToKey(pattern) !== 'ggggg') {
//         log('Candidate list exhausted before solve. Likely the actual answer is not in the current truncated word list. Add full Wordle answer list for best results.')
//       }
//       if (patternToKey(pattern) === 'ggggg') {
//         log('Solved!')
//         const answer = guess
//         await browser.close()
//         return res.json({ success: true, answer, steps, logs } as SolveResponse)
//       }
//       candidates = filterCandidates(steps)
//     }
//     await browser.close()
//     return res.json({ success: false, steps, logs, error: 'Max tries reached' } as SolveResponse)
//   } catch (e: any) {
//     console.error(e)
//     if (browser) await browser.close().catch(() => {})
//     return res.status(500).json({ success: false, steps: [], logs, error: e?.message || String(e) } as SolveResponse)
//   }
// })

/**
 * The function `ensureFocusAndClearRow` in TypeScript ensures focus on a specific row on a page and
 * clears any lingering letters in that row by pressing the Backspace key multiple times.
 * @param {Page} page - The `page` parameter is an object that represents a page in a browser. It is
 * typically provided by a browser automation library like Puppeteer or Playwright and is used to
 * interact with the web page, navigate, click elements, type text, etc.
 * @param {number} rowIndex - The `rowIndex` parameter represents the index of the row that needs to be
 * focused and cleared in the function `ensureFocusAndClearRow`.
 */
async function ensureFocusAndClearRow(page: Page, rowIndex: number) {
  try {
    const board = page.locator('div[class^="Board-module_board__"]')
    await board.click({ timeout: 2000 }).catch(()=>{})
  } catch {}
  // Press Backspace a few times to clear any lingering letters in the active row
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Backspace').catch(()=>{})
    await page.waitForTimeout(10)
  }
}

/**
 * The function `getRowLetters` retrieves the first five letters of a specified row on a game board
 * using asynchronous JavaScript in a TypeScript environment.
 * @param {Page} page - The `page` parameter is a reference to the webpage where the function will be
 * executed. It is of type `Page`, which likely represents a Puppeteer Page object used for web
 * scraping or automation.
 * @param {number} rowIndex - The `rowIndex` parameter is the index of the row on the game board from
 * which you want to retrieve the letters. It is used to identify the specific row whose letters you
 * want to extract.
 * @returns The function `getRowLetters` returns a Promise that resolves to an array of strings
 * representing the letters in the specified row of a game board.
 */
async function getRowLetters(page: Page, rowIndex: number): Promise<string[]> {
  const letters = await page.evaluate((idx) => {
    const board = document.querySelector('div[class^="Board-module_board__"]')
    if (!board) return [] as string[]
    const rows = board.querySelectorAll('div[role="group"][aria-label^="Row "]')
    const row = rows[idx] as HTMLElement
    if (!row) return [] as string[]
    const tiles = row.querySelectorAll('div[data-testid="tile"]')
    const chars: string[] = []
    tiles.forEach(t => chars.push((t.textContent || '').trim().toLowerCase().slice(0,1)))
    return chars.slice(0,5)
  }, rowIndex).catch(()=>[] as string[])
  return letters
}

/**
 * The function `waitForToast` in TypeScript asynchronously checks for common rejection toasts on a web
 * page using specified selectors and returns the text content of the toast if found within a specified
 * time limit.
 * @param {Page} page - The `page` parameter in the `waitForToast` function is an instance of a
 * Puppeteer `Page` object. This object represents a single tab or window in a browser controlled by
 * Puppeteer. It provides methods to interact with the page's content, such as querying for elements,
 * clicking on elements
 * @returns The `waitForToast` function returns a Promise that resolves to a string (the text content
 * of the visible toast message) or `null` if no toast message is found within the specified time
 * frame.
 */
async function waitForToast(page: Page): Promise<string | null> {
  // Check for common rejection toasts
  const selectors = [
    'div[role="alert"]',
    'div[class*="Toast"]',
    'div:has-text("Not in word list")',
    'div:has-text("Not enough letters")',
    'div:has-text("Invalid word")'
  ]
  const end = Date.now() + 1500
  while (Date.now() < end) {
    for (const sel of selectors) {
      const loc = page.locator(sel)
      if (await loc.isVisible().catch(()=>false)) {
        const txt = (await loc.first().textContent().catch(()=>'')) || ''
        if (txt.trim()) return txt.trim()
      }
    }
    await page.waitForTimeout(100)
  }
  return null
}

/**
 * This TypeScript function submits a guess on a page, verifies the input, and returns whether the
 * guess was accepted along with a reason if it was rejected.
 * @param {Page} page - The `page` parameter in the `submitGuess` function is typically a reference to
 * the Puppeteer Page object. This object represents a single tab or window in a browser controlled by
 * Puppeteer and provides methods to interact with the page's content.
 * @param {string} guess - The `guess` parameter in the `submitGuess` function is a string that
 * represents the user's input or guess for a particular row in a game or application. It is the value
 * that the user is trying to submit or enter into the specified row.
 * @param {number} rowIndex - The `rowIndex` parameter in the `submitGuess` function refers to the
 * index of the row where the guess will be submitted. This index is used to interact with the specific
 * row on the page, such as focusing on it, clearing it, typing the guess slowly, and verifying the
 * letters placed
 * @returns The function `submitGuess` returns a Promise that resolves to an object with properties
 * `accepted` (a boolean indicating whether the guess was accepted) and `reason` (a string providing a
 * reason if the guess was not accepted).
 */
async function submitGuess(page: Page, guess: string, rowIndex: number): Promise<{ accepted: boolean; reason?: string }> {
  // Focus and clear
  await ensureFocusAndClearRow(page, rowIndex)
  // Type slowly and verify letters
  for (const ch of guess) {
    await page.keyboard.type(ch)
    await page.waitForTimeout(25)
  }
  // Verify letters placed
  const letters = await getRowLetters(page, rowIndex)
  if (letters.join('') !== guess) {
    // Retry once
    await ensureFocusAndClearRow(page, rowIndex)
    for (const ch of guess) {
      await page.keyboard.type(ch)
      await page.waitForTimeout(25)
    }
  }
  // Submit
  await page.keyboard.press('Enter')
  // If rejected, a toast usually appears; detect quickly
  const toast = await waitForToast(page)
  if (toast && /not in word list|not enough letters|invalid/i.test(toast)) {
    return { accepted: false, reason: toast }
  }
  return { accepted: true }
}

async function readPatternForRow(page: Page, rowIndex: number): Promise<Pattern> {
  /* New NYT layout (no direct game-row/game-tile elements visible to us here, instead CSS modules):
     <div class="Board-module_board__...">
        <div class="Row-module_row__..." role="group" aria-label="Row 1">
           <div><div class="Tile-module_tile__..." data-state="empty|tbd|correct|present|absent" data-testid="tile"></div></div>
        </div>
     We attempt in this order:
       1. CSS-module board/row/tile structure.
       2. Legacy custom element shadow DOM (fallback if layout reverts or A/B test).
  */

  const pattern = await tryBoardCssModulePattern(page, rowIndex)
  if (pattern) return pattern
  const legacy = await tryLegacyShadowDomPattern(page, rowIndex)
  if (legacy) return legacy
  // If neither worked, return all 'b' but this indicates failure; caller logs will show.
  return ['b','b','b','b','b']
}

/**
 * The function `tryBoardCssModulePattern` in TypeScript asynchronously checks and retrieves the
 * pattern of tiles on a game board based on their states.
 * @param {Page} page - The `page` parameter in the `tryBoardCssModulePattern` function is a reference
 * to the Puppeteer Page object. Puppeteer is a Node library which provides a high-level API to control
 * headless Chrome or Chromium over the DevTools Protocol. The `page` object represents a single tab or
 * @param {number} rowIndex - The `rowIndex` parameter in the `tryBoardCssModulePattern` function
 * represents the index of the row within a board that the function is targeting. It is used to
 * identify and interact with a specific row on the game board.
 * @returns The function `tryBoardCssModulePattern` returns a Promise that resolves to either a
 * `Pattern` array or `null`.
 */
async function tryBoardCssModulePattern(page: Page, rowIndex: number): Promise<Pattern | null> {
  const success = await page.waitForFunction((idx) => {
    const board = document.querySelector('div[class^="Board-module_board__"]')
    if (!board) return false
    const rows = board.querySelectorAll('div[role="group"][aria-label^="Row "]')
    if (rows.length <= idx) return false
    const row = rows[idx] as HTMLElement
    const tiles = row.querySelectorAll('div[data-testid="tile"]')
    if (tiles.length < 5) return false
    // We need the letters to have been entered first: data-state shifts from empty -> tbd -> evaluation states
    // Wait until all 5 tiles have left 'empty'
    return Array.from(tiles).every(t => t.getAttribute('data-state') && t.getAttribute('data-state') !== 'empty')
  }, rowIndex, { timeout: 15000 }).catch(() => false)
  if (!success) return null

  // After Enter, evaluation animation: we wait until states are final (correct/present/absent) OR timeout.
  await page.waitForFunction((idx) => {
    const board = document.querySelector('div[class^="Board-module_board__"]')
    if (!board) return false
    const rows = board.querySelectorAll('div[role="group"][aria-label^="Row "]')
    const row = rows[idx] as HTMLElement
    if (!row) return false
    const tiles = row.querySelectorAll('div[data-testid="tile"]')
    if (tiles.length < 5) return false
    const finals = ['correct','present','absent']
    const states = Array.from(tiles).map(t=> t.getAttribute('data-state')||'')
    // Accept if all tiles are in a final state
    return states.every(s => finals.includes(s))
  }, rowIndex, { timeout: 8000 }).catch(()=>{})

  const states = await page.evaluate((idx) => {
    const board = document.querySelector('div[class^="Board-module_board__"]')!
    const rows = board.querySelectorAll('div[role="group"][aria-label^="Row "]')
    const row = rows[idx] as HTMLElement
    const tiles = row.querySelectorAll('div[data-testid="tile"]')
    const finals = [] as string[]
    tiles.forEach(t => finals.push((t.getAttribute('data-state')||'').toLowerCase()))
    return finals.slice(0,5)
  }, rowIndex)
  if (states.length < 5) return null
  const mapped: Pattern = states.map(s => s === 'correct' ? 'g' : s === 'present' ? 'y' : s === 'absent' ? 'b' : 'b') as Pattern
  return mapped
}

/**
 * This TypeScript function uses Puppeteer to interact with a web page and extract a pattern from a
 * legacy Shadow DOM structure.
 * @param {Page} page - The `page` parameter in the `tryLegacyShadowDomPattern` function is a reference
 * to the Puppeteer Page object. Puppeteer is a Node library which provides a high-level API to control
 * headless Chrome or Chromium over the DevTools Protocol. The `page` object represents a single tab or
 * @param {number} rowIndex - The `rowIndex` parameter in the `tryLegacyShadowDomPattern` function
 * represents the index of the row within the game app that you want to interact with. It is used to
 * locate and evaluate the tiles within that specific row in the game.
 * @returns The function `tryLegacyShadowDomPattern` returns a Promise that resolves to either a
 * `Pattern` object or `null`.
 */
async function tryLegacyShadowDomPattern(page: Page, rowIndex: number): Promise<Pattern | null> {
  const ok = await page.waitForFunction((idx) => {
    const app = document.querySelector('game-app') as any
    if (!app) return false
    const root = app.shadowRoot
    if (!root) return false
    const rows = root.querySelectorAll('game-row')
    return rows.length > idx
  }, rowIndex, { timeout: 3000 }).catch(()=>false)
  if (!ok) return null
  const evalOk = await page.waitForFunction((idx) => {
    const app = document.querySelector('game-app') as any
    const root = app?.shadowRoot
    if (!root) return false
    const rows = root.querySelectorAll('game-row') as any
    const row = rows[idx]
    const rroot = row?.shadowRoot
    if (!rroot) return false
    const tiles = rroot.querySelectorAll('game-tile')
    if (tiles.length < 5) return false
    const arr = Array.from(tiles as any) as Element[]
    return arr.every((t) => {
      const s = (t.getAttribute('evaluation') || t.getAttribute('data-state') || '')
      return !!s
    })
  }, rowIndex, { timeout: 8000 }).catch(()=>false)
  if (!evalOk) return null
  const states = await page.evaluate((idx) => {
    const app = document.querySelector('game-app') as any
    const root = app.shadowRoot
    const rows = root.querySelectorAll('game-row') as any
    const row = rows[idx]
    const rroot = row.shadowRoot
    const tiles = rroot.querySelectorAll('game-tile')
    const result: string[] = []
    for (let i=0;i<5;i++) {
      const t = tiles[i] as Element
      const s = (t.getAttribute('evaluation') || t.getAttribute('data-state') || '').toLowerCase()
      result.push(s)
    }
    return result
  }, rowIndex)
  return states.map(s => s === 'correct' ? 'g' : s === 'present' ? 'y' : s === 'absent' ? 'b' : 'b') as Pattern
}

/**
 * The function `clickPlayIfPresent` attempts to find and click the Play button on a webpage within a
 * specified time frame using different selectors.
 * @param {Page} page - The `page` parameter in the `clickPlayIfPresent` function is typically an
 * instance of a Puppeteer Page object. This object represents a single tab or window in a browser
 * controlled by Puppeteer and provides methods to interact with the page's content. You can use
 * methods like `page.locator
 * @param log - The `log` parameter in the `clickPlayIfPresent` function is a function that takes a
 * single string parameter `m`. This function is used to log messages or information during the
 * execution of the function. It allows the function to provide feedback or report on its progress,
 * such as when attempting to
 * @returns The `clickPlayIfPresent` function returns `undefined`.
 */
async function clickPlayIfPresent(page: Page, log: (m:string)=>void) {
  // Try for a few seconds to find and click the Play button
  const end = Date.now() + 8000
  const selectors = [
    'button[data-testid="Play"]',
    'button:has-text("Play")',
    'button[class*="Welcome-module_button__"]',
  ]
  while (Date.now() < end) {
    for (const sel of selectors) {
      const btn = page.locator(sel)
      if (await btn.isVisible().catch(()=>false)) {
        log(`Clicking Play via selector: ${sel}`)
        await btn.click({ trial: false }).catch(()=>{})
        await page.waitForTimeout(300)
        return
      }
    }
    await page.waitForTimeout(250)
  }
  log('Play button not found (continuing)...')
}

/**
 * The function `closeIntroModalIfPresent` attempts to close an intro modal on a web page using various
 * selectors and keyboard commands within a specified time limit.
 * @param {Page} page - The `page` parameter in the `closeIntroModalIfPresent` function is typically an
 * instance of a Puppeteer `Page` object. This object represents a single tab or window in a browser
 * controlled by Puppeteer and provides methods to interact with the page's content.
 * @param log - The `log` parameter in the `closeIntroModalIfPresent` function is a function that takes
 * a string as an argument and logs that string. It is used to provide logging information within the
 * function for debugging or tracking purposes.
 * @returns The `closeIntroModalIfPresent` function returns nothing (`undefined`) explicitly, as there
 * is no `return` statement outside of the loop in the function.
 */
async function closeIntroModalIfPresent(page: Page, log: (m:string)=>void) {
  // The intro modal may appear after clicking Play; try to close it.
  const end = Date.now() + 8000
  const selectors = [
    'button.Modal-module_closeIcon__TcEKb[aria-label="Close"]',
    'button[class*="Modal-module_closeIcon"][aria-label="Close"]',
    'button[aria-label="Close"]:has(svg[data-testid="icon-close"])',
  ]
  while (Date.now() < end) {
    for (const sel of selectors) {
      const btn = page.locator(sel)
      if (await btn.isVisible().catch(()=>false)) {
        log(`Closing intro modal via selector: ${sel}`)
        await btn.click().catch(()=>{})
        await page.waitForTimeout(300)
        return
      }
    }
    await page.keyboard.press('Escape').catch(()=>{})
    await page.waitForTimeout(250)
  }
}

/* The below code is setting up a server to listen on a specified port. It first checks if there is a
port specified in the environment variables, and if so, it uses that port. Otherwise, it defaults to
port 4000. Once the server is set up to listen on the specified port, it logs a message indicating
that the NYT Solver API is now listening on that port. */
const port = process.env.PORT ? Number(process.env.PORT) : 4000
app.listen(port, () => {
  console.log(`NYT Solver API listening on http://localhost:${port}`)
})