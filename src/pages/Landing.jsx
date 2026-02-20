// src/pages/Landing.jsx
import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg-pattern" />
        <div className="container hero-content">
          <div className="hero-tag">Intelligent Loan Assessment</div>
          <h1>
            Fast, Fair & Transparent<br/>
            <em>Loan Decisions</em>
          </h1>
          <p className="hero-sub">
            Motsitseng Financial Services uses an AI-powered expert system to evaluate your 
            loan application instantly — based on clear, fair criteria.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Apply for a Loan</Link>
            <Link to="/login"    className="btn btn-outline btn-lg">Sign In</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features container">
        <div className="section-label">How It Works</div>
        <h2>Three steps to a decision</h2>
        <div className="grid-3 features-grid">
          {[
            { icon: 'Apps', step: '01', title: 'Submit Your Application', desc: 'Fill in your personal details, financial information, and loan requirements through our secure form.' },
            { icon: '⚖', step: '02', title: 'Prolog Expert System Evaluates', desc: 'Our AI engine applies financial rules — affordability, credit score, debt ratios — to assess your profile.' },
            { icon: '', step: '03', title: 'Receive Your Decision', desc: 'Get an instant decision with a full explanation, and receive an email confirmation to your inbox.' },
          ].map(f => (
            <div key={f.step} className="feature-card">
              <div className="feature-step">{f.step}</div>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Criteria */}
      <section className="criteria-section">
        <div className="container">
          <div className="section-label">Assessment Criteria</div>
          <h2>What we evaluate</h2>
          <div className="grid-2 criteria-grid">
            {[
              { icon: '', title: 'Age & Employment', desc: 'Applicants must be 18–65 and employed or self-employed.' },
              { icon: 'Credit', title: 'Credit Score',    desc: 'A minimum score of 600 is required for full approval.' },
              { icon: 'Stats', title: '40% Affordability Rule', desc: 'Monthly repayments must not exceed 40% of your income.' },
              { icon: 'DTI', title: 'Debt-to-Income Ratio', desc: 'Existing debts must be below 40% of your monthly income.' },
            ].map(c => (
              <div key={c.title} className="criteria-card">
                <span className="criteria-icon">{c.icon}</span>
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section container">
        <div className="cta-inner">
          <h2>Ready to apply?</h2>
          <p>Create your account and submit your first application in minutes.</p>
          <Link to="/register" className="btn btn-primary btn-lg">Get Started →</Link>
        </div>
      </section>
    </div>
  )
}
