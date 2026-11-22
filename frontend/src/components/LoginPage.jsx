import { useState } from 'react'
import SunPowerBrand from './SunPowerBrand'

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@sunpower.demo' },
  { role: 'SALES', email: 'sales@sunpower.demo' },
  { role: 'SURVEYOR', email: 'surveyor@sunpower.demo' },
  { role: 'WAREHOUSE', email: 'warehouse@sunpower.demo' },
  { role: 'TECHNICIAN', email: 'technician@sunpower.demo' },
  { role: 'SUPPORT', email: 'support@sunpower.demo' },
  { role: 'FINANCE', email: 'finance@sunpower.demo' },
  { role: 'CUSTOMER', email: 'customer@sunpower.demo' },
]

export default function LoginPage({
  onLogin,
  onNavigate,
  onRetry,
  notice,
  serviceError,
  busy,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demoRole, setDemoRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await onLogin(email.trim(), password)
    } catch (loginError) {
      setError(loginError.message)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <SunPowerBrand subtitle="Solar Installation Management" />
        <div className="auth-story-copy">
          <p className="auth-eyebrow">Powering every rooftop</p>
          <h1>One workspace for every solar journey.</h1>
          <p>Coordinate customers, surveys, installations, and service with a team built around reliable solar delivery.</p>
        </div>
        <p className="auth-story-foot">Odoo × LPU Hackathon · SunPower Solutions</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <SunPowerBrand subtitle="Team and customer portal" />
          <div className="auth-heading">
            <p className="auth-eyebrow">Welcome back</p>
            <h2>Sign in to your account</h2>
            <p>Use the email address associated with your SunPower account.</p>
          </div>

          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {serviceError && (
            <div className="auth-error" role="alert">
              <p>{serviceError}</p>
              <button type="button" className="auth-retry" onClick={onRetry}>Retry session check</button>
            </div>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}

          <form className="auth-form" onSubmit={submit}>
            <label className="auth-field">
              <span>Quick Demo Login (optional)</span>
              <select
                value={demoRole}
                onChange={(event) => {
                  const role = event.target.value
                  setDemoRole(role)
                  const account = DEMO_ACCOUNTS.find((demoAccount) => demoAccount.role === role)
                  if (account) setEmail(account.email)
                }}
              >
                <option value="">Choose a role to prefill an email</option>
                {DEMO_ACCOUNTS.map(({ role }) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <small className="auth-demo-note">Prefills the email only. Enter the password manually.</small>
            </label>

            <label className="auth-field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setDemoRole('')
                }}
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <span className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            <p className="auth-security-note">
              Your session uses a secure HttpOnly cookie. No authentication token is stored in browser storage.
            </p>

            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            New to SunPower?{' '}
            <a href="/register" onClick={(event) => {
              event.preventDefault()
              onNavigate('/register')
            }}>
              Create a customer account
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}
