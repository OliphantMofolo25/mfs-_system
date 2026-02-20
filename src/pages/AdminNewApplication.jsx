// src/pages/AdminNewApplication.jsx
// Officer applies for a loan on behalf of a registered system user
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import { assessLoan, calcMonthlyRepayment } from '../prolog/loanRules'
import { sendSubmissionEmail } from '../services/emailService'
import AdminDecisionBadge from '../components/AdminDecisionBadge'
import './AdminNewApplication.css'

const STEPS = ['Select User', 'Financial Information', 'Loan Details', 'Review & Submit']

function fmt(n) { return `LSL ${Number(n || 0).toLocaleString('en-LS', { minimumFractionDigits: 2 })}` }

export default function AdminNewApplication() {
  // ── Registered users pulled from loan_applications + registered users ──
  const [users, setUsers]         = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSearch, setUserSearch]     = useState('')

  // ── Form state ──
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    age: '', employmentStatus: '',
    monthlyIncome: '', monthlyExpenses: '', existingDebts: '', creditScore: '',
    loanAmount: '', repaymentMonths: '', purpose: '',
  })
  const [errors, setErrors]         = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(null)
  const [serverError, setServerError] = useState('')

  // ── Load registered users from Firestore applicants collection ──
  // We pull distinct applicants from existing loan_applications
  // This gives us real registered users who have applied before OR
  // users registered by the officer via AdminRegisterUser
  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'loan_applications'), orderBy('submittedAt', 'desc'))
        )
        // Also pull from registered_users collection if officer created them
        const regSnap = await getDocs(collection(db, 'registered_users')).catch(() => ({ docs: [] }))

        // Build unique user list from applications
        const seen = new Map()
        snap.docs.forEach(d => {
          const data = d.data()
          if (data.applicantEmail && !seen.has(data.applicantEmail)) {
            seen.set(data.applicantEmail, {
              uid:   data.applicantId,
              name:  data.applicantName,
              email: data.applicantEmail,
              phone: data.phoneNumber || '',
              source: 'application',
            })
          }
        })
        // Add users from registered_users collection
        regSnap.docs.forEach(d => {
          const data = d.data()
          if (data.email && !seen.has(data.email)) {
            seen.set(data.email, {
              uid:   data.uid || d.id,
              name:  data.fullName || data.name,
              email: data.email,
              phone: data.phone || '',
              source: 'registered',
            })
          }
        })
        setUsers([...seen.values()])
      } catch (err) {
        console.error('Error loading users:', err)
      } finally {
        setUsersLoading(false)
      }
    }
    loadUsers()
  }, [])

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  function selectUser(u) {
    setSelectedUser(u)
    setUserSearch('')
  }

  // ── Live hints ──
  const income   = Number(form.monthlyIncome) || 0
  const liveRep  = form.loanAmount && form.repaymentMonths
    ? calcMonthlyRepayment(Number(form.loanAmount), Number(form.repaymentMonths)) : null
  const hintExp  = income > 0 ? Math.round(income * 0.5) : null
  const hintDebt = income > 0 ? Math.round(income * 0.3) : null
  const hintMax  = income > 0 ? Math.round(income * 2.5) : null

  function update(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(er => ({ ...er, [name]: '' }))
  }

  function validateStep() {
    const errs = {}
    if (step === 0) {
      if (!selectedUser) errs.user = 'Please select a registered user'
      if (!form.age || Number(form.age) < 18 || Number(form.age) > 100) errs.age = 'Must be 18–100'
      if (!form.employmentStatus) errs.employmentStatus = 'Required'
    }
    if (step === 1) {
      if (!form.monthlyIncome || Number(form.monthlyIncome) <= 0) errs.monthlyIncome = 'Must be greater than 0'
      if (form.monthlyExpenses === '' || Number(form.monthlyExpenses) < 0) errs.monthlyExpenses = 'Must be 0 or more'
      if (form.existingDebts === ''   || Number(form.existingDebts) < 0)   errs.existingDebts   = 'Must be 0 or more'
      if (!form.creditScore || Number(form.creditScore) < 300 || Number(form.creditScore) > 850)
        errs.creditScore = 'Must be 300–850'
    }
    if (step === 2) {
      if (!form.loanAmount || Number(form.loanAmount) <= 0) errs.loanAmount = 'Must be greater than 0'
      if (!form.repaymentMonths) errs.repaymentMonths = 'Required'
      if (!form.purpose.trim()) errs.purpose = 'Required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() { if (validateStep()) setStep(s => s + 1) }
  function prevStep() { setStep(s => s - 1) }

  const preview = step === 3 ? assessLoan({
    age: Number(form.age), employmentStatus: form.employmentStatus,
    monthlyIncome: Number(form.monthlyIncome), monthlyExpenses: Number(form.monthlyExpenses),
    creditScore: Number(form.creditScore), existingDebts: Number(form.existingDebts),
    loanAmount: Number(form.loanAmount), repaymentMonths: Number(form.repaymentMonths),
  }) : null

  async function handleSubmit() {
    setSubmitting(true)
    setServerError('')

    const assessment = assessLoan({
      age: Number(form.age), employmentStatus: form.employmentStatus,
      monthlyIncome: Number(form.monthlyIncome), monthlyExpenses: Number(form.monthlyExpenses),
      creditScore: Number(form.creditScore), existingDebts: Number(form.existingDebts),
      loanAmount: Number(form.loanAmount), repaymentMonths: Number(form.repaymentMonths),
    })

    try {
      const docRef = await addDoc(collection(db, 'loan_applications'), {
        // Link to the selected user's account
        applicantId:         selectedUser.uid,
        applicantName:       selectedUser.name,
        applicantEmail:      selectedUser.email,
        phoneNumber:         selectedUser.phone || '',
        age:                 Number(form.age),
        employmentStatus:    form.employmentStatus,
        monthlyIncome:       Number(form.monthlyIncome),
        monthlyExpenses:     Number(form.monthlyExpenses),
        creditScore:         Number(form.creditScore),
        existingDebts:       Number(form.existingDebts),
        loanAmount:          Number(form.loanAmount),
        repaymentMonths:     Number(form.repaymentMonths),
        purpose:             form.purpose,
        decision:            assessment.decision,
        decisionReasons:     assessment.reasons,
        monthlyRepayment:    assessment.monthlyRepayment,
        disposableIncome:    assessment.disposableIncome,
        debtToIncomeRatio:   assessment.debtToIncomeRatio,
        overriddenByOfficer: false,
        officerNotes:        'Application submitted by loan officer on behalf of applicant.',
        submittedAt:         serverTimestamp(),
        updatedAt:           serverTimestamp(),
      })

      // Email the selected user
      await sendSubmissionEmail({
        applicantName:     selectedUser.name,
        applicantEmail:    selectedUser.email,
        appId:             docRef.id,
        loanAmount:        Number(form.loanAmount),
        repaymentMonths:   Number(form.repaymentMonths),
        monthlyRepayment:  assessment.monthlyRepayment,
        disposableIncome:  assessment.disposableIncome,
        debtToIncomeRatio: assessment.debtToIncomeRatio,
        creditScore:       Number(form.creditScore),
        decision:          assessment.decision,
        decisionReasons:   assessment.reasons,
        officerNotes:      'Application submitted by loan officer on behalf of applicant.',
      })

      setSubmitted({ id: docRef.id, assessment })
    } catch (err) {
      console.error(err)
      setServerError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSubmitted(null); setStep(0); setSelectedUser(null); setUserSearch('')
    setForm({ age:'', employmentStatus:'', monthlyIncome:'', monthlyExpenses:'',
              existingDebts:'', creditScore:'', loanAmount:'', repaymentMonths:'', purpose:'' })
  }

  // ── Success Screen ──
  if (submitted) {
    return (
      <div className="admin-layout">
        <div className="container" style={{ maxWidth: 580 }}>
          <div className="anew-success">
            <div className="anew-success-badge">Application Submitted</div>
            <h2>Application Created Successfully</h2>
            <p>
              The application for <strong>{selectedUser.name}</strong> has been submitted
              and a notification email has been sent to <strong>{selectedUser.email}</strong>.
              This application is now linked to their account and visible in their dashboard.
            </p>
            <div className="anew-result-card">
              <div className="anew-result-row"><span>Reference</span>
                <strong style={{ fontFamily:'monospace' }}>#{submitted.id.slice(-8).toUpperCase()}</strong></div>
              <div className="anew-result-row"><span>Applicant</span><strong>{selectedUser.name}</strong></div>
              <div className="anew-result-row"><span>Decision</span>
                <AdminDecisionBadge decision={submitted.assessment.decision} /></div>
              <div className="anew-result-row"><span>Monthly Repayment</span>
                <strong>{fmt(submitted.assessment.monthlyRepayment)}</strong></div>
              <div className="anew-result-row"><span>Email Sent To</span>
                <strong style={{ color:'#166534' }}>{selectedUser.email}</strong></div>
              <div className="anew-result-row"><span>Account Linked</span>
                <strong style={{ color:'#166534' }}>Yes — visible in user dashboard</strong></div>
            </div>
            <div className="anew-success-actions">
              <Link to={`/admin/${submitted.id}`} className="btn-admin-primary">Review Application</Link>
              <button className="btn-admin-ghost" onClick={resetForm}>Submit Another</button>
              <Link to="/admin" className="btn-admin-ghost">Back to Dashboard</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <div className="container" style={{ maxWidth: 780 }}>

        <div className="adash-header animate-fade-up">
          <div>
            <p className="adash-eyebrow">Loan Application</p>
            <h2 className="adash-title">Apply on Behalf of User</h2>
            <p style={{ color:'#6b7280', fontSize:'0.88rem', marginTop:4 }}>
              Select a registered user and submit a loan application linked to their account.
            </p>
          </div>
          <Link to="/admin" className="btn-admin-ghost">Back to Dashboard</Link>
        </div>

        {/* Steps */}
        <div className="anew-steps animate-fade-up">
          {STEPS.map((label, i) => (
            <div key={i} className={`anew-step ${i===step?'active':i<step?'done':''}`}>
              <div className="anew-step-num">{i < step ? 'Done' : i + 1}</div>
              <div className="anew-step-label">{label}</div>
              {i < STEPS.length-1 && <div className="anew-step-line" />}
            </div>
          ))}
        </div>

        <div className="admin-card animate-fade-up">
          {serverError && <div className="anew-error">{serverError}</div>}

          {/* ── STEP 1: Select User ── */}
          {step === 0 && (
            <div>
              <h3 className="anew-section-title">Select Registered User</h3>

              {/* Search box */}
              <div className="anew-user-search-wrap">
                <input
                  className="admin-input"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>

              {/* Selected user banner */}
              {selectedUser && (
                <div className="anew-selected-user">
                  <div className="anew-selected-avatar">
                    {selectedUser.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="anew-selected-info">
                    <div className="anew-selected-name">{selectedUser.name}</div>
                    <div className="anew-selected-email">{selectedUser.email}</div>
                    {selectedUser.phone && (
                      <div className="anew-selected-phone">{selectedUser.phone}</div>
                    )}
                  </div>
                  <div className="anew-selected-badge">Selected</div>
                  <button className="anew-deselect" onClick={() => setSelectedUser(null)}>
                    Change
                  </button>
                </div>
              )}

              {/* User list */}
              {!selectedUser && (
                <div className="anew-user-list">
                  {usersLoading && (
                    <div className="anew-user-loading">
                      <div className="spinner" style={{ margin:'0 auto' }} />
                      <p>Loading registered users...</p>
                    </div>
                  )}
                  {!usersLoading && filteredUsers.length === 0 && (
                    <div className="anew-user-empty">
                      {userSearch
                        ? `No users found matching "${userSearch}"`
                        : 'No registered users found. Register a user first via Register User.'}
                    </div>
                  )}
                  {!usersLoading && filteredUsers.map(u => (
                    <button key={u.email} className="anew-user-item" onClick={() => selectUser(u)}>
                      <div className="anew-user-avatar">{u.name?.charAt(0).toUpperCase()}</div>
                      <div className="anew-user-info">
                        <div className="anew-user-name">{u.name}</div>
                        <div className="anew-user-email">{u.email}</div>
                      </div>
                      <div className="anew-user-source">{u.source === 'registered' ? 'Registered' : 'Returning'}</div>
                      <div className="anew-user-select">Select</div>
                    </button>
                  ))}
                </div>
              )}

              {errors.user && <p className="anew-err" style={{ marginTop:8 }}>{errors.user}</p>}

              {/* Age and Employment on same step */}
              {selectedUser && (
                <div>
                  <div style={{ height:1, background:'#e5e7eb', margin:'20px 0' }} />
                  <h3 className="anew-section-title" style={{ marginBottom:16 }}>Applicant Details</h3>
                  <div className="anew-grid-2">
                    <div className="anew-field">
                      <label className="admin-label">Age</label>
                      <input name="age" type="number"
                        className={`admin-input ${errors.age ? 'inp-err':''}`}
                        value={form.age} onChange={update} placeholder="e.g. 35" min="18" max="100" />
                      {errors.age && <p className="anew-err">{errors.age}</p>}
                    </div>
                    <div className="anew-field">
                      <label className="admin-label">Employment Status</label>
                      <select name="employmentStatus"
                        className={`admin-select ${errors.employmentStatus ? 'inp-err':''}`}
                        value={form.employmentStatus} onChange={update}>
                        <option value="">Select...</option>
                        <option value="employed">Employed — Full Time</option>
                        <option value="self_employed">Self-Employed</option>
                        <option value="unemployed">Unemployed</option>
                        <option value="retired">Retired</option>
                      </select>
                      {errors.employmentStatus && <p className="anew-err">{errors.employmentStatus}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Financial ── */}
          {step === 1 && (
            <div>
              <div className="anew-user-chip">
                <span>Applying for:</span>
                <strong>{selectedUser.name}</strong>
                <span className="anew-chip-email">{selectedUser.email}</span>
              </div>
              <h3 className="anew-section-title">Financial Information</h3>
              <div className="anew-grid-2">
                <div className="anew-field">
                  <label className="admin-label">Monthly Income (LSL)</label>
                  <input name="monthlyIncome" type="number"
                    className={`admin-input ${errors.monthlyIncome ? 'inp-err':''}`}
                    value={form.monthlyIncome} onChange={update} placeholder="e.g. 15000" min="0" />
                  {errors.monthlyIncome && <p className="anew-err">{errors.monthlyIncome}</p>}
                </div>
                <div className="anew-field">
                  <label className="admin-label">Monthly Expenses (LSL)</label>
                  <input name="monthlyExpenses" type="number"
                    className={`admin-input ${errors.monthlyExpenses ? 'inp-err':''}`}
                    value={form.monthlyExpenses} onChange={update}
                    placeholder={hintExp ? `Typical: ${hintExp.toLocaleString()}` : 'e.g. 7000'} min="0" />
                  {hintExp && !form.monthlyExpenses && (
                    <div className="anew-hint-box">
                      Typical: ~50% of income
                      <button type="button" className="anew-hint-btn"
                        onClick={() => setForm(f => ({ ...f, monthlyExpenses: String(hintExp) }))}>
                        Use {hintExp.toLocaleString()}
                      </button>
                    </div>
                  )}
                  {errors.monthlyExpenses && <p className="anew-err">{errors.monthlyExpenses}</p>}
                </div>
              </div>
              <div className="anew-grid-2">
                <div className="anew-field">
                  <label className="admin-label">Existing Monthly Debts (LSL)</label>
                  <input name="existingDebts" type="number"
                    className={`admin-input ${errors.existingDebts ? 'inp-err':''}`}
                    value={form.existingDebts} onChange={update}
                    placeholder={hintDebt ? `Max safe: ${hintDebt.toLocaleString()}` : 'e.g. 2000'} min="0" />
                  {hintDebt && !form.existingDebts && (
                    <div className="anew-hint-box">
                      Recommended: keep debts under 30% of income
                      <button type="button" className="anew-hint-btn"
                        onClick={() => setForm(f => ({ ...f, existingDebts:'0' }))}>
                        Use 0
                      </button>
                    </div>
                  )}
                  {errors.existingDebts && <p className="anew-err">{errors.existingDebts}</p>}
                </div>
                <div className="anew-field">
                  <label className="admin-label">Credit Score <span className="anew-opt">(300–850)</span></label>
                  <input name="creditScore" type="number"
                    className={`admin-input ${errors.creditScore ? 'inp-err':''}`}
                    value={form.creditScore} onChange={update} placeholder="e.g. 680" min="300" max="850" />
                  {form.creditScore && (
                    <div className={`anew-credit-bar ${Number(form.creditScore)>=700?'good':Number(form.creditScore)>=600?'fair':'poor'}`}>
                      {Number(form.creditScore)>=700 ? 'Good — strong approval chance' :
                       Number(form.creditScore)>=600 ? 'Fair — conditional approval possible' :
                       'Poor — approval unlikely'}
                    </div>
                  )}
                  {errors.creditScore && <p className="anew-err">{errors.creditScore}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Loan Details ── */}
          {step === 2 && (
            <div>
              <div className="anew-user-chip">
                <span>Applying for:</span>
                <strong>{selectedUser.name}</strong>
                <span className="anew-chip-email">{selectedUser.email}</span>
              </div>
              <h3 className="anew-section-title">Loan Details</h3>
              <div className="anew-grid-2">
                <div className="anew-field">
                  <label className="admin-label">Loan Amount (LSL)</label>
                  <input name="loanAmount" type="number"
                    className={`admin-input ${errors.loanAmount ? 'inp-err':''}`}
                    value={form.loanAmount} onChange={update}
                    placeholder={hintMax ? `Comfortable max: ${hintMax.toLocaleString()}` : 'e.g. 50000'} min="1" />
                  {hintMax && !form.loanAmount && (
                    <div className="anew-hint-box">Based on income, comfortable max is LSL {hintMax.toLocaleString()}</div>
                  )}
                  {errors.loanAmount && <p className="anew-err">{errors.loanAmount}</p>}
                </div>
                <div className="anew-field">
                  <label className="admin-label">Repayment Period</label>
                  <select name="repaymentMonths"
                    className={`admin-select ${errors.repaymentMonths ? 'inp-err':''}`}
                    value={form.repaymentMonths} onChange={update}>
                    <option value="">Select period...</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months — 1 year</option>
                    <option value="24">24 months — 2 years</option>
                    <option value="36">36 months — 3 years</option>
                    <option value="48">48 months — 4 years</option>
                    <option value="60">60 months — 5 years</option>
                    <option value="84">84 months — 7 years</option>
                    <option value="120">120 months — 10 years</option>
                  </select>
                  {errors.repaymentMonths && <p className="anew-err">{errors.repaymentMonths}</p>}
                </div>
              </div>
              {liveRep && (
                <div className="anew-repayment-preview">
                  <div className="anew-preview-row">
                    <span>Estimated Monthly Repayment</span><strong>{fmt(liveRep)}</strong>
                  </div>
                  <div className="anew-preview-row">
                    <span>Total Amount Repayable</span>
                    <strong>{fmt(liveRep * Number(form.repaymentMonths))}</strong>
                  </div>
                  <div className="anew-preview-row">
                    <span>Total Interest (10% p.a.)</span>
                    <strong>{fmt(liveRep * Number(form.repaymentMonths) - Number(form.loanAmount))}</strong>
                  </div>
                </div>
              )}
              <div className="anew-field">
                <label className="admin-label">Purpose of Loan</label>
                <textarea name="purpose"
                  className={`admin-textarea ${errors.purpose ? 'inp-err':''}`}
                  value={form.purpose} onChange={update}
                  placeholder="Describe the purpose of the loan..." rows={3} />
                {errors.purpose && <p className="anew-err">{errors.purpose}</p>}
              </div>
            </div>
          )}

          {/* ── STEP 4: Review ── */}
          {step === 3 && preview && (
            <div>
              <div className="anew-user-chip">
                <span>Applying for:</span>
                <strong>{selectedUser.name}</strong>
                <span className="anew-chip-email">{selectedUser.email}</span>
              </div>
              <h3 className="anew-section-title">Review Before Submission</h3>

              <div className="anew-review-decision">
                <div className="anew-review-decision-label">Prolog Expert System Decision</div>
                <AdminDecisionBadge decision={preview.decision} />
                {preview.reasons?.length > 0 && (
                  <ul className="anew-review-reasons">
                    {preview.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                {preview.reasons?.length === 0 && (
                  <p style={{ color:'#166534', fontSize:'0.85rem', marginTop:8 }}>All criteria satisfied.</p>
                )}
              </div>

              <div className="anew-review-grid">
                <div className="anew-review-section">
                  <p className="anew-review-heading">Applicant</p>
                  <div className="anew-review-row"><span>Name</span><strong>{selectedUser.name}</strong></div>
                  <div className="anew-review-row"><span>Email</span><strong>{selectedUser.email}</strong></div>
                  <div className="anew-review-row"><span>Age</span><strong>{form.age}</strong></div>
                  <div className="anew-review-row"><span>Employment</span><strong>{form.employmentStatus?.replace('_',' ')}</strong></div>
                </div>
                <div className="anew-review-section">
                  <p className="anew-review-heading">Financials</p>
                  <div className="anew-review-row"><span>Income</span><strong>{fmt(form.monthlyIncome)}</strong></div>
                  <div className="anew-review-row"><span>Expenses</span><strong>{fmt(form.monthlyExpenses)}</strong></div>
                  <div className="anew-review-row"><span>Debts</span><strong>{fmt(form.existingDebts)}</strong></div>
                  <div className="anew-review-row"><span>Credit Score</span><strong>{form.creditScore}</strong></div>
                </div>
                <div className="anew-review-section">
                  <p className="anew-review-heading">Loan</p>
                  <div className="anew-review-row"><span>Amount</span><strong>{fmt(form.loanAmount)}</strong></div>
                  <div className="anew-review-row"><span>Period</span><strong>{form.repaymentMonths} months</strong></div>
                  <div className="anew-review-row"><span>Monthly Rep.</span><strong>{fmt(preview.monthlyRepayment)}</strong></div>
                  <div className="anew-review-row"><span>DTI Ratio</span><strong>{preview.debtToIncomeRatio}%</strong></div>
                </div>
              </div>

              <div className="anew-email-notice">
                An application confirmation and decision email will be sent to <strong>{selectedUser.email}</strong>.
                This application will also be linked to their account and visible in their dashboard.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="anew-nav">
            {step > 0 && (
              <button type="button" className="btn-admin-ghost" onClick={prevStep}>Back</button>
            )}
            <div style={{ flex:1 }} />
            {step < 3 && (
              <button type="button" className="btn-admin-primary" onClick={nextStep}>Continue</button>
            )}
            {step === 3 && (
              <button type="button" className="btn-admin-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit & Notify Applicant'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
