import { useEffect, useState } from 'react'
import { getRoleLabel } from '../auth/roleAccess'
import { useAuth } from '../auth/useAuth'
import SunPowerBrand from './SunPowerBrand'

export default function CustomerPortal({ user, onLogout }) {
  const { request } = useAuth()
  const [profile, setProfile] = useState(null)
  const [surveys, setSurveys] = useState([])
  const [surveysLoading, setSurveysLoading] = useState(true)
  const [surveysError, setSurveysError] = useState('')
  const [quotations, setQuotations] = useState([])
  const [quotationsLoading, setQuotationsLoading] = useState(true)
  const [quotationError, setQuotationError] = useState('')
  const [respondingQuoteId, setRespondingQuoteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [values, setValues] = useState({})
  const [businessRecords, setBusinessRecords] = useState({ orders: [], warranties: [], serviceTickets: [] })
  const [businessLoading, setBusinessLoading] = useState(true)
  const [businessError, setBusinessError] = useState('')
  const [installations, setInstallations] = useState([])
  const [serviceBusy, setServiceBusy] = useState(false)
  const [serviceNotice, setServiceNotice] = useState('')
  const [serviceError, setServiceError] = useState('')

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
          solarRequirement: ['On-Grid System', 'Off-Grid System'].includes(response.customer.solarRequirement)
            ? response.customer.solarRequirement
            : '',
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

  useEffect(() => {
    let active = true
    Promise.all([
      request('/api/operations/customer-records'),
      request('/api/operations/installations'),
    ]).then(([recordsResponse, installationResponse]) => {
      if (!active) return
      setBusinessRecords(recordsResponse.records)
      setInstallations(installationResponse.installations)
    }).catch((requestError) => {
      if (active) setBusinessError(requestError.message)
    }).finally(() => {
      if (active) setBusinessLoading(false)
    })
    return () => { active = false }
  }, [request])

  async function createServiceRequest(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setServiceError('')
    setServiceNotice('')
    setServiceBusy(true)
    try {
      const response = await request('/api/operations/service-tickets', {
        method: 'POST',
        body: {
          subject: form.get('subject'),
          description: form.get('description'),
          ...(form.get('serialNumber') ? { serialNumber: form.get('serialNumber') } : {}),
        },
      })
      setBusinessRecords((current) => ({
        ...current,
        serviceTickets: [response.ticket, ...current.serviceTickets],
      }))
      formElement.reset()
      setServiceNotice('Your service request has been submitted.')
    } catch (requestError) {
      setServiceError(requestError.message)
    } finally {
      setServiceBusy(false)
    }
  }

  async function confirmService(ticket, confirmed) {
    setServiceError('')
    setServiceNotice('')
    setServiceBusy(true)
    try {
      const response = await request(`/api/operations/service-tickets/${encodeURIComponent(ticket.id)}/confirm`, {
        method: 'POST',
        body: { confirmed, notes: confirmed ? 'Customer confirmed service resolution.' : 'Customer requested further assistance.' },
      })
      setBusinessRecords((current) => ({
        ...current,
        serviceTickets: current.serviceTickets.map((item) => item.id === ticket.id ? response.ticket : item),
      }))
      setServiceNotice(confirmed ? 'Service completion confirmed.' : 'The ticket has been reopened for further assistance.')
    } catch (requestError) {
      setServiceError(requestError.message)
    } finally {
      setServiceBusy(false)
    }
  }

  async function signOffInstallation(event, job) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setServiceError('')
    setServiceNotice('')
    setServiceBusy(true)
    try {
      const response = await request(`/api/operations/installations/${encodeURIComponent(job.id)}/signoff`, {
        method: 'POST',
        body: {
          notes: form.get('notes'),
        },
      })
      setInstallations((current) => current.map((item) => item.id === job.id ? response.installation : item))
      setServiceNotice('Installation sign-off recorded.')
    } catch (requestError) {
      setServiceError(requestError.message)
    } finally {
      setServiceBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    request('/api/quotations')
      .then((response) => {
        if (active) setQuotations(response.quotations)
      })
      .catch((requestError) => {
        if (active) setQuotationError(requestError.message)
      })
      .finally(() => {
        if (active) setQuotationsLoading(false)
      })
    return () => { active = false }
  }, [request])

  async function respondToQuote(quotation, decision) {
    setQuotationError('')
    setRespondingQuoteId(quotation.id)
    try {
      const response = await request(`/api/quotations/${encodeURIComponent(quotation.id)}/respond`, {
        method: 'POST',
        body: { decision, comments: '' },
      })
      setQuotations((current) => current.map((item) => item.id === quotation.id ? response.quotation : item))
    } catch (requestError) {
      setQuotationError(requestError.message)
    } finally {
      setRespondingQuoteId('')
    }
  }

  useEffect(() => {
    let active = true
    request('/api/surveys')
      .then((response) => {
        if (active) setSurveys(response.surveys)
      })
      .catch((requestError) => {
        if (active) setSurveysError(requestError.message)
      })
      .finally(() => {
        if (active) setSurveysLoading(false)
      })
    return () => { active = false }
  }, [request])

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function saveProfile(event) {
    event.preventDefault()
    setFormError('')
    const capacityKw = Number(values.capacityKw)
    if (!Number.isFinite(capacityKw) || capacityKw < 1 || capacityKw > 5) {
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
                  </select>
                </label>
                <label className="field">
                  <span>System capacity (1–5 kW)</span>
                  <input name="capacityKw" type="number" min="1" max="5" step="any" value={values.capacityKw} onChange={change} required />
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
            <p>Orders, payments, installation, warranties, and service requests are loaded from your own account records.</p>
          </div>
          {businessError && <p className="form-error" role="alert">{businessError}</p>}
          {businessLoading ? <p role="status">Loading your project records…</p> : (
            <div className="customer-project-list">
              {businessRecords.orders.map((order) => (
                <article className="customer-project-card" key={order.id}>
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <span>Order {order.status} · Quote {order.quoteNumber}</span>
                    <span>Paid {order.paidAmount === null ? 'Not configured' : `₹${Number(order.paidAmount).toLocaleString('en-IN')}`} · Balance {order.outstandingAmount === null ? 'Not configured' : `₹${Number(order.outstandingAmount).toLocaleString('en-IN')}`}</span>
                    {order.dispatch && <span>Delivery: {order.dispatch.status}</span>}
                    {order.installation && <span>Installation: {order.installation.status}</span>}
                  </div>
                </article>
              ))}
              {businessRecords.warranties.map((warranty) => (
                <article className="customer-project-card" key={warranty.serialNumber}>
                  <div>
                    <strong>{warranty.productName} · {warranty.serialNumber}</strong>
                    <span>Warranty {warranty.status} · {warranty.startsOn || 'Start pending'} to {warranty.endsOn || 'Duration not specified'}</span>
                    <span>Delivered {warranty.deliveredAt ? new Date(warranty.deliveredAt).toLocaleDateString('en-IN') : 'Not delivered'}</span>
                  </div>
                </article>
              ))}
              {!businessRecords.orders.length && !businessRecords.warranties.length && (
                <p className="customer-surveys-empty">No order or warranty records are linked to your profile yet.</p>
              )}
            </div>
          )}
        </section>

        <section className="panel customer-surveys" aria-labelledby="customer-quotations-heading">
          <div className="customer-record-heading">
            <h2 id="customer-quotations-heading">Your quotations</h2>
            <p>Offers are linked to your account and an approved roof survey.</p>
          </div>
          {quotationError && <p className="form-error" role="alert">{quotationError}</p>}
          {quotationsLoading ? <p role="status">Loading your quotations…</p> : quotations.length ? (
            <div className="customer-project-list">
              {quotations.map((quotation) => (
                <article className="customer-project-card" key={quotation.id}>
                  <div>
                    <strong>{quotation.quoteNumber}</strong>
                    <span>{quotation.packageName || 'Package to be confirmed'} · Survey {quotation.surveyReference}</span>
                    <span>Status: {quotation.status}</span>
                  </div>
                  {quotation.status === 'RELEASED' && (
                    <div className="customer-project-actions">
                      <button type="button" className="btn btn-primary" onClick={() => respondToQuote(quotation, 'ACCEPT')} disabled={respondingQuoteId === quotation.id}>
                        Accept
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => respondToQuote(quotation, 'REJECT')} disabled={respondingQuoteId === quotation.id}>
                        Decline
                      </button>
                    </div>
                  )}
                  {quotation.totalAmount !== null && quotation.totalAmount !== undefined && (
                    <span>Configured quotation total: ₹{Number(quotation.totalAmount).toLocaleString('en-IN')}</span>
                  )}
                </article>
              ))}
            </div>
          ) : <p className="customer-surveys-empty">No quotations are linked to your profile yet.</p>}
        </section>

        <section className="panel customer-surveys" aria-labelledby="customer-surveys-heading">
          <div className="customer-record-heading">
            <h2 id="customer-surveys-heading">Roof survey appointments</h2>
            <p>Survey information for your linked customer profile only.</p>
          </div>
          {surveysLoading ? (
            <p role="status">Loading your surveys…</p>
          ) : surveysError ? (
            <p className="form-error" role="alert">{surveysError}</p>
          ) : surveys.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Reference</th><th>Site</th><th>Appointment</th><th>Status</th></tr></thead>
                <tbody>
                  {surveys.map((survey) => (
                    <tr key={survey.id}>
                      <td><strong>{survey.reference}</strong></td>
                      <td>{survey.siteAddress}</td>
                      <td>{survey.scheduledAt ? new Date(survey.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled'}</td>
                      <td><span className="status">{survey.status.replaceAll('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="customer-surveys-empty">No survey appointments are linked to your profile yet.</p>
          )}
        </section>

        <section className="panel customer-surveys" aria-labelledby="customer-installations-heading">
          <div className="customer-record-heading">
            <h2 id="customer-installations-heading">Installation and handover</h2>
            <p>Review commissioning details and sign off only after the checklist and test are complete.</p>
          </div>
          {installations.map((job) => (
            <article className="customer-project-card" key={job.id}>
              <div>
                <strong>{job.jobNumber} · {job.orderNumber}</strong>
                <span>{job.siteAddress} · {job.status}</span>
                <span>Schedule: {job.scheduledStart ? new Date(job.scheduledStart).toLocaleString('en-IN') : 'Pending'}</span>
                <span>Commissioning: {job.generationTestResult || 'Not recorded'}</span>
              </div>
              {job.status === 'IN_PROGRESS' && job.generationTestResult && job.checklist.every((item) => item.isComplete) && !job.customerSignedAt && (
                <form className="customer-edit-form" onSubmit={(event) => signOffInstallation(event, job)}>
                  <label className="field"><span>Handover notes</span><input name="notes" maxLength="2000" /></label>
                  <button className="btn btn-primary" disabled={serviceBusy}>Record installation sign-off</button>
                </form>
              )}
              {job.customerSignedAt && <p className="form-success">Sign-off recorded {new Date(job.customerSignedAt).toLocaleString('en-IN')}.</p>}
            </article>
          ))}
          {!installations.length && <p className="customer-surveys-empty">No installation jobs are linked to your account.</p>}
        </section>

        <section className="panel customer-surveys" aria-labelledby="customer-service-heading">
          <div className="customer-record-heading">
            <h2 id="customer-service-heading">Service requests</h2>
            <p>Submit a complaint or confirm a completed service request.</p>
          </div>
          {serviceError && <p className="form-error" role="alert">{serviceError}</p>}
          {serviceNotice && <p className="form-success" role="status">{serviceNotice}</p>}
          <form className="customer-edit-form" onSubmit={createServiceRequest}>
            <label className="field"><span>Subject</span><input name="subject" minLength="3" maxLength="200" required /></label>
            <label className="field"><span>Issue details</span><textarea name="description" rows="3" minLength="1" maxLength="4000" required /></label>
            <label className="field"><span>Delivered serial (optional)</span><select name="serialNumber" defaultValue="">
              <option value="">Select if available</option>
              {businessRecords.warranties.map((warranty) => <option key={warranty.serialNumber} value={warranty.serialNumber}>{warranty.productName} · {warranty.serialNumber}</option>)}
            </select></label>
            <button className="btn btn-primary" disabled={serviceBusy}>{serviceBusy ? 'Submitting…' : 'Submit service request'}</button>
          </form>
          <div className="customer-project-list">
            {businessRecords.serviceTickets.map((ticket) => (
              <article className="customer-project-card" key={ticket.id}>
                <div><strong>{ticket.ticketNumber} · {ticket.subject}</strong><span>{ticket.description} · {ticket.status}</span>
                  {ticket.resolutions.map((resolution) => <span key={resolution.id}>Resolution: {resolution.type} · Warranty {resolution.warrantyCoverage} · Parts ₹{Number(resolution.partsCharge || 0).toLocaleString('en-IN')} · Labour ₹{Number(resolution.labourCharge || 0).toLocaleString('en-IN')}</span>)}
                </div>
                {ticket.status === 'WAITING_CUSTOMER' && <div className="customer-project-actions">
                  <button type="button" className="btn btn-primary" disabled={serviceBusy} onClick={() => confirmService(ticket, true)}>Confirm resolution</button>
                  <button type="button" className="btn btn-secondary" disabled={serviceBusy} onClick={() => confirmService(ticket, false)}>Request more help</button>
                </div>}
              </article>
            ))}
            {!businessLoading && !businessRecords.serviceTickets.length && <p className="customer-surveys-empty">No service requests are linked to your account.</p>}
          </div>
        </section>
      </section>
    </main>
  )
}
