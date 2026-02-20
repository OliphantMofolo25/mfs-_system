// functions/emailTemplates/templates.js
// All HTML email templates for MFS notifications

const BASE_STYLE = `
  font-family: 'DM Sans', Arial, sans-serif;
  max-width: 600px; margin: 0 auto; background: #ffffff;
`
const HEADER = (title) => `
  <div style="background: #0f2540; padding: 32px 40px; text-align: center;">
    <div style="width: 48px; height: 48px; border-radius: 50%; background: #c8973a;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 1.4rem; color: white; font-weight: bold; margin-bottom: 12px;">M</div>
    <h1 style="color: white; font-size: 1.1rem; margin: 0; font-weight: 600; letter-spacing: .03em;">
      Motsitseng Financial Services
    </h1>
    <p style="color: rgba(255,255,255,.5); font-size: 0.82rem; margin: 6px 0 0;">${title}</p>
  </div>
`
const FOOTER = `
  <div style="background: #f8f4ef; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 0.78rem; margin: 0; line-height: 1.6;">
      This is an automated message from MFS Loan System.<br/>
      Please do not reply to this email.<br/>
      © ${new Date().getFullYear()} Motsitseng Financial Services
    </p>
  </div>
`

function welcomeTemplate(fullName) {
  return `
  <div style="${BASE_STYLE}">
    ${HEADER('Account Registration Confirmation')}
    <div style="padding: 40px 40px 32px;">
      <h2 style="color: #0f2540; font-size: 1.3rem; margin: 0 0 16px;">
        Welcome, ${fullName}! 🎉
      </h2>
      <p style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
        Your account has been successfully created at <strong>Motsitseng Financial Services</strong>.
        You can now log in and submit your loan application.
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="color: #16a34a; font-size: 0.9rem; margin: 0; font-weight: 500;">
          ✓ Your account is now active and ready to use.
        </p>
      </div>
      <p style="color: #4b5563; font-size: 0.9rem; line-height: 1.7; margin-bottom: 28px;">
        Our expert AI system evaluates loan applications based on transparent financial 
        criteria to give you a fair, instant decision.
      </p>
      <a href="#" style="display: inline-block; background: #0f2540; color: white;
        padding: 14px 32px; border-radius: 8px; text-decoration: none;
        font-weight: 600; font-size: 0.95rem;">
        Sign In & Apply →
      </a>
    </div>
    ${FOOTER}
  </div>`
}

function submissionTemplate(data, appId) {
  return `
  <div style="${BASE_STYLE}">
    ${HEADER('Loan Application Received')}
    <div style="padding: 40px 40px 32px;">
      <h2 style="color: #0f2540; font-size: 1.3rem; margin: 0 0 8px;">
        Application Received
      </h2>
      <p style="color: #4b5563; margin-bottom: 24px; font-size: 0.9rem;">
        Hi ${data.applicantName}, we have received your loan application.
        Here is a summary of what you submitted:
      </p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${[
            ['Application ID', `<code style="font-size:.8rem; background:#e5e7eb; padding:2px 6px; border-radius:4px;">${appId}</code>`],
            ['Loan Amount', `LSL ${data.loanAmount?.toLocaleString()}`],
            ['Repayment Period', `${data.repaymentMonths} months`],
            ['Purpose', data.purpose],
            ['Employment', data.employmentStatus?.replace('_', ' ')],
          ].map(([k, v]) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #9ca3af; font-size: 0.85rem; width: 45%;">${k}</td>
              <td style="padding: 10px 0; color: #1f2937; font-weight: 600; font-size: 0.9rem;">${v}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="color: #b45309; font-size: 0.88rem; margin: 0;">
          ⏳ <strong>What happens next?</strong> A loan officer will review your application.
          You will receive an email notification once a final decision is made.
        </p>
      </div>
    </div>
    ${FOOTER}
  </div>`
}

function decisionTemplate(data, appId) {
  const isApproved = data.decision === 'APPROVED'
  const isConditional = data.decision === 'CONDITIONAL_APPROVED'
  const isRejected = data.decision === 'REJECTED'

  const color = isApproved ? '#16a34a' : isConditional ? '#b45309' : '#dc2626'
  const bg    = isApproved ? '#f0fdf4' : isConditional ? '#fffbeb' : '#fef2f2'
  const borderC = isApproved ? '#bbf7d0' : isConditional ? '#fde68a' : '#fecaca'
  const icon  = isApproved ? '✅' : isConditional ? '⚠️' : '❌'
  const label = isApproved ? 'APPROVED' : isConditional ? 'CONDITIONALLY APPROVED' : 'REJECTED'

  const reasonsHtml = data.decisionReasons?.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <p style="color: #4b5563; font-size: 0.88rem; font-weight: 600; margin-bottom: 10px;">
        ${isRejected ? 'Reason(s) for Rejection:' : 'Conditions to Address:'}
      </p>
      ${data.decisionReasons.map((r) => `
        <div style="background: ${bg}; border: 1px solid ${borderC}; border-radius: 8px;
          padding: 10px 14px; margin-bottom: 8px; color: ${color}; font-size: 0.85rem;">
          ⚠ ${r}
        </div>
      `).join('')}
    </div>
  ` : ''

  const officerNoteHtml = data.officerNotes ? `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
      <p style="color: #1d4ed8; font-size: 0.88rem; font-weight: 600; margin: 0 0 6px;">Officer Note:</p>
      <p style="color: #1e40af; font-size: 0.88rem; margin: 0; line-height: 1.6;">${data.officerNotes}</p>
    </div>
  ` : ''

  return `
  <div style="${BASE_STYLE}">
    ${HEADER('Loan Application Decision')}
    <div style="padding: 40px 40px 32px;">

      <div style="background: ${bg}; border: 2px solid ${borderC}; border-radius: 12px;
        padding: 28px; text-align: center; margin-bottom: 28px;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">${icon}</div>
        <div style="display: inline-block; background: ${bg}; border: 1.5px solid ${borderC};
          padding: 6px 18px; border-radius: 999px; color: ${color};
          font-size: 0.8rem; font-weight: 700; letter-spacing: .04em; margin-bottom: 12px;">
          ${label}
        </div>
        <h2 style="color: ${color}; font-size: 1.2rem; margin: 0;">
          ${isApproved ? `Your loan of LSL ${data.loanAmount?.toLocaleString()} has been approved!`
            : isConditional ? 'Your application has been conditionally approved.'
            : 'Your application was not approved at this time.'}
        </h2>
      </div>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${[
            ['Loan Amount', `LSL ${data.loanAmount?.toLocaleString()}`],
            ['Monthly Repayment', `LSL ${data.monthlyRepayment?.toFixed(2)}`],
            ['Repayment Period', `${data.repaymentMonths} months`],
            ['Debt-to-Income Ratio', `${data.debtToIncomeRatio?.toFixed(1)}%`],
          ].map(([k, v]) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #9ca3af; font-size: 0.85rem; width: 50%;">${k}</td>
              <td style="padding: 10px 0; color: #1f2937; font-weight: 600;">${v}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      ${reasonsHtml}
      ${officerNoteHtml}

      ${isRejected ? `
      <p style="color: #4b5563; font-size: 0.88rem; line-height: 1.7;">
        You are welcome to address the issues above and submit a new application in the future.
        If you believe this decision is incorrect, please contact your loan officer.
      </p>` : ''}

    </div>
    ${FOOTER}
  </div>`
}

module.exports = { welcomeTemplate, submissionTemplate, decisionTemplate }
