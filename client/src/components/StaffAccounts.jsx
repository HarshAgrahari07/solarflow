import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ROLE_LABELS } from '../auth/roleAccess'

const STAFF_ROLES = ['SALES', 'SURVEYOR', 'WAREHOUSE', 'TECHNICIAN', 'SUPPORT', 'FINANCE']

export default function StaffAccounts() {
  const { request } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const form = event.currentTarget
    const formData = new FormData(form)

    try {
      const response = await request('/api/admin/users', {
        method: 'POST',
        body: {
          fullName: String(formData.get('fullName') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          password: String(formData.get('password') || ''),
          role: String(formData.get('role') || ''),
        },
      })
      setSuccess(`${response.user.fullName} was created as ${ROLE_LABELS[response.user.role]}.`)
      form.reset()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dashboard">
      <div className="demo-banner">
        <strong>Administrator-only action.</strong> The server verifies your database role before creating staff accounts.
      </div>
      <section className="panel staff-account-panel">
        <div className="section-head">
          <div>
            <h2>Create a staff account</h2>
            <p>New accounts are limited to supported internal roles. Administrator accounts cannot be created here.</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={submit}>
          <label className="field">
            <span>Full name</span>
            <input name="fullName" minLength="2" maxLength="120" autoComplete="name" required />
          </label>
          <label className="field">
            <span>Email address</span>
            <input name="email" type="email" maxLength="254" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input name="password" type="password" minLength="12" maxLength="72" autoComplete="new-password" required />
          </label>
          <label className="field">
            <span>Staff role</span>
            <select name="role" required defaultValue="">
              <option value="" disabled>Select a role</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating account…' : 'Create staff account'}
          </button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success" role="status">{success}</p>}
      </section>
    </section>
  )
}
