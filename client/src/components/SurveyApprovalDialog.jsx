import { useEffect } from 'react'
import Icon from './Icon'

export default function SurveyApprovalDialog({ survey, onClose, onApprove }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isApproved = survey.status === 'Approved'

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog survey-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Roof Survey Technical Review</h2>
            <p>Mandatory evaluation: Survey approval is compulsory before any quotation can be created or delivered.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <div className="survey-review-body">
          <div className="job-summary-card">
            <div>
              <strong>{survey.customer}</strong>
              <small>Survey ID: {survey.id} · Category: {survey.category || 'Home / Small Factory'}</small>
            </div>
            <span className={`status ${isApproved ? 'status-completed' : 'status-pending'}`}>
              Status: {survey.status}
            </span>
          </div>

          <div className="survey-checklist-grid">
            <div className="survey-param-card">
              <span className="param-label">1. Electricity Bill & Needs</span>
              <strong>{survey.monthlyBill || 'Verified monthly consumption'}</strong>
              <small className="text-muted">{survey.needs || 'Load reduction & energy security'}</small>
            </div>

            <div className="survey-param-card">
              <span className="param-label">2. Shadow-Free Roof Space</span>
              <strong>{survey.shadowCheck || 'Shadow-free area verified'}</strong>
              <small className="text-muted">Unobstructed solar irradiance path</small>
            </div>

            <div className="survey-param-card">
              <span className="param-label">3. Grid Connection Suitability</span>
              <strong>{survey.gridSuitability || 'Grid synchronization suitable'}</strong>
              <small className="text-muted">Voltage stability & phase verified</small>
            </div>

            <div className="survey-param-card">
              <span className="param-label">4. Roof Direction & Tilt</span>
              <strong>{survey.roofOrientation || 'South-facing orientation'}</strong>
              <small className="text-muted">Optimum sun trajectory alignment</small>
            </div>

            <div className="survey-param-card">
              <span className="param-label">5. DC/AC Cable Distance</span>
              <strong>{survey.cableFeasibility || 'Feasible routing distance'}</strong>
              <small className="text-muted">Minimal voltage drop to main panel</small>
            </div>

            <div className="survey-param-card">
              <span className="param-label">6. System Feasibility</span>
              <strong className="text-green">1.0 kW to 5.0 kW Feasible</strong>
              <small className="text-muted">Within SunPower Solutions official scope</small>
            </div>
          </div>

          <div className="approval-notice panel sub-panel" style={{ marginTop: '14px' }}>
            <h4>Approval Gatekeeper Compliance</h4>
            <p className="text-muted">
              By approving this technical survey, the customer record is unlocked in the Quotation Manager.
              No quotation template or price may be issued without this verified survey sign-off.
            </p>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {!isApproved && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onApprove(survey.id)}
            >
              <Icon name="check" />
              <span>Approve Survey & Unlock Quotation</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
