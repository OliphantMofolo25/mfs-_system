// functions/index.js — MFS Cloud Functions (Nodemailer + Firebase Triggers)
const functions  = require('firebase-functions')
const admin      = require('firebase-admin')
const nodemailer = require('nodemailer')

admin.initializeApp()

// ── Nodemailer Transport ──────────────────────────────────────────
// Setup: firebase functions:config:set email.user="you@gmail.com" email.pass="app_password"
const getTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user,
    pass: functions.config().email?.pass,
  },
})

const FROM = '"MFS Loan System" <no-reply@mfs-loans.co.ls>'

// ════════════════════════════════════════════════════════════════
// TRIGGER 1 — Welcome Email on User Registration
// ════════════════════════════════════════════════════════════════
exports.onUserRegistered = functions.auth.user().onCreate(async (user) => {
  const { email, displayName } = user
  if (!email) return null

  try {
    await getTransporter().sendMail({
      from:    FROM,
      to:      email,
      subject: 'Welcome to Motsitseng Financial Services',
      html:    welcomeTemplate(displayName || 'Applicant', email),
    })
    console.log(`[MFS] ✓ Welcome email → ${email}`)
  } catch (err) {
    console.error(`[MFS] ✗ Welcome email failed:`, err.message)
  }
})

// ════════════════════════════════════════════════════════════════
// TRIGGER 2 — Submission Confirmation on New Application
// ════════════════════════════════════════════════════════════════
exports.onApplicationSubmitted = functions.firestore
  .document('loan_applications/{appId}')
  .onCreate(async (snap, context) => {
    const data  = snap.data()
    const appId = context.params.appId

    if (!data.applicantEmail) {
      console.warn('[MFS] No applicantEmail on document, skipping email')
      return null
    }

    try {
      await getTransporter().sendMail({
        from:    FROM,
        to:      data.applicantEmail,
        subject: `MFS: Application Received — Ref #${appId.slice(-8).toUpperCase()}`,
        html:    submissionTemplate(data, appId),
      })
      console.log(`[MFS] ✓ Submission email → ${data.applicantEmail}`)
    } catch (err) {
      console.error(`[MFS] ✗ Submission email failed:`, err.message)
    }
  })

// ════════════════════════════════════════════════════════════════
// TRIGGER 3 — Decision Email when decision field changes
// This fires both when the Prolog system sets the decision on submit
// AND when an officer manually overrides it — covering both cases.
// ════════════════════════════════════════════════════════════════
exports.onDecisionChanged = functions.firestore
  .document('loan_applications/{appId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after  = change.after.data()
    const appId  = context.params.appId

    // Only fire when the decision field actually changes value
    if (before.decision === after.decision) return null
    if (!after.applicantEmail) {
      console.warn('[MFS] No applicantEmail on update, skipping email')
      return null
    }

    // Skip if decision is going back to PENDING (officer reset)
    if (after.decision === 'PENDING') return null

    try {
      await getTransporter().sendMail({
        from:    FROM,
        to:      after.applicantEmail,
        subject: `MFS: Loan Decision — ${after.decision.replace(/_/g, ' ')} | Ref #${appId.slice(-8).toUpperCase()}`,
        html:    decisionTemplate(after, appId),
      })
      console.log(`[MFS] ✓ Decision email (${after.decision}) → ${after.applicantEmail}`)
    } catch (err) {
      console.error(`[MFS] ✗ Decision email failed:`, err.message)
    }
  })

// ════════════════════════════════════════════════════════════════
// EMAIL HTML TEMPLATES
// ════════════════════════════════════════════════════════════════

function base(content) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #F5F0E8; font-family: Georgia, 'Times New Roman', serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
  .header { background: #0D1B2A; border-radius: 12px 12px 0 0; padding: 28px 36px; }
  .header-logo { color: #C9A84C; font-size: 1.4rem; font-weight: 700; letter-spacing: 0.04em; margin: 0; }
  .header-sub  { color: #6A8AA0; font-size: 0.8rem; margin: 4px 0 0; }
  .body  { background: #FFFFFF; border: 1px solid #E8ECF2; border-top: none; border-radius: 0 0 12px 12px; padding: 32px 36px; }
  .footer { text-align: center; padding: 20px; color: #9AAABB; font-size: 0.74rem; line-height: 1.6; }
  h2 { color: #0D1B2A; margin: 0 0 12px; font-size: 1.3rem; }
  p  { color: #5A6A7A; line-height: 1.7; margin: 0 0 12px; font-size: 0.92rem; }
  .ref-box { background: #F4F6F9; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #F0F2F5; font-size: 0.88rem; }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { color: #9AAABB; }
  .stat-value { color: #1A2C3A; font-weight: 600; }
  .badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; margin: 8px 0 16px; }
  .badge-approved    { background: #E8F5EF; color: #1A6B47; border: 1px solid #A8D5BF; }
  .badge-conditional { background: #FFF8E1; color: #8A5A00; border: 1px solid #F0D080; }
  .badge-rejected    { background: #FDEAEA; color: #8B1A1A; border: 1px solid #E5A0A0; }
  .badge-pending     { background: #F4F6F9; color: #5A6A7A; border: 1px solid #D0D8E0; }
  ul.reasons { padding-left: 18px; margin: 10px 0 16px; }
  ul.reasons li { color: #5A6A7A; font-size: 0.86rem; margin-bottom: 5px; line-height: 1.5; }
  .officer-note { background: #FFF8E1; border-left: 3px solid #C9A84C; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: 0.86rem; color: #5A6A7A; margin: 12px 0; }
  .divider { border: none; border-top: 1px solid #F0F2F5; margin: 20px 0; }
</style></head><body>
<div class="wrap">
  <div class="header">
    <p class="header-logo">⚖ Motsitseng Financial Services</p>
    <p class="header-sub">Intelligent Loan Assessment System — Maseru, Lesotho</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    © 2026 Motsitseng Financial Services · All rights reserved<br>
    This is an automated message, please do not reply directly to this email.
  </div>
</div></body></html>`
}

function fmtLSL(n) {
  return `LSL ${Number(n || 0).toLocaleString('en-LS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Template 1: Welcome ───────────────────────────────────────────
function welcomeTemplate(name, email) {
  return base(`
    <h2>Welcome, ${name}! 👋</h2>
    <p>Your account has been successfully created at Motsitseng Financial Services. You can now log in and submit a loan application.</p>
    <p>Our Prolog-powered expert system evaluates applications instantly based on fair, transparent financial criteria.</p>
    <div class="ref-box">
      <div class="stat-row"><span class="stat-label">Account Email</span><span class="stat-value">${email}</span></div>
      <div class="stat-row"><span class="stat-label">Account Status</span><span class="stat-value" style="color:#1A6B47">✓ Active</span></div>
      <div class="stat-row"><span class="stat-label">Next Step</span><span class="stat-value">Log in and apply for a loan</span></div>
    </div>
    <hr class="divider">
    <p style="font-size:0.82rem;color:#9AAABB">If you did not create this account, please disregard this email.</p>
  `)
}

// ── Template 2: Submission Confirmation ──────────────────────────
function submissionTemplate(data, appId) {
  const decisionBadgeClass = {
    APPROVED: 'badge-approved', CONDITIONAL_APPROVED: 'badge-conditional',
    REJECTED: 'badge-rejected', PENDING: 'badge-pending',
  }[data.decision] || 'badge-pending'

  return base(`
    <h2>Application Received ✓</h2>
    <p>Dear <strong>${data.applicantName}</strong>, your loan application has been received and processed by our expert system.</p>
    <span class="badge ${decisionBadgeClass}">${data.decision?.replace(/_/g, ' ')}</span>
    <div class="ref-box">
      <div class="stat-row"><span class="stat-label">Reference Number</span><span class="stat-value" style="font-family:monospace">#${appId.slice(-8).toUpperCase()}</span></div>
      <div class="stat-row"><span class="stat-label">Loan Amount</span><span class="stat-value">${fmtLSL(data.loanAmount)}</span></div>
      <div class="stat-row"><span class="stat-label">Repayment Period</span><span class="stat-value">${data.repaymentMonths} months</span></div>
      <div class="stat-row"><span class="stat-label">Est. Monthly Repayment</span><span class="stat-value">${fmtLSL(data.monthlyRepayment)}</span></div>
      <div class="stat-row"><span class="stat-label">Credit Score</span><span class="stat-value">${data.creditScore}</span></div>
    </div>
    ${data.decisionReasons?.length > 0 ? `
      <p><strong>Reason(s) for current status:</strong></p>
      <ul class="reasons">${data.decisionReasons.map(r => `<li>${r}</li>`).join('')}</ul>
    ` : '<p style="color:#1A6B47;font-size:0.88rem">✓ All assessment criteria were satisfied.</p>'}
    <p style="font-size:0.82rem;color:#9AAABB">Please keep your reference number for your records. Log in to track your application status at any time.</p>
  `)
}

// ── Template 3: Decision Notification ────────────────────────────
function decisionTemplate(data, appId) {
  const config = {
    APPROVED:             { cls: 'badge-approved',    title: '🎉 Great News — Your Loan is Approved!',       intro: 'Congratulations! Your loan application has been approved.' },
    CONDITIONAL_APPROVED: { cls: 'badge-conditional', title: '📋 Conditionally Approved — Action Required',   intro: 'Your application has received a conditional approval. Please review the conditions below.' },
    REJECTED:             { cls: 'badge-rejected',    title: '📋 Application Decision Update',               intro: 'We have reviewed your application and unfortunately are unable to approve it at this time.' },
  }
  const { cls, title, intro } = config[data.decision] || config.REJECTED

  return base(`
    <h2>${title}</h2>
    <p>Dear <strong>${data.applicantName}</strong>, ${intro}</p>
    <span class="badge ${cls}">${data.decision.replace(/_/g, ' ')}</span>
    <div class="ref-box">
      <div class="stat-row"><span class="stat-label">Reference Number</span><span class="stat-value" style="font-family:monospace">#${appId.slice(-8).toUpperCase()}</span></div>
      <div class="stat-row"><span class="stat-label">Loan Amount</span><span class="stat-value">${fmtLSL(data.loanAmount)}</span></div>
      <div class="stat-row"><span class="stat-label">Est. Monthly Repayment</span><span class="stat-value">${fmtLSL(data.monthlyRepayment)}</span></div>
      <div class="stat-row"><span class="stat-label">Repayment Period</span><span class="stat-value">${data.repaymentMonths} months</span></div>
      <div class="stat-row"><span class="stat-label">Disposable Income</span><span class="stat-value">${fmtLSL(data.disposableIncome)}</span></div>
      <div class="stat-row"><span class="stat-label">Debt-to-Income Ratio</span><span class="stat-value">${data.debtToIncomeRatio}%</span></div>
    </div>
    ${data.decisionReasons?.length > 0 ? `
      <p><strong>Reason(s):</strong></p>
      <ul class="reasons">${data.decisionReasons.map(r => `<li>${r}</li>`).join('')}</ul>
    ` : ''}
    ${data.officerNotes ? `
      <div class="officer-note"><strong>Note from our Loan Officer:</strong><br>${data.officerNotes}</div>
    ` : ''}
    ${data.decision === 'REJECTED' ? `
      <hr class="divider">
      <p style="font-size:0.86rem;color:#7A8A9A">You may reapply in the future once your financial situation improves. We encourage you to work on improving your credit score and reducing your debt-to-income ratio before reapplying.</p>
    ` : ''}
  `)
}
