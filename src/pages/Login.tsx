import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import AnimatedGridBackground from '../components/AnimatedGridBackground'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  /**
   * The function handles form submission in a TypeScript React application, performing validation,
   * authentication, and error handling.
   * @param e - The parameter `e` in the `handleSubmit` function is of type `React.FormEvent`. This is
   * a synthetic event type defined in React that represents the event that occurs when a form is
   * submitted. In this case, the function is handling the form submission event and preventing the
   * default behavior using `e
   * @returns The function `handleSubmit` returns either an error message if there is a validation
   * error or an authentication error, or it navigates to the home page if the login or signup is
   * successful.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate confirm password for signup
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await signup(email, password)
      }
      navigate('/')
    } catch (err: any) {
      const message = err.code === 'auth/email-already-in-use' 
        ? 'Email already in use'
        : err.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : err.code === 'auth/invalid-email'
        ? 'Invalid email address'
        : err.code === 'auth/user-not-found'
        ? 'User not found'
        : err.code === 'auth/wrong-password'
        ? 'Incorrect password'
        : err.code === 'auth/invalid-credential'
        ? 'Invalid email or password'
        : 'Authentication failed. Please try again.'
      
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 flex items-center justify-center relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatedGridBackground
          palette={['#6AAA64','#6AAA64','#C9B458','#C9B458','#6366F1','#6366F1','#EC4899','#EC4899','#787C7E','#878A8C']}
          rows={20}
          cols={50}
          opacity={0.25}
          jitter={0.22}
          intervalMs={1800}
          rounded
          blur
        />
      </div>

      {/* Translucent card form */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200/50 dark:border-zinc-700/50">
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="Wordler Logo" className="h-16 w-16 mb-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Wordler</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          {/* Toggle between login/signup */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setConfirmPassword('')
              }}
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
