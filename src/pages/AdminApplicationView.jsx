// src/pages/AdminApplicationView.jsx
import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import AdminDecisionBadge from '../components/AdminDecisionBadge'
import { sendDecisionEmail } from '../services/emailService'
import './AdminApplicationView.css'

function fmt(n) { return `LSL ${Number(n || 0).toLocaleString('en-LS', { minimumFractionDigits: 2 })}` }

function InfoRow({ label, value, highlight }) {
  return (
    <div className="aview-info-row">
      <span className="aview-info-label">{label}</span>
      <span className="aview-info-value" style={highlight ? { color: highlight } : {}}>{value}</span>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Confirm Delete</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn-admin-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-admin-danger" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminApplicationView() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [app, setApp]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const [override, setOverride] = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'loan_applications', id)).then(snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setApp(data)
        setOverride(data.decision)
        setNotes(data.officerNotes || '')
      }
      setLoading(false)
    })
  }, [id])

  async function handleSave() {
    setSaving(true)
    await updateDoc(doc(db, 'loan_applications', id), {
      decision:            override,
      officerNotes:        notes,
      overriddenByOfficer: true,
      updatedAt:           serverTimestamp(),
    })
    const updated = { ...app, decision: override, officerNotes: notes, overriddenByOfficer: true }
    setApp(updated)

    // Send decision email to applicant via EmailJS
    await sendDecisionEmail({
      applicantName:    updated.applicantName,
      applicantEmail:   updated.applicantEmail,
      appId:            id,
      loanAmount:       updated.loanAmount,
      repaymentMonths:  updated.repaymentMonths,
      monthlyRepayment: updated.monthlyRepayment,
      disposableIncome: updated.disposableIncome,
      debtToIncomeRatio:updated.debtToIncomeRatio,
      decision:         override,
      decisionReasons:  updated.decisionReasons || [],
      officerNotes:     notes,
    })

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 4000)
  }

  async function handleDelete() {
    await deleteDoc(doc(db, 'loan_applications', id))
    navigate('/admin')
  }

  if (loading) return (
    <div className="admin-layout loading-screen">
      <div className="spinner" style={{ borderTopColor: 'var(--admin-accent)' }} />
    </div>
  )
  if (!app) return (
    <div className="admin-layout">
      <div className="container" style={{ paddingTop: 60 }}>
        <p style={{ color: 'var(--admin-muted)' }}>Application not found.</p>
        <Link to="/admin" className="btn-admin-ghost" style={{ marginTop: 16 }}>← Back</Link>
      </div>
    </div>
  )

  const creditColor = app.creditScore >= 700 ? '#2ecc71' : app.creditScore >= 600 ? '#F1C40F' : '#E74C3C'
  const dtiColor    = app.debtToIncomeRatio <= 30 ? '#2ecc71' : app.debtToIncomeRatio <= 40 ? '#F1C40F' : '#E74C3C'

  return (
    <div className="admin-layout">
      <div className="container" style={{ maxWidth: 1080 }}>

        {/* ── Page Header ──────────────────────────────── */}
        <div className="aview-header animate-fade-up">
          <div>
            <Link to="/admin" className="aview-back">← All Applications</Link>
            <h2 style={{ color: 'var(--admin-text)', marginTop: 8 }}>
              Application <span style={{ color: 'var(--admin-accent-lt)', fontFamily: 'monospace', fontSize: '1.2rem' }}>
                #{id.slice(-8).toUpperCase()}
              </span>
            </h2>
            <p style={{ color: 'var(--admin-muted)', fontSize: '0.82rem', marginTop: 4 }}>
              Submitted: {app.submittedAt?.toDate?.().toLocaleDateString('en-LS', { dateStyle: 'long' }) || '—'}
              {app.overriddenByOfficer && (
                <span style={{ marginLeft: 10, background: 'rgba(212,172,13,0.15)', color: '#F1C40F',
                  border: '1px solid rgba(212,172,13,0.3)', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                   Officer Modified
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AdminDecisionBadge decision={app.decision} />
            <button className="btn-admin-danger" onClick={() => setShowDelete(true)}> Delete</button>
          </div>
        </div>

        {/* ── Main Grid ────────────────────────────────── */}
        <div className="aview-grid">

          {/* ─ Left Column ─────────────────────────────── */}
          <div className="aview-left">

            {/* Applicant Details */}
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-card-header"><h3> Applicant Details</h3></div>
              <InfoRow label="Full Name"         value={app.applicantName} />
              <InfoRow label="Email Address"     value={app.applicantEmail} />
              <InfoRow label="Phone Number"      value={app.phoneNumber || '—'} />
              <InfoRow label="Age"               value={`${app.age} years`} />
              <InfoRow label="Employment Status" value={app.employmentStatus?.replace('_', ' ')} />
              <InfoRow label="Loan Purpose"      value={app.purpose} />
            </div>

            {/* Financial Metrics */}
            <div className="admin-card">
              <div className="admin-card-header"><h3> Financial Metrics</h3></div>
              <InfoRow label="Monthly Income"    value={fmt(app.monthlyIncome)} />
              <InfoRow label="Monthly Expenses"  value={fmt(app.monthlyExpenses)} />
              <InfoRow label="Existing Debts"    value={fmt(app.existingDebts)} />
              <InfoRow label="Disposable Income" value={fmt(app.disposableIncome)}
                highlight={app.disposableIncome > 0 ? '#2ecc71' : '#E74C3C'} />
              <InfoRow label="Credit Score"      value={app.creditScore} highlight={creditColor} />
              <InfoRow label="Debt-to-Income"    value={`${app.debtToIncomeRatio}%`} highlight={dtiColor} />
              <div className="divider" style={{ borderColor: 'var(--admin-border)' }} />
              <InfoRow label="Loan Amount"        value={fmt(app.loanAmount)} />
              <InfoRow label="Repayment Period"   value={`${app.repaymentMonths} months`} />
              <InfoRow label="Monthly Repayment"  value={fmt(app.monthlyRepayment)} />
            </div>
          </div>

          {/* ─ Right Column ────────────────────────────── */}
          <div className="aview-right">

            {/* System Decision Breakdown */}
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-card-header"><h3>🤖 Prolog System Decision</h3></div>
              <div style={{ marginBottom: 16 }}>
                <AdminDecisionBadge decision={app.decision} />
              </div>
              {app.decisionReasons?.length > 0 ? (
                <div>
                  <p style={{ color: 'var(--admin-muted)', fontSize: '0.78rem', textTransform: 'uppercase',
                    letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>Failure Reasons</p>
                  {app.decisionReasons.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                      <span style={{ color: '#E74C3C', marginTop: 2, flexShrink: 0 }}></span>
                      <span style={{ fontSize: '0.85rem', color: '#D0B0B0' }}>{r}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#2ecc71', fontSize: '0.88rem' }}>All criteria were satisfied by the Prolog rules engine.</p>
              )}
            </div>

            {/* Officer Override Panel */}
            <div className="admin-card aview-override-card">
              <div className="admin-card-header">
                <h3> Officer Override</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--admin-muted)' }}>
                  Changes trigger an email to applicant
                </span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="admin-label">Override Decision</label>
                <select className="admin-select" style={{ width: '100%' }}
                  value={override} onChange={e => setOverride(e.target.value)}>
                  <option value="APPROVED">  Approved</option>
                  <option value="CONDITIONAL_APPROVED">◎  Conditional Approval</option>
                  <option value="REJECTED">  Rejected</option>
                  <option value="PENDING">…  Pending Review</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="admin-label">Officer Notes (visible to applicant)</label>
                <textarea className="admin-textarea"
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add a note explaining the decision or any conditions required…"
                  rows={4} />
              </div>

              {saved && (
                <div style={{ background: 'rgba(39,174,96,0.12)', border: '1px solid rgba(39,174,96,0.3)',
                  color: '#2ecc71', borderRadius: 6, padding: '10px 14px', fontSize: '0.85rem', marginBottom: 14 }}>
                   Decision saved. Applicant will be notified via email automatically.
                </div>
              )}

              <button className="btn-admin-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving…' : ' Save Decision & Notify Applicant'}
              </button>
            </div>

          </div>
        </div>
      </div>

      {showDelete && (
        <ConfirmModal
          message={`Permanently delete application #${id.slice(-8).toUpperCase()} for ${app.applicantName}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
