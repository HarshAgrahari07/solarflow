import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import SurveyApprovalDialog from './SurveyApprovalDialog'

const EMPTY_FINDINGS = {
  shadowFreeRoofAreaSqm: '',
  monthlyElectricityBillInr: '',
  gridSuitability: '',
  customerRequirements: '',
  preliminaryObservations: '',
  roofDirection: '',
  roofTiltDegrees: '',
  cableDistanceMeters: '',
  actualAvailableRoofAreaSqm: '',
  siteCondition: '',
  shadeObservations: '',
  technicalNotes: '',
}

function localDateTime(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function findingsFromSurvey(survey) {
  return Object.fromEntries(
    Object.keys(EMPTY_FINDINGS).map((field) => [field, survey[field] ?? '']),
  )
}

function errorText(error) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export default function SurveyManagement({ user, query = '' }) {
  const { request } = useAuth()
  const [surveys, setSurveys] = useState([])
  const [customers, setCustomers] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [selectedSurvey, setSelectedSurvey] = useState(null)
  const [findings, setFindings] = useState(EMPTY_FINDINGS)
  const [schedule, setSchedule] = useState({
    customerId: '',
    assignedSurveyorId: '',
    siteAddress: '',
    scheduledAt: localDateTime(),
  })
  const [scheduleTarget, setScheduleTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reviewSurvey, setReviewSurvey] = useState(null)

  const canSchedule = user.role === 'ADMIN' || user.role === 'SALES'
  const isSurveyor = user.role === 'SURVEYOR'
  const isAdmin = user.role === 'ADMIN'

  const reload = useCallback(async () => {
    setError('')
    try {
      const { surveys: records } = await request('/api/surveys')
      setSurveys(records)
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const tasks = [request('/api/surveys')]
        if (canSchedule) {
          tasks.push(request('/api/customers?recordType=real&pageSize=100'))
          tasks.push(request('/api/surveys/surveyors'))
        }
        const results = await Promise.all(tasks)
        if (!active) return
        setSurveys(results[0].surveys)
        if (canSchedule) {
          setCustomers(results[1].customers)
          setSurveyors(results[2].surveyors)
          setSchedule((current) => ({
            ...current,
            customerId: current.customerId || results[1].customers[0]?.id || '',
            assignedSurveyorId: current.assignedSurveyorId || results[2].surveyors[0]?.id || '',
          }))
        }
      } catch (requestError) {
        if (active) setError(errorText(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [canSchedule, request])

  async function openSurvey(survey) {
    setSelectedSurvey(survey)
    setDetailLoading(true)
    setError('')
    try {
      const response = await request(`/api/surveys/${encodeURIComponent(survey.id)}`)
      setSelectedSurvey(response.survey)
      setFindings(findingsFromSurvey(response.survey))
      if (isAdmin && response.survey.status === 'PENDING_APPROVAL') {
        setReviewSurvey(response.survey)
      }
      setScheduleTarget(response.survey)
      setSchedule({
        customerId: response.survey.customerId,
        assignedSurveyorId: response.survey.assignedSurveyorId || '',
        siteAddress: response.survey.siteAddress,
        scheduledAt: localDateTime(response.survey.scheduledAt),
      })
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setDetailLoading(false)
    }
  }

  function changeFinding(event) {
    setFindings((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function changeSchedule(event) {
    const { name, value } = event.target
    setSchedule((current) => {
      const next = { ...current, [name]: value }
      if (name === 'customerId') {
        const customer = customers.find((item) => item.id === value)
        next.siteAddress = customer?.address || ''
      }
      return next
    })
  }

  async function submitSchedule(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const body = {
        assignedSurveyorId: schedule.assignedSurveyorId,
        scheduledAt: new Date(schedule.scheduledAt).toISOString(),
        siteAddress: schedule.siteAddress.trim(),
      }
      if (scheduleTarget) {
        await request(`/api/surveys/${encodeURIComponent(scheduleTarget.id)}/schedule`, {
          method: 'PATCH',
          body,
        })
        setNotice(`Survey ${scheduleTarget.reference} rescheduled.`)
      } else {
        const response = await request('/api/surveys', {
          method: 'POST',
          body: { ...body, customerId: schedule.customerId },
        })
        setNotice(`Survey ${response.survey.reference} scheduled.`)
        setSelectedSurvey(response.survey)
      }
      setScheduleTarget(null)
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function updateVisitStatus(status) {
    if (!selectedSurvey) return
    setSaving(true)
    setError('')
    try {
      const response = await request(`/api/surveys/${encodeURIComponent(selectedSurvey.id)}/status`, {
        method: 'PATCH',
        body: { status },
      })
      setSelectedSurvey(response.survey)
      setNotice(status === 'IN_PROGRESS' ? 'Site visit started.' : 'Survey status updated.')
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function saveFindings(event) {
    event.preventDefault()
    if (!selectedSurvey) return
    setSaving(true)
    setError('')
    setNotice('')
    const numericFields = new Set([
      'shadowFreeRoofAreaSqm',
      'monthlyElectricityBillInr',
      'roofTiltDegrees',
      'cableDistanceMeters',
      'actualAvailableRoofAreaSqm',
    ])
    const body = Object.fromEntries(
      Object.entries(findings)
        .filter(([, value]) => value !== '')
        .map(([field, value]) => [field, numericFields.has(field) ? Number(value) : value]),
    )
    try {
      const response = await request(`/api/surveys/${encodeURIComponent(selectedSurvey.id)}`, {
        method: 'PATCH',
        body,
      })
      setSelectedSurvey(response.survey)
      setFindings(findingsFromSurvey(response.survey))
      setNotice('Survey findings saved as a draft.')
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function submitForApproval() {
    if (!selectedSurvey) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await request(`/api/surveys/${encodeURIComponent(selectedSurvey.id)}/submit`, {
        method: 'POST',
        body: {},
      })
      setSelectedSurvey(response.survey)
      setNotice('Survey submitted for approval.')
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedSurvey) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/surveys/${encodeURIComponent(selectedSurvey.id)}/photos`, {
        method: 'POST',
        body: file,
        headers: {
          'X-File-Name': encodeURIComponent(file.name),
          'X-Attachment-Type': 'ROOF_PHOTO',
        },
      })
      const response = await request(`/api/surveys/${encodeURIComponent(selectedSurvey.id)}`)
      setSelectedSurvey(response.survey)
      setNotice('Survey photograph uploaded securely.')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  const visibleSurveys = surveys.filter((survey) => {
    const text = `${survey.reference} ${survey.customerName} ${survey.siteAddress} ${survey.status}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })

  return (
    <div className="dashboard survey-management">
      {error && <p className="form-error survey-message" role="alert">{error}</p>}
      {notice && <p className="form-success survey-message" role="status">{notice}</p>}

      {canSchedule && (
        <section className="panel survey-schedule-panel">
          <div className="section-head">
            <div>
              <h2>{scheduleTarget ? `Reschedule ${scheduleTarget.reference}` : 'Schedule a roof survey'}</h2>
              <p>Choose a customer and an active Surveyor. Survey dates and site addresses are stored with the record.</p>
            </div>
            {scheduleTarget && (
              <button type="button" className="btn btn-ghost" onClick={() => setScheduleTarget(null)}>
                New survey
              </button>
            )}
          </div>
          {loading ? (
            <div className="survey-loading" role="status"><span className="loading-spinner" /> Loading customers and Surveyors…</div>
          ) : (
          <form className="survey-form-grid" onSubmit={submitSchedule}>
            {!scheduleTarget && (
              <label className="field">
                <span>Customer</span>
                <select
                  name="customerId"
                  value={schedule.customerId}
                  onChange={changeSchedule}
                  required
                >
                  <option value="" disabled>Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName} · {customer.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Assigned Surveyor</span>
              <select
                name="assignedSurveyorId"
                value={schedule.assignedSurveyorId}
                onChange={changeSchedule}
                required
              >
                <option value="" disabled>Select Surveyor</option>
                {surveyors.map((surveyor) => (
                  <option key={surveyor.id} value={surveyor.id}>{surveyor.fullName} · {surveyor.email}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Appointment</span>
              <input
                name="scheduledAt"
                type="datetime-local"
                value={schedule.scheduledAt}
                onChange={changeSchedule}
                required
              />
            </label>
            <label className="field survey-address-field">
              <span>Site address</span>
              <textarea name="siteAddress" value={schedule.siteAddress} onChange={changeSchedule} minLength="5" maxLength="500" required />
            </label>
            <div className="survey-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving || !customers.length || !surveyors.length}>
                {saving ? 'Saving…' : scheduleTarget ? 'Save schedule' : 'Schedule survey'}
              </button>
              {!customers.length && <span className="text-muted">Create a live customer profile before scheduling.</span>}
              {!!customers.length && !surveyors.length && <span className="text-muted">No active Surveyor account is available.</span>}
            </div>
          </form>
          )}
        </section>
      )}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{isSurveyor ? 'Assigned site visits' : user.role === 'CUSTOMER' ? 'Your roof surveys' : 'Survey register'}</h2>
            <p>{isSurveyor ? 'Only surveys assigned to your Surveyor account are shown.' : 'Live survey appointments and approval status from the workflow database.'}</p>
          </div>
          <span className="count-pill">{visibleSurveys.length} surveys</span>
        </div>
        {loading ? (
          <div className="survey-loading" role="status"><span className="loading-spinner" /> Loading surveys…</div>
        ) : visibleSurveys.length ? (
          <div className="table-wrap">
            <table className="data-table survey-table">
              <thead>
                <tr>
                  <th>Survey</th>
                  <th>Customer / site</th>
                  <th>Surveyor</th>
                  <th>Appointment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleSurveys.map((survey) => (
                  <tr key={survey.id}>
                    <td><strong>{survey.reference}</strong></td>
                    <td>{survey.customerName}<small>{survey.siteAddress}</small></td>
                    <td>{survey.assignedSurveyorName || 'Unassigned'}</td>
                    <td>{formatDate(survey.scheduledAt)}</td>
                    <td><span className="status">{survey.status.replaceAll('_', ' ')}</span></td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openSurvey(survey)}>
                        {isAdmin && survey.status === 'PENDING_APPROVAL' ? 'Review' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty" role="status">
            <h3>{query ? 'No matching surveys' : 'No surveys scheduled'}</h3>
            <p>{query ? 'Try another search term.' : 'When a site visit is scheduled or assigned, it will appear here.'}</p>
          </div>
        )}
      </section>

      {selectedSurvey && (
        <section className="panel survey-detail-panel" aria-labelledby="survey-detail-heading">
          <div className="section-head">
            <div>
              <p className="role-kicker">{selectedSurvey.reference} · {selectedSurvey.status.replaceAll('_', ' ')}</p>
              <h2 id="survey-detail-heading">{selectedSurvey.customerName}</h2>
              <p>{selectedSurvey.siteAddress} · Scheduled {formatDate(selectedSurvey.scheduledAt)}</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedSurvey(null)}>Close</button>
          </div>
          {detailLoading ? <p role="status">Loading survey details…</p> : (
            <>
              {(selectedSurvey.status === 'DRAFT' || selectedSurvey.status === 'CHANGES_REQUESTED') && isSurveyor && (
                <div className="survey-visit-actions">
                  <span>Assigned surveyor: {selectedSurvey.assignedSurveyorName || user.fullName}</span>
                  {selectedSurvey.visitStatus !== 'IN_PROGRESS' && (
                    <button type="button" className="btn btn-secondary" onClick={() => updateVisitStatus('IN_PROGRESS')} disabled={saving}>
                      Start site visit
                    </button>
                  )}
                </div>
              )}
              {canSchedule && selectedSurvey.status !== 'APPROVED' && selectedSurvey.status !== 'CANCELLED' && (
                <p className="survey-reschedule-note">Use the form above to reassign or reschedule this survey.</p>
              )}
              {isSurveyor && ['DRAFT', 'CHANGES_REQUESTED'].includes(selectedSurvey.status) ? (
                <form className="survey-findings-form" onSubmit={saveFindings}>
                  <h3>Initial qualification</h3>
                  <div className="survey-form-grid">
                    <label className="field"><span>Shadow-free roof area (m²)</span><input name="shadowFreeRoofAreaSqm" type="number" min="0" step="any" value={findings.shadowFreeRoofAreaSqm} onChange={changeFinding} /></label>
                    <label className="field"><span>Average monthly electricity bill (₹)</span><input name="monthlyElectricityBillInr" type="number" min="0" step="any" value={findings.monthlyElectricityBillInr} onChange={changeFinding} /></label>
                    <label className="field"><span>Grid suitability</span><select name="gridSuitability" value={findings.gridSuitability} onChange={changeFinding}><option value="">Select</option><option value="SUITABLE">Suitable</option><option value="UNSUITABLE">Not suitable</option><option value="UNKNOWN">Unknown</option></select></label>
                    <label className="field"><span>Customer requirements</span><textarea name="customerRequirements" value={findings.customerRequirements} onChange={changeFinding} maxLength="3000" /></label>
                    <label className="field"><span>Preliminary observations</span><textarea name="preliminaryObservations" value={findings.preliminaryObservations} onChange={changeFinding} maxLength="3000" /></label>
                  </div>
                  <h3>Physical roof survey</h3>
                  <div className="survey-form-grid">
                    <label className="field"><span>Roof direction</span><select name="roofDirection" value={findings.roofDirection} onChange={changeFinding}><option value="">Select</option>{['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'UNKNOWN'].map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select></label>
                    <label className="field"><span>Roof tilt (degrees)</span><input name="roofTiltDegrees" type="number" min="0" max="90" step="any" value={findings.roofTiltDegrees} onChange={changeFinding} /></label>
                    <label className="field"><span>Cable distance (m)</span><input name="cableDistanceMeters" type="number" min="0" step="any" value={findings.cableDistanceMeters} onChange={changeFinding} /></label>
                    <label className="field"><span>Actual available roof area (m²)</span><input name="actualAvailableRoofAreaSqm" type="number" min="0" step="any" value={findings.actualAvailableRoofAreaSqm} onChange={changeFinding} /></label>
                    <label className="field"><span>Site condition</span><textarea name="siteCondition" value={findings.siteCondition} onChange={changeFinding} maxLength="2000" /></label>
                    <label className="field"><span>Shade and obstructions</span><textarea name="shadeObservations" value={findings.shadeObservations} onChange={changeFinding} maxLength="3000" /></label>
                    <label className="field survey-address-field"><span>Technical notes</span><textarea name="technicalNotes" value={findings.technicalNotes} onChange={changeFinding} maxLength="5000" /></label>
                  </div>
                  <div className="survey-photo-section">
                    <label className="field">
                      <span>Survey photographs (JPEG, PNG or WebP; up to 5 MB)</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={saving} />
                    </label>
                    {selectedSurvey.photos?.length > 0 && (
                      <div className="survey-photo-grid">
                        {selectedSurvey.photos.map((photo) => (
                          <figure key={photo.id}>
                            <img src={photo.url} alt={`Survey site photograph: ${photo.originalName}`} />
                            <figcaption>{photo.originalName}</figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="survey-form-actions">
                    <button type="submit" className="btn btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
                    <button type="button" className="btn btn-primary" onClick={submitForApproval} disabled={saving}>
                      {saving ? 'Submitting…' : 'Submit for approval'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="survey-summary-grid">
                  <div><strong>Qualification</strong><span>Shadow-free area: {selectedSurvey.shadowFreeRoofAreaSqm ?? '—'} m²</span><span>Monthly bill: {selectedSurvey.monthlyElectricityBillInr ?? '—'}</span><span>Grid suitability: {selectedSurvey.gridSuitability || '—'}</span><span>Requirements: {selectedSurvey.customerRequirements || '—'}</span></div>
                  <div><strong>Physical measurements</strong><span>Roof: {selectedSurvey.roofDirection || '—'} · {selectedSurvey.roofTiltDegrees ?? '—'}°</span><span>Cable distance: {selectedSurvey.cableDistanceMeters ?? '—'} m</span><span>Available area: {selectedSurvey.actualAvailableRoofAreaSqm ?? '—'} m²</span><span>Site condition: {selectedSurvey.siteCondition || '—'}</span></div>
                  {selectedSurvey.photos?.length > 0 && <div className="survey-photo-grid">{selectedSurvey.photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={`Survey site photograph: ${photo.originalName}`} /><figcaption>{photo.originalName}</figcaption></figure>)}</div>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {reviewSurvey && (
        <SurveyApprovalDialog
          survey={reviewSurvey}
          onClose={() => setReviewSurvey(null)}
          onReviewed={async () => {
            setReviewSurvey(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}
