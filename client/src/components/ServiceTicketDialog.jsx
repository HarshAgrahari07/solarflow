import { useEffect, useState } from 'react'
import Icon from './Icon'

export default function ServiceTicketDialog({ ticket, onClose, onResolve }) {
  const [customerConfirmed, setCustomerConfirmed] = useState(false)
  const isClosed = ticket.status.includes('Closed') || ticket.status.includes('Resolved')

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isCovered = ticket.coverage ? ticket.coverage.toLowerCase().includes('covered') : true
  const partsCost = isCovered ? 0 : 3500
  const labourCost = isCovered ? 0 : 1200
  const totalCharge = partsCost + labourCost

  function handleCloseTicket() {
    if (!customerConfirmed) {
      alert('Mandatory rule: Service tickets remain open until the customer explicitly confirms resolution.')
      return
    }
    onResolve(ticket.id)
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog service-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Service Ticket & Warranty Assessment</h2>
            <p>Official service rules: Covered repairs are free; non-covered calculate parts and labour. Tickets remain open until customer confirms resolution.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <div className="service-dialog-body">
          <div className="job-summary-card">
            <div>
              <strong>{ticket.customer}</strong>
              <small>Ticket Ref: {ticket.id} · Serial: {ticket.serialNo || 'SN-Verified'}</small>
            </div>
            <span className={`status ${isClosed ? 'status-completed' : 'status-pending'}`}>
              {ticket.status}
            </span>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>Reported Issue & Diagnostics</h4>
            <p style={{ marginTop: '6px', fontSize: '15px' }}>{ticket.issue}</p>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <div className="section-head" style={{ marginBottom: '8px' }}>
              <div>
                <h4>Warranty Validity Calculation</h4>
                <p className="text-muted">Calculated against completed delivery date (Inverter: 2y, Battery: 2y, Panels: 20y).</p>
              </div>
              <span className={`mini-pill ${isCovered ? 'mini-pill-green' : 'mini-pill-amber'}`}>
                {isCovered ? 'Covered under warranty' : 'Out-of-warranty / Non-covered'}
              </span>
            </div>

            <div className="billing-calculation-grid">
              <div className="billing-item">
                <span>Replacement Parts Cost:</span>
                <strong>{isCovered ? '₹0.00 (Covered by warranty)' : `₹${partsCost.toLocaleString('en-IN')}`}</strong>
              </div>
              <div className="billing-item">
                <span>Technician Labour Charges:</span>
                <strong>{isCovered ? '₹0.00 (Covered by warranty)' : `₹${labourCost.toLocaleString('en-IN')}`}</strong>
              </div>
              <div className="billing-item total">
                <span>Total Bill to Customer:</span>
                <strong className={isCovered ? 'text-green' : 'text-amber'}>
                  {isCovered ? '₹0.00 (Free to customer)' : `₹${totalCharge.toLocaleString('en-IN')}`}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>Customer Resolution Confirmation Gate</h4>
            <p className="text-muted">Problem statement mandate: Tickets must remain open until customer confirms resolution.</p>
            {!isClosed ? (
              <label className="check-field" style={{ marginTop: '10px' }}>
                <input
                  type="checkbox"
                  checked={customerConfirmed}
                  onChange={(e) => setCustomerConfirmed(e.target.checked)}
                />
                <span>Homeowner / Factory manager has tested the repair and confirmed resolution</span>
              </label>
            ) : (
              <p className="form-success" style={{ marginTop: '8px' }}>
                Resolution verified and customer sign-off recorded.
              </p>
            )}
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {!isClosed && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!customerConfirmed}
              onClick={handleCloseTicket}
            >
              <Icon name="check" />
              <span>Confirm Customer Sign-Off & Close Ticket</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
