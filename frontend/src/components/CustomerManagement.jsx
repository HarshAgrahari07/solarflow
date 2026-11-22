import { useCallback, useEffect, useState } from 'react'
import { statusClass } from '../data/demoData'
import { useAuth } from '../auth/useAuth'

const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Survey Pending', 'Quotation', 'Converted', 'Lost']
const LEAD_SOURCES = ['UNKNOWN', 'WEBSITE', 'REFERRAL', 'PHONE', 'WALK_IN']
const SOLAR_REQUIREMENTS = ['On-Grid System', 'Off-Grid System']

function blankCustomer(user) {
  return {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    solarRequirement: '',
    capacityKw: '',
    leadStatus: 'New',
    leadSource: 'UNKNOWN',
    assignedTo: user.role === 'SALES' ? user.id : '',
    notes: '',
  }
}

function localDateTimeInOneHour() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDate(value) {
  if (!value) return 'None scheduled'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function CustomerForm({ user, salesUsers, customer, busy, onClose, onSave }) {
  const [values, setValues] = useState(() => customer
    ? {
        fullName: customer.fullName,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        category: customer.category || '',
        solarRequirement: SOLAR_REQUIREMENTS.includes(customer.solarRequirement)
          ? customer.solarRequirement
          : '',
        capacityKw: customer.capacityKw ?? '',
        leadStatus: customer.leadStatus || 'New',
        leadSource: customer.leadSource || 'UNKNOWN',
        assignedTo: customer.assignedTo || '',
        notes: customer.notes || '',
      }
    : blankCustomer(user))
  const [error, setError] = useState('')

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    const capacityKw = Number(values.capacityKw)
    if (!Number.isFinite(capacityKw) || capacityKw < 1 || capacityKw > 5) {
      setError('System capacity must be from 1 to 5 kW inclusive.')
      return
    }

    const { assignedTo, ...customerFields } = values
    const payload = { ...customerFields, capacityKw }
    if (user.role === 'ADMIN') payload.assignedTo = assignedTo || null

    try {
      await onSave(payload)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <section
        className="dialog crm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-form-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <h2 id="customer-form-heading">{customer ? 'Edit customer & lead' : 'Add customer & lead'}</h2>
            <p>Customer details and lead stage are saved to the CRM database.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close customer form">×</button>
        </div>
        <form className="crm-form" onSubmit={submit}>
          <div className="crm-form-grid">
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
              <span>Customer category</span>
              <select name="category" value={values.category} onChange={change} required>
                <option value="" disabled>Select category</option>
                <option value="Home">Home</option>
                <option value="Small Factory">Small Factory</option>
              </select>
            </label>
            <label className="field crm-form-span">
              <span>Address</span>
              <textarea name="address" value={values.address} onChange={change} minLength="5" maxLength="500" rows="2" required />
            </label>
            <label className="field">
              <span>Solar requirement</span>
              <select name="solarRequirement" value={values.solarRequirement} onChange={change} required>
                <option value="" disabled>Select requirement</option>
                {SOLAR_REQUIREMENTS.map((requirement) => (
                  <option value={requirement} key={requirement}>{requirement}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>System capacity (1–5 kW)</span>
              <input name="capacityKw" type="number" min="1" max="5" step="any" value={values.capacityKw} onChange={change} required />
            </label>
            <label className="field">
              <span>Lead stage</span>
              <select name="leadStatus" value={values.leadStatus} onChange={change}>
                {LEAD_STAGES.map((stage) => <option value={stage} key={stage}>{stage}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Lead source</span>
              <select name="leadSource" value={values.leadSource} onChange={change}>
                {LEAD_SOURCES.map((source) => (
                  <option value={source} key={source}>{source.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </label>
            {user.role === 'ADMIN' && (
              <label className="field">
                <span>Sales owner</span>
                <select name="assignedTo" value={values.assignedTo} onChange={change}>
                  <option value="">Unassigned</option>
                  {salesUsers.map((salesUser) => (
                    <option value={salesUser.id} key={salesUser.id}>
                      {salesUser.fullName} ({salesUser.email})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field crm-form-span">
              <span>Lead notes</span>
              <textarea name="notes" value={values.notes} onChange={change} maxLength="3000" rows="3" />
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function FollowUpDialog({ customer, salesUsers, user, followUps, loading, busy, error, onClose, onCreate, onComplete }) {
  const [dueAt, setDueAt] = useState(localDateTimeInOneHour)
  const [assignedTo, setAssignedTo] = useState(
    customer.assignedTo || (user.role === 'SALES' ? user.id : ''),
  )
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setFormError('')
    if (!note.trim()) {
      setFormError('Add a short note describing the planned follow-up.')
      return
    }
    try {
      await onCreate({
        dueAt: new Date(dueAt).toISOString(),
        note: note.trim(),
        assignedTo: assignedTo || undefined,
      })
      setNote('')
      setDueAt(localDateTimeInOneHour())
    } catch (requestError) {
      setFormError(requestError.message)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <section
        className="dialog crm-followup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="followup-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <h2 id="followup-heading">Follow-ups · {customer.fullName}</h2>
            <p>Schedule and complete customer contact reminders.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close follow-ups">×</button>
        </div>

        <form className="crm-followup-form" onSubmit={submit}>
          <label className="field">
            <span>Follow-up date and time</span>
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
          </label>
          <label className="field">
            <span>Responsible Sales executive</span>
            <select
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              disabled={user.role === 'SALES'}
              required
            >
              <option value="" disabled>Select a Sales executive</option>
              {salesUsers.map((salesUser) => (
                <option value={salesUser.id} key={salesUser.id}>
                  {salesUser.fullName} ({salesUser.email})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Follow-up note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="2000" rows="2" required />
          </label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Scheduling…' : 'Schedule follow-up'}
          </button>
        </form>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="crm-followup-list">
          <h3>Scheduled follow-ups</h3>
          {loading ? (
            <p role="status">Loading follow-ups…</p>
          ) : followUps.length === 0 ? (
            <p className="crm-empty-inline">No follow-ups scheduled for this customer.</p>
          ) : followUps.map((followUp) => (
            <article className="crm-followup-item" key={followUp.id}>
              <div>
                <strong>{formatDate(followUp.dueAt)}</strong>
                {followUp.overdue && <span className="crm-overdue">Overdue</span>}
                <p>{followUp.note}</p>
                <small>Assigned to {followUp.assignedToName || 'staff'}</small>
              </div>
              {followUp.completed ? (
                <span className="status status-completed">Completed</span>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onComplete(followUp.id)}>
                  Mark complete
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function CustomerDetailsDialog({ customer, onClose, onEdit, onFollowUps }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <section
        className="dialog crm-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-details-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <p className="role-kicker">{customer.isDemo ? 'Synthetic demonstration record' : 'Customer profile'}</p>
            <h2 id="customer-details-heading">{customer.fullName}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close customer details">×</button>
        </div>
        <dl className="crm-details-grid">
          <div><dt>Email</dt><dd>{customer.email || 'Not provided'}</dd></div>
          <div><dt>Phone</dt><dd>{customer.phone || 'Not provided'}</dd></div>
          <div><dt>Address</dt><dd>{customer.address || 'Not provided'}</dd></div>
          <div><dt>Category</dt><dd>{customer.category || 'Not specified'}</dd></div>
          <div><dt>Connection preference</dt><dd>{customer.solarRequirement || 'Not specified'}</dd></div>
          <div><dt>Capacity</dt><dd>{customer.capacityKw ? `${customer.capacityKw} kW` : 'Not specified'}</dd></div>
          <div><dt>Lead stage</dt><dd>{customer.leadStatus}</dd></div>
          <div><dt>Lead source</dt><dd>{customer.leadSource?.replaceAll('_', ' ') || 'Unknown'}</dd></div>
          <div><dt>Sales owner</dt><dd>{customer.assignedSalesName || 'Unassigned'}</dd></div>
          <div><dt>Next follow-up</dt><dd>{formatDate(customer.nextFollowUpAt)}</dd></div>
          <div className="crm-details-span"><dt>Sales notes</dt><dd>{customer.notes || 'No notes recorded.'}</dd></div>
        </dl>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-secondary" onClick={onFollowUps}>Follow-ups</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>Edit customer</button>
        </div>
      </section>
    </div>
  )
}

export default function CustomerManagement({ user, query = '' }) {
  const { request } = useAuth()
  const [customers, setCustomers] = useState([])
  const [salesUsers, setSalesUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({
    category: '',
    leadStatus: '',
    assignedTo: '',
    recordType: 'real',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })
  const [pageState, setPageState] = useState({ search: query, page: 1 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [followUpCustomer, setFollowUpCustomer] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [followUpsLoading, setFollowUpsLoading] = useState(false)
  const [followUpError, setFollowUpError] = useState('')
  const [followUpBusy, setFollowUpBusy] = useState(false)
  const [detailsCustomer, setDetailsCustomer] = useState(null)
  const requestPage = pageState.search === query ? pageState.page : 1

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setLoadError('')
      const params = new URLSearchParams({
        ...filters,
        page: String(requestPage),
        pageSize: String(pagination.pageSize),
        search: query.trim(),
      })
      if (!params.get('search')) params.delete('search')
      for (const [key, value] of [...params.entries()]) {
        if (!value) params.delete(key)
      }
      const path = `/api/customers?${params.toString()}`
      request(path)
        .then((response) => {
          if (!active) return
          setCustomers(response.customers)
          setSalesUsers(response.salesUsers)
          setPagination(response.pagination)
        })
        .catch((error) => {
          if (active) setLoadError(error.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filters, pagination.pageSize, query, refreshKey, request, requestPage])

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])
  const changeFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
    setPageState({ search: query, page: 1 })
  }
  const changePage = (page) => setPageState({ search: query, page })

  async function saveCustomer(payload) {
    setBusy(true)
    setActionError('')
    try {
      await request(editingCustomer
        ? `/api/customers/${encodeURIComponent(editingCustomer.id)}`
        : '/api/customers', {
        method: editingCustomer ? 'PATCH' : 'POST',
        body: payload,
      })
      setFormOpen(false)
      setEditingCustomer(null)
      setDetailsCustomer(null)
      refresh()
    } catch (error) {
      setActionError(error.message)
      throw error
    } finally {
      setBusy(false)
    }
  }

  function openCreate() {
    setEditingCustomer(null)
    setActionError('')
    setFormOpen(true)
  }

  function openEdit(customer) {
    setDetailsCustomer(null)
    setEditingCustomer(customer)
    setActionError('')
    setFormOpen(true)
  }

  async function archive(customer) {
    if (!window.confirm(`Archive ${customer.fullName}? This removes the unlinked lead from active CRM lists.`)) return
    setActionError('')
    try {
      await request(`/api/customers/${encodeURIComponent(customer.id)}`, { method: 'DELETE' })
      refresh()
    } catch (error) {
      setActionError(error.message)
    }
  }

  async function openFollowUps(customer) {
    setDetailsCustomer(null)
    setFollowUpCustomer(customer)
    setFollowUps([])
    setFollowUpError('')
    setFollowUpsLoading(true)
    try {
      const response = await request(`/api/customers/${encodeURIComponent(customer.id)}/follow-ups`)
      setFollowUps(response.followUps)
    } catch (error) {
      setFollowUpError(error.message)
    } finally {
      setFollowUpsLoading(false)
    }
  }

  async function scheduleFollowUp(fields) {
    if (!followUpCustomer) return
    setFollowUpBusy(true)
    setFollowUpError('')
    try {
      const response = await request(
        `/api/customers/${encodeURIComponent(followUpCustomer.id)}/follow-ups`,
        { method: 'POST', body: fields },
      )
      setFollowUps((current) => [...current, response.followUp].sort((a, b) => a.dueAt.localeCompare(b.dueAt)))
      refresh()
    } catch (error) {
      setFollowUpError(error.message)
      throw error
    } finally {
      setFollowUpBusy(false)
    }
  }

  async function completeFollowUp(followUpId) {
    if (!followUpCustomer) return
    setFollowUpError('')
    try {
      const response = await request(
        `/api/customers/${encodeURIComponent(followUpCustomer.id)}/follow-ups/${encodeURIComponent(followUpId)}`,
        { method: 'PATCH', body: { completed: true } },
      )
      setFollowUps((current) => current.map((item) => item.id === followUpId ? response.followUp : item))
      refresh()
    } catch (error) {
      setFollowUpError(error.message)
    }
  }

  return (
    <section className="crm-workspace">
      <div className="panel crm-toolbar">
        <div>
          <p className="role-kicker">{user.role === 'ADMIN' ? 'Administrator' : 'Sales'} CRM</p>
          <h2>Customers &amp; Leads</h2>
          <p>Persistent customer profiles, lead ownership and scheduled follow-ups.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add customer / lead</button>
      </div>

      <div className="panel crm-filter-bar" aria-label="Customer and lead filters">
        <label className="field">
          <span>Category</span>
          <select value={filters.category} onChange={(event) => changeFilter('category', event.target.value)}>
            <option value="">All categories</option>
            <option value="Home">Home</option>
            <option value="Small Factory">Small Factory</option>
          </select>
        </label>
        <label className="field">
          <span>Lead stage</span>
          <select value={filters.leadStatus} onChange={(event) => changeFilter('leadStatus', event.target.value)}>
            <option value="">All stages</option>
            {LEAD_STAGES.map((stage) => <option value={stage} key={stage}>{stage}</option>)}
          </select>
        </label>
        {user.role === 'ADMIN' && (
          <label className="field">
            <span>Sales owner</span>
            <select value={filters.assignedTo} onChange={(event) => changeFilter('assignedTo', event.target.value)}>
              <option value="">All owners</option>
              <option value="unassigned">Unassigned</option>
              {salesUsers.map((salesUser) => (
                <option value={salesUser.id} key={salesUser.id}>{salesUser.fullName}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Record set</span>
          <select value={filters.recordType} onChange={(event) => changeFilter('recordType', event.target.value)}>
            <option value="real">Live customer records</option>
            <option value="demo">Synthetic demo records</option>
            <option value="all">All records</option>
          </select>
        </label>
        <label className="field">
          <span>Sort by</span>
          <select value={filters.sortBy} onChange={(event) => changeFilter('sortBy', event.target.value)}>
            <option value="updatedAt">Recently updated</option>
            <option value="createdAt">Date created</option>
            <option value="name">Customer name</option>
            <option value="leadStatus">Lead stage</option>
            <option value="assignedTo">Sales owner</option>
            <option value="nextFollowUpAt">Next follow-up</option>
          </select>
        </label>
        <label className="field">
          <span>Direction</span>
          <select value={filters.sortOrder} onChange={(event) => changeFilter('sortOrder', event.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      <div className="crm-caption">
        <span>{pagination.total} records · {filters.recordType === 'demo' ? 'Synthetic demo data' : filters.recordType === 'all' ? 'Live and demo data' : 'Live customer data'}</span>
        <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
      </div>

      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {loadError && (
        <div className="panel crm-state" role="alert">
          <strong>Could not load customers</strong>
          <p>{loadError}</p>
          <button type="button" className="btn btn-secondary" onClick={refresh}>Try again</button>
        </div>
      )}
      {!loadError && loading ? (
        <div className="panel crm-state" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <strong>Loading customer records…</strong>
          <div className="crm-skeleton-rows" aria-hidden="true"><i /><i /><i /></div>
        </div>
      ) : !loadError && customers.length === 0 ? (
        <div className="panel crm-state">
          <strong>{query ? 'No matching customers or leads' : 'Your CRM is ready'}</strong>
          <p>{query ? 'Try another search or clear the search field.' : 'Create the first customer or lead to start tracking follow-ups.'}</p>
          {query ? (
            <button type="button" className="btn btn-secondary" onClick={refresh}>Refresh results</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={openCreate}>Add customer / lead</button>
          )}
        </div>
      ) : !loadError ? (
        <div className="panel crm-table-panel">
          <div className="table-wrap">
            <table className="data-table crm-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Category / requirement</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Lead stage</th>
                  <th scope="col">Source</th>
                  <th scope="col">Sales owner</th>
                  <th scope="col">Next follow-up</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong className="cell-title">{customer.fullName}</strong>
                      {customer.isDemo && <small className="crm-demo-tag">DEMO · synthetic</small>}
                      <small className="crm-subline">{customer.address}</small>
                    </td>
                    <td>
                      <span>{customer.email}</span>
                      <small className="crm-subline">{customer.phone}</small>
                    </td>
                    <td>
                      <span>{customer.category || 'Not set'}</span>
                      <small className="crm-subline">{customer.solarRequirement || 'Requirement not set'}</small>
                    </td>
                    <td>{customer.capacityKw ? `${customer.capacityKw} kW` : 'Not set'}</td>
                    <td><span className={statusClass(customer.leadStatus)}>{customer.leadStatus}</span></td>
                    <td>{customer.leadSource?.replaceAll('_', ' ') || 'Unknown'}</td>
                    <td>{customer.assignedSalesName || 'Unassigned'}</td>
                    <td>
                      {formatDate(customer.nextFollowUpAt)}
                      {customer.nextFollowUpOverdue && <small className="crm-overdue">Overdue</small>}
                    </td>
                    <td>
                      <div className="crm-row-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailsCustomer(customer)}>View</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(customer)}>Edit</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openFollowUps(customer)}>Follow-ups</button>
                        {user.role === 'ADMIN' && !customer.isLinked && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => archive(customer)}>Archive</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="crm-pagination">
            <span>Showing {customers.length} of {pagination.total} records</span>
            <div className="crm-row-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={loading || pagination.page <= 1}
                onClick={() => changePage(pagination.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={loading || pagination.page >= pagination.totalPages}
                onClick={() => changePage(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen && (
        <CustomerForm
          user={user}
          salesUsers={salesUsers}
          customer={editingCustomer}
          busy={busy}
          onClose={() => setFormOpen(false)}
          onSave={saveCustomer}
        />
      )}
      {followUpCustomer && (
        <FollowUpDialog
          customer={followUpCustomer}
          salesUsers={salesUsers}
          user={user}
          followUps={followUps}
          loading={followUpsLoading}
          busy={followUpBusy}
          error={followUpError}
          onClose={() => setFollowUpCustomer(null)}
          onCreate={scheduleFollowUp}
          onComplete={completeFollowUp}
        />
      )}
      {detailsCustomer && (
        <CustomerDetailsDialog
          customer={detailsCustomer}
          onClose={() => setDetailsCustomer(null)}
          onEdit={() => openEdit(detailsCustomer)}
          onFollowUps={() => openFollowUps(detailsCustomer)}
        />
      )}
    </section>
  )
}
