import { useState } from 'react'
import { FINANCE_DATA, formatInr } from '../data/demoData'
import DemoBanner from './DemoBanner'
import Icon from './Icon'

export default function FinanceView() {
  const [timeframe, setTimeframe] = useState('monthly')
  const [activeTab, setActiveTab] = useState('invoices')
  const [sessionNote, setSessionNote] = useState(null)

  const tfData = FINANCE_DATA.timeframes[timeframe] || FINANCE_DATA.timeframes.monthly

  function recordSnapshot() {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setSessionNote(`Financial audit snapshot recorded at ${time}. Kept in browser demonstration session only.`)
  }

  return (
    <div className="dashboard">
      <DemoBanner />

      {/* Timeframe & Overview Header */}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Finance & Accounts Ledger</h2>
            <p>
              Official financial accounting: Advance payments, stock purchases, technician payroll, customer invoices,
              subsidy paperwork, project-level P&L, unfinished work, and open repairs.
            </p>
          </div>
          <div className="timeframe-toggles" role="group" aria-label="Reporting timeframe">
            <button
              type="button"
              className={`tab-btn ${timeframe === 'today' ? 'is-active' : ''}`}
              onClick={() => setTimeframe('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`tab-btn ${timeframe === 'weekly' ? 'is-active' : ''}`}
              onClick={() => setTimeframe('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`tab-btn ${timeframe === 'monthly' ? 'is-active' : ''}`}
              onClick={() => setTimeframe('monthly')}
            >
              Monthly (~40 Benchmark)
            </button>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="insight-grid" style={{ marginTop: '14px' }}>
          <article className="stat-card">
            <p className="stat-label">Advance Payments Collected</p>
            <p className="stat-value">{tfData.advances}</p>
            <p className="stat-note">50% milestone prior to warehouse picking</p>
          </article>

          <article className="stat-card">
            <p className="stat-label">Stock Purchases</p>
            <p className="stat-value">{tfData.stockPurchases}</p>
            <p className="stat-note">Panels, inverters, batteries, wiring kits</p>
          </article>

          <article className="stat-card">
            <p className="stat-label">Technician Working Hours & Payroll</p>
            <p className="stat-value">{tfData.payrollExpense}</p>
            <p className="stat-note">{tfData.technicianHours} (15 crew members)</p>
          </article>

          <article className="stat-card">
            <p className="stat-label">Invoiced System Revenue</p>
            <p className="stat-value">{tfData.invoiced}</p>
            <p className="stat-note">Gross billed for 1 kW to 5 kW rooftop systems</p>
          </article>

          <article className="stat-card">
            <p className="stat-label">Subsidy Receivables</p>
            <p className="stat-value">{FINANCE_DATA.kpis.subsidyPending}</p>
            <p className="stat-note">Government rooftop subsidy claims filed</p>
          </article>

          <article className="stat-card">
            <p className="stat-label">Project Gross Margin</p>
            <p className="stat-value">{FINANCE_DATA.kpis.grossMarginPercent}</p>
            <p className="stat-note">After material cost and installation labor</p>
          </article>
        </div>

        {/* Operational Health Callout (Unfinished Work & Open Repairs) */}
        <div className="job-summary-card" style={{ marginTop: '16px', background: '#f5faf7' }}>
          <div>
            <strong>Operational Balance & Work-in-Progress (WIP)</strong>
            <p className="text-muted" style={{ margin: '2px 0 0 0', fontSize: '13px' }}>
              Tracking unfinished installations and open service tickets impacting financial clearance.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span className="count-pill">
              <strong>{FINANCE_DATA.operationalHealth.unfinishedJobs}</strong> Unfinished Jobs (Ongoing)
            </span>
            <span className="count-pill">
              <strong>{FINANCE_DATA.operationalHealth.openRepairs}</strong> Open Repairs
            </span>
            <span className="count-pill">
              <strong>{tfData.openRepairsCost}</strong> Open Repairs Impact
            </span>
          </div>
        </div>
      </section>

      {/* Detailed Ledger Tabs */}
      <section className="panel" style={{ marginTop: '16px' }}>
        <div className="section-head">
          <div className="timeframe-toggles" role="tablist">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'invoices' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              Customer Invoices & Advances
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'subsidies' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('subsidies')}
            >
              Rooftop Subsidy Paperwork
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'payroll' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('payroll')}
            >
              Technician Payroll & Hours
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'pnl' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('pnl')}
            >
              Project-Level Profit & Loss
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={recordSnapshot}>
            <Icon name="reports" />
            <span>Record Session Audit</span>
          </button>
        </div>

        {sessionNote && <p className="form-success" style={{ margin: '10px 0' }}>{sessionNote}</p>}

        {/* 1. Invoices & Advances */}
        {activeTab === 'invoices' && (
          <div className="table-wrap" style={{ marginTop: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Invoice ID</th>
                  <th scope="col">Customer & Category</th>
                  <th scope="col">System Scope</th>
                  <th scope="col">Total Contract</th>
                  <th scope="col">50% Advance Paid</th>
                  <th scope="col">Balance Due</th>
                  <th scope="col">Invoice Status</th>
                </tr>
              </thead>
              <tbody>
                {FINANCE_DATA.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><span className="cell-title">{inv.id}</span></td>
                    <td>{inv.customer}</td>
                    <td>{inv.system}</td>
                    <td>{formatInr(inv.totalAmount)}</td>
                    <td><strong className="text-green">{formatInr(inv.advancePaid)}</strong></td>
                    <td>{formatInr(inv.balanceDue)}</td>
                    <td>
                      <span className={`status ${inv.status.includes('Paid in Full') ? 'status-completed' : 'status-pending'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Subsidy Paperwork */}
        {activeTab === 'subsidies' && (
          <div className="table-wrap" style={{ marginTop: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Application Ref</th>
                  <th scope="col">Customer Name</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Eligible Subsidy Claim</th>
                  <th scope="col">Government Paperwork Status</th>
                </tr>
              </thead>
              <tbody>
                {FINANCE_DATA.subsidies.map((sub) => (
                  <tr key={sub.id}>
                    <td><span className="cell-title">{sub.id}</span></td>
                    <td>{sub.customer}</td>
                    <td>{sub.capacity}</td>
                    <td><strong>{sub.claimAmount}</strong></td>
                    <td>
                      <span className={`status ${sub.portalStatus.includes('Disbursed') ? 'status-completed' : 'status-ongoing'}`}>
                        {sub.portalStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Technician Payroll & Hours */}
        {activeTab === 'payroll' && (
          <div className="table-wrap" style={{ marginTop: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Crew ID</th>
                  <th scope="col">Technician Name (15 Crew)</th>
                  <th scope="col">Logged Hours</th>
                  <th scope="col">Base Hourly Rate</th>
                  <th scope="col">Calculated Payment</th>
                  <th scope="col">Payroll Status</th>
                </tr>
              </thead>
              <tbody>
                {FINANCE_DATA.technicianPayroll.map((t) => (
                  <tr key={t.id}>
                    <td><span className="cell-title">{t.id}</span></td>
                    <td>{t.name}</td>
                    <td>{t.hoursLogged} hrs</td>
                    <td>₹{t.hourlyRate}/hr</td>
                    <td><strong>{formatInr(t.totalPay)}</strong></td>
                    <td>
                      <span className={`status ${t.status === 'Processed' ? 'status-completed' : 'status-pending'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Project-Level Profit and Loss */}
        {activeTab === 'pnl' && (
          <div className="table-wrap" style={{ marginTop: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project / Customer</th>
                  <th scope="col">System Capacity</th>
                  <th scope="col">Contract Revenue</th>
                  <th scope="col">Stock Purchase (Material)</th>
                  <th scope="col">Technician Labour</th>
                  <th scope="col">Net Project Margin</th>
                  <th scope="col">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {FINANCE_DATA.projectPnL.map((p) => (
                  <tr key={p.project}>
                    <td><span className="cell-title">{p.project}</span></td>
                    <td>{p.capacity}</td>
                    <td>{formatInr(p.contractValue)}</td>
                    <td className="text-muted">{formatInr(p.materialCost)}</td>
                    <td className="text-muted">{formatInr(p.labourCost)}</td>
                    <td><strong className="text-green">{formatInr(p.netProfit)}</strong></td>
                    <td><span className="mini-pill mini-pill-green">{p.marginPercent}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
