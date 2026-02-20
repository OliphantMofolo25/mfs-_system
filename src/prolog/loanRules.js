// src/prolog/loanRules.js
// ─────────────────────────────────────────────────────────────────
// JavaScript mirror of loan_system.pl (SWI-Prolog)
// All decision logic matches the Prolog predicates exactly.
// ─────────────────────────────────────────────────────────────────

/**
 * Monthly repayment using amortization formula (mirrors monthly_repayment/2)
 * Annual interest rate: 10%
 */
export function calcMonthlyRepayment(loanAmount, months) {
  if (months <= 0 || loanAmount <= 0) return 0
  const rate = 0.10 / 12
  return (loanAmount * rate * Math.pow(1 + rate, months)) /
         (Math.pow(1 + rate, months) - 1)
}

/**
 * Debt-to-income ratio % (mirrors debt_to_income/2)
 */
export function calcDTI(monthlyIncome, existingDebts) {
  if (monthlyIncome <= 0) return 100
  return (existingDebts / monthlyIncome) * 100
}

/**
 * Disposable income (mirrors disposable_income/2)
 */
export function calcDisposable(monthlyIncome, monthlyExpenses, existingDebts) {
  return monthlyIncome - monthlyExpenses - existingDebts
}

/**
 * Main assessment function — mirrors loan_decision/2 and reason/2
 *
 * @param {Object} applicant - all form fields
 * @returns {{ decision, reasons, monthlyRepayment, disposableIncome, debtToIncomeRatio }}
 */
export function assessLoan(applicant) {
  const {
    age,
    employmentStatus,
    monthlyIncome,
    monthlyExpenses,
    creditScore,
    existingDebts,
    loanAmount,
    repaymentMonths,
  } = applicant

  const reasons = []

  // ── Rule 1: age_eligible/1 ───────────────────────────────────
  const ageOk = Number(age) >= 18 && Number(age) <= 65
  if (!ageOk) reasons.push('Age is outside the eligible range of 18 – 65 years')

  // ── Rule 2: employment_eligible/1 ────────────────────────────
  const empOk = ['employed', 'self_employed'].includes(employmentStatus)
  if (!empOk) reasons.push('Applicant must be employed or self-employed')

  // ── Rule 3: has_disposable_income/1 ──────────────────────────
  const disposable = calcDisposable(
    Number(monthlyIncome), Number(monthlyExpenses), Number(existingDebts)
  )
  const hasDisposable = disposable > 0
  if (!hasDisposable) reasons.push('No positive disposable income after expenses and existing debts')

  // ── Rule 4: affordable/1  (40% rule) ─────────────────────────
  const monthlyRep = calcMonthlyRepayment(Number(loanAmount), Number(repaymentMonths))
  const affordable = monthlyRep <= Number(monthlyIncome) * 0.40
  if (!affordable) reasons.push('Estimated monthly repayment exceeds 40% of monthly income')

  // ── Rule 5: credit_eligible/1 ────────────────────────────────
  const creditOk = Number(creditScore) >= 600
  if (!creditOk) reasons.push('Credit score is below the minimum threshold of 600')

  // ── Rule 6: low_debt_ratio/1 ─────────────────────────────────
  const dti   = calcDTI(Number(monthlyIncome), Number(existingDebts))
  const lowDTI = dti <= 40
  if (!lowDTI) reasons.push(`Debt-to-income ratio is ${dti.toFixed(1)}% (must be ≤ 40%)`)

  // ── Decision Logic (mirrors loan_decision/2) ──────────────────

  // APPROVED: all criteria met
  if (ageOk && empOk && hasDisposable && affordable && creditOk && lowDTI) {
    return result('APPROVED', [], monthlyRep, disposable, dti)
  }

  // CONDITIONAL_APPROVED: core met, minor issues on credit/DTI
  if (ageOk && empOk && hasDisposable && affordable && (!creditOk || !lowDTI)) {
    return result('CONDITIONAL_APPROVED', reasons, monthlyRep, disposable, dti)
  }

  // REJECTED: major disqualifier
  return result('REJECTED', reasons, monthlyRep, disposable, dti)
}

function result(decision, reasons, monthlyRepayment, disposableIncome, debtToIncomeRatio) {
  return {
    decision,
    reasons,
    monthlyRepayment: parseFloat(monthlyRepayment.toFixed(2)),
    disposableIncome: parseFloat(disposableIncome.toFixed(2)),
    debtToIncomeRatio: parseFloat(debtToIncomeRatio.toFixed(2)),
  }
}
