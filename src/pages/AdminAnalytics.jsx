// src/pages/AdminAnalytics.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import './AdminAnalytics.css'

function fmt(n) { return `LSL ${Number(n || 0).toLocaleString()}` }

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p style={{ color: 'var(--admin-muted)', fontSize: '0.85rem' }}>No data yet</p>
  const r = 50; const cx = 60; const cy = 60
  let angle = -90
  const slices = data.map(d => {
    const pct   = d.value / total
    const start = angle
    angle += pct * 360
    return { ...d, pct, start, end: angle }
  })

  function arc(startDeg, endDeg) {
    const s = (startDeg * Math.PI) / 180
    const e = (endDeg   * Math.PI) / 180
    const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
  }

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 120 120">
        {slices.map((s, i) => (
          <path key={i} d={arc(s.start, s.end)} fill={s.color} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={32} fill="var(--admin-card)" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--admin-text)" fontSize="14" fontWeight="700">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--admin-muted)" fontSize="7">TOTAL</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-dot" style={{ background: s.color }} />
            <span>{s.label}: <strong style={{ color: 'var(--admin-text)' }}>{s.value}</strong></span>
            <span style={{ marginLeft: 4 }}>({(s.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data, max }) {
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${max > 0 ? (d.value / max) * 100 : 0}%`, background: d.color }} />
          </div>
          <span className="bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalytics() {
  const [apps, setApps]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'loan_applications'), orderBy('submittedAt', 'desc'))
    getDocs(q).then(snap => {
      setApps(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="admin-layout loading-screen">
      <div className="spinner" style={{ borderTopColor: 'var(--admin-accent)' }} />
    </div>
  )

  const total     = apps.length
  const approved  = apps.filter(a => a.decision === 'APPROVED').length
  const cond      = apps.filter(a => a.decision === 'CONDITIONAL_APPROVED').length
  const rejected  = apps.filter(a => a.decision === 'REJECTED').length
  const pending   = apps.filter(a => a.decision === 'PENDING').length

  const totalLoan  = apps.reduce((s, a) => s + (Number(a.loanAmount) || 0), 0)
  const avgLoan    = total > 0 ? totalLoan / total : 0
  const avgCredit  = total > 0 ? apps.reduce((s, a) => s + (Number(a.creditScore) || 0), 0) / total : 0
  const avgDTI     = total > 0 ? apps.reduce((s, a) => s + (Number(a.debtToIncomeRatio) || 0), 0) / total : 0
  const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : 0

  // Employment breakdown
  const empCounts = apps.reduce((acc, a) => {
    const k = a.employmentStatus || 'unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  // Credit score bands
  const creditBands = [
    { label: '750–850 (Excellent)', value: apps.filter(a => a.creditScore >= 750).length, color: '#27AE60' },
    { label: '700–749 (Good)',      value: apps.filter(a => a.creditScore >= 700 && a.creditScore < 750).length, color: '#2ecc71' },
    { label: '650–699 (Fair)',      value: apps.filter(a => a.creditScore >= 650 && a.creditScore < 700).length, color: '#F1C40F' },
    { label: '600–649 (Poor)',      value: apps.filter(a => a.creditScore >= 600 && a.creditScore < 650).length, color: '#E67E22' },
    { label: 'Below 600',           value: apps.filter(a => a.creditScore < 600).length, color: '#E74C3C' },
  ]

  // Loan amount ranges
  const loanRanges = [
    { label: 'Under LSL 20k',       value: apps.filter(a => a.loanAmount < 20000).length,  color: '#3498DB' },
    { label: 'LSL 20k – 50k',       value: apps.filter(a => a.loanAmount >= 20000 && a.loanAmount < 50000).length, color: '#9B59B6' },
    { label: 'LSL 50k – 100k',      value: apps.filter(a => a.loanAmount >= 50000 && a.loanAmount < 100000).length, color: '#C0392B' },
    { label: 'Over LSL 100k',       value: apps.filter(a => a.loanAmount >= 100000).length, color: '#8E44AD' },
  ]

  const maxCredit = Math.max(...creditBands.map(b => b.value), 1)
  const maxLoan   = Math.max(...loanRanges.map(b => b.value), 1)

  return (
    <div className="admin-layout">
      <div className="container">

        {/* Header */}
        <div className="adash-header animate-fade-up">
          <div>
            <p className="adash-eyebrow">Analytics & Reporting</p>
            <h2 style={{ color: 'var(--admin-text)', marginBottom: 4 }}>Performance Overview</h2>
            <p style={{ color: 'var(--admin-muted)', fontSize: '0.88rem' }}>
              Aggregated statistics across all {total} loan applications
            </p>
          </div>
          <Link to="/admin" className="btn-admin-ghost">← Applications</Link>
        </div>

        {/* KPI Row */}
        <div className="analytics-kpis animate-fade-up">
          {[
            { label: 'Total Applications', value: total,              color: '#C0392B', icon: 'Apps' },
            { label: 'Approval Rate',      value: `${approvalRate}%`, color: '#27AE60', icon: 'Rate' },
            { label: 'Avg. Loan Amount',   value: fmt(avgLoan),        color: '#2980B9', icon: 'Value' },
            { label: 'Avg. Credit Score',  value: avgCredit.toFixed(0), color: '#8E44AD', icon: 'Credit' },
            { label: 'Avg. DTI Ratio',     value: `${avgDTI.toFixed(1)}%`, color: '#D4AC0D', icon: 'DTI' },
            { label: 'Total Loan Value',   value: `LSL ${(totalLoan/1000).toFixed(0)}k`, color: '#16A085', icon: 'Bank' },
          ].map(k => (
            <div key={k.label} className="admin-stat-card" style={{ '--accent-color': k.color }}>
              <div className="admin-stat-icon">{k.icon}</div>
              <div>
                <div className="admin-stat-value">{k.value}</div>
                <div className="admin-stat-label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="analytics-charts animate-fade-up">

          {/* Decision Breakdown */}
          <div className="admin-card">
            <div className="admin-card-header"><h3>Decision Breakdown</h3></div>
            <DonutChart data={[
              { label: 'Approved',    value: approved, color: '#27AE60' },
              { label: 'Conditional', value: cond,     color: '#D4AC0D' },
              { label: 'Rejected',    value: rejected, color: '#C0392B' },
              { label: 'Pending',     value: pending,  color: '#555' },
            ]} />
          </div>

          {/* Employment Status */}
          <div className="admin-card">
            <div className="admin-card-header"><h3>Employment Status</h3></div>
            <DonutChart data={[
              { label: 'Employed',      value: empCounts.employed || 0,      color: '#2980B9' },
              { label: 'Self-Employed', value: empCounts.self_employed || 0, color: '#8E44AD' },
              { label: 'Unemployed',    value: empCounts.unemployed || 0,    color: '#E74C3C' },
              { label: 'Retired',       value: empCounts.retired || 0,       color: '#7F8C8D' },
            ]} />
          </div>

          {/* Credit Score Bands */}
          <div className="admin-card">
            <div className="admin-card-header"><h3>Credit Score Distribution</h3></div>
            <BarChart data={creditBands} max={maxCredit} />
          </div>

          {/* Loan Amount Ranges */}
          <div className="admin-card">
            <div className="admin-card-header"><h3>Loan Amount Ranges</h3></div>
            <BarChart data={loanRanges} max={maxLoan} />
          </div>

        </div>

        {/* Recent Applications Table */}
        <div className="admin-card" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
          <div className="admin-card-header" style={{ padding: '16px 20px', marginBottom: 0 }}>
            <h3>5 Most Recent Applications</h3>
            <Link to="/admin" className="btn-admin-ghost" style={{ fontSize: '0.78rem' }}>View All →</Link>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Loan Amount</th>
                <th>Credit Score</th>
                <th>Decision</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {apps.slice(0, 5).map(app => (
                <tr key={app.id}>
                  <td>
                    <div style={{ color: 'var(--admin-text)', fontWeight: 600 }}>{app.applicantName}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--admin-muted)' }}>{app.applicantEmail}</div>
                  </td>
                  <td style={{ color: 'var(--admin-silver)' }}>{fmt(app.loanAmount)}</td>
                  <td style={{ color: app.creditScore >= 700 ? '#2ecc71' : app.creditScore >= 600 ? '#F1C40F' : '#E74C3C' }}>
                    {app.creditScore}
                  </td>
                  <td>
                    <span className={`admin-badge-${app.decision?.toLowerCase().replace('_approved','').replace('conditional','conditional')}`}
                      style={{ fontSize: '0.75rem' }}>
                      {app.decision?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--admin-muted)' }}>
                    {app.submittedAt?.toDate?.().toLocaleDateString() || '—'}
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-muted)' }}>No applications yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
