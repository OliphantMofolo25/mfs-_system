// src/hooks/useApplications.js
import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

// Hook: get current user's applications (live)
export function useMyApplications() {
  const { currentUser } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentUser) return
    const q = query(
      collection(db, 'loan_applications'),
      where('applicantId', '==', currentUser.uid),
      orderBy('submittedAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [currentUser])

  return { applications, loading, error }
}

// Hook: get ALL applications (officer only, live)
export function useAllApplications(filterStatus = 'ALL') {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q
    if (filterStatus === 'ALL') {
      q = query(collection(db, 'loan_applications'), orderBy('submittedAt', 'desc'))
    } else {
      q = query(
        collection(db, 'loan_applications'),
        where('decision', '==', filterStatus),
        orderBy('submittedAt', 'desc')
      )
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [filterStatus])

  return { applications, loading, error }
}

// Function: submit a new loan application
export async function submitApplication(applicantData, decisionResult, currentUser, userProfile) {
  const applicationData = {
    // Applicant identity
    applicantId: currentUser.uid,
    applicantName: userProfile.fullName,
    applicantEmail: currentUser.email,

    // Form fields
    age: applicantData.age,
    employmentStatus: applicantData.employmentStatus,
    monthlyIncome: applicantData.monthlyIncome,
    monthlyExpenses: applicantData.monthlyExpenses,
    creditScore: applicantData.creditScore,
    existingDebts: applicantData.existingDebts,
    loanAmount: applicantData.loanAmount,
    repaymentMonths: applicantData.repaymentMonths,
    purpose: applicantData.purpose,

    // Expert system output
    decision: decisionResult.decision,
    decisionReasons: decisionResult.reasons,
    monthlyRepayment: decisionResult.monthlyRepayment,
    disposableIncome: decisionResult.disposableIncome,
    debtToIncomeRatio: decisionResult.debtToIncomeRatio,

    // Officer fields (empty at submission)
    overriddenByOfficer: false,
    officerNotes: '',

    // Timestamps
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const ref = await addDoc(collection(db, 'loan_applications'), applicationData)
  return ref.id
}

// Function: officer updates/overrides a decision
export async function updateApplicationDecision(appId, decision, officerNotes) {
  await updateDoc(doc(db, 'loan_applications', appId), {
    decision,
    officerNotes,
    overriddenByOfficer: true,
    updatedAt: serverTimestamp(),
  })
}

// Function: get a single application by ID
export async function getApplication(appId) {
  const snap = await getDoc(doc(db, 'loan_applications', appId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}
