# MFS Loan Assessment System

Motsitseng Financial Services — AI-powered loan assessment using Prolog expert system rules.

## Tech Stack
- **Frontend**: React + Vite
- **Auth & DB**: Firebase Auth + Firestore
- **Email**: Firebase Cloud Functions + Nodemailer (Gmail)
- **Expert System**: SWI-Prolog (`prolog/loan_system.pl`) + JS mirror (`src/prolog/loanRules.js`)

## Quick Start

### 1. Install Dependencies
```bash
npm install
cd functions && npm install && cd ..
```

### 2. Configure Firebase
Copy `.env.example` to `.env` and fill in your Firebase project values:
```bash
cp .env.example .env
```

### 3. Set Email Config (Cloud Functions)
```bash
firebase functions:config:set email.user="yourgmail@gmail.com" email.pass="your_app_password"
```
> Use a Gmail **App Password** (not your regular password). Enable 2FA first, then generate at myaccount.google.com/apppasswords

### 4. Run Locally
```bash
npm run dev
# In another terminal:
firebase emulators:start --only functions,firestore,auth
```

### 5. Run Prolog Expert System
```bash
swipl prolog/loan_system.pl
?- run.
```

### 6. Deploy
```bash
npm run build
firebase deploy
```

## Project Structure
```
src/
  components/   Navbar, ProtectedRoute, DecisionBadge, StatsWidget
  pages/        Landing, Login, Register, Dashboard, NewApplication,
                ApplicationDetail, AdminDashboard, AdminApplicationView
  prolog/       loanRules.js  ← JS mirror of Prolog rules
  firebase/     config.js
  context/      AuthContext.jsx
prolog/
  loan_system.pl  ← Submit this for the Prolog component
functions/
  index.js      ← 3 email triggers: onUserRegistered, onApplicationSubmitted, onDecisionChanged
```

## Creating an Officer Account
1. Register normally through the UI
2. In Firebase Console → Firestore → users → find the user document
3. Change `role` from `"applicant"` to `"officer"`
4. The user will now see the Admin Dashboard on next login

## Email Triggers
| Event | Template |
|-------|----------|
| User registers | Welcome email |
| Loan application submitted | Submission confirmation with reference number |
| Decision made / changed | Decision email with full breakdown |
