// src/pages/ApplicationDetail.jsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import DecisionBadge from '../components/DecisionBadge'
import './ApplicationDetail.css'

function fmt(n) { return `LSL ${Number(n).toLocaleString('en-LS', { minimumFractionDigits: 2 })}` }

export default function ApplicationDetail() {
  const { id } = useParams()
  const [app, setApp]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'loan_applications', id)).then(snap => {
      if (snap.exists()) setApp({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!app)    return <div className="page-wrapper container"><p>Application not found.</p></div>

  const decisionColor = {
    APPROVED: 'success', CONDITIONAL_APPROVED: 'warn', REJECTED: 'danger', PENDING: 'gray'
  }[app.decision] || 'gray'

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 820 }}>
        {/* Header */}
        <div className="detail-header animate-fade-up">
          <div>
            <Link to="/dashboard" className="back-link">← My Applications</Link>
            <h2 style={{ marginTop: 8 }}>Application #{id.slice(-8).toUpperCase()}</h2>
            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Submitted: {app.submittedAt?.toDate?.().toLocaleDateString('en-LS', { dateStyle: 'long' }) || '—'}
            </p>
          </div>
          <DecisionBadge decision={app.decision} size="lg" />
        </div>

        {/* Decision Box */}
        <div className={`decision-box decision-${decisionColor} animate-fade-up`}>
          <div className="decision-box-icon">
            {{ APPROVED: 'OK', CONDITIONAL_APPROVED: 'Cond', REJECTED: 'Rej', PENDING: 'Pending' }[app.decision]}
          </div>
          <div>
            <h3>{{ APPROVED: 'Your loan has been approved!',
                   CONDITIONAL_APPROVED: 'Conditionally approved — action required',
                   REJECTED: 'Application not approved at this time',
                   PENDING:  'Your application is under review' }[app.decision]}</h3>
            {app.decisionReasons?.length > 0 && (
              <ul className="reason-list">
                {app.decisionReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {app.officerNotes && (
              <div className="officer-note">
                <strong>Officer note:</strong> {app.officerNotes}
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid-2" style={{ gap: 20, margin: '24px 0' }}>
          {[
            { label: 'Loan Amount', value: fmt(app.loanAmount) },
            { label: 'Est. Monthly Repayment', value: fmt(app.monthlyRepayment) },
            { label: 'Repayment Period', value: `${app.repaymentMonths} months` },
            { label: 'Disposable Income', value: fmt(app.disposableIncome) },
            { label: 'Debt-to-Income Ratio', value: `${app.debtToIncomeRatio}%` },
            { label: 'Credit Score', value: app.creditScore },
          ].map(item => (
            <div key={item.label} className="summary-stat">
              <span className="summary-label">{item.label}</span>
              <span className="summary-value">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Applicant Info */}
        <div className="card">
          <div className="card-header"><h3>Applicant Details</h3></div>
          <div className="grid-2">
            {[
              { label: 'Full Name',          value: app.applicantName },
              { label: 'Email',              value: app.applicantEmail },
              { label: 'Age',                value: app.age },
              { label: 'Employment Status',  value: app.employmentStatus?.replace('_', ' ') },
              { label: 'Monthly Income',     value: fmt(app.monthlyIncome) },
              { label: 'Monthly Expenses',   value: fmt(app.monthlyExpenses) },
              { label: 'Existing Debts/mo',  value: fmt(app.existingDebts) },
              { label: 'Loan Purpose',       value: app.purpose },
            ].map(item => (
              <div key={item.label} className="info-row">
                <span className="info-label">{item.label}</span>
                <span className="info-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/apply" className="btn btn-primary">Submit Another Application</Link>
        </div>
      </div>
    </div>
  )
}
