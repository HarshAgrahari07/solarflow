import { useState } from 'react'
import { getNavigationForRole, getRoleLabel, ROLE_WORKSPACES } from '../auth/roleAccess'
import {
  FINANCE_DATA,
  INSTALLATIONS,
  MODULES,
  SERIAL_REGISTRY,
  matchesQuery,
} from '../data/demoData'
import DemoBanner from './DemoBanner'
import FinanceView from './FinanceView'
import Icon from './Icon'
import InstallationChart from './InstallationChart'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const SERIAL_ROWS = [
  ...SERIAL_REGISTRY.inverters.map((serial) => [
    serial.sn,
    'Inverter',
    serial.model,
    serial.warehouse,
    serial.assignedCustomer || 'Available',
    serial.deliveryDate || 'Not dispatched',
  ]),
  ...SERIAL_REGISTRY.batteries.map((serial) => [
    serial.sn,
    'Battery',
    serial.model,
    serial.warehouse,
    serial.assignedCustomer || 'Available',
    serial.deliveryDate || 'Not dispatched',
  ]),
  ...SERIAL_REGISTRY.chargeControllers.map((serial) => [
    serial.sn,
    'Charge controller',
    serial.model,
    serial.warehouse,
    serial.assignedCustomer || 'Available',
    serial.deliveryDate || 'Not dispatched',
  ]),
]

const INSTALLATION_ROWS = INSTALLATIONS.map((job) => [
  job.id,
  job.customer,
  job.location,
  job.capacity,
  job.package,
  job.date,
  job.technician,
  job.status,
])

const ROLE_TABLES = {
  SALES: {
    customers: [{ title: 'Enquiries & follow-ups', columns: MODULES.customers.columns, rows: MODULES.customers.rows }],
    surveys: [{ title: 'Survey coordination', columns: MODULES.surveys.columns, rows: MODULES.surveys.rows }],
    quotations: [{ title: 'Quotation pipeline', columns: MODULES.quotations.columns, rows: MODULES.quotations.rows }],
  },
  SURVEYOR: {
    surveys: [{ title: 'Site visits & survey review', columns: MODULES.surveys.columns, rows: MODULES.surveys.rows }],
  },
  WAREHOUSE: {
    inventory: [
      { title: 'Stock overview & picking', columns: MODULES.inventory.columns, rows: MODULES.inventory.rows },
      {
        title: 'Serial verification & dispatch register',
        columns: ['Serial number', 'Component', 'Model', 'Warehouse', 'Assigned customer', 'Delivery'],
        rows: SERIAL_ROWS,
      },
    ],
  },
  TECHNICIAN: {
    installations: [{
      title: 'Installation schedule & commissioning',
      columns: ['Job ID', 'Customer', 'Site', 'Capacity', 'System', 'Schedule', 'Assigned crew', 'Status'],
      rows: INSTALLATION_ROWS,
    }],
  },
  SUPPORT: {
    warranties: [
      { title: 'Warranty coverage', columns: MODULES.warranties.columns, rows: MODULES.warranties.rows },
      {
        title: 'Serial lookup',
        columns: ['Serial number', 'Component', 'Model', 'Warehouse', 'Assigned customer', 'Delivery'],
        rows: SERIAL_ROWS,
      },
    ],
    service: [{ title: 'Customer service tickets', columns: MODULES.service.columns, rows: MODULES.service.rows }],
  },
  FINANCE: {
    reports: [{
      title: 'Project profitability',
      columns: ['Project', 'System', 'Contract value', 'Material cost', 'Labor cost', 'Net profit', 'Margin'],
      rows: FINANCE_DATA.projectPnL.map((project) => [
        project.project,
        project.capacity,
        `₹${project.contractValue.toLocaleString('en-IN')}`,
        `₹${project.materialCost.toLocaleString('en-IN')}`,
        `₹${project.labourCost.toLocaleString('en-IN')}`,
        `₹${project.netProfit.toLocaleString('en-IN')}`,
        project.marginPercent,
      ]),
    }],
  },
}

const ROLE_METRICS = {
  SALES: [
    { label: 'Customer enquiries', value: MODULES.customers.rows.length, detail: 'Synthetic customer pipeline' },
    { label: 'Surveys to coordinate', value: MODULES.surveys.rows.filter((row) => row[4] !== 'Approved').length, detail: 'Demo visits not yet approved' },
    { label: 'Quotes in pipeline', value: MODULES.quotations.rows.length, detail: 'Illustrative quotation records' },
  ],
  SURVEYOR: [
    { label: 'Site visits', value: MODULES.surveys.rows.length, detail: 'Synthetic survey queue' },
    { label: 'Awaiting review', value: MODULES.surveys.rows.filter((row) => row[4] !== 'Approved').length, detail: 'Submit findings for admin approval' },
    { label: 'Approved surveys', value: MODULES.surveys.rows.filter((row) => row[4] === 'Approved').length, detail: 'Demonstration records' },
  ],
  WAREHOUSE: [
    { label: 'Tracked stock lines', value: MODULES.inventory.rows.length, detail: 'Synthetic warehouse quantities' },
    { label: 'Serial records', value: SERIAL_ROWS.length, detail: 'Inverters, batteries and controllers' },
    { label: 'Dispatch references', value: MODULES.quotations.rows.length, detail: 'Illustrative picking queue' },
  ],
  TECHNICIAN: [
    { label: 'Scheduled demo jobs', value: INSTALLATIONS.length, detail: 'Synthetic crew assignments' },
    { label: 'In progress', value: INSTALLATIONS.filter((job) => job.status === 'Ongoing').length, detail: 'Illustrative installation schedule' },
    { label: 'Completed', value: INSTALLATIONS.filter((job) => job.status === 'Completed').length, detail: 'Demo commissioning records' },
  ],
  SUPPORT: [
    { label: 'Service tickets', value: MODULES.service.rows.length, detail: 'Synthetic customer cases' },
    { label: 'Warranty records', value: MODULES.warranties.rows.length, detail: 'Coverage starts at completed delivery' },
    { label: 'Serials searchable', value: SERIAL_ROWS.length, detail: 'Demonstration serial register' },
  ],
  FINANCE: [
    { label: 'Advance payments', value: FINANCE_DATA.kpis.advanceCollected, detail: 'Synthetic financial summary' },
    { label: 'Invoiced revenue', value: FINANCE_DATA.kpis.invoicedRevenue, detail: 'Not live revenue' },
    { label: 'Gross margin', value: FINANCE_DATA.kpis.grossMarginPercent, detail: 'Illustrative project calculations' },
  ],
}

const OVERVIEW_TABLE = {
  SALES: ROLE_TABLES.SALES.customers[0],
  SURVEYOR: ROLE_TABLES.SURVEYOR.surveys[0],
  WAREHOUSE: ROLE_TABLES.WAREHOUSE.inventory[0],
  TECHNICIAN: ROLE_TABLES.TECHNICIAN.installations[0],
  SUPPORT: ROLE_TABLES.SUPPORT.service[0],
  FINANCE: ROLE_TABLES.FINANCE.reports[0],
}

function WorkflowTable({ table, query }) {
  const rows = table.rows.filter((row) => matchesQuery(query, row))

  return (
    <section className="panel role-table-card">
      <div className="section-head">
        <div>
          <h2>{table.title}</h2>
          <p>Searchable synthetic demonstration records.</p>
        </div>
        <span className="count-pill">{rows.length} records</span>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>{table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${table.title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${table.title}-${index}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="role-empty-state" role="status">
          <strong>No matching demonstration records</strong>
          <p>Try a different search, or clear the search field to see all records.</p>
        </div>
      )}
    </section>
  )
}

function RoleMetrics({ role }) {
  return (
    <section className="role-metrics" aria-label={`${getRoleLabel(role)} dashboard metrics`}>
      {ROLE_METRICS[role].map((metric) => (
        <article className="stat-card" key={metric.label}>
          <p className="stat-label">{metric.label}</p>
          <p className="stat-value">{metric.value}</p>
          <p className="stat-note">{metric.detail}</p>
        </article>
      ))}
    </section>
  )
}

export default function RoleWorkspace({ user, onLogout }) {
  const [activeId, setActiveId] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const items = getNavigationForRole(user.role)
  const workspace = ROLE_WORKSPACES[user.role]
  const activeItem = items.find((item) => item.id === activeId)
  const pageHeading = activeId === 'overview' ? workspace.title : activeItem?.heading

  function selectNav(id) {
    if (!items.some((item) => item.id === id)) return
    setActiveId(id)
    setQuery('')
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeId={activeId}
        items={items}
        open={sidebarOpen}
        onSelect={selectNav}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="workspace">
        <TopBar
          heading={pageHeading}
          user={user}
          query={query}
          onQueryChange={setQuery}
          onMenu={() => setSidebarOpen(true)}
          onLogout={onLogout}
          alertsEnabled
          showSearch={!(user.role === 'FINANCE' && activeId === 'finance')}
          searchPlaceholder="Search this workspace"
        />
        <main className="content role-content">
          {!(user.role === 'FINANCE' && activeId === 'finance') && <DemoBanner />}
          {activeId === 'overview' ? (
            <section className="role-dashboard">
              <div className="role-welcome panel">
                <div>
                  <p className="role-kicker">{getRoleLabel(user.role)} workspace</p>
                  <h2>Welcome, {user.fullName}</h2>
                  <p>{workspace.description}</p>
                </div>
                <span className="role-status">Role-scoped access</span>
              </div>

              <RoleMetrics role={user.role} />

              <div className="role-area-grid">
                {items.filter((item) => item.id !== 'overview').map((item) => (
                  <button
                    className="role-area-card"
                    key={item.id}
                    type="button"
                    onClick={() => selectNav(item.id)}
                  >
                    <span className="role-area-icon"><Icon name={item.icon} /></span>
                    <span className="role-area-copy">
                      <strong>{item.label}</strong>
                      <small>{workspace.areas[item.id]}</small>
                      <em>Open workflow</em>
                    </span>
                  </button>
                ))}
              </div>

              <WorkflowTable table={OVERVIEW_TABLE[user.role]} query={query} />
              {user.role === 'SURVEYOR' && (
                <section className="role-data-note panel">
                  <h3>Survey approval boundary</h3>
                  <p>Surveyors can prepare findings for review. Only an authorized administrator can approve a survey or release a quotation.</p>
                </section>
              )}
            </section>
          ) : user.role === 'FINANCE' && activeId === 'finance' ? (
            <FinanceView />
          ) : user.role === 'FINANCE' && activeId === 'reports' ? (
            <div className="role-workflow">
              <InstallationChart />
              <RoleMetrics role={user.role} />
              <WorkflowTable table={ROLE_TABLES.FINANCE.reports[0]} query={query} />
            </div>
          ) : (
            <section className="role-workflow">
              <div className="panel role-workflow-heading">
                <div className="role-area-panel-head">
                  <span className="role-area-icon"><Icon name={activeItem?.icon} /></span>
                  <div>
                    <p className="role-kicker">{getRoleLabel(user.role)} workflow</p>
                    <h2>{activeItem?.label}</h2>
                  </div>
                </div>
                <p>{workspace.areas[activeId]}</p>
              </div>

              {(ROLE_TABLES[user.role]?.[activeId] || []).map((table) => (
                <WorkflowTable key={table.title} table={table} query={query} />
              ))}

              {user.role === 'SURVEYOR' && (
                <section className="role-data-note panel">
                  <h3>Approval workflow</h3>
                  <p>Submit survey findings for administrator review. Surveyors cannot approve financial or customer quotation records.</p>
                </section>
              )}
              {user.role === 'WAREHOUSE' && (
                <section className="role-data-note panel">
                  <h3>Pick, verify and dispatch</h3>
                  <p>Confirm the order reference, scan required serial-tracked components, and dispatch against the completed delivery record. This demo view does not change stock or customer records.</p>
                </section>
              )}
              {user.role === 'TECHNICIAN' && (
                <section className="role-data-note panel">
                  <h3>Time tracking & commissioning</h3>
                  <p>Review the assigned schedule and customer/site details above. Time entries, commissioning checklists and handover signatures require a connected installation service.</p>
                </section>
              )}
              {user.role === 'SUPPORT' && (
                <section className="role-data-note panel">
                  <h3>Warranty and serial lookup</h3>
                  <p>Search this workspace for a customer, ticket, warranty or serial number. Coverage starts on the completed delivery date; charge-controller warranty terms are not specified in the official problem statement.</p>
                </section>
              )}
            </section>
          )}

          <section className="panel role-data-note">
            <h3>Demonstration data</h3>
            <p>These searchable records and metrics are synthetic examples, not live work assignments or financial/customer records. Live workflow APIs are not connected.</p>
          </section>
        </main>
      </div>
    </div>
  )
}
