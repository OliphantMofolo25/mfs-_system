// src/pages/AdminRegisterUser.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, db } from '../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { sendWelcomeEmail } from '../services/emailService'
import './AdminRegisterUser.css'

export default function AdminRegisterUser() {
  const { user: officerUser } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(null)
  const [serverError, setServerError] = useState('')

  function update(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(er => ({ ...er, [name]: '' }))
  }

  function validate() {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Valid email required'
    if (!form.password || form.password.length < 6) errs.password = 'Minimum 6 characters'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError('')
    setSuccess(null)

    // Store officer credentials to restore session after
    const officerEmail    = officerUser.email
    const officerPassword = null // we can't retrieve password, use a workaround below

    try {
      // Create the new user account
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(cred.user, { displayName: form.fullName })

      // Save to registered_users so officer can find them in Apply for User
      await addDoc(collection(db, 'registered_users'), {
        uid:       cred.user.uid,
        fullName:  form.fullName,
        name:      form.fullName,
        email:     form.email,
        phone:     form.phone || '',
        createdAt: serverTimestamp(),
      })

      // Send welcome email to new user
      await sendWelcomeEmail({ name: form.fullName, email: form.email })

      // Sign new user out immediately so officer session can be restored
      await signOut(auth)

      // Show success — officer will need to log back in
      setSuccess({
        name:  form.fullName,
        email: form.email,
      })
      setForm({ fullName: '', email: '', phone: '', password: '' })

    } catch (err) {
      const msg = {
        'auth/email-already-in-use': 'This email address is already registered in the system.',
        'auth/invalid-email':        'Please enter a valid email address.',
        'auth/weak-password':        'Password must be at least 6 characters.',
      }
      setServerError(msg[err.code] || err.message)
    } finally {
      setSaving(false)
    }
  }

  // After creating a user, officer is signed out — show re-login prompt
  if (success) {
    return (
      <div className="admin-layout">
        <div className="container" style={{ maxWidth: 560 }}>
          <div className="aregister-success-card">
            <div className="aregister-success-icon">User Registered</div>
            <h2>Account Created Successfully</h2>
            <p>
              <strong>{success.name}</strong> has been registered and a welcome email
              has been sent to <strong>{success.email}</strong>.
            </p>
            <div className="aregister-info-box">
              <div className="aregister-info-row">
                <span>Name</span><strong>{success.name}</strong>
              </div>
              <div className="aregister-info-row">
                <span>Email</span><strong>{success.email}</strong>
              </div>
              <div className="aregister-info-row">
                <span>Status</span><strong style={{ color: '#166534' }}>Active — Welcome email sent</strong>
              </div>
            </div>
            <p className="aregister-note">
              Note: For security, your session was reset after creating this account.
              Please sign in again to continue.
            </p>
            <Link to="/login" className="btn-admin-primary" style={{ display: 'inline-flex', marginTop: 8 }}>
              Sign Back In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <div className="container" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div className="adash-header animate-fade-up">
          <div>
            <p className="adash-eyebrow">User Management</p>
            <h2 className="adash-title">Register New User</h2>
            <p className="adash-sub">
              Create an applicant account on behalf of a client. A welcome email with login
              details will be sent to the user automatically.
            </p>
          </div>
          <Link to="/admin" className="btn-admin-ghost">Back to Applications</Link>
        </div>

        <div className="admin-card animate-fade-up">

          {serverError && (
            <div className="aregister-alert-error">{serverError}</div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Name + Phone */}
            <div className="aregister-grid">
              <div className="aregister-field">
                <label className="admin-label">Full Name</label>
                <input
                  name="fullName"
                  className={`admin-input ${errors.fullName ? 'input-error' : ''}`}
                  placeholder="e.g. Thabo Mokoena"
                  value={form.fullName}
                  onChange={update}
                />
                {errors.fullName && <p className="aregister-error">{errors.fullName}</p>}
              </div>
              <div className="aregister-field">
                <label className="admin-label">Phone Number <span className="aregister-optional">(Optional)</span></label>
                <input
                  name="phone"
                  className="admin-input"
                  placeholder="+266 5000 0000"
                  value={form.phone}
                  onChange={update}
                />
              </div>
            </div>

            {/* Email */}
            <div className="aregister-field">
              <label className="admin-label">Email Address</label>
              <input
                name="email"
                type="email"
                className={`admin-input ${errors.email ? 'input-error' : ''}`}
                placeholder="applicant@example.com"
                value={form.email}
                onChange={update}
              />
              {errors.email && <p className="aregister-error">{errors.email}</p>}
              <p className="aregister-hint">The welcome email and all loan decision emails will be sent to this address.</p>
            </div>

            {/* Password */}
            <div className="aregister-field">
              <label className="admin-label">Temporary Password</label>
              <input
                name="password"
                type="password"
                className={`admin-input ${errors.password ? 'input-error' : ''}`}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={update}
              />
              {errors.password && <p className="aregister-error">{errors.password}</p>}
              <p className="aregister-hint">Provide a temporary password — advise the user to change it after first login.</p>
            </div>

            {/* Info Notice */}
            <div className="aregister-notice">
              <strong>What happens after you submit:</strong>
              <ul>
                <li>A new applicant account is created in the system</li>
                <li>A welcome email is sent to the user immediately</li>
                <li>The user can log in and apply for a loan using the credentials you set</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <Link to="/admin" className="btn-admin-ghost">Cancel</Link>
              <button type="submit" className="btn-admin-primary" disabled={saving}>
                {saving ? 'Creating Account...' : 'Create Account & Send Email'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
