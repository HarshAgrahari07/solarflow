import { useEffect, useState } from 'react'
import { getRoleLabel } from '../auth/roleAccess'
import { useAuth } from '../auth/useAuth'
import SunPowerBrand from './SunPowerBrand'

const CUSTOMER_RECORD_SECTIONS = [
  'Quotations',
  'Payments',
  'Order progress',
  'Installation details',
  'Warranties',
  'Complaints',
]

export default function CustomerPortal({ user, onLogout }) {
  const { request } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [values, setValues] = useState({})

  useEffect(() => {
    let active = true
    request('/api/customers/me')
      .then((response) => {
        if (!active) return
        setProfile(response.customer)
        setValues({
          fullName: response.customer.fullName,
          email: response.customer.email,
          phone: response.customer.phone || '',
          address: response.customer.address || '',
          category: response.customer.category || '',
          solarRequirement: response.customer.solarRequirement || '',
          capacityKw: response.customer.capacityKw ?? '',
        })
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [request])

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function saveProfile(event) {
    event.preventDefault()
    setFormError('')
    const capacityKw = values.capacityKw === '' ? null : Number(values.capacityKw)
    if (capacityKw !== null && (!Number.isFinite(capacityKw) || capacityKw < 1 || capacityKw > 5)) {
      setFormError('System capacity must be from 1 to 5 kW inclusive.')
      return
    }
    setBusy(true)
    try {
      const response = await request('/api/customers/me', {
        method: 'PATCH',
        body: { ...values, capacityKw },
      })
      setProfile(response.customer)
      setEditing(false)
    } catch (requestError) {
      setFormError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const fullName = profile?.fullName || user.fullName

  return (
    <main className="customer-portal">
      <header className="customer-portal-header">
        <SunPowerBrand subtitle="Customer portal" />
        <div className="customer-portal-user">
          <span>{fullName}</span>
          <button type="button" className="btn btn-secondary" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <section className="customer-portal-content">
        <p className="role-kicker">Your account</p>
        <h1>Welcome, {fullName}</h1>
        <p className="customer-portal-intro">
          This portal loads the profile linked to your authenticated customer account. Only your own records are available here.
        </p>

        {loading ? (
          <section className="panel customer-profile" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <p>Loading your customer profile…</p>
          </section>
        ) : error ? (
          <section className="panel customer-profile" role="alert">
            <h2>Could not load your profile</h2>
            <p className="form-error">{error}</p>
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </section>
        ) : profile ? (
          <section className="panel customer-profile" aria-labelledby="profile-heading">
            <div className="customer-profile-heading">
              <div>
                <h2 id="profile-heading">Account profile</h2>
                <p>Details associated with your SunPower account.</p>
              </div>
              <div className="customer-profile-actions">
                <span className="role-pill">{getRoleLabel(user.role)}</span>
                {!editing && (
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                    Edit profile
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              <form className="customer-edit-form" onSubmit={saveProfile}>
                <label className="field">
                  <span>Full name</span>
                  <input name="fullName" value={values.fullName} onChange={change} minLength="2" maxLength="120" required />
                </label>
                <label className="field">
                  <span>Email address</span>
                  <input name="email" type="email" value={values.email} onChange={change} maxLength="254" required />
                </label>
                <label className="field">
                  <span>Phone number</span>
                  <input name="phone" type="tel" value={values.phone} onChange={change} minLength="7" maxLength="32" pattern="[+()0-9 .-]+" required />
                </label>
                <label className="field">
                  <span>Address</span>
                  <textarea name="address" value={values.address} onChange={change} minLength="5" maxLength="500" rows="2" required />
                </label>
                <label className="field">
                  <span>Category</span>
                  <select name="category" value={values.category} onChange={change} required>
                    <option value="" disabled>Select category</option>
                    <option value="Home">Home</option>
                    <option value="Small Factory">Small Factory</option>
                  </select>
                </label>
                <label className="field">
                  <span>Solar requirement</span>
                  <select name="solarRequirement" value={values.solarRequirement} onChange={change} required>
                    <option value="" disabled>Select requirement</option>
                    <option value="On-Grid System">On-Grid System</option>
                    <option value="Off-Grid System">Off-Grid System</option>
                    <option value="Solar Panel Set">Solar Panel Set</option>
                  </select>
                </label>
                <label className="field">
                  <span>System capacity (optional, 1–5 kW)</span>
                  <input name="capacityKw" type="number" min="1" max="5" step="any" value={values.capacityKw} onChange={change} />
                </label>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="customer-profile-grid">
                <div><dt>Full name</dt><dd>{profile.fullName}</dd></div>
                <div><dt>Email address</dt><dd>{profile.email}</dd></div>
                <div><dt>Phone number</dt><dd>{profile.phone || 'Not provided'}</dd></div>
                <div><dt>Address</dt><dd>{profile.address || 'Not provided'}</dd></div>
                <div><dt>Category</dt><dd>{profile.category || 'Not specified'}</dd></div>
                <div><dt>Solar requirement</dt><dd>{profile.solarRequirement || 'Not specified'}</dd></div>
                <div><dt>System capacity</dt><dd>{profile.capacityKw ? `${profile.capacityKw} kW` : 'Not specified'}</dd></div>
              </dl>
            )}
          </section>
        ) : null}

        <section className="customer-record-section" aria-labelledby="customer-records-heading">
          <div className="customer-record-heading">
            <h2 id="customer-records-heading">Your solar project</h2>
            <p>Only records linked to your signed-in account will appear here.</p>
          </div>
          <div className="customer-record-grid">
            {CUSTOMER_RECORD_SECTIONS.map((section) => (
              <article className="panel customer-record-card" key={section}>
                <h3>{section}</h3>
                <p>No customer-specific records are connected yet.</p>
                <span>Private to your account</span>
              </article>
            ))}
          </div>
        </section>

        <div className="customer-data-note" role="status">
          <strong>Project services are not connected yet.</strong>
          <span>Your quotations, payments, order progress, installation, warranties, and complaints will appear here when those services are connected. Other customers' records are never shown.</span>
        </div>
      </section>
    </main>
  )
}
