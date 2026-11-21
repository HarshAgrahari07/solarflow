import { useState } from 'react'
import SunPowerBrand from './SunPowerBrand'

export default function CustomerRegistrationPage({ onRegister, onNavigate, busy }) {
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')

    if (password.length < 12) {
      setError('Choose a password with at least 12 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The password and confirmation do not match.')
      return
    }

    try {
      await onRegister({
        fullName: String(formData.get('fullName') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        address: String(formData.get('address') || '').trim(),
        category: String(formData.get('category') || ''),
        solarRequirement: String(formData.get('solarRequirement') || ''),
        capacityKw: String(formData.get('capacityKw') || '') === ''
          ? null
          : Number(formData.get('capacityKw')),
        password,
      })
    } catch (registrationError) {
      setError(registrationError.message)
    }
  }

  return (
    <main className="auth-page auth-page-register">
      <section className="auth-story">
        <SunPowerBrand subtitle="Customer account" />
        <div className="auth-story-copy">
          <p className="auth-eyebrow">Welcome to SunPower</p>
          <h1>Your solar journey starts here.</h1>
          <p>Create a customer account to save your profile and solar requirements securely.</p>
        </div>
        <p className="auth-story-foot">Customer registration creates a CUSTOMER account only.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel auth-panel-wide">
          <SunPowerBrand subtitle="Customer portal registration" />
          <div className="auth-heading">
            <p className="auth-eyebrow">Get started</p>
            <h2>Create your account</h2>
            <p>Profile fields are required. Capacity is optional and must be from 1 to 5 kW when provided. Staff accounts are created by an administrator.</p>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <form className="auth-form auth-form-grid" onSubmit={submit}>
            <label className="auth-field">
              <span>Full name</span>
              <input name="fullName" autoComplete="name" minLength="2" maxLength="120" required />
            </label>
            <label className="auth-field">
              <span>Email address</span>
              <input name="email" type="email" autoComplete="email" maxLength="254" required />
            </label>
            <label className="auth-field">
              <span>Phone number</span>
              <input name="phone" type="tel" autoComplete="tel" minLength="7" maxLength="32" required />
            </label>
            <label className="auth-field">
              <span>Address</span>
              <input name="address" autoComplete="street-address" minLength="5" maxLength="500" required />
            </label>
            <label className="auth-field">
              <span>Customer category</span>
              <select name="category" defaultValue="" required>
                <option value="" disabled>Select Home or Small Factory</option>
                <option value="Home">Home</option>
                <option value="Small Factory">Small Factory</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Solar requirement</span>
              <select name="solarRequirement" defaultValue="" required>
                <option value="" disabled>Select a solar requirement</option>
                <option value="On-Grid System">On-Grid System</option>
                <option value="Off-Grid System">Off-Grid System</option>
                <option value="Solar Panel Set">Solar Panel Set</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Estimated system capacity (optional)</span>
              <input name="capacityKw" type="number" min="1" max="5" step="any" placeholder="1 to 5 kW" />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input name="password" type="password" autoComplete="new-password" minLength="12" maxLength="72" required />
            </label>
            <label className="auth-field">
              <span>Confirm password</span>
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength="12" maxLength="72" required />
            </label>
            <p className="auth-security-note auth-grid-span">
              Your password is securely hashed by the server. Registration does not allow staff or administrator roles.
            </p>
            <button type="submit" className="btn btn-primary auth-submit auth-grid-span" disabled={busy}>
              {busy ? 'Creating account…' : 'Create customer account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <a href="/login" onClick={(event) => {
              event.preventDefault()
              onNavigate('/login')
            }}>
              Sign in
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}
