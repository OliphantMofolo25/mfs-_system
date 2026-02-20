// src/pages/Login.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { isOfficer } = useAuth()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function update(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password)
      // AuthContext detects the role — redirect handled after re-render
      // We check the email directly here since context updates async
      const officerEmails = (import.meta.env.VITE_OFFICER_EMAILS || '')
        .split(',').map(e => e.trim().toLowerCase())
      const goAdmin = officerEmails.includes(form.email.toLowerCase())
      navigate(goAdmin ? '/admin' : '/dashboard')
    } catch (err) {
      const msg = {
        'auth/user-not-found':    'No account found with this email.',
        'auth/wrong-password':    'Incorrect password. Please try again.',
        'auth/invalid-email':     'Please enter a valid email address.',
        'auth/invalid-credential':'Incorrect email or password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
      }
      setError(msg[err.code] || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-up">
        <div className="auth-header">
          <span className="auth-logo">⚖</span>
          <h2>Welcome back</h2>
          <p>Sign in to view your applications and apply for loans</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input name="email" type="email" className="form-input"
              placeholder="you@example.com"
              value={form.email} onChange={update} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input name="password" type="password" className="form-input"
              placeholder="Your password"
              value={form.password} onChange={update} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  )
}
