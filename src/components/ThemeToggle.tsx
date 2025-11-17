import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { saveThemePreference, getThemePreference, type Theme } from '../lib/themeService'

/**
 * The function `applyTheme` toggles a 'dark' class on the root element of the document based on the
 * boolean parameter `dark`.
 * @param {boolean} dark - The `dark` parameter is a boolean value that determines whether to apply a
 * dark theme or not. If `dark` is `true`, the function adds a CSS class `dark` to the root element of
 * the document to apply the dark theme.
 */
function applyTheme(dark: boolean) {
  const root = document.documentElement
  if (dark) root.classList.add('dark')
  else root.classList.remove('dark')
}

/* The `ThemeToggle` component is responsible for toggling between dark and light themes. */
export default function ThemeToggle() {
  const { user } = useAuth()
  const [dark, setDark] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Load theme from Firestore when user logs in
  useEffect(() => {
    async function loadTheme() {
      if (user && !initialized) {
        try {
          const savedTheme = await getThemePreference(user.uid)
          if (savedTheme) {
            const isDark = savedTheme === 'dark'
            setDark(isDark)
            applyTheme(isDark)
          } else {
            // Fallback to localStorage or system preference
            const stored = localStorage.getItem('theme')
            if (stored) {
              const isDark = stored === 'dark'
              setDark(isDark)
              applyTheme(isDark)
            } else {
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              setDark(prefersDark)
              applyTheme(prefersDark)
            }
          }
          setInitialized(true)
        } catch (error) {
          console.error('Error loading theme preference:', error)
        }
      } else if (!user) {
        // Not logged in - use localStorage or system preference
        const stored = localStorage.getItem('theme')
        if (stored) {
          const isDark = stored === 'dark'
          setDark(isDark)
          applyTheme(isDark)
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          setDark(prefersDark)
          applyTheme(prefersDark)
        }
        setInitialized(true)
      }
    }

    loadTheme()
  }, [user, initialized])

  const toggle = async () => {
    const next = !dark
    setDark(next)
    applyTheme(next)
    
    // Save to localStorage
    localStorage.setItem('theme', next ? 'dark' : 'light')
    
    // Save to Firestore if user is logged in
    if (user) {
      try {
        await saveThemePreference(user.uid, next ? 'dark' : 'light')
      } catch (error) {
        console.error('Error saving theme preference:', error)
      }
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-9 w-9 rounded-full border bg-gray-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow flex items-center justify-center hover:bg-gray-300 dark:hover:bg-zinc-700 transition"
    >
      {dark ? (
        // Outline sun icon (center circle + 8 evenly spaced rays)
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="4.93" y1="4.93" x2="6.35" y2="6.35" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.35" y2="17.65" />
          <line x1="12" y1="22" x2="12" y2="20" />
          <line x1="17.65" y1="17.65" x2="19.07" y2="19.07" />
          <line x1="22" y1="12" x2="20" y2="12" />
          <line x1="17.65" y1="6.35" x2="19.07" y2="4.93" />
        </svg>
      ) : (
        // Outline moon icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  )
}
