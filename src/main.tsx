import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './pages/App'
import History from './pages/History'
import About from './pages/About'
import Profile from './pages/Profile'
import Login from './pages/Login'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

/* The `const router = createBrowserRouter([...])` code block is creating a router configuration for
the React application using the `createBrowserRouter` function from the `react-router-dom` library. */
const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { 
    path: '/', 
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ) 
  },
  {
    path: '/about',
    element: (
      <ProtectedRoute>
        <About />
      </ProtectedRoute>
    )
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    )
  },
  { 
    path: '/history', 
    element: (
      <ProtectedRoute>
        <History />
      </ProtectedRoute>
    ) 
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)
