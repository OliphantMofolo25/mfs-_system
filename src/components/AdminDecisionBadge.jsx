// src/components/AdminDecisionBadge.jsx
export default function AdminDecisionBadge({ decision }) {
  const map = {
    APPROVED:             { cls: 'admin-badge-approved',    icon: '✓', label: 'Approved' },
    CONDITIONAL_APPROVED: { cls: 'admin-badge-conditional', icon: '◎', label: 'Conditional' },
    REJECTED:             { cls: 'admin-badge-rejected',    icon: '✕', label: 'Rejected' },
    PENDING:              { cls: 'admin-badge-pending',     icon: '…', label: 'Pending' },
  }
  const { cls, icon, label } = map[decision] || map.PENDING
  return <span className={cls}>{icon} {label}</span>
}
