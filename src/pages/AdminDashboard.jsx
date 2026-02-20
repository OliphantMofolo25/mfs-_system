// src/pages/AdminDashboard.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import AdminDecisionBadge from '../components/AdminDecisionBadge'
import './AdminDashboard.css'

function fmt(n) { return `LSL ${Number(n || 0).toLocaleString()}` }

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Confirm Delete</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn-admin-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-admin-danger" onClick={onConfirm}>Delete Permanently</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [apps, setApps]         = useState([])
  const [filter, setFilter]     = useState('ALL')
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('date_desc')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [confirm, setConfirm]   = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadApps() }, [])

  async function loadApps() {
    setLoading(true)
    const q = query(collection(db, 'loan_applications'), orderBy('submittedAt', 'desc'))
    const snap = await getDocs(q)
    setApps(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  const counts = {
    ALL:                  apps.length,
    APPROVED:             apps.filter(a => a.decision === 'APPROVED').length,
    CONDITIONAL_APPROVED: apps.filter(a => a.decision === 'CONDITIONAL_APPROVED').length,
    REJECTED:             apps.filter(a => a.decision === 'REJECTED').length,
    PENDING:              apps.filter(a => a.decision === 'PENDING').length,
  }

  const filtered = apps
    .filter(a => {
      const matchFilter = filter === 'ALL' || a.decision === filter
      const q = search.toLowerCase()
      const matchSearch = !q ||
        a.applicantName?.toLowerCase().includes(q) ||
        a.applicantEmail?.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.purpose?.toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc')   return (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
      if (sortBy === 'date_asc')    return (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0)
      if (sortBy === 'amount_desc') return (b.loanAmount || 0) - (a.loanAmount || 0)
      if (sortBy === 'amount_asc')  return (a.loanAmount || 0) - (b.loanAmount || 0)
      if (sortBy === 'credit_desc') return (b.creditScore || 0) - (a.creditScore || 0)
      return 0
    })

  const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id))
  function toggleSelectAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(a => a.id)))
  }
  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function doDelete(ids) {
    setDeleting(true)
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'loan_applications', id))))
    setApps(prev => prev.filter(a => !ids.includes(a.id)))
    setSelected(new Set())
    setDeleting(false)
    setConfirm(null)
  }

  function askDelete(ids, single = false) {
    setConfirm({
      ids,
      message: single
        ? 'Are you sure you want to permanently delete this application? This cannot be undone.'
        : `Are you sure you want to delete ${ids.length} selected application(s)? This cannot be undone.`
    })
  }

  function exportCSV() {
    const rows = [
      ['ID','Applicant','Email','Age','Employment','Income','Expenses','Debts','Credit Score',
       'Loan Amount','Months','Monthly Repayment','DTI%','Decision','Submitted'],
      ...filtered.map(a => [
        a.id, a.applicantName, a.applicantEmail, a.age, a.employmentStatus,
        a.monthlyIncome, a.monthlyExpenses, a.existingDebts, a.creditScore,
        a.loanAmount, a.repaymentMonths, a.monthlyRepayment,
        a.debtToIncomeRatio, a.decision,
        a.submittedAt?.toDate?.().toLocaleDateString() || '',
      ])
    ]
    const csv  = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `mfs_applications_${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const approvalRate   = counts.ALL > 0 ? Math.round((counts.APPROVED / counts.ALL) * 100) : 0
  const totalLoanValue = apps.reduce((s, a) => s + (Number(a.loanAmount) || 0), 0)

  const stats = [
    { label: 'Total Applications', value: counts.ALL,           tag: 'Total',      color: 'var(--navy)' },
    { label: 'Approved',           value: counts.APPROVED,       tag: 'Approved',   color: '#166534' },
    { label: 'Conditional',        value: counts.CONDITIONAL_APPROVED, tag: 'Cond.', color: '#92400e' },
    { label: 'Rejected',           value: counts.REJECTED,       tag: 'Rejected',   color: '#991b1b' },
    { label: 'Approval Rate',      value: `${approvalRate}%`,   tag: 'Rate',       color: '#1e40af' },
    { label: 'Total Loan Value',   value: `LSL ${(totalLoanValue/1000).toFixed(0)}k`, tag: 'Value', color: '#065f46' },
  ]

  return (
    <div className="admin-layout">
      <div className="container">

        {/* Header */}
        <div className="adash-header animate-fade-up">
          <div>
            <p className="adash-eyebrow">Officer Control Panel</p>
            <h2 className="adash-title">Loan Applications</h2>
          </div>
          <div className="adash-header-actions">
            <Link to="/admin/new-application" className="btn-admin-primary">Apply for User</Link>
            <Link to="/admin/register" className="btn-admin-ghost">Register User</Link>
            <button className="btn-admin-ghost" onClick={exportCSV}>Export CSV</button>
            <button className="btn-admin-ghost" onClick={loadApps}>Refresh</button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="adash-summary animate-fade-up">
          <div className="adash-summary-item">
            <span className="adash-summary-num">{counts.ALL}</span>
            <span className="adash-summary-lbl">Total</span>
          </div>
          <div className="adash-summary-divider" />
          <div className="adash-summary-item">
            <span className="adash-summary-num" style={{ color: '#166534' }}>{counts.APPROVED}</span>
            <span className="adash-summary-lbl">Approved</span>
          </div>
          <div className="adash-summary-divider" />
          <div className="adash-summary-item">
            <span className="adash-summary-num" style={{ color: '#92400e' }}>{counts.CONDITIONAL_APPROVED}</span>
            <span className="adash-summary-lbl">Conditional</span>
          </div>
          <div className="adash-summary-divider" />
          <div className="adash-summary-item">
            <span className="adash-summary-num" style={{ color: '#991b1b' }}>{counts.REJECTED}</span>
            <span className="adash-summary-lbl">Rejected</span>
          </div>
          <div className="adash-summary-divider" />
          <div className="adash-summary-item">
            <span className="adash-summary-num" style={{ color: '#1e40af' }}>{approvalRate}%</span>
            <span className="adash-summary-lbl">Approval Rate</span>
          </div>
          <div className="adash-summary-divider" />
          <div className="adash-summary-item">
            <span className="adash-summary-num" style={{ color: '#065f46' }}>LSL {(totalLoanValue/1000).toFixed(0)}k</span>
            <span className="adash-summary-lbl">Total Value</span>
          </div>
        </div>

        {/* Controls */}
        <div className="adash-controls animate-fade-up">
          <div className="adash-filters">
            {[
              { key: 'ALL',                  label: 'All',         color: '#0D1B2A', bg: '#f0f4ff' },
              { key: 'APPROVED',             label: 'Approved',    color: '#166534', bg: '#dcfce7' },
              { key: 'CONDITIONAL_APPROVED', label: 'Conditional', color: '#92400e', bg: '#fef3c7' },
              { key: 'REJECTED',             label: 'Rejected',    color: '#991b1b', bg: '#fee2e2' },
              { key: 'PENDING',              label: 'Pending',     color: '#374151', bg: '#f3f4f6' },
            ].map(tab => (
              <button key={tab.key}
                className={`admin-filter-tab ${filter === tab.key ? 'active' : ''}`}
                style={{ '--tab-color': tab.color, '--tab-bg': tab.bg }}
                onClick={() => setFilter(tab.key)}>
                {tab.label}
                <span className="admin-filter-count">{counts[tab.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="adash-search-row">
            <input className="admin-input adash-search"
              placeholder="Search by name, email, ID or purpose..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-select" style={{ width: 180 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Loan</option>
              <option value="amount_asc">Lowest Loan</option>
              <option value="credit_desc">Best Credit Score</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="adash-bulk-bar animate-fade-in">
            <span className="bulk-count">{selected.size} selected</span>
            <button className="btn-admin-danger" onClick={() => askDelete([...selected])} disabled={deleting}>
              Delete Selected
            </button>
            <button className="btn-admin-ghost" onClick={() => setSelected(new Set())}>Clear Selection</button>
          </div>
        )}

        {/* Table */}
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          )}
          {!loading && (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                        style={{ accentColor: 'var(--navy)', cursor: 'pointer' }} />
                    </th>
                    <th>Applicant</th>
                    <th>Loan Amount</th>
                    <th>Monthly Rep.</th>
                    <th>Credit Score</th>
                    <th>DTI Ratio</th>
                    <th>Submitted</th>
                    <th>Decision</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
                        No applications match your filters
                      </td>
                    </tr>
                  )}
                  {filtered.map(app => (
                    <tr key={app.id} className={selected.has(app.id) ? 'row-selected' : ''}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          style={{ accentColor: 'var(--navy)', cursor: 'pointer' }} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.9rem' }}>
                          {app.applicantName}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#6b7280', marginTop: 2 }}>
                          {app.applicantEmail}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: 1 }}>
                          #{app.id.slice(-8).toUpperCase()}
                        </div>
                      </td>
                      <td style={{ color: 'var(--navy)', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>
                        {fmt(app.loanAmount)}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {fmt(app.monthlyRepayment)}/mo
                        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{app.repaymentMonths} months</div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                          background: app.creditScore >= 700 ? '#dcfce7' : app.creditScore >= 600 ? '#fef3c7' : '#fee2e2',
                          color:      app.creditScore >= 700 ? '#166534' : app.creditScore >= 600 ? '#92400e' : '#991b1b',
                        }}>{app.creditScore}</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.85rem', fontWeight: 600,
                          color: app.debtToIncomeRatio <= 30 ? '#166534' : app.debtToIncomeRatio <= 40 ? '#92400e' : '#991b1b'
                        }}>{app.debtToIncomeRatio}%</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {app.submittedAt?.toDate?.().toLocaleDateString() || '—'}
                      </td>
                      <td><AdminDecisionBadge decision={app.decision} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link to={`/admin/${app.id}`} className="btn-admin-ghost">Review</Link>
                          <button className="btn-admin-danger"
                            onClick={e => { e.stopPropagation(); askDelete([app.id], true) }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                Showing {filtered.length} of {apps.length} applications
              </span>
              <button className="btn-admin-ghost" onClick={exportCSV} style={{ fontSize: '0.78rem' }}>
                Export {filtered.length} rows to CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={() => doDelete(confirm.ids)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
