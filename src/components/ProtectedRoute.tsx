import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * The function `ProtectedRoute` renders loading spinner if user is still loading, redirects to login
 * page if user is not authenticated, and displays children components if user is authenticated.
 * @param  - The `ProtectedRoute` function is a React component that acts as a wrapper for routes that
 * require authentication. It takes a `children` prop, which represents the components or content that
 * should be rendered within the protected route.
 * @returns If the `loading` state is true, a loading spinner with the text "Loading..." is displayed.
 * If the `user` is not authenticated, the user is redirected to the login page. Otherwise, the
 * `children` components are rendered.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
