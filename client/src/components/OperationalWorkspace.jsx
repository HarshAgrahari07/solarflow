import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'

const today = new Date().toISOString().slice(0, 10)
const nowLocal = (offsetMs = 0) => {
  const date = new Date(Date.now() + offsetMs)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
const dateTimeLocal = (value) => {
  if (!value) return ''
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function inr(value) {
  return value === null || value === undefined
    ? 'Not configured'
    : `₹${Number(value).toLocaleString('en-IN')}`
}

function EmptyState({ children }) {
  return <div className="role-empty-state"><strong>{children}</strong></div>
}

export default function OperationalWorkspace({ user, section }) {
  const { request } = useAuth()
  const [inventory, setInventory] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [purchases, setPurchases] = useState([])
  const [installations, setInstallations] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [tickets, setTickets] = useState([])
  const [orders, setOrders] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payrollOptions, setPayrollOptions] = useState([])
  const [payroll, setPayroll] = useState([])
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [stockItemId, setStockItemId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [selectedPurchase, setSelectedPurchase] = useState(null)
  const [serialInputs, setSerialInputs] = useState({})
  const [dispatchSerial, setDispatchSerial] = useState({})
  const [dispatchWarehouseChoice, setDispatchWarehouseChoice] = useState({})
  const [testResults, setTestResults] = useState({})
  const [paymentAmounts, setPaymentAmounts] = useState({})
  const [serialSearch, setSerialSearch] = useState('')
  const [serialResult, setSerialResult] = useState(null)
  const [reportDates, setReportDates] = useState({ from: '', to: '' })

  const needsStock = ['inventory', 'finance', 'reports'].includes(section)
  const needsDispatches = section === 'inventory'
  const needsInstallations = section === 'installations'
  const needsTickets = ['service', 'warranties'].includes(section)
  const needsFinance = ['finance', 'reports'].includes(section)

  const reload = useCallback(async (dates = reportDates) => {
    try {
      const tasks = []
      if (needsStock) {
        tasks.push(request('/api/operations/inventory').then((result) => setInventory(result.inventory)))
      }
      if (needsDispatches) {
        tasks.push(request('/api/operations/dispatches').then((result) => setDispatches(result.dispatches)))
        tasks.push(request('/api/operations/finance/purchases').then((result) => setPurchases(result.purchases)))
      }
      if (needsInstallations) {
        tasks.push(request('/api/operations/installations').then((result) => setInstallations(result.installations)))
        if (user.role === 'ADMIN') {
          tasks.push(request('/api/operations/technicians').then((result) => setTechnicians(result.technicians)))
        }
      }
      if (needsTickets) {
        tasks.push(request('/api/operations/service-tickets').then((result) => setTickets(result.tickets)))
      }
      if (needsFinance) {
        tasks.push(request('/api/operations/orders').then((result) => setOrders(result.orders)))
        tasks.push(request('/api/operations/finance/invoices').then((result) => setInvoices(result.invoices)))
        tasks.push(request('/api/operations/finance/payroll/options').then((result) => setPayrollOptions(result.options)))
        tasks.push(request('/api/operations/finance/payroll').then((result) => setPayroll(result.payroll)))
        tasks.push(request(`/api/operations/finance/report${dates.from || dates.to
          ? `?${new URLSearchParams(Object.fromEntries(Object.entries(dates).filter(([, value]) => value))).toString()}`
          : ''}`).then((result) => setReport(result.report)))
        tasks.push(request('/api/operations/finance/purchases').then((result) => setPurchases(result.purchases)))
      }
      await Promise.all(tasks)
    } catch (requestError) {
      setError(requestError.message || 'Could not load operational records.')
    } finally {
      setLoading(false)
    }
  }, [needsDispatches, needsFinance, needsInstallations, needsStock, needsTickets, reportDates, request, user.role])

  useEffect(() => {
    Promise.resolve().then(reload)
  }, [reload])

  async function perform(action, successMessage) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(successMessage)
      await reload()
    } catch (requestError) {
      setError(requestError.message || 'The operation could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function receiveStock(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const item = inventory.find((entry) => entry.id === stockItemId)
    if (!item) return
    const form = new FormData(formElement)
    await perform(() => request('/api/operations/inventory/receipts', {
      method: 'POST',
      body: {
        warehouseId: form.get('warehouseId'),
        inventoryItemId: item.id,
        quantity: Number(form.get('quantity')),
        ...(form.get('serialNumber') ? { serialNumber: form.get('serialNumber') } : {}),
        note: 'Stock receipt recorded by warehouse',
      },
    }), 'Stock receipt saved.')
    formElement.reset()
  }

  async function loadPurchase(purchaseId) {
    setError('')
    try {
      const result = await request(`/api/operations/finance/purchases/${encodeURIComponent(purchaseId)}`)
      setSelectedPurchase(result.purchase)
      setSerialInputs({})
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function receivePurchase(event) {
    event.preventDefault()
    if (!selectedPurchase) return
    const serials = selectedPurchase.items
      .filter((item) => item.tracksSerial)
      .map((item) => ({
        purchaseItemId: item.id,
        serialNumbers: (serialInputs[item.id] || '').split(',').map((value) => value.trim()).filter(Boolean),
      }))
    await perform(async () => {
      await request(`/api/operations/finance/purchases/${encodeURIComponent(selectedPurchase.id)}/receive`, {
        method: 'POST',
        body: { serials },
      })
      setSelectedPurchase(null)
    }, 'Purchase receipt posted to stock.')
  }

  async function changeDispatch(dispatch, nextStatus) {
    await perform(() => request(`/api/operations/dispatches/${encodeURIComponent(dispatch.id)}/status`, {
      method: 'PATCH',
      body: { status: nextStatus },
    }), `Dispatch marked ${nextStatus.toLowerCase()}.`)
  }

  async function chooseDispatchWarehouse(dispatch, selectedWarehouse) {
    await perform(() => request(`/api/operations/dispatches/${encodeURIComponent(dispatch.id)}/warehouse`, {
      method: 'PATCH',
      body: { warehouseId: selectedWarehouse },
    }), 'Warehouse assigned and available stock reserved.')
  }

  async function scanSerial(dispatch) {
    const serialNumber = dispatchSerial[dispatch.id]?.trim()
    if (!serialNumber) return
    await perform(() => request(`/api/operations/dispatches/${encodeURIComponent(dispatch.id)}/serials`, {
      method: 'POST',
      body: { serialNumber },
    }), `Serial ${serialNumber} verified for dispatch.`)
    setDispatchSerial((current) => ({ ...current, [dispatch.id]: '' }))
  }

  async function updateChecklist(job, item, isComplete) {
    await perform(() => request(
      `/api/operations/installations/${encodeURIComponent(job.id)}/checklist/${encodeURIComponent(item.code)}`,
      { method: 'PATCH', body: { isComplete, notes: item.notes || '' } },
    ), 'Installation checklist updated.')
  }

  async function scheduleInstallation(event, job) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const scheduledStart = new Date(form.get('scheduledStart')).toISOString()
    const scheduledEnd = form.get('scheduledEnd')
    await perform(() => request(`/api/operations/installations/${encodeURIComponent(job.id)}/schedule`, {
      method: 'PATCH',
      body: {
        scheduledStart,
        ...(scheduledEnd ? { scheduledEnd: new Date(scheduledEnd).toISOString() } : {}),
        technicianIds: [form.get('technicianId')],
      },
    }), 'Installation appointment and crew assignment saved.')
  }

  async function lookupSerial(event) {
    event.preventDefault()
    setError('')
    setSerialResult(null)
    try {
      const result = await request(`/api/operations/serials/${encodeURIComponent(serialSearch.trim())}`)
      setSerialResult(result.equipment)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function createInvoice(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const orderId = new FormData(formElement).get('orderId')
    await perform(async () => {
      await request('/api/operations/finance/invoices', { method: 'POST', body: { orderId } })
    }, 'Draft invoice created from configured quotation line items.')
    formElement.reset()
  }

  async function invoiceStatus(invoice, status) {
    await perform(() => request(`/api/operations/finance/invoices/${encodeURIComponent(invoice.id)}/status`, {
      method: 'PATCH',
      body: { status },
    }), `Invoice ${status.toLowerCase()}.`)
  }

  async function recordPayment(event, order) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await perform(() => request(`/api/operations/orders/${encodeURIComponent(order.id)}/payments`, {
      method: 'POST',
      body: {
        type: form.get('type'),
        amount: Number(form.get('amount')),
        method: form.get('method'),
        reference: form.get('reference'),
      },
    }), 'Payment recorded.')
    formElement.reset()
  }

  async function addExpense(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await perform(() => request('/api/operations/finance/expenses', {
      method: 'POST',
      body: {
        orderId: form.get('orderId') || undefined,
        type: form.get('type'),
        description: form.get('description'),
        amount: Number(form.get('amount')),
        incurredAt: new Date(`${form.get('incurredAt')}T12:00:00`).toISOString(),
      },
    }), 'Expense recorded.')
    formElement.reset()
  }

  async function addPayroll(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const [jobId, technicianUserId] = form.get('assignment').split('|')
    const pricing = form.get('pricing')
    const amountValue = Number(form.get('rateOrAmount'))
    await perform(() => request('/api/operations/finance/payroll', {
      method: 'POST',
      body: {
        jobId,
        technicianUserId,
        hours: Number(form.get('hours')),
        [pricing]: amountValue,
        notes: form.get('notes'),
        ...(form.get('paidAt') ? { paidAt: new Date(`${form.get('paidAt')}T12:00:00`).toISOString() } : {}),
      },
    }), 'Technician payroll recorded from completed time logs.')
  }

  async function createPurchase(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await perform(() => request('/api/operations/finance/purchases', {
      method: 'POST',
      body: {
        warehouseId: form.get('warehouseId'),
        supplierName: form.get('supplierName'),
        purchasedAt: new Date(`${form.get('purchasedAt')}T12:00:00`).toISOString(),
        items: [{
          inventoryItemId: form.get('inventoryItemId'),
          quantity: Number(form.get('quantity')),
          ...(form.get('unitCost') === '' ? {} : { unitCost: Number(form.get('unitCost')) }),
        }],
      },
    }), 'Stock purchase order created.')
    formElement.reset()
  }

  async function resolveTicket(event, ticket) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await perform(() => request(`/api/operations/service-tickets/${encodeURIComponent(ticket.id)}/resolve`, {
      method: 'POST',
      body: {
        type: form.get('type'),
        partsCharge: Number(form.get('partsCharge')),
        labourCharge: Number(form.get('labourCharge')),
        notes: form.get('notes'),
      },
    }), 'Resolution recorded; ticket is awaiting customer confirmation.')
  }

  const warehouses = [...new Map(inventory.map((item) => [
    item.warehouseId,
    { id: item.warehouseId, name: item.warehouseName },
  ])).values()]
  const uniqueItems = [...new Map(inventory.map((item) => [item.id, item])).values()]

  return (
    <div className="dashboard operational-workspace">
      {loading && <section className="panel" role="status">Loading live operational records…</section>}
      {error && <p className="form-error survey-message" role="alert">{error}</p>}
      {notice && <p className="form-success survey-message" role="status">{notice}</p>}
      {!loading && !error && (
        <>
          {needsStock && (
            <section className="panel">
              <div className="section-head">
                <div><h2>Live inventory</h2><p>Quantities and alerts are based on recorded stock movements.</p></div>
                <span className="count-pill">{inventory.length} warehouse lines</span>
              </div>
              {inventory.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>SKU / Item</th><th>Type</th><th>Warehouse</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Alert</th></tr></thead>
                    <tbody>{inventory.map((item) => (
                      <tr key={`${item.id}-${item.warehouseId}`}>
                        <td><strong>{item.sku}</strong><br />{item.name}</td>
                        <td>{item.productType}</td><td>{item.warehouseName}</td>
                        <td>{item.quantityOnHand} {item.unit}</td><td>{item.quantityReserved} {item.unit}</td>
                        <td>{item.available} {item.unit}</td>
                        <td>{item.lowStock ? <span className="status status-pending">Reorder review</span> : 'In range'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <EmptyState>No active inventory records.</EmptyState>}
            </section>
          )}

          {section === 'inventory' && (
            <>
              <section className="panel">
                <h2>Receive stock</h2>
                <form className="crm-form-grid" onSubmit={receiveStock}>
                  <label className="field"><span>Warehouse</span><select name="warehouseId" value={warehouseId || warehouses[0]?.id || ''} onChange={(event) => setWarehouseId(event.target.value)} required>
                    {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select></label>
                  <label className="field"><span>Inventory item</span><select value={stockItemId || uniqueItems[0]?.id || ''} onChange={(event) => setStockItemId(event.target.value)} required>
                    {uniqueItems.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}
                  </select></label>
                  <label className="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="any" defaultValue="1" required /></label>
                  {uniqueItems.find((item) => item.id === (stockItemId || uniqueItems[0]?.id))?.tracksSerial ? (
                    <label className="field"><span>Unique serial number</span><input name="serialNumber" maxLength="120" required /></label>
                  ) : null}
                  <div className="crm-form-span"><button className="btn btn-primary" disabled={busy}>Post stock receipt</button></div>
                </form>
              </section>
              <section className="panel">
                <div className="section-head"><div><h2>Picking and dispatch</h2><p>Reserve stock, verify required serials, then record departure and delivery.</p></div></div>
                {dispatches.length ? dispatches.map((dispatch) => (
                  <article className="customer-project-card" key={dispatch.id}>
                    <div><strong>{dispatch.dispatchNumber} · {dispatch.orderNumber}</strong><span>{dispatch.customerName} · {dispatch.warehouseName || 'Warehouse not assigned'}</span><span>Status: {dispatch.status}</span></div>
                    {dispatch.status === 'PICKING' && (
                      <div className="operational-actions">
                        <select aria-label="Dispatch warehouse" value={dispatchWarehouseChoice[dispatch.id] || dispatch.warehouseId || warehouses[0]?.id || ''} onChange={(event) => setDispatchWarehouseChoice((current) => ({ ...current, [dispatch.id]: event.target.value }))}>
                          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                        </select>
                        <button className="btn btn-secondary" type="button" disabled={busy || !warehouses.length} onClick={() => chooseDispatchWarehouse(dispatch, dispatchWarehouseChoice[dispatch.id] || dispatch.warehouseId || warehouses[0]?.id)}>Assign & reserve</button>
                        <input aria-label="Scan serial number" placeholder="Serial number" value={dispatchSerial[dispatch.id] || ''} onChange={(event) => setDispatchSerial((current) => ({ ...current, [dispatch.id]: event.target.value }))} />
                        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => scanSerial(dispatch)}>Verify serial</button>
                        <button className="btn btn-primary" type="button" disabled={busy || !dispatch.warehouseId} onClick={() => changeDispatch(dispatch, 'READY')}>Ready</button>
                      </div>
                    )}
                    {dispatch.status === 'READY' && <button className="btn btn-primary" disabled={busy} onClick={() => changeDispatch(dispatch, 'DISPATCHED')}>Record departure</button>}
                    {dispatch.status === 'DISPATCHED' && <button className="btn btn-primary" disabled={busy} onClick={() => changeDispatch(dispatch, 'DELIVERED')}>Confirm delivery</button>}
                    <small>{dispatch.scannedSerialCount} serial(s) scanned</small>
                  </article>
                )) : <EmptyState>No dispatches are waiting for warehouse action.</EmptyState>}
              </section>
              <PurchaseList purchases={purchases} busy={busy} onOpen={loadPurchase} />
              {selectedPurchase && <PurchaseReceiveForm purchase={selectedPurchase} values={serialInputs} onChange={setSerialInputs} onSubmit={receivePurchase} onCancel={() => setSelectedPurchase(null)} busy={busy} />}
            </>
          )}

          {needsInstallations && (
            <section className="panel">
              <div className="section-head"><div><h2>Assigned installations</h2><p>Only jobs assigned to your technician account are returned.</p></div><span className="count-pill">{installations.length} jobs</span></div>
              {installations.length ? installations.map((job) => (
                <article className="customer-project-card" key={job.id}>
                  <div><strong>{job.jobNumber} · {job.customerName}</strong><span>{job.siteAddress} · {job.orderNumber}</span><span>{job.scheduledStart ? new Date(job.scheduledStart).toLocaleString('en-IN') : 'Schedule pending'} · {job.status}</span></div>
                  {user.role === 'ADMIN' && ['SCHEDULED', 'READY'].includes(job.status) && <form className="operational-actions" onSubmit={(event) => scheduleInstallation(event, job)}>
                    <label className="field"><span>Appointment</span><input name="scheduledStart" type="datetime-local" defaultValue={dateTimeLocal(job.scheduledStart) || nowLocal()} required /></label>
                    <label className="field"><span>End (optional)</span><input name="scheduledEnd" type="datetime-local" defaultValue={dateTimeLocal(job.scheduledEnd)} /></label>
                    <label className="field"><span>Assign technician</span><select name="technicianId" defaultValue={job.assignments[0]?.userId || technicians[0]?.id || ''} required>
                      {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
                    </select></label>
                    <button className="btn btn-primary" disabled={busy || !technicians.length}>Save schedule</button>
                  </form>}
                  {['SCHEDULED', 'READY'].includes(job.status) && <button className="btn btn-primary" disabled={busy || job.dispatchStatus !== 'DELIVERED'} onClick={() => perform(() => request(`/api/operations/installations/${encodeURIComponent(job.id)}/start`, { method: 'POST' }), 'Installation started.')}>Start installation</button>}
                  {job.status === 'IN_PROGRESS' && (
                    <div className="installation-operations">
                      <h3>Safety and commissioning checklist</h3>
                      {job.checklist.map((item) => <label className="check-field" key={item.code}>
                        <input type="checkbox" checked={Boolean(item.isComplete)} disabled={busy} onChange={(event) => updateChecklist(job, item, event.target.checked)} />
                        <span>{item.description}</span>
                      </label>)}
                      <label className="field"><span>Commissioning test result</span><textarea rows="2" value={testResults[job.id] ?? job.generationTestResult} onChange={(event) => setTestResults((current) => ({ ...current, [job.id]: event.target.value }))} /></label>
                      <button className="btn btn-secondary" disabled={busy || !(testResults[job.id] ?? job.generationTestResult)?.trim()} onClick={() => perform(() => request(`/api/operations/installations/${encodeURIComponent(job.id)}/commissioning`, { method: 'PUT', body: { result: (testResults[job.id] ?? job.generationTestResult).trim() } }), 'Commissioning result saved.')}>Save test result</button>
                      <form className="operational-actions" onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        perform(() => request(`/api/operations/installations/${encodeURIComponent(job.id)}/time-logs`, {
                          method: 'POST',
                          body: {
                            startedAt: new Date(form.get('startedAt')).toISOString(),
                            endedAt: new Date(form.get('endedAt')).toISOString(),
                            notes: form.get('notes'),
                          },
                        }), 'Technician time recorded.')
                      }}>
                        <input aria-label="Time started" name="startedAt" type="datetime-local" defaultValue={nowLocal(-60 * 60 * 1000)} required />
                        <input aria-label="Time ended" name="endedAt" type="datetime-local" defaultValue={nowLocal()} required />
                        <input aria-label="Time notes" name="notes" placeholder="Work notes" />
                        <button className="btn btn-secondary" disabled={busy}>Record hours</button>
                      </form>
                      <button className="btn btn-primary" disabled={busy} onClick={() => perform(() => request(`/api/operations/installations/${encodeURIComponent(job.id)}/complete`, { method: 'POST' }), 'Installation completed after sign-off.')}>Complete job</button>
                      {!job.customerSignedAt && <p className="role-data-note">Customer sign-off is still required in the customer portal.</p>}
                    </div>
                  )}
                  {job.status === 'COMPLETED' && <p className="form-success">Commissioning complete{job.customerSignedAt ? ' · customer sign-off recorded' : ''}.</p>}
                </article>
              )) : <EmptyState>No installations are assigned to your account.</EmptyState>}
            </section>
          )}

          {needsTickets && (
            <>
              {section === 'warranties' && <section className="panel">
                <h2>Serial and warranty lookup</h2>
                <form className="operational-actions" onSubmit={lookupSerial}>
                  <input aria-label="Serial number" value={serialSearch} onChange={(event) => setSerialSearch(event.target.value)} placeholder="Enter a delivered serial number" required />
                  <button className="btn btn-primary" disabled={busy}>Check serial</button>
                </form>
                {serialResult && <dl className="crm-details-grid"><div><dt>Product</dt><dd>{serialResult.productName} · {serialResult.productType}</dd></div><div><dt>Customer</dt><dd>{serialResult.customerName}</dd></div><div><dt>Warranty</dt><dd>{serialResult.warranty.status} · {serialResult.warranty.startsOn || 'No start'} to {serialResult.warranty.endsOn || 'No end'}</dd></div></dl>}
              </section>}
              <section className="panel">
                <div className="section-head"><div><h2>Service tickets</h2><p>Customer-owned records are scoped by the server; resolutions remain open until customer confirmation.</p></div></div>
                {tickets.length ? tickets.map((ticket) => <article className="customer-project-card" key={ticket.id}>
                  <div><strong>{ticket.ticketNumber} · {ticket.customerName}</strong><span>{ticket.subject} · {ticket.status}</span><span>{ticket.description}</span><span>{ticket.serials.map((serial) => `${serial.productName}: ${serial.serialNumber}`).join(' · ') || 'No equipment serial linked'}</span></div>
                  {user.role === 'SUPPORT' && ['OPEN', 'IN_PROGRESS'].includes(ticket.status) && (
                    <>
                      {!ticket.assigneeName && <button className="btn btn-secondary" disabled={busy} onClick={() => perform(() => request(`/api/operations/service-tickets/${encodeURIComponent(ticket.id)}/assignment`, { method: 'PATCH', body: { supportUserId: user.id } }), 'Ticket assigned to you.')}>Assign to me</button>}
                      <form className="crm-form-grid" onSubmit={(event) => resolveTicket(event, ticket)}>
                        <label className="field"><span>Resolution</span><select name="type"><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option><option value="ADVICE">Advice</option><option value="NO_FAULT_FOUND">No fault found</option><option value="OTHER">Other</option></select></label>
                        <label className="field"><span>Parts charge (₹)</span><input name="partsCharge" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                        <label className="field"><span>Labour charge (₹)</span><input name="labourCharge" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                        <label className="field"><span>Resolution notes</span><input name="notes" maxLength="4000" required /></label>
                        <div className="crm-form-span"><button className="btn btn-primary" disabled={busy}>Record resolution</button></div>
                      </form>
                    </>
                  )}
                  {ticket.resolutions.map((resolution) => <p key={resolution.id} className="role-data-note">Resolution: {resolution.type} · Warranty {resolution.warrantyCoverage} · Parts {inr(resolution.partsCharge)} · Labour {inr(resolution.labourCharge)}. Awaiting customer confirmation.</p>)}
                </article>) : <EmptyState>No service tickets are available.</EmptyState>}
              </section>
            </>
          )}

          {needsFinance && (
            <>
              <section className="role-metrics">
                <article className="stat-card"><p className="stat-label">Configured revenue</p><p className="stat-value">{inr(report?.knownRevenue)}</p><p className="stat-note">Derived only from configured quotation or invoice line items.</p></article>
                <article className="stat-card"><p className="stat-label">Known costs</p><p className="stat-value">{inr(report?.knownCosts)}</p><p className="stat-note">Reported expenses and recorded stock/payroll costs.</p></article>
                <article className="stat-card"><p className="stat-label">Complete project profit</p><p className="stat-value">{inr(report?.completeProfitTotal)}</p><p className="stat-note">{report?.incompleteProjectCount ?? 0} projects have incomplete cost or revenue records.</p></article>
              </section>
              <section className="panel">
                <div className="section-head"><div><h2>Project profitability</h2><p>Incomplete costs remain explicitly unreported, never estimated.</p></div></div>
                <form className="operational-actions" onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const dates = { from: form.get('from'), to: form.get('to') }
                  setReportDates(dates)
                  setError('')
                  reload(dates)
                }}>
                  <label className="field"><span>From</span><input name="from" type="date" defaultValue={reportDates.from} max={today} /></label>
                  <label className="field"><span>To</span><input name="to" type="date" defaultValue={reportDates.to} max={today} /></label>
                  <button className="btn btn-secondary">Filter dates</button>
                </form>
                <div className="table-wrap"><table className="data-table">
                  <thead><tr><th>Order</th><th>Customer</th><th>Revenue</th><th>Known costs</th><th>Profit</th><th>Cost completeness</th></tr></thead>
                  <tbody>{(report?.projects || []).map((project) => <tr key={project.orderId}>
                    <td>{project.orderNumber} {project.isDemo ? <small>(Synthetic)</small> : null}</td><td>{project.customerName}</td>
                    <td>{inr(project.revenueAmount)}</td><td>{inr(project.projectCostAmount)}</td><td>{inr(project.projectProfitAmount)}</td>
                    <td>{project.costsComplete ? 'Complete' : 'Incomplete'}</td>
                  </tr>)}</tbody>
                </table></div>
              </section>
              <section className="panel">
                <h2>Invoices</h2>
                <form className="operational-actions" onSubmit={createInvoice}>
                  <label className="field"><span>Confirmed order</span><select name="orderId" required>
                    <option value="">Select an order</option>
                    {orders.filter((order) => ['CONFIRMED', 'COMPLETED'].includes(order.status)).map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customerName}</option>)}
                  </select></label>
                  <button className="btn btn-primary" disabled={busy}>Create draft invoice</button>
                </form>
                {invoices.map((invoice) => <article className="customer-project-card" key={invoice.id}>
                  <div><strong>{invoice.invoiceNumber} · {invoice.orderNumber}</strong><span>{invoice.status} · {inr(invoice.totalAmount)}</span></div>
                  {invoice.status === 'DRAFT' && <button className="btn btn-secondary" disabled={busy} onClick={() => invoiceStatus(invoice, 'ISSUED')}>Issue invoice</button>}
                </article>)}
              </section>
              <section className="panel">
                <h2>Record payment</h2>
                {orders.map((order) => <form className="operational-actions" key={order.id} onSubmit={(event) => recordPayment(event, order)}>
                  <strong>{order.orderNumber} · {order.customerName} · Paid {inr(order.paidAmount)} · Due {inr(order.outstandingAmount)}</strong>
                  <select name="type"><option value="ADVANCE">Advance</option><option value="FULL">Full balance</option></select>
                  <input name="amount" type="number" min="0.01" step="0.01" value={paymentAmounts[order.id] ?? ''} onChange={(event) => setPaymentAmounts((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Amount (₹)" required />
                  <select name="method"><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="OTHER">Other</option></select>
                  <input name="reference" placeholder="Receipt reference" maxLength="120" />
                  <button className="btn btn-secondary" disabled={busy}>Record payment</button>
                </form>)}
                {!orders.length && <EmptyState>No customer orders are available.</EmptyState>}
              </section>
              <section className="panel">
                <h2>Record project expense</h2>
                <form className="crm-form-grid" onSubmit={addExpense}>
                  <label className="field"><span>Order (optional)</span><select name="orderId"><option value="">General expense</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}</select></label>
                  <label className="field"><span>Expense type</span><select name="type"><option value="TRAVEL">Travel</option><option value="PERMIT">Permit</option><option value="MATERIAL">Material</option><option value="SERVICE">Service</option><option value="OTHER">Other</option></select></label>
                  <label className="field"><span>Description</span><input name="description" maxLength="500" required /></label>
                  <label className="field"><span>Amount (₹)</span><input name="amount" type="number" min="0" step="0.01" required /></label>
                  <label className="field"><span>Incurred date</span><input name="incurredAt" type="date" defaultValue={today} required /></label>
                  <div className="crm-form-span"><button className="btn btn-primary" disabled={busy}>Save expense</button></div>
                </form>
              </section>
              <section className="panel">
                <h2>Technician payroll</h2>
                <p className="text-muted">Payroll hours are limited to completed, unprocessed time logs. Rates and amounts must be supplied by Finance.</p>
                <form className="crm-form-grid" onSubmit={addPayroll}>
                  <label className="field"><span>Job and technician</span><select name="assignment" required>
                    <option value="">Select a logged assignment</option>
                    {payrollOptions.filter((option) => option.availableHours > 0).map((option) => <option key={`${option.jobId}-${option.technicianUserId}`} value={`${option.jobId}|${option.technicianUserId}`}>{option.jobNumber} · {option.customerName} · {option.technicianName} · {option.availableHours} logged hours</option>)}
                  </select></label>
                  <label className="field"><span>Hours to process</span><input name="hours" type="number" min="0.01" step="0.01" required /></label>
                  <label className="field"><span>Calculate by</span><select name="pricing"><option value="hourlyRate">Hourly rate</option><option value="amount">Payroll amount</option></select></label>
                  <label className="field"><span>Configured rate or amount (₹)</span><input name="rateOrAmount" type="number" min="0" step="0.01" required /></label>
                  <label className="field"><span>Paid date (optional)</span><input name="paidAt" type="date" /></label>
                  <label className="field"><span>Payroll notes</span><input name="notes" maxLength="2000" /></label>
                  <div className="crm-form-span"><button className="btn btn-primary" disabled={busy || !payrollOptions.some((option) => option.availableHours > 0)}>Save payroll entry</button></div>
                </form>
                {payroll.length ? <div className="table-wrap"><table className="data-table">
                  <thead><tr><th>Job</th><th>Technician</th><th>Hours</th><th>Rate</th><th>Amount</th><th>Paid</th></tr></thead>
                  <tbody>{payroll.map((entry) => <tr key={entry.id}><td>{entry.jobNumber}</td><td>{entry.technicianName}</td><td>{entry.hours}</td><td>{inr(entry.hourlyRate)}</td><td>{inr(entry.amount ?? (entry.hourlyRate === null ? null : entry.hours * entry.hourlyRate))}</td><td>{entry.paidAt || 'Not marked paid'}</td></tr>)}</tbody>
                </table></div> : <EmptyState>No payroll entries are recorded.</EmptyState>}
              </section>
              <section className="panel">
                <h2>Stock purchases</h2>
                <form className="crm-form-grid" onSubmit={createPurchase}>
                  <label className="field"><span>Warehouse</span><select name="warehouseId" required>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label className="field"><span>Supplier</span><input name="supplierName" maxLength="200" required /></label>
                  <label className="field"><span>Inventory item</span><select name="inventoryItemId" required>{uniqueItems.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></label>
                  <label className="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="any" required /></label>
                  <label className="field"><span>Configured unit cost (optional)</span><input name="unitCost" type="number" min="0" step="0.01" /></label>
                  <label className="field"><span>Purchase date</span><input name="purchasedAt" type="date" defaultValue={today} required /></label>
                  <div className="crm-form-span"><button className="btn btn-primary" disabled={busy}>Create purchase</button></div>
                </form>
                <PurchaseList purchases={purchases} busy={busy} onOpen={loadPurchase} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

function PurchaseList({ purchases, busy, onOpen }) {
  return (
    <section className="panel">
      <h2>Purchase receipts</h2>
      {purchases.length ? purchases.map((purchase) => (
        <article className="customer-project-card" key={purchase.id}>
          <div><strong>{purchase.purchaseNumber} · {purchase.supplierName}</strong><span>{purchase.warehouseName} · {purchase.status} · {purchase.lineCount} line(s)</span></div>
          {purchase.status === 'ORDERED' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onOpen(purchase.id)}>Receive purchase</button>}
        </article>
      )) : <EmptyState>No purchase receipts are recorded.</EmptyState>}
    </section>
  )
}

function PurchaseReceiveForm({ purchase, values, onChange, onSubmit, onCancel, busy }) {
  return (
    <section className="panel">
      <div className="section-head"><div><h2>Receive {purchase.purchaseNumber}</h2><p>Record the actual serials for serialized units; bulk quantity is received from the purchase lines.</p></div></div>
      <form className="form-grid" onSubmit={onSubmit}>
        {purchase.items.map((item) => <label className="field" key={item.id}>
          <span>{item.sku} · {item.name} · quantity {item.quantity}{item.tracksSerial ? ' · serial tracked' : ''}</span>
          {item.tracksSerial && <input value={values[item.id] || ''} onChange={(event) => onChange((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Comma-separated serial numbers" required />}
        </label>)}
        <div className="operational-actions"><button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button><button className="btn btn-primary" disabled={busy}>Post receipt</button></div>
      </form>
    </section>
  )
}
