// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'

const AuthContext = createContext(null)

// ─── Officer emails ────────────────────────────────────────────────
// Add your officer email(s) in .env as:
// VITE_OFFICER_EMAILS=officer@mfs.co.ls,admin@mfs.co.ls
// OR hardcode directly in the array below for quick testing:
const HARDCODED_OFFICERS = [
  'adminofficer@gmail.com',
]

const ENV_OFFICERS = (import.meta.env.VITE_OFFICER_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

const OFFICER_EMAILS = [...new Set([...HARDCODED_OFFICERS, ...ENV_OFFICERS])]

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsub
  }, [])

  const isOfficer = !!user && OFFICER_EMAILS.includes(user.email?.toLowerCase())

  const profile = user
    ? {
        fullName: user.displayName || user.email,
        email:    user.email,
        role:     isOfficer ? 'officer' : 'applicant',
      }
    : null

  return (
    <AuthContext.Provider value={{ user, profile, isOfficer, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
