// src/components/StatsWidget.jsx
export default function StatsWidget({ label, value, icon, color = 'navy' }) {
  return (
    <div className="stats-widget" style={{ '--accent': `var(--${color})` }}>
      <div className="stats-icon-text">{icon}</div>
      <div className="stats-body">
        <div className="stats-value">{value}</div>
        <div className="stats-label">{label}</div>
      </div>
    </div>
  )
}
