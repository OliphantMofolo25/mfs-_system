// src/pages/NewApplication.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { assessLoan, calcMonthlyRepayment } from '../prolog/loanRules'
import { sendSubmissionEmail } from '../services/emailService'
import './NewApplication.css'

const STEPS = ['Personal Details', 'Financial Information', 'Loan Details']

// Credit score estimator questions
const CREDIT_QUESTIONS = [
  { key: 'hasLoans',       label: 'Do you have any existing loans or credit accounts?', yes: -10, no: 20 },
  { key: 'paidOnTime',     label: 'Have you consistently paid bills and debts on time?', yes: 80, no: -30 },
  { key: 'longHistory',    label: 'Have you had any bank account for more than 2 years?', yes: 40, no: 0 },
  { key: 'multipleDebts',  label: 'Do you have more than 3 active debt accounts?', yes: -40, no: 20 },
  { key: 'recentDefaults', label: 'Have you ever defaulted or missed payments in the last 2 years?', yes: -80, no: 30 },
  { key: 'stableIncome',   label: 'Do you have a stable, regular source of income?', yes: 50, no: -20 },
]

export default function NewApplication() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]       = useState(0)
  const [form, setForm]       = useState({
    // Pre-filled from profile
    fullName:         profile?.fullName || user?.displayName || '',
    phoneNumber:      '',
    age:              '',
    employmentStatus: '',
    // Financial
    monthlyIncome:    '',
    monthlyExpenses:  '',
    existingDebts:    '',
    creditScore:      '',
    // Loan
    loanAmount:       '',
    repaymentMonths:  '',
    purpose:          '',
  })
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Smart hints computed from income
  const income       = Number(form.monthlyIncome) || 0
  const suggestExp   = income > 0 ? Math.round(income * 0.5)  : null
  const suggestMax   = income > 0 ? Math.round(income * 2.5)  : null
  const suggestDebt  = income > 0 ? Math.round(income * 0.3)  : null

  // Live repayment preview
  const liveRepayment = form.loanAmount && form.repaymentMonths
    ? calcMonthlyRepayment(Number(form.loanAmount), Number(form.repaymentMonths))
    : null

  // Credit score estimator
  const [showCreditCalc, setShowCreditCalc]   = useState(false)
  const [creditAnswers, setCreditAnswers]     = useState({})
  const [estimatedScore, setEstimatedScore]   = useState(null)

  function calcCreditScore() {
    let score = 580 // base score
    CREDIT_QUESTIONS.forEach(q => {
      if (creditAnswers[q.key] === 'yes') score += q.yes
      if (creditAnswers[q.key] === 'no')  score += q.no
    })
    score = Math.max(300, Math.min(850, score))
    setEstimatedScore(score)
    return score
  }

  function applyEstimatedScore() {
    const score = calcCreditScore()
    setForm(f => ({ ...f, creditScore: String(score) }))
    setShowCreditCalc(false)
    setEstimatedScore(null)
    setCreditAnswers({})
  }

  function update(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(er => ({ ...er, [name]: '' }))
  }

  function validateStep() {
    const errs = {}
    if (step === 0) {
      if (!form.fullName.trim())  errs.fullName = 'Required'
      if (!form.age || Number(form.age) < 18 || Number(form.age) > 100) errs.age = 'Must be between 18 and 100'
      if (!form.employmentStatus) errs.employmentStatus = 'Required'
    }
    if (step === 1) {
      if (!form.monthlyIncome || Number(form.monthlyIncome) <= 0) errs.monthlyIncome = 'Must be greater than 0'
      if (form.monthlyExpenses === '' || Number(form.monthlyExpenses) < 0) errs.monthlyExpenses = 'Must be 0 or more'
      if (form.existingDebts === '' || Number(form.existingDebts) < 0)    errs.existingDebts   = 'Must be 0 or more'
      if (!form.creditScore || Number(form.creditScore) < 300 || Number(form.creditScore) > 850)
        errs.creditScore = 'Must be between 300 and 850'
    }
    if (step === 2) {
      if (!form.loanAmount || Number(form.loanAmount) <= 0) errs.loanAmount = 'Must be greater than 0'
      if (!form.repaymentMonths || Number(form.repaymentMonths) < 1 || Number(form.repaymentMonths) > 360)
        errs.repaymentMonths = 'Between 1 and 360 months'
      if (!form.purpose.trim()) errs.purpose = 'Please describe the loan purpose'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() { if (validateStep()) setStep(s => s + 1) }
  function prevStep() { setStep(s => s - 1) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validateStep()) return
    setSubmitting(true)
    setSubmitError('')

    const assessment = assessLoan({
      age:              Number(form.age),
      employmentStatus: form.employmentStatus,
      monthlyIncome:    Number(form.monthlyIncome),
      monthlyExpenses:  Number(form.monthlyExpenses),
      creditScore:      Number(form.creditScore),
      existingDebts:    Number(form.existingDebts),
      loanAmount:       Number(form.loanAmount),
      repaymentMonths:  Number(form.repaymentMonths),
    })

    try {
      const docRef = await addDoc(collection(db, 'loan_applications'), {
        applicantId:         user.uid,
        applicantName:       form.fullName,
        applicantEmail:      user.email,
        phoneNumber:         form.phoneNumber,
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
        officerNotes:        '',
        submittedAt:         serverTimestamp(),
        updatedAt:           serverTimestamp(),
      })

      await sendSubmissionEmail({
        applicantName:     form.fullName,
        applicantEmail:    user.email,
        appId:             docRef.id,
        loanAmount:        Number(form.loanAmount),
        repaymentMonths:   Number(form.repaymentMonths),
        monthlyRepayment:  assessment.monthlyRepayment,
        disposableIncome:  assessment.disposableIncome,
        debtToIncomeRatio: assessment.debtToIncomeRatio,
        creditScore:       Number(form.creditScore),
        decision:          assessment.decision,
        decisionReasons:   assessment.reasons,
        officerNotes:      '',
      })

      navigate(`/application/${docRef.id}`)
    } catch (err) {
      console.error('Submit error:', err)
      setSubmitError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fmtLSL = n => n ? `LSL ${Number(n).toLocaleString()}` : ''

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 740 }}>

        <div className="app-form-header">
          <h2>New Loan Application</h2>
          <p>Complete all three steps — your decision is instant upon submission</p>
        </div>

        {/* Step Progress */}
        <div className="steps-bar">
          {STEPS.map((label, i) => (
            <div key={i} className="step-item">
              <div>
                <div className={`step-circle ${i < step ? 'complete' : i === step ? 'active' : ''}`}>
                  {i < step ? 'Done' : i + 1}
                </div>
                <div className="step-label">{label}</div>
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'complete' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="card animate-fade-up">
          {submitError && <div className="alert alert-error">{submitError}</div>}
          <form onSubmit={handleSubmit}>

            {/* ── STEP 1: Personal Details ── */}
            {step === 0 && (
              <div>
                <h3 className="step-title">Personal Details</h3>

                {/* Autofill notice */}
                {(form.fullName || user?.email) && (
                  <div className="autofill-notice">
                    Some fields have been pre-filled from your account. Please verify and update if needed.
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Full Name
                      {form.fullName && <span className="autofill-tag">Pre-filled</span>}
                    </label>
                    <input name="fullName" className={`form-input ${errors.fullName ? 'error' : ''}`}
                      value={form.fullName} onChange={update} placeholder="Your full legal name" />
                    {errors.fullName && <p className="form-error">{errors.fullName}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age</label>
                    <input name="age" type="number" className={`form-input ${errors.age ? 'error' : ''}`}
                      value={form.age} onChange={update} placeholder="e.g. 35" min="18" max="100" />
                    {errors.age && <p className="form-error">{errors.age}</p>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email Address
                    <span className="autofill-tag">Pre-filled from account</span>
                  </label>
                  <input className="form-input" value={user?.email || ''} readOnly
                    style={{ background: '#f8f9ff', color: '#6b7280', cursor: 'not-allowed' }} />
                  <p className="form-hint">This is your registered email — all communications will be sent here.</p>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select name="employmentStatus" className={`form-select ${errors.employmentStatus ? 'error' : ''}`}
                      value={form.employmentStatus} onChange={update}>
                      <option value="">Select your status...</option>
                      <option value="employed">Employed — Full Time</option>
                      <option value="self_employed">Self-Employed</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="retired">Retired</option>
                    </select>
                    {errors.employmentStatus && <p className="form-error">{errors.employmentStatus}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number <span className="label-optional">(Optional)</span></label>
                    <input name="phoneNumber" className="form-input"
                      value={form.phoneNumber} onChange={update} placeholder="+266 5000 0000" />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Financial Info ── */}
            {step === 1 && (
              <div>
                <h3 className="step-title">Financial Information</h3>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Monthly Income (LSL)</label>
                    <input name="monthlyIncome" type="number" className={`form-input ${errors.monthlyIncome ? 'error' : ''}`}
                      value={form.monthlyIncome} onChange={update} placeholder="e.g. 15000" min="0" />
                    {errors.monthlyIncome && <p className="form-error">{errors.monthlyIncome}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Expenses (LSL)</label>
                    <input name="monthlyExpenses" type="number" className={`form-input ${errors.monthlyExpenses ? 'error' : ''}`}
                      value={form.monthlyExpenses} onChange={update}
                      placeholder={suggestExp ? `Suggested: LSL ${suggestExp.toLocaleString()}` : 'e.g. 7000'} min="0" />
                    {suggestExp && !form.monthlyExpenses && (
                      <div className="smart-hint">
                        Typical expenses are around 50% of income.
                        <button type="button" className="hint-apply" onClick={() => setForm(f => ({ ...f, monthlyExpenses: String(suggestExp) }))}>
                          Use LSL {suggestExp.toLocaleString()}
                        </button>
                      </div>
                    )}
                    {errors.monthlyExpenses && <p className="form-error">{errors.monthlyExpenses}</p>}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Existing Monthly Debt Payments (LSL)</label>
                    <input name="existingDebts" type="number" className={`form-input ${errors.existingDebts ? 'error' : ''}`}
                      value={form.existingDebts} onChange={update}
                      placeholder={suggestDebt ? `Max recommended: LSL ${suggestDebt.toLocaleString()}` : 'e.g. 2000'} min="0" />
                    {suggestDebt && !form.existingDebts && (
                      <div className="smart-hint">
                        Keep debts under 30% of income for best approval chances.
                        <button type="button" className="hint-apply" onClick={() => setForm(f => ({ ...f, existingDebts: '0' }))}>
                          Use 0 if none
                        </button>
                      </div>
                    )}
                    <p className="form-hint">Total of all current monthly loan/credit repayments</p>
                    {errors.existingDebts && <p className="form-error">{errors.existingDebts}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Credit Score
                      <span className="label-optional">(300–850)</span>
                    </label>
                    <div className="credit-input-row">
                      <input name="creditScore" type="number" className={`form-input ${errors.creditScore ? 'error' : ''}`}
                        value={form.creditScore} onChange={update}
                        placeholder="e.g. 680" min="300" max="850" />
                      <button type="button" className="btn-estimate-credit"
                        onClick={() => setShowCreditCalc(true)}>
                        Estimate Mine
                      </button>
                    </div>
                    {form.creditScore && (
                      <div className={`credit-indicator ${
                        Number(form.creditScore) >= 700 ? 'good' :
                        Number(form.creditScore) >= 600 ? 'fair' : 'poor'
                      }`}>
                        {Number(form.creditScore) >= 700 ? 'Good — strong approval chance' :
                         Number(form.creditScore) >= 600 ? 'Fair — conditional approval possible' :
                         'Below threshold — approval unlikely'}
                      </div>
                    )}
                    {!form.creditScore && (
                      <p className="form-hint">Don't know your score? Click "Estimate Mine" for a quick calculation.</p>
                    )}
                    {errors.creditScore && <p className="form-error">{errors.creditScore}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Loan Details ── */}
            {step === 2 && (
              <div>
                <h3 className="step-title">Loan Details</h3>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Loan Amount Requested (LSL)</label>
                    <input name="loanAmount" type="number" className={`form-input ${errors.loanAmount ? 'error' : ''}`}
                      value={form.loanAmount} onChange={update}
                      placeholder={suggestMax ? `Max recommended: LSL ${suggestMax.toLocaleString()}` : 'e.g. 50000'} min="1" />
                    {suggestMax && !form.loanAmount && (
                      <div className="smart-hint">
                        Based on your income, a comfortable loan is up to LSL {suggestMax.toLocaleString()}.
                      </div>
                    )}
                    {errors.loanAmount && <p className="form-error">{errors.loanAmount}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Repayment Period (Months)</label>
                    <select name="repaymentMonths" className={`form-select ${errors.repaymentMonths ? 'error' : ''}`}
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
                    {errors.repaymentMonths && <p className="form-error">{errors.repaymentMonths}</p>}
                  </div>
                </div>

                {/* Live repayment preview */}
                {liveRepayment && (
                  <div className="repayment-preview">
                    <div className="repayment-preview-row">
                      <span>Estimated Monthly Repayment</span>
                      <strong>LSL {liveRepayment.toLocaleString('en-LS', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="repayment-preview-row">
                      <span>Total Amount Repayable</span>
                      <strong>LSL {(liveRepayment * Number(form.repaymentMonths)).toLocaleString('en-LS', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="repayment-preview-row">
                      <span>Total Interest (at 10% p.a.)</span>
                      <strong>LSL {(liveRepayment * Number(form.repaymentMonths) - Number(form.loanAmount)).toLocaleString('en-LS', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: 8, marginBottom: 0 }}>
                      Indicative figures at 10% annual interest. Final terms subject to approval.
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Purpose of Loan</label>
                  <textarea name="purpose" className={`form-textarea ${errors.purpose ? 'error' : ''}`}
                    value={form.purpose} onChange={update}
                    placeholder="Briefly describe what you will use the loan for..." rows={3} />
                  {errors.purpose && <p className="form-error">{errors.purpose}</p>}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="form-nav">
              {step > 0 && (
                <button type="button" className="btn btn-ghost" onClick={prevStep}>Back</button>
              )}
              <div style={{ flex: 1 }} />
              {step < 2 && (
                <button type="button" className="btn btn-primary" onClick={nextStep}>Continue</button>
              )}
              {step === 2 && (
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Submit Application'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Credit Score Estimator Modal */}
      {showCreditCalc && (
        <div className="modal-overlay" onClick={() => setShowCreditCalc(false)}>
          <div className="credit-calc-modal" onClick={e => e.stopPropagation()}>
            <div className="credit-calc-header">
              <h3>Credit Score Estimator</h3>
              <p>Answer these questions honestly to get an estimated credit score.</p>
            </div>

            <div className="credit-calc-questions">
              {CREDIT_QUESTIONS.map(q => (
                <div key={q.key} className="credit-question">
                  <p className="credit-question-text">{q.label}</p>
                  <div className="credit-question-options">
                    <button type="button"
                      className={`credit-opt ${creditAnswers[q.key] === 'yes' ? 'selected' : ''}`}
                      onClick={() => setCreditAnswers(a => ({ ...a, [q.key]: 'yes' }))}>
                      Yes
                    </button>
                    <button type="button"
                      className={`credit-opt ${creditAnswers[q.key] === 'no' ? 'selected' : ''}`}
                      onClick={() => setCreditAnswers(a => ({ ...a, [q.key]: 'no' }))}>
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {estimatedScore && (
              <div className={`credit-result ${estimatedScore >= 700 ? 'good' : estimatedScore >= 600 ? 'fair' : 'poor'}`}>
                <div className="credit-result-score">{estimatedScore}</div>
                <div className="credit-result-label">
                  {estimatedScore >= 700 ? 'Good Credit Score' :
                   estimatedScore >= 600 ? 'Fair Credit Score' : 'Poor Credit Score'}
                </div>
              </div>
            )}

            <div className="credit-calc-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreditCalc(false)}>Cancel</button>
              {!estimatedScore ? (
                <button type="button" className="btn btn-primary"
                  disabled={Object.keys(creditAnswers).length < CREDIT_QUESTIONS.length}
                  onClick={calcCreditScore}>
                  Calculate Score
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={applyEstimatedScore}>
                  Use This Score
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
