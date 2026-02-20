// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

export function OfficerRoute({ children }) {
  const { user, isOfficer, loading } = useAuth()
  if (loading)    return <div className="loading-screen"><div className="spinner" /></div>
  if (!user)      return <Navigate to="/login" replace />
  if (!isOfficer) return <Navigate to="/dashboard" replace />
  return children
}

export function PublicOnlyRoute({ children }) {
  const { user, isOfficer, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (user)    return <Navigate to={isOfficer ? '/admin' : '/dashboard'} replace />
  return children
}
