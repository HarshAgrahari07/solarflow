import { useEffect, useState } from 'react'
import { SERIAL_REGISTRY } from '../data/demoData'
import Icon from './Icon'

export default function DispatchDialog({ order, onClose, onDispatch }) {
  const [inverterSn, setInverterSn] = useState('')
  const [controllerSn, setControllerSn] = useState('')
  const [batterySn, setBatterySn] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => {
    return new Date().toISOString().slice(0, 10)
  })

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const needsBattery = (order.packageType || order.package || '').toLowerCase().includes('off-grid')

  function handleAutoFillAvailable() {
    const freeInv = SERIAL_REGISTRY.inverters.find((i) => !i.assignedCustomer) || SERIAL_REGISTRY.inverters[0]
    const freeCc = SERIAL_REGISTRY.chargeControllers.find((c) => !c.assignedCustomer) || SERIAL_REGISTRY.chargeControllers[0]
    const freeBat = SERIAL_REGISTRY.batteries.find((b) => !b.assignedCustomer) || SERIAL_REGISTRY.batteries[0]

    setInverterSn(freeInv.sn)
    setControllerSn(freeCc.sn)
    if (needsBattery) {
      setBatterySn(freeBat.sn)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!inverterSn.trim() || !controllerSn.trim() || (needsBattery && !batterySn.trim())) {
      alert('Mandatory serial scanning: Inverter, Charge Controller (and Battery if Off-Grid) serial numbers must be scanned before dispatch.')
      return
    }

    onDispatch({
      orderId: order.id || order.quoteId,
      customer: order.customer,
      capacity: order.capacity,
      packageType: order.packageType || order.package || 'On-Grid System',
      deliveryDate,
      serials: {
        inverter: inverterSn.trim(),
        chargeController: controllerSn.trim(),
        battery: needsBattery ? batterySn.trim() : null,
      },
    })
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dispatch-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Warehouse Picking & Serial Scan Dispatch</h2>
            <p>Mandatory barcode scan: Inverters, batteries, and charge controllers must have serial numbers logged before dispatch. Warranty begins on completed delivery date.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dispatch-dialog-body">
          <div className="job-summary-card">
            <div>
              <strong>{order.customer}</strong>
              <small>Order Ref: {order.quoteId || order.id} · System: {order.capacity} {order.packageType || order.package || 'On-Grid'}</small>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAutoFillAvailable}>
              <Icon name="barcode" />
              <span>Simulate Barcode Scan</span>
            </button>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>Mandatory Serial Number Scanning</h4>
            <p className="text-muted">Serial numbers link directly to customer records for warranty validity verification.</p>

            <div className="field-grid" style={{ marginTop: '10px' }}>
              <label className="field">
                <span>Inverter Serial Number (Mandatory)</span>
                <input
                  type="text"
                  placeholder="e.g. SN-INV-3K-4109"
                  required
                  value={inverterSn}
                  onChange={(e) => setInverterSn(e.target.value)}
                />
                <small className="text-muted">2-Year Inverter Warranty starts on delivery</small>
              </label>

              <label className="field">
                <span>Charge Controller Serial Number (Mandatory)</span>
                <input
                  type="text"
                  placeholder="e.g. SN-CC-MPPT-104"
                  required
                  value={controllerSn}
                  onChange={(e) => setControllerSn(e.target.value)}
                />
                <small className="text-muted">Warranty: Not specified in the official problem statement</small>
              </label>

              {needsBattery && (
                <label className="field">
                  <span>Large Battery Serial Number (Mandatory for Off-Grid)</span>
                  <input
                    type="text"
                    placeholder="e.g. SN-BAT-100-3301"
                    required
                    value={batterySn}
                    onChange={(e) => setBatterySn(e.target.value)}
                  />
                  <small className="text-muted">2-Year Battery Warranty starts on delivery</small>
                </label>
              )}
            </div>
          </div>

          <div className="panel sub-panel" style={{ marginTop: '12px' }}>
            <h4>Delivery Date & Warranty Activation</h4>
            <div className="form-grid-2" style={{ marginTop: '8px' }}>
              <label className="field">
                <span>Scheduled / Completed Delivery Date</span>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                <small className="text-muted">Official mandate: Warranty begins on completed delivery date</small>
              </label>

              <div style={{ padding: '8px 12px', background: '#eef6f1', borderRadius: '8px', fontSize: '12px' }}>
                <strong>Warranty Terms Activated:</strong>
                <ul style={{ paddingLeft: '18px', margin: '4px 0 0 0' }}>
                  <li>Solar Panels: 20 years</li>
                  <li>Inverter: 2 years</li>
                  {needsBattery && <li>Battery: 2 years</li>}
                  <li>Charge Controller: Not specified in official problem statement</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="dialog-actions" style={{ marginTop: '14px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Icon name="check" />
              <span>Confirm Warehouse Dispatch & Link Serials</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
