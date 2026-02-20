// src/components/DecisionBadge.jsx
export default function DecisionBadge({ decision, size = 'md' }) {
  const map = {
    APPROVED:             { cls: 'badge-approved',    icon: '✓', label: 'Approved' },
    CONDITIONAL_APPROVED: { cls: 'badge-conditional', icon: '◎', label: 'Conditional Approval' },
    REJECTED:             { cls: 'badge-rejected',    icon: '✕', label: 'Rejected' },
    PENDING:              { cls: 'badge-pending',     icon: '…', label: 'Pending Review' },
  }
  const { cls, icon, label } = map[decision] || map.PENDING
  return (
    <span className={`badge ${cls} ${size === 'lg' ? 'badge-lg' : ''}`}>
      {icon} {label}
    </span>
  )
}
