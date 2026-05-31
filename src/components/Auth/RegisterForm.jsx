import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function toHebrewError(msg) {
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'כתובת האימייל כבר רשומה במערכת'
  if (msg.includes('weak') || msg.includes('short'))
    return 'הסיסמה חלשה מדי (לפחות 6 תווים)'
  if (msg.includes('invalid email') || msg.includes('Invalid email'))
    return 'כתובת אימייל לא תקינה'
  return 'שגיאה בהרשמה. נסה שוב.'
}

export default function RegisterForm() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות')
      return
    }
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    if (!displayName.trim()) {
      setError('יש להזין שם תצוגה')
      return
    }

    setLoading(true)
    setError(null)
    const { data, error } = await signUp(email, password, displayName.trim())
    if (error) {
      setError(toHebrewError(error.message))
    } else {
      // If email confirmation is disabled in Supabase, session is set immediately
      if (data?.session) {
        navigate('/')
      } else {
        setSuccess(true)
      }
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">נרשמת בהצלחה!</h3>
        <p className="text-gray-500 text-sm">
          בדוק את תיבת הדואר שלך לאימות האימייל.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          שם תצוגה
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="השם שיופיע בטבלת המובילים"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          כתובת אימייל
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          dir="ltr"
          placeholder="name@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-left"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          סיסמה
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="לפחות 6 תווים"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          אימות סיסמה
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'נרשם...' : 'הרשמה'}
      </button>
    </form>
  )
}
