import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'

export default function SurveyApprovalDialog({ survey, onClose, onReviewed }) {
  const { request } = useAuth()
  const [details, setDetails] = useState(survey)
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request(`/api/surveys/${encodeURIComponent(survey.id)}`)
      .then((response) => {
        if (active) setDetails(response.survey)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [request, survey.id])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  async function review(action) {
    setError('')
    if (action !== 'APPROVE' && !comments.trim()) {
      setError('Add a reason before requesting corrections or rejecting this survey.')
      return
    }
    setSaving(true)
    try {
      await request(`/api/surveys/${encodeURIComponent(survey.id)}/review`, {
        method: 'POST',
        body: { action, comments: comments.trim() },
      })
      await onReviewed()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={saving ? undefined : onClose}>
      <section
        className="dialog survey-approval-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-review-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <p className="role-kicker">{details.reference || survey.reference}</p>
            <h2 id="survey-review-heading">Roof survey approval</h2>
            <p>Review submitted measurements and photographs before deciding.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={saving}>×</button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? (
          <div className="survey-loading" role="status"><span className="loading-spinner" /> Loading survey details…</div>
        ) : (
          <div className="survey-review-body">
            <div className="job-summary-card">
              <div>
                <strong>{details.customerName}</strong>
                <small>{details.customerCategory || 'Customer'} · {details.siteAddress}</small>
                <small>Assigned Surveyor: {details.assignedSurveyorName || 'Not available'}</small>
              </div>
              <span className="status">{details.status.replaceAll('_', ' ')}</span>
            </div>

            <div className="survey-summary-grid">
              <div>
                <strong>Initial qualification</strong>
                <span>Shadow-free area: {details.shadowFreeRoofAreaSqm ?? '—'} m²</span>
                <span>Monthly electricity bill: {details.monthlyElectricityBillInr ?? '—'} INR</span>
                <span>Grid suitability: {details.gridSuitability || '—'}</span>
                <span>Customer requirements: {details.customerRequirements || '—'}</span>
                <span>Preliminary observations: {details.preliminaryObservations || '—'}</span>
              </div>
              <div>
                <strong>Physical roof survey</strong>
                <span>Roof direction: {details.roofDirection || '—'}</span>
                <span>Roof tilt: {details.roofTiltDegrees ?? '—'} degrees</span>
                <span>Cable distance: {details.cableDistanceMeters ?? '—'} m</span>
                <span>Actual available area: {details.actualAvailableRoofAreaSqm ?? '—'} m²</span>
                <span>Site condition: {details.siteCondition || '—'}</span>
                <span>Shade / obstructions: {details.shadeObservations || '—'}</span>
                <span>Technical notes: {details.technicalNotes || '—'}</span>
              </div>
            </div>

            <section className="survey-photo-section" aria-label="Survey photographs">
              <h3>Survey photographs</h3>
              {details.photos?.length ? (
                <div className="survey-photo-grid">
                  {details.photos.map((photo) => (
                    <figure key={photo.id}>
                      <img src={photo.url} alt={`Survey site photograph: ${photo.originalName}`} />
                      <figcaption>{photo.originalName} · {photo.attachmentType.replaceAll('_', ' ')}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : <p className="text-muted">No photographs attached.</p>}
            </section>

            <section className="survey-history">
              <h3>Approval history</h3>
              {details.approvalHistory?.length ? (
                <ol>
                  {details.approvalHistory.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.decision.replaceAll('_', ' ')}</strong>
                      <span>{entry.reviewerName} · {new Date(entry.decidedAt).toLocaleString()}</span>
                      {entry.comments && <p>{entry.comments}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-muted">No review decisions have been recorded.</p>}
            </section>

            {details.status === 'PENDING_APPROVAL' && (
              <label className="field">
                <span>Review comments (required for correction request or rejection)</span>
                <textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength="3000" rows="3" />
              </label>
            )}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Close</button>
          {!loading && details.status === 'PENDING_APPROVAL' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => review('REQUEST_CORRECTIONS')} disabled={saving}>
                Request corrections
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => review('REJECT')} disabled={saving}>
                Reject
              </button>
              <button type="button" className="btn btn-primary" onClick={() => review('APPROVE')} disabled={saving}>
                {saving ? 'Saving…' : 'Approve survey'}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
