import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Menu, X } from 'lucide-react'

/* Header component that includes navigation links, user info, logout button, and theme toggle. */
export default function AppHeader() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const isHome = pathname === '/'
  const isHistory = pathname === '/history'
  const isAbout = pathname === '/about'
  const active = 'text-gray-900 dark:text-gray-100 font-medium'
  const inactive = 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'

  /**
   * The function `handleLogout` logs out the user and handles any errors that occur during the
   * process.
   */
  const handleLogout = async () => {
    try {
      await logout()
      closeMenu()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const closeMenu = () => {
    // Trigger slide-out animation, then unmount after duration
    setClosing(true)
    setTimeout(() => {
      setMenuOpen(false)
      setClosing(false)
    }, 300)
  }

  return (
    <>
  <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between md:grid md:grid-cols-3 px-5 py-3 border-b dark:border-zinc-700 bg-[#f5f5f5] dark:bg-[#18181b]">
        <div className="justify-self-start flex items-center gap-2">
        <img src="/logo.png" alt="Wordler Logo" className="h-8 w-8" />
        <Link to="/" className="text-xl font-semibold tracking-tight">Wordler</Link>
      </div>
      <nav className="justify-self-center hidden md:flex gap-4">
        <Link to="/" className={`text-sm transition-colors ${isHome ? active : inactive}`}>Home</Link>
        <Link to="/history" className={`text-sm transition-colors ${isHistory ? active : inactive}`}>History</Link>
        <Link to="/about" className={`text-sm transition-colors ${isAbout ? active : inactive}`}>About Us</Link>
      </nav>
  <div className="flex items-center gap-3 md:justify-self-end">
        {user && (
          <>
            <Link to="/profile" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hidden md:inline">{user.email}</Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {/* Icons cluster (logout already above if user) */}
        <ThemeToggle />
        <button
          type="button"
          aria-label="Open menu"
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
    {/* Mobile sidebar overlay */}
    {(menuOpen || closing) && (
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={closeMenu}
      >
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white/80 dark:bg-zinc-900/80 border-r border-gray-200/60 dark:border-zinc-700/60 shadow-xl backdrop-blur-xl p-4 flex flex-col ${closing ? 'animate-slideOutLeft' : 'animate-slideInLeft'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Wordler Logo" className="h-7 w-7" />
              <span className="text-lg font-semibold">Wordler</span>
            </div>
            <button
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-lg p-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
              onClick={closeMenu}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            <Link
              to="/"
              className={`px-3 py-2 rounded-md ${isHome ? active : inactive} hover:bg-gray-100/70 dark:hover:bg-zinc-800/60`}
              onClick={closeMenu}
            >
              Home
            </Link>
            <Link
              to="/history"
              className={`px-3 py-2 rounded-md ${isHistory ? active : inactive} hover:bg-gray-100/70 dark:hover:bg-zinc-800/60`}
              onClick={closeMenu}
            >
              History
            </Link>
            <Link
              to="/about"
              className={`px-3 py-2 rounded-md ${isAbout ? active : inactive} hover:bg-gray-100/70 dark:hover:bg-zinc-800/60`}
              onClick={closeMenu}
            >
              About Us
            </Link>
            <Link
              to="/profile"
              className={`px-3 py-2 rounded-md hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 ${pathname === '/profile' ? active : inactive}`}
              onClick={closeMenu}
            >
              Profile
            </Link>
          </nav>

          {user && (
            <div className="mt-auto pt-4">
              <div className="text-xs mb-2 text-gray-600 dark:text-gray-400 truncate">{user.email}</div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </aside>
      </div>
    )}
    </>
  )
}

