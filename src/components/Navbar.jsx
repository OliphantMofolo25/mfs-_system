// src/components/Navbar.jsx
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, profile, isOfficer } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await signOut(auth)
    navigate('/')
  }

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
      ? 'nav-link active' : 'nav-link'

  return (
    <nav className={`navbar ${isOfficer ? 'admin-nav' : ''}`}>
      <div className="navbar-inner">
        <Link to={isOfficer ? '/admin' : '/'} className="navbar-logo">
          <span className="logo-mark">MFS</span>
          <span className="logo-text">
            <strong>Motsitseng</strong>
            <small>{isOfficer ? 'Admin Portal' : 'Financial Services'}</small>
          </span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {!user && (
            <>
              <Link to="/"         className={isActive('/')}>Home</Link>
              <Link to="/login"    className={isActive('/login')}>Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Apply Now</Link>
            </>
          )}

          {user && !isOfficer && (
            <>
              <Link to="/dashboard" className={isActive('/dashboard')}>My Applications</Link>
              <Link to="/apply"     className={isActive('/apply')}>New Application</Link>
              <div className="nav-divider" />
              <span className="nav-user">{profile?.fullName?.split(' ')[0] || 'Account'}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
            </>
          )}

          {user && isOfficer && (
            <>
              <Link to="/admin"                  className={isActive('/admin')}>Applications</Link>
              <Link to="/admin/analytics"        className={isActive('/admin/analytics')}>Analytics</Link>
              <Link to="/admin/new-application"  className={isActive('/admin/new-application')}>Apply for User</Link>
              <Link to="/admin/register"         className={isActive('/admin/register')}>Register User</Link>
              <div className="nav-divider" />
              <span className="nav-user nav-officer">Officer — {profile?.fullName?.split(' ')[0] || 'Admin'}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
            </>
          )}
        </div>

        <button className="navbar-hamburger" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}
