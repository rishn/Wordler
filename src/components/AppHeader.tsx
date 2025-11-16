import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

export default function AppHeader() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const isHome = pathname === '/'
  const isHistory = pathname === '/history'
  const active = 'text-gray-900 dark:text-gray-100 font-medium'
  const inactive = 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 grid grid-cols-3 items-center px-5 py-3 border-b dark:border-zinc-700 bg-[#f5f5f5] dark:bg-[#18181b]">
      <div className="justify-self-start flex items-center gap-2">
        <img src="/logo.png" alt="Wordler Logo" className="h-8 w-8" />
        <Link to="/" className="text-xl font-semibold tracking-tight">Wordler</Link>
      </div>
      <nav className="justify-self-center flex gap-4">
        <Link to="/" className={`text-sm transition-colors ${isHome ? active : inactive}`}>Home</Link>
        <Link to="/history" className={`text-sm transition-colors ${isHistory ? active : inactive}`}>History</Link>
      </nav>
      <div className="justify-self-end flex items-center gap-3">
        {user && (
          <>
            <span className="text-xs text-gray-600 dark:text-gray-400 hidden md:inline">{user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}

