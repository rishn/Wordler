import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import type { SolveSummary } from '../lib/wordleTypes'
import AnimatedGridBackground from '../components/AnimatedGridBackground'
import { Home, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToHistory, deleteHistoryEntry, clearAllHistory as clearAllFirestoreHistory, type HistoryEntry } from '../lib/historyService'

/* The `History` component displays a user's past Wordle solving attempts, allowing them to view details of each attempt,
delete individual entries, and clear their entire history. It features an animated background and a fixed header and footer. */
export default function History() {
  const { user } = useAuth()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [openId, setOpenId] = useState<number | null>(null)

  // Subscribe to real-time history updates
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToHistory(user.uid, (newHistory) => {
      setHistory(newHistory)
    })

    return () => unsubscribe()
  }, [user])

  /**
   * The function `clearAllHistory` clears the entire history after confirming with the user and
   * handling any errors that may occur.
   * @returns The `clearAllHistory` function is an asynchronous function that clears the entire history
   * for a user. If there is no user logged in, the function will return early. If the user confirms
   * the action to clear the history, it will attempt to clear the history in Firestore using the
   * `clearAllFirestoreHistory` function and then set the history to an empty array. If there is an
   * error during this process, it will log the error and alert the user.
   */
  const clearAllHistory = async () => {
    if (!user) return
    if (confirm('Are you sure you want to clear entire history? This cannot be undone.')) {
      try {
        await clearAllFirestoreHistory(user.uid)
        setHistory([])
      } catch (error) {
        console.error('Error clearing history:', error)
        alert('Failed to clear history. Please try again.')
      }
    }
  }

  /**
   * This function deletes a history entry by its ID and updates the state if the entry is currently
   * open.
   * @param {number} id - The `id` parameter in the `deleteEntry` function is a number that represents
   * the unique identifier of the entry that needs to be deleted.
   * @returns If the `user` is not defined, the function will return early and not execute the rest of
   * the code block.
   */
  const deleteEntry = async (id: number) => {
    if (!user) return
    try {
      await deleteHistoryEntry(user.uid, id)
      if (openId === id) setOpenId(null)
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('Failed to delete entry. Please try again.')
    }
  }

  /**
   * This function `tagClass` returns a CSS class based on the `mode` value from a `HistoryEntry`
   * object in TypeScript React.
   * @param mode - The `mode` parameter in the `tagClass` function is expected to be a string
   * representing the mode of a `HistoryEntry`. The possible values for `mode` are 'nyt', 'random',
   * 'simulation', or any other value.
   */
  const tagClass = (mode: HistoryEntry['mode']) =>
    mode === 'nyt' ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
      : mode === 'random' ? 'bg-indigo-600/15 text-indigo-700 dark:text-indigo-300'
        : mode === 'simulation' ? 'bg-sky-600/15 text-sky-700 dark:text-sky-300'
          : 'bg-gray-500/15 text-gray-700 dark:text-gray-300'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 flex flex-col">
      <AppHeader />
      <div className="pt-[60px]" /> {/* Spacer for fixed header */}
      {/* Animated grid background - fixed position, starts below header */}
      <div className="fixed top-[60px] left-0 right-0 bottom-[60px] overflow-hidden z-5">
        <AnimatedGridBackground
          palette={['#6AAA64', '#6AAA64', '#C9B458', '#C9B458', '#6366F1', '#EC4899', '#787C7E', '#878A8C']}
          rows={30}
          cols={60}
          opacity={0.40}
          jitter={0.22}
          intervalMs={1900}
          rounded
          blur
          className=""
        />
      </div>
      {/* Backdrop blur for content */}
      <div className="fixed top-[60px] left-0 right-0 bottom-[60px] bg-white/60 dark:bg-zinc-900/20 backdrop-blur-05 z-7" />
      <main className="max-w-4xl mx-auto px-5 py-6 flex-1 w-full relative z-10">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Link to="/" className="inline-flex items-center gap-1 hover:underline">
            <Home className="h-4 w-4" />
            Home
          </Link>
          <span>/</span>
          <span>History</span>
        </nav>

        {/* Title + description */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">History</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">Past attempts across NYT, Random, and Simulation modes. Click an attempt to view the mini board and remaining-candidates summary for each guess.</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearAllHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-200 dark:bg-red-900 text-gray-900 dark:text-red-200 text-sm font-medium hover:bg-red-300 dark:hover:bg-red-800 hover:scale-105 transition-all whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" />
              Clear History
            </button>
          )}
        </div>

        <ul className="space-y-3">
          {history.length === 0 && (
            <li className="text-sm text-gray-600 dark:text-gray-300">No history yet.</li>
          )}
          {history.map((entry) => {
            const s = entry.summary
            const open = openId === entry.id
            return (
              <li key={entry.id} className="rounded border dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/60 hover:scale-[1.02] transition-transform">
                <div className="flex items-center">
                  <button
                    className="flex-1 p-3 flex items-center justify-between gap-3 text-left"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    aria-expanded={open}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${tagClass(entry.mode)}`}>{entry.mode === 'nyt' ? 'NYT' : entry.mode === 'random' ? 'Random' : entry.mode === 'simulation' ? 'Simulation' : 'Other'}</span>
                      <div>
                        <div className="font-medium">Answer: <span className="font-mono uppercase">{s.answer}</span></div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <span className={s.success ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                            {s.success ? 'Solved' : 'Failed'}
                          </span>
                          {' '}• {s.steps.length} {s.steps.length === 1 ? 'guess' : 'guesses'}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{new Date(entry.ts).toLocaleString()}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteEntry(entry.id)
                    }}
                    className="p-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:scale-110 transition-all"
                    title="Delete this attempt"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                {open && (
                  <div className="px-3 pb-3">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                      <MiniGrid steps={s.steps} />
                      <MiniCandidates steps={s.steps} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
      {/* Footer with fixed position at the bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 py-6 text-center text-xs text-gray-600 dark:text-gray-400 bg-[#f5f5f5] dark:bg-[#18181b]">Wordler by Educify™ An EduTech Enterprise 2025</footer>
      <div className="pb-[60px]" /> {/* Spacer for fixed footer */}
    </div>
  )
}

/**
 * The MiniGrid function in TypeScript React renders a grid with 6 rows and 5 columns, displaying
 * guesses and patterns based on the provided steps data.
 * @param  - The `MiniGrid` component takes a prop `steps` which is an array of objects.
 */
function MiniGrid({ steps }: { steps: SolveSummary['steps'] }) {
  const rows = Array.from({ length: 6 }, (_, i) => steps[i] || { guess: '', pattern: ['b', 'b', 'b', 'b', 'b'], remaining: 0 })
  return (
    <div className="grid gap-1" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
      {rows.map((row, r) => (
        <div key={r} className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {Array.from({ length: 5 }, (_, c) => {
            const ch = row.guess?.[c]?.toUpperCase() || ''
            const p = row.guess ? row.pattern[c] : 'b'
            const cls = p === 'g' ? 'bg-[#3FA75A] dark:bg-[#2F8A48]' : p === 'y' ? 'bg-yellow-500' : 'bg-gray-500 dark:bg-gray-700'
            return (
              <div key={c} className={`h-7 w-7 rounded grid place-items-center text-white font-bold text-xs ${cls}`}>
                <span className="font-mono">{ch}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * The MiniCandidates function in TypeScript React displays a list of remaining candidates with their
 * corresponding guesses and remaining words.
 * @param  - The `MiniCandidates` component takes a prop `steps` which is an array of objects with the
 * following structure:
 * @returns The MiniCandidates component is being returned. It displays a list of remaining candidates
 * with their corresponding guesses and remaining words.
 */
function MiniCandidates({ steps }: { steps: SolveSummary['steps'] }) {
  return (
    <div className="min-w-[220px]">
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
