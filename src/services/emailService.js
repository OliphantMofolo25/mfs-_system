// src/services/emailService.js
// ─────────────────────────────────────────────────────────────────
// EmailJS — 2 templates only (fits free plan)
//
// TEMPLATE 1: MFS Welcome       → VITE_EMAILJS_TEMPLATE_WELCOME
// TEMPLATE 2: MFS Application   → VITE_EMAILJS_TEMPLATE_APP
//   (used for BOTH submission confirmation AND decision updates)
// ─────────────────────────────────────────────────────────────────
import emailjs from '@emailjs/browser'

const SERVICE_ID       = import.meta.env.VITE_EMAILJS_SERVICE_ID
const PUBLIC_KEY       = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const TEMPLATE_WELCOME = import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME
const TEMPLATE_APP     = import.meta.env.VITE_EMAILJS_TEMPLATE_APP

emailjs.init(PUBLIC_KEY)

function fmtLSL(n) {
  return `LSL ${Number(n || 0).toLocaleString('en-LS', { minimumFractionDigits: 2 })}`
}

function isConfigured(template) {
  if (!SERVICE_ID || !PUBLIC_KEY || !template) {
    console.warn('[EmailJS] Credentials missing in .env — email skipped')
    return false
  }
  return true
}

// ── TEMPLATE 1: Welcome on Registration ──────────────────────────
// Variables: {{to_name}} {{to_email}} {{app_name}}
export async function sendWelcomeEmail({ name, email }) {
  if (!isConfigured(TEMPLATE_WELCOME)) return
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_WELCOME, {
      to_name:  name,
      to_email: email,
      app_name: 'Motsitseng Financial Services',
    })
    console.log('[EmailJS] ✓ Welcome →', email)
  } catch (e) {
    console.error('[EmailJS] ✗ Welcome failed:', e?.text || e)
  }
}

// ── TEMPLATE 2: Application Result (submission + decision) ────────
// Used in two situations:
//   A) Right after applicant submits → email_type = "Application Received"
//   B) When officer overrides decision → email_type = "Decision Updated"
//
// Variables: {{to_name}} {{to_email}} {{email_type}} {{ref_number}}
//   {{decision}} {{loan_amount}} {{monthly_repayment}} {{repayment_months}}
//   {{credit_score}} {{disposable_income}} {{dti_ratio}}
//   {{reasons}} {{officer_notes}} {{app_name}}
export async function sendSubmissionEmail({ applicantName, applicantEmail, appId, ...data }) {
  if (!isConfigured(TEMPLATE_APP)) return
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_APP, {
      to_name:           applicantName,
      to_email:          applicantEmail,
      email_type:        'Application Received & Assessed',
      ref_number:        appId.slice(-8).toUpperCase(),
      decision:          (data.decision || '').replace(/_/g, ' '),
      loan_amount:       fmtLSL(data.loanAmount),
      monthly_repayment: fmtLSL(data.monthlyRepayment),
      repayment_months:  `${data.repaymentMonths} months`,
      credit_score:      data.creditScore,
      disposable_income: fmtLSL(data.disposableIncome),
      dti_ratio:         `${data.debtToIncomeRatio}%`,
      reasons:           data.decisionReasons?.length
                           ? '• ' + data.decisionReasons.join('\n• ')
                           : 'All criteria were satisfied.',
      officer_notes:     'Pending officer review.',
      app_name:          'Motsitseng Financial Services',
    })
    console.log('[EmailJS] ✓ Submission →', applicantEmail)
  } catch (e) {
    console.error('[EmailJS] ✗ Submission failed:', e?.text || e)
  }
}

export async function sendDecisionEmail({ applicantName, applicantEmail, appId, ...data }) {
  if (!isConfigured(TEMPLATE_APP)) return
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_APP, {
      to_name:           applicantName,
      to_email:          applicantEmail,
      email_type:        'Decision Update from Loan Officer',
      ref_number:        appId.slice(-8).toUpperCase(),
      decision:          (data.decision || '').replace(/_/g, ' '),
      loan_amount:       fmtLSL(data.loanAmount),
      monthly_repayment: fmtLSL(data.monthlyRepayment),
      repayment_months:  `${data.repaymentMonths} months`,
      credit_score:      data.creditScore || '—',
      disposable_income: fmtLSL(data.disposableIncome),
      dti_ratio:         `${data.debtToIncomeRatio}%`,
      reasons:           data.decisionReasons?.length
                           ? '• ' + data.decisionReasons.join('\n• ')
                           : 'All criteria were satisfied.',
      officer_notes:     data.officerNotes || 'No additional notes.',
      app_name:          'Motsitseng Financial Services',
    })
    console.log('[EmailJS] ✓ Decision →', applicantEmail)
  } catch (e) {
    console.error('[EmailJS] ✗ Decision failed:', e?.text || e)
  }
}
