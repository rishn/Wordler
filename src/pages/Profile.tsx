import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import AnimatedGridBackground from '../components/AnimatedGridBackground'
import { useAuth } from '../contexts/AuthContext'
import { auth } from '../lib/firebase'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'

/* The `Profile` component is responsible for rendering a user profile page where users can manage their account
details, specifically allowing them to change their password.*/
export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  /**
   * This function handles the submission of a form to update a user's password, including validation
   * checks and error handling.
   * @param {any} e - The parameter `e` in the `handleSubmit` function is typically an event object,
   * such as a form submission event. In this case, it is used to prevent the default behavior of the
   * event (e.g., form submission) using `e.preventDefault()`. This function is an asynchronous
   * function that handles
   * @returns The `handleSubmit` function returns a Promise because it is an asynchronous function
   * declared with the `async` keyword. The function will return a Promise that resolves to undefined.
   */
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setMessage(null)
    if (!user || !user.email) return setMessage('No authenticated user.')
    if (!oldPass || !newPass || !confirmPass) return setMessage('Please fill all fields')
    if (newPass !== confirmPass) return setMessage('New password and confirmation do not match')
    setBusy(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, oldPass)
      await reauthenticateWithCredential(auth.currentUser!, cred)
      await updatePassword(auth.currentUser!, newPass)
      setMessage('Password updated successfully')
      setSuccess(true)
      setShowForm(false)
      setOldPass(''); setNewPass(''); setConfirmPass('')
      // Sign the user out after a short delay so they must log in with the new password
      setTimeout(async () => {
        try {
          await logout()
        } catch {}
        navigate('/login')
      }, 1400)
    } catch (err: any) {
      setSuccess(false)
      setMessage(err?.message?.toString().includes('auth') ? 'Old password is incorrect' : err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 flex flex-col">
      <AppHeader />
      <div className="pt-[60px]" />
         
      {/* Animated grid background - fixed position, starts below header */}
      <div className="fixed top-[60px] left-0 right-0 bottom-[60px] overflow-hidden z-5">
        <AnimatedGridBackground
          palette={['#6AAA64','#6AAA64','#C9B458','#C9B458','#6366F1','#EC4899','#787C7E','#878A8C']}
          rows={30}
          cols={60}
          opacity={0.40}
          jitter={0.22}
          intervalMs={1900}
          rounded
          blur
        />
      </div>
      <div className="fixed top-[60px] left-0 right-0 bottom-[60px] bg-white/60 dark:bg-zinc-900/20 backdrop-blur-05 z-7" />

      <main className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        <h1 className="text-2xl font-semibold mb-2">Profile</h1>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">Manage your account details.</p>

        <div className="bg-white/60 dark:bg-zinc-800/60 rounded p-6">
          <div className="mb-4">
            <div className="text-xs text-gray-500">Email</div>
            <div className="font-mono font-semibold">{user?.email || '—'}</div>
          </div>

          <div>
            <button
              onClick={() => { setShowForm(s => !s); setMessage(null) }}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition"
            >
              {showForm ? 'Cancel password change' : 'Change password'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3 max-w-md">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Old password</label>
                <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full px-3 py-2 rounded border dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/60" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">New password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-3 py-2 rounded border dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/60" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Confirm new password</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full px-3 py-2 rounded border dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/60" />
              </div>
              {message && (
                <div className={success ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>{message}</div>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition">{busy ? 'Working…' : 'Update password'}</button>
                <button type="button" onClick={() => { setShowForm(false); setMessage(null) }} className="px-3 py-2 rounded border">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer with fixed position at the bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 py-6 text-center text-xs text-gray-600 dark:text-gray-400 bg-[#f5f5f5] dark:bg-[#18181b]">Wordler by Educify™ An EduTech Enterprise 2025</footer>
      <div className="pb-[60px]" />
    </div>
  )
}
