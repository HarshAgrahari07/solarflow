import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export default function CommissioningDialog({ job, onClose, onComplete }) {
  const [startTime, setStartTime] = useState('09:30')
  const [finishTime, setFinishTime] = useState('16:45')
  const [powerGenKw, setPowerGenKw] = useState('3.85')
  const [hasPhotoProof, setHasPhotoProof] = useState(true)
  const [signatureDrawn, setSignatureDrawn] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f6b3c'
  }, [])

  function startDrawing(e) {
    setIsDrawing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  function draw(e) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
    setSignatureDrawn(true)
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureDrawn(false)
  }

  function handleCompleteHandover(e) {
    e.preventDefault()
    if (!signatureDrawn) {
      alert('Mandatory requirement: Homeowner digital signature is required before completing commissioning.')
      return
    }
    const testGen = parseFloat(powerGenKw)
    if (Number.isNaN(testGen) || testGen <= 0) {
      alert('Mandatory requirement: A valid power-generation test reading must be recorded.')
      return
    }

    onComplete(job.id, {
      startTime,
      finishTime,
      testOutput: `${testGen} kW peak tested`,
      hasPhotoProof,
      signatureConfirmed: true,
    })
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog commissioning-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Installation Commissioning & Handover</h2>
            <p>Official commissioning checklist: times, power-generation test, photos, and homeowner digital signature.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleCompleteHandover} className="commissioning-body">
          <div className="job-summary-card">
            <div>
              <strong>{job.customer}</strong>
              <small>Location: {job.location} · Assigned: {job.technician}</small>
            </div>
            <div className="header-meta">
              <span className="count-pill">{job.capacity} (1–5 kW Scope)</span>
              <span className="status status-ongoing">{job.status}</span>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>1. Technician Working Hours</h4>
            <div className="form-grid-2" style={{ marginTop: '8px' }}>
              <label className="field">
                <span>Start Time</span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Finish Time</span>
                <input
                  type="time"
                  required
                  value={finishTime}
                  onChange={(e) => setFinishTime(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>2. Confirmed Capacity & Power-Generation Test</h4>
            <div className="form-grid-2" style={{ marginTop: '8px' }}>
              <label className="field">
                <span>Installed System Capacity</span>
                <input type="text" readOnly value={job.capacity} style={{ background: '#f4f4f4' }} />
                <small className="text-muted">Strictly 1.0 kW to 5.0 kW inclusive</small>
              </label>
              <label className="field">
                <span>Peak Generation Output Test (kW)</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={powerGenKw}
                  onChange={(e) => setPowerGenKw(e.target.value)}
                />
                <small className="text-muted">Live solar generation verified on-site</small>
              </label>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <div className="section-head" style={{ marginBottom: '8px' }}>
              <div>
                <h4>3. Installation Photographs Proof</h4>
                <p className="text-muted">Visual documentation of roof mounting, inverter hookup, and grounding.</p>
              </div>
              <label className="check-field" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={hasPhotoProof}
                  onChange={(e) => setHasPhotoProof(e.target.checked)}
                />
                <span>Photographs captured</span>
              </label>
            </div>
            <div className="photo-preview-grid">
              <div className="photo-thumb">
                <Icon name="camera" />
                <span>Panels & Stands on Roof</span>
                <span className="mini-pill mini-pill-green">Verified</span>
              </div>
              <div className="photo-thumb">
                <Icon name="camera" />
                <span>Inverter & Wiring Boxes</span>
                <span className="mini-pill mini-pill-green">Verified</span>
              </div>
              <div className="photo-thumb">
                <Icon name="camera" />
                <span>Grounding & Earthing Pit</span>
                <span className="mini-pill mini-pill-green">Verified</span>
              </div>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <div className="section-head" style={{ marginBottom: '6px' }}>
              <div>
                <h4>4. Homeowner Digital Signature</h4>
                <p className="text-muted">Homeowner or factory representative sign-off confirming inspection.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearSignature}>
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={540}
              height={100}
              className="signature-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            {!signatureDrawn && (
              <small style={{ color: '#b23b2a', display: 'block', marginTop: '4px' }}>
                * Sign with mouse or stylus inside the box above.
              </small>
            )}
            {signatureDrawn && (
              <small style={{ color: '#0f6b3c', display: 'block', marginTop: '4px' }}>
                ✓ Digital signature captured for customer file.
              </small>
            )}
          </div>

          <div className="dialog-actions" style={{ marginTop: '14px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Icon name="check" />
              <span>Complete Handover & Mark Completed</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
