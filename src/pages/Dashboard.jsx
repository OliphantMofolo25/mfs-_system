// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import DecisionBadge from '../components/DecisionBadge'
import StatsWidget from '../components/StatsWidget'
import './Dashboard.css'

function fmt(n) { return `LSL ${Number(n || 0).toLocaleString()}` }

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [apps, setApps]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'loan_applications'),
      where('applicantId', '==', user.uid),
      orderBy('submittedAt', 'desc')
    )
    getDocs(q).then(snap => {
      setApps(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [user])

  const counts = {
    total:       apps.length,
    approved:    apps.filter(a => a.decision === 'APPROVED').length,
    conditional: apps.filter(a => a.decision === 'CONDITIONAL_APPROVED').length,
    rejected:    apps.filter(a => a.decision === 'REJECTED').length,
  }

  return (
    <div className="page-wrapper">
      <div className="container">
        {/* Welcome */}
        <div className="dash-welcome animate-fade-up">
          <div>
            <h2>Welcome back, {profile?.fullName?.split(' ')[0] || 'Applicant'}</h2>
            <p>Here is a summary of your loan applications</p>
          </div>
          <Link to="/apply" className="btn btn-primary">+ New Application</Link>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 32 }}>
          <StatsWidget label="Total Applications" value={counts.total}       icon="Apps" color="navy-mid" />
          <StatsWidget label="Approved"           value={counts.approved}    icon="OK"  color="success" />
          <StatsWidget label="Conditional"        value={counts.conditional} icon="Cond"  color="warn" />
          <StatsWidget label="Rejected"           value={counts.rejected}    icon="Rej"  color="danger" />
        </div>

        {/* Applications List */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>My Applications</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>{apps.length} total</span>
          </div>

          {loading && <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
          {!loading && apps.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">—</div>
              <h3>No applications yet</h3>
              <p>Submit your first loan application to get started</p>
              <Link to="/apply" className="btn btn-primary" style={{ marginTop: 16 }}>Apply Now</Link>
            </div>
          )}
          {!loading && apps.length > 0 && (
            <div className="app-list">
              {apps.map(app => (
                <Link key={app.id} to={`/application/${app.id}`} className="app-list-item">
                  <div className="app-list-left">
                    <div className="app-id">#{app.id.slice(-8).toUpperCase()}</div>
                    <div className="app-date">
                      {app.submittedAt?.toDate?.().toLocaleDateString('en-LS') || '—'}
                    </div>
                  </div>
                  <div className="app-list-mid">
                    <div className="app-amount">{fmt(app.loanAmount)}</div>
                    <div className="app-purpose">{app.purpose?.slice(0, 50) || '—'}</div>
                  </div>
                  <div className="app-list-right">
                    <DecisionBadge decision={app.decision} />
                    <span className="app-arrow">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
