import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import AppHeader from '../components/AppHeader'
import { solve, filterCandidates, computePickDetails, setWordLists, getAllowedList, getAnswersList } from '../lib/solver'
import type { GuessResult, SolveSummary } from '../lib/wordleTypes'
import { Link } from 'react-router-dom'
import { simulate } from '../lib/simulate'
import AnimatedGridBackground from '../components/AnimatedGridBackground'
import { useAuth } from '../contexts/AuthContext'
import { saveAttempt, migrateLocalStorageToFirestore } from '../lib/historyService'
import { getWordLists } from '../lib/wordlistLoader'

export default function App() {
  const { user } = useAuth()
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''
  const apiUrl = (path: string) => (API_BASE ? `${API_BASE.replace(/\/$/, '')}${path}` : path)
  const [summary, setSummary] = useState<SolveSummary | null>(null)
  const [running, setRunning] = useState(false)
  const [nytRunning, setNytRunning] = useState(false)
  const [nytLogs, setNytLogs] = useState<string[]>([])
  const [nytResult, setNytResult] = useState<SolveSummary | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [cells, setCells] = useState<string[]>(['','','','',''])
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null])
  const [hasTyped, setHasTyped] = useState(false)
  const [simError, setSimError] = useState<string>('')
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState<SolveSummary | null>(null)
  const nytSourceRef = useRef<EventSource | null>(null)
  const [nytApiAvailable, setNytApiAvailable] = useState<'unknown'|'up'|'down'>('unknown')
  const [nytApiError, setNytApiError] = useState<string>('')

  // Load word lists from backend (with fallback to local)
  useEffect(() => {
    getWordLists()
      .then(({ answers, allowed }) => {
        setWordLists(answers, allowed)
        console.log(`Loaded word lists: ${answers.length} answers, ${allowed.length} allowed`)
      })
      .catch(err => {
        console.warn('Failed to load word lists from backend, using local fallback:', err)
      })
  }, [])

  // Migrate localStorage history on first load
  useEffect(() => {
    if (user) {
      migrateLocalStorageToFirestore(user.uid).catch(console.error)
    }
  }, [user])

  // Lightweight health check for backend (Render may spin down when idle)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        setNytApiAvailable('unknown')
        const resp = await fetch(apiUrl('/api/health'), { method: 'GET' })
        if (!cancelled) setNytApiAvailable(resp.ok ? 'up' : 'down')
      } catch {
        if (!cancelled) setNytApiAvailable('down')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Debug: print decision rationale for each step
  function logDebugSteps(title: string, steps: GuessResult[]) {
    try {
      console.groupCollapsed(title)
      const prev: GuessResult[] = []
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const cands = filterCandidates(prev)
        const d = computePickDetails(step.guess, cands, prev)
        console.groupCollapsed(`#${i + 1} ${step.guess.toUpperCase()} — score ${d.score.toFixed(3)}`)
        console.log('entropy:', d.entropy.toFixed(3))
        console.log('coverage:', d.coverage.toFixed(3))
        console.log('newLetterBonus:', d.newLetterBonus.toFixed(3))
        console.log('positional:', d.positional.toFixed(3))
        console.log('penalty:', d.penalty.toFixed(3))
        console.log('constraints:', d.constraints)
        console.groupEnd()
        prev.push(step)
      }
      console.groupEnd()
    } catch {}
  }

  const clearNyt = () => {
    nytSourceRef.current?.close()
    nytSourceRef.current = null
    setNytResult(null)
    setNytLogs([])
    setNytRunning(false)
  }

  const runSolve = () => {
    setRunning(true)
    setSimResult(null) // Clear simulation result
    clearNyt() // hide NYT
    setTimeout(async () => {
      const res = solve()
      setSummary(res)
      logDebugSteps('Random solve decision breakdown', res.steps)
      // Save to Firestore
      if (user) {
        try {
          await saveAttempt(user.uid, {
            id: Date.now(),
            ts: Date.now(),
            mode: 'random',
            summary: res
          })
        } catch (error) {
          console.error('Error saving to Firestore:', error)
        }
      }
      setRunning(false)
    }, 10)
  }

  const runNytSolve = () => {
    // Clear other UIs
    setSummary(null)
    setSimResult(null)
    setRunning(false)
    // Reset NYT state
    nytSourceRef.current?.close()
    setNytResult({ success: false, answer: '', steps: [] })
    setNytLogs(['Starting NYT solve (live)...'])
    setNytRunning(true)
  const es = new EventSource(apiUrl('/api/nyt-sse'))
    nytSourceRef.current = es
    const steps: GuessResult[] = []
    es.addEventListener('log', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        const msg = simplifyLog(data.message)
        if (msg) setNytLogs(prev => [...prev, msg])
      } catch {}
    })
    es.addEventListener('step', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        // Debug: compute rationale using candidates BEFORE adding this step
        const prev = [...steps]
        const cands = filterCandidates(prev)
        const d = computePickDetails(data.guess, cands, prev)
        console.groupCollapsed(`[NYT] #${steps.length + 1} ${data.guess.toUpperCase()} — score ${d.score.toFixed(3)}`)
        console.log('entropy:', d.entropy.toFixed(3))
        console.log('coverage:', d.coverage.toFixed(3))
        console.log('newLetterBonus:', d.newLetterBonus.toFixed(3))
        console.log('positional:', d.positional.toFixed(3))
        console.log('penalty:', d.penalty.toFixed(3))
        console.log('constraints:', d.constraints)
        console.groupEnd()

        steps.push({ guess: data.guess, pattern: data.pattern, remaining: data.remaining })
        setNytResult({ success: false, answer: '', steps: [...steps] })
      } catch {}
    })
    es.addEventListener('complete', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        if (data.steps) {
          steps.splice(0, steps.length, ...data.steps)
        }
        const success = !!data.success
        const answer = data.answer || (success && steps.length ? steps[steps.length - 1].guess : '') || ''
        const summary: SolveSummary = { success, answer, steps: [...steps] }
        setNytResult(summary)
        // Save to Firestore
        if (user) {
          saveAttempt(user.uid, {
            id: Date.now(),
            ts: Date.now(),
            mode: 'nyt',
            summary
          }).catch(console.error)
        }
      } catch {}
      setNytRunning(false)
      es.close(); nytSourceRef.current = null
    })
    es.addEventListener('error', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        setNytLogs(prev => [...prev, 'Error: ' + data.message])
      } catch {
        setNytLogs(prev => [...prev, 'Stream error'])
      }
      setNytApiError('The NYT solver server may be waking up (free tier). If it just deployed or was idle, it can take ~20–60s to start. Please retry shortly.')
      setNytRunning(false)
      es.close(); nytSourceRef.current = null
    })
  }

  const runSimulate = () => {
    const a = userAnswer.trim().toLowerCase()
    if (!/^[a-z]{5}$/.test(a)) {
      alert('Please enter a valid 5-letter answer (a-z).')
      return
    }
    setSimRunning(true)
    setSimResult(null)
    setSummary(null) // Clear random solve result
    clearNyt()
    setTimeout(async () => {
      const res = simulate(a)
      setSimResult(res)
      logDebugSteps('Simulation decision breakdown', res.steps)
      // Save to Firestore
      if (user) {
        try {
          await saveAttempt(user.uid, {
            id: Date.now(),
            ts: Date.now(),
            mode: 'simulation',
            summary: res
          })
        } catch (error) {
          console.error('Error saving to Firestore:', error)
        }
      }
      setSimRunning(false)
    }, 10)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 flex flex-col relative">
      <AppHeader />
      <div className="pt-[60px]" /> {/* Spacer for fixed header */}
      {/* Animated gradient background layer */}
      <div className="fixed inset-0 top-[316px] bottom-[340px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-20 dark:opacity-15 animate-gradient-flow bg-gradient-to-br from-[#6366F1] via-[#3fa75a] via-[#C9B458] to-[#EC4899] bg-[length:200%_200%]" />
      </div>
      <main className="mx-auto flex-1 w-full flex flex-col relative z-[3]">
        {/* Hero: Today's NYT Solve */}
        <section className="relative bg-slate-50 dark:bg-zinc-800 overflow-hidden">
          {/* Animated grid background - constrained to hero text area */}
          <div className="absolute top-0 left-0 right-0 h-[284px] overflow-hidden">
            <AnimatedGridBackground
              palette={['#6AAA64','#6AAA64','#C9B458','#C9B458','#787C7E','#878A8C']}
              rows={9}
              cols={40}
              opacity={0.40}
              jitter={0.28}
              intervalMs={1600}
              rounded
              blur
            />
          </div>
          {/* Translucent green overlay for results area */}
          {(nytRunning || nytResult) && (
            <div className="absolute inset-0 top-[284px] bg-emerald-600/15 dark:bg-emerald-400/10 z-5" />
          )}
          {/* Backdrop blur for text content */}
          <div className="absolute top-0 left-0 right-0 h-[284px] bg-white/60 dark:bg-zinc-900/20 backdrop-blur-05 z-7" />
          <div className="max-w-4xl mx-auto px-6 py-12 text-center relative z-10">
            <h2 className="text-2xl md:text-3xl font-semibold">Solve Today’s NYT Wordle</h2>
            <p className="mt-2 text-sm md:text-base text-gray-700 dark:text-gray-300">Watch the solver play the official NYT Wordle in real time. We’ll show the board as it updates and a simple status of what’s happening.</p>
            {/* Backend status notice */}
            {nytApiAvailable === 'down' && (
              <div className="mt-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300/60 dark:border-amber-700/60 rounded p-2">
                The NYT solver server seems unavailable right now. On the free tier it may be sleeping and can take ~20–60s to wake up. Try again in a moment.
              </div>
            )}
            <div className="mt-6">
              <button
                onClick={runNytSolve}
                disabled={nytRunning}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 shadow hover:bg-emerald-500 hover:scale-105 transition-all"
                title="Runs a local headless browser to solve today's Wordle"
              >
                {nytRunning ? 'Solving…' : 'Start NYT Solve'}
              </button>
            </div>
            {(nytRunning || nytResult) && (
              <div className="mt-3 flex flex-col items-center gap-6">
                {nytResult && (
                  <div className="text-sm mt-20">
                    {nytRunning ? (
                      <span>Solving…</span>
                    ) : (
                      <span className={nytResult.success ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                        {nytResult.success ? 'Solved:' : 'Failed:'}
                      </span>
                    )}
                    {' '} {nytResult.steps.length} {nytResult.steps.length === 1 ? 'guess' : 'guesses'}
                    <span className="inline-block ml-8"></span>
                    {nytResult.answer ? <> Answer: <span className="font-mono font-bold uppercase">{nytResult.answer}</span></> : null}
                  </div>
                )}
                <div className="flex flex-col md:flex-row items-start justify-center gap-10">
                  <GridDisplay steps={nytResult?.steps || []} variant="nyt" />
                  <CandidatesPanel steps={nytResult?.steps || []} />
                </div>
                {/* Friendly logs */}
                <div className="w-full max-w-2xl mx-auto p-3 rounded border dark:border-zinc-700 max-h-44 overflow-auto text-xs bg-white/60 dark:bg-zinc-800/60 backdrop-blur">
                  {nytLogs.slice(-10).map((l, i) => (
                    <div key={i}>• {l}</div>
                  ))}
                  {nytApiError && (
                    <div className="mt-2 text-amber-700 dark:text-amber-300">{nytApiError}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Spacer to push Random section to bottom when no results */}
        {!summary && !simResult && <div className="flex-1" />}

        {/* Random Solve / Simulation */}
        <section className="relative py-10 bg-slate-50 dark:bg-zinc-800 overflow-hidden">
          {/* Animated grid background - constrained to hero text area */}
          <div className="absolute top-0 left-0 right-0 h-[284px] overflow-hidden">
            <AnimatedGridBackground
              palette={['#6366F1','#6366F1','#6366F1','#EC4899','#EC4899','#EC4899','#787C7E','#878A8C']}
              rows={10}
              cols={42}
              opacity={0.40}
              jitter={0.28}
              intervalMs={1600}
              rounded
              blur
            />
          </div>
          {/* Translucent blue/purple overlay for results area */}
          {(summary || simResult) && (
            <div className="absolute inset-0 top-[284px] bg-indigo-600/15 dark:bg-indigo-400/10 z-5" />
          )}
          {/* Backdrop blur for text content */}
          <div className="absolute top-0 left-0 right-0 h-[284px] bg-white/60 dark:bg-zinc-900/20 backdrop-blur-05 -z-7" />
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="text-2xl md:text-3xl font-semibold">Try a Random or Simulated Solve</h2>
            <p className="mt-2 text-sm md:text-base text-gray-700 dark:text-gray-300">Enter a 5-letter word to simulate the solve, or leave it blank and we’ll pick a random answer.</p>

            {/* Five-letter input + Button */}
            <div className="mt-6 flex flex-col items-center gap-4">
              <FiveLetterInput
                cells={cells}
                setCells={setCells}
                inputsRef={inputsRef}
                setHasTyped={setHasTyped}
                setUserAnswer={(val)=>{ setUserAnswer(val); setSimError('') }}
              />
              {simError && <div className="text-xs text-red-600 dark:text-red-400">{simError}</div>}
              <button
                onClick={() => {
                  const word = cells.join('').toLowerCase()
                  if (!hasTyped || word.length === 0) {
                    runSolve()
                    return
                  }
                  if (word.length < 5) return
                  // validate word
                  const allowed = getAllowedList()
                  const answers = getAnswersList()
                  if (!(allowed.includes(word) || answers.includes(word))) {
                    setSimError('That word is not in the dictionary. Try another common 5-letter word.')
                    return
                  }
                  setUserAnswer(word)
                  runSimulate()
                }}
                disabled={(hasTyped && cells.join('').length < 5) || running || simRunning}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50 shadow hover:bg-indigo-500 hover:scale-105 transition-all"
              >
                {(running || simRunning) ? 'Working…' : hasTyped ? 'Simulate' : 'Random Solve'}
              </button>
            </div>

            {/* Random result */}
            {summary && (
              <div className="mt-10 flex flex-col items-center gap-6">
                <div className="text-sm mt-5">
                  <span className={summary.success ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                    {summary.success ? 'Solved:' : 'Failed:'}
                  </span>
                  {' '} {summary.steps.length} {summary.steps.length === 1 ? 'guess' : 'guesses'} <span className="inline-block ml-8"></span> Answer: <span className="font-mono font-bold uppercase">{summary.answer}</span>
                </div>
                <div className="flex flex-col md:flex-row items-start justify-center gap-10">
                  <GridDisplay steps={summary.steps} variant="other" />
                  <CandidatesPanel steps={summary.steps} />
                </div>
              </div>
            )}

            {/* Simulation result */}
            {simResult && (
              <div className="mt-10 flex flex-col items-center gap-6">
                <div className="text-sm mt-5">
                  <span className={simResult.success ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                    {simResult.success ? 'Solved:' : 'Failed:'}
                  </span>
                  {' '} {simResult.steps.length} {simResult.steps.length === 1 ? 'guess' : 'guesses'} <span className="inline-block ml-8"></span> Answer: <span className="font-mono font-bold uppercase">{simResult.answer}</span>
                </div>
                <div className="flex flex-col md:flex-row items-start justify-center gap-10">
                  <GridDisplay steps={simResult.steps} variant="other" />
                  <CandidatesPanel steps={simResult.steps} />
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 z-50 py-6 text-center text-xs text-gray-600 dark:text-gray-400 bg-[#f5f5f5] dark:bg-[#18181b]">Wordler © 2025</footer>
      <div className="pb-[60px]" /> {/* Spacer for fixed footer */}
    </div>
  )
}

// Simple log mapper to keep messages non-technical
function simplifyLog(msg: string): string | null {
  const m = msg.toLowerCase()
  if (m.includes('clicking play') || m.includes('closing intro modal') || m.includes('selector')) return null
  if (m.includes('launching browser')) return 'Preparing browser…'
  if (m.includes('opening nyt wordle')) return 'Opening Wordle…'
  if (m.includes('not accepted')) return 'That word wasn’t accepted. Trying another...'
  if (m.includes('candidate list exhausted')) return 'Dictionary mismatch detected. Continuing with best effort...'
  if (m.includes('max tries reached')) return 'Couldn’t solve within 6 guesses.'
  return msg
}

function SolveDisplay({ summary }: { summary: SolveSummary }) {
  return (
    <div className="space-y-4">
  <h2 className="text-lg font-semibold">Result: <span className={summary.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{summary.success ? 'Solved' : 'Failed'}</span> in {summary.steps.length} tries</h2>
      <p className="text-sm">Answer: <span className="font-mono font-bold">{summary.answer}</span></p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b dark:border-zinc-700">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Guess</th>
            <th className="py-1 pr-2">Pattern</th>
            <th className="py-1 pr-2">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {summary.steps.map((s: GuessResult, i: number) => (
            <tr key={i} className="border-b dark:border-zinc-800">
              <td className="py-1 pr-2 text-sm">{i + 1}</td>
              <td className="py-1 pr-2 font-mono">{s.guess}</td>
              <td className="py-1 pr-2 font-mono">
                {s.pattern.map((c, idx) => (
                  <span
                    key={idx}
                    className={
                      'inline-block w-6 h-6 text-center rounded text-xs font-bold mr-1 ' +
                      (c === 'g'
                        ? 'bg-green-600 text-white'
                        : c === 'y'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-400 dark:bg-gray-600 text-white')
                    }
                  >
                    {c.toUpperCase()}
                  </span>
                ))}
              </td>
              <td className="py-1 pr-2 text-sm">{s.remaining}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GridDisplay({ steps, variant = 'nyt' }: { steps: GuessResult[]; variant?: 'nyt' | 'other' }) {
  const rows: GuessResult[] = Array.from({ length: 6 }, (_, i) => steps[i] || { guess: '', pattern: ['b','b','b','b','b'], remaining: 0 })
  return (
    <div className="grid gap-2" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
      {rows.map((row, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {Array.from({ length: 5 }, (_, c) => {
            const ch = row.guess?.[c]?.toUpperCase() || ''
            const p = row.guess ? row.pattern[c] : 'b'
            const cls = p === 'g'
              ? (variant === 'nyt' ? 'bg-[#3FA75A] dark:bg-[#2F8A48]' : 'bg-[#5B4FCF] dark:bg-[#4B3FB0]')
              : p === 'y'
              ? (variant === 'nyt' ? 'bg-yellow-500' : 'bg-[#F472B6] dark:bg-[#EC4899]')
              : 'bg-gray-500 dark:bg-gray-700'
            return (
              <div key={c} className={`h-12 w-12 rounded grid place-items-center text-white font-bold text-lg ${cls}`}>
                <span className="font-mono">{ch}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function CandidatesPanel({ steps }: { steps: GuessResult[] }) {
  if (!steps.length) {
    return (
      <div className="min-w-[240px] text-sm text-gray-600 dark:text-gray-400">
        <div className="font-semibold mb-2">Candidates</div>
        <p className="text-xs">Guesses will appear here with remaining possibilities.</p>
      </div>
    )
  }
  return (
    <div className="min-w-[240px]">
      <div className="font-semibold mb-2 text-sm">Remaining Candidates</div>
      <ul className="space-y-1 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">#{i + 1}</span>
            <span className="font-mono tracking-wide">{s.guess.toUpperCase()}</span>
            <span className="text-gray-500">→</span>
            <span className={s.remaining === 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-800 dark:text-gray-200'}>
              {s.remaining} {s.remaining === 1 ? 'word' : 'words'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type FiveLetterInputProps = {
  cells: string[]
  setCells: (v: string[]) => void
  inputsRef: MutableRefObject<Array<HTMLInputElement | null>>
  setHasTyped: (b: boolean) => void
  setUserAnswer: (v: string) => void
}

function FiveLetterInput({ cells, setCells, inputsRef, setHasTyped, setUserAnswer }: FiveLetterInputProps) {
  useEffect(() => {
    setUserAnswer(cells.join(''))
  }, [cells])
  return (
    <div className="flex items-center justify-center gap-2">
      {cells.map((val, idx) => (
        <input
          key={idx}
          ref={el => (inputsRef.current[idx] = el)}
          value={val}
          onChange={e => {
            const v = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toLowerCase()
            const next = [...cells]
            next[idx] = v
            setCells(next)
            setHasTyped(next.join('').length > 0)
            if (v && idx < 4) inputsRef.current[idx + 1]?.focus()
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !cells[idx] && idx > 0) {
              const prev = inputsRef.current[idx - 1]
              prev?.focus()
            }
          }}
          className="w-12 h-12 text-center text-xl font-mono uppercase rounded border dark:border-zinc-700 dark:bg-zinc-900"
          maxLength={1}
          placeholder="_"
        />
      ))}
    </div>
  )
}
