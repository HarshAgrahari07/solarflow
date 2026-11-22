import { useEffect } from 'react'
import { getBOMForSystem } from '../data/demoData'
import Icon from './Icon'

export default function BOMDialog({ quote, onClose, onConfirmOrder }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const capacityVal = parseFloat(quote.capacity) || 3.0
  const bomItems = getBOMForSystem(capacityVal, quote.packageType || 'On-Grid System')
  const isConfirmed = quote.status === 'Order Confirmed'

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog bom-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Quotation Details & Bill of Materials (BOM)</h2>
            <p>Automatic component list generated for approved survey. Installation is unbundled as a separate service.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <div className="bom-body">
          <div className="job-summary-card">
            <div>
              <strong>{quote.customer}</strong>
              <small>Quote: {quote.quoteId} · Associated Survey: {quote.surveyRef || 'Approved Survey'}</small>
            </div>
            <div className="header-meta">
              <span className="count-pill">{quote.capacity} · {quote.packageType || 'On-Grid System'}</span>
              <span className="status status-completed">{quote.status}</span>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <div className="section-head" style={{ marginBottom: '8px' }}>
              <div>
                <h4>Automatic Component Package List</h4>
                <p className="text-muted">Mandatory package components strictly following official problem statement requirements.</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Component Item</th>
                    <th scope="col">Specification / Quantity</th>
                    <th scope="col">Package Requirement Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bomItems.map((item) => (
                    <tr key={item.component}>
                      <td><strong>{item.component}</strong></td>
                      <td>{item.spec}</td>
                      <td>
                        <span className={`mini-pill ${item.type.includes('Required') ? 'mini-pill-green' : 'mini-pill-amber'}`}>
                          {item.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>Payment Terms & Warehouse Picking</h4>
            <div className="form-grid-2" style={{ marginTop: '8px' }}>
              <div>
                <span className="text-muted">Illustrative Quotation Amount:</span>
                <p style={{ fontSize: '18px', fontWeight: '700' }}>{quote.amount || '₹2,40,000*'}</p>
                <small className="text-muted">*Illustrative demo estimate based on standard BOM</small>
              </div>
              <div>
                <span className="text-muted">Payment Milestone Terms:</span>
                <p style={{ fontSize: '14px', fontWeight: '600' }}>50% Advance collected before warehouse picking</p>
                <small className="text-muted">Balance due upon completed installation handover</small>
              </div>
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {!isConfirmed && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onConfirmOrder(quote.quoteId)}
            >
              <Icon name="check" />
              <span>Confirm Order & Generate Warehouse Picking List</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
