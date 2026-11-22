import { useState } from 'react'
import { MODULES, calculateResidentialAverage, matchesQuery, statusClass } from '../data/demoData'
import DemoBanner from './DemoBanner'
import FinanceView from './FinanceView'
import InstallationChart from './InstallationChart'
import InstallationsTable from './InstallationsTable'

const SESSION_TYPE = {
  quotations: 'quotation',
  inventory: 'inventory',
}

function sessionCells(record) {
  if (record.type === 'quotation') {
    return [
      record.quoteId,
      record.customer,
      record.surveyRef || 'Associated Approved Survey',
      record.packageType || 'On-Grid System',
      record.capacity,
      record.amount,
      record.status || 'Draft (Pending Delivery)',
    ]
  }
  if (record.type === 'inventory') {
    return [
      record.sku,
      record.item,
      record.quantity,
      record.warehouse,
      record.serialTracking || 'Standard item',
    ]
  }
  return []
}

function RecordTable({ columns, rows, onRowAction }) {
  const hasAction = Boolean(onRowAction)
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
            {hasAction && <th scope="col">Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.isNew ? 'is-new' : undefined}>
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${columns[index]}`}>
                  {index === 0 ? <span className="cell-title">{cell}</span> : null}
                  {index === row.cells.length - 1 ? <span className={statusClass(cell)}>{cell}</span> : null}
                  {index > 0 && index < row.cells.length - 1 ? cell : null}
                  {index === 0 && row.isNew ? <span className="mini-pill">Added now</span> : null}
                </td>
              ))}
              {hasAction && <td>{onRowAction(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ModuleView({
  activeId,
  heading,
  query,
  onClearSearch,
  onAction,
  installations,
  sessionRecords,
  workspace,
  onSaveWorkspace,
  modules = MODULES,
  onCommission,
  onReviewSurvey,
  onInspectQuote,
  onOpenDispatch,
  onInspectTicket,
}) {
  const [notesById, setNotesById] = useState({})
  const [settingsMessage, setSettingsMessage] = useState(null)

  const module = modules[activeId]
  const notes = notesById[activeId] || []

  function recordNote(label) {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setNotesById((current) => ({
      ...current,
      [activeId]: [
        `${label} recorded at ${time}. Saved in this demonstration session only.`,
        ...(current[activeId] || []),
      ],
    }))
  }

  function saveSettings(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const company = String(data.get('company') || '').trim()
    const desk = String(data.get('desk') || '').trim()
    const alerts = data.get('alerts') === 'on'

    if (!company || !desk) {
      setSettingsMessage({
        tone: 'error',
        text: 'Enter a company name and an operations desk before saving.',
      })
      return
    }

    onSaveWorkspace({ company, desk, alerts })
    setSettingsMessage({
      tone: 'success',
      text: `Settings saved for this demonstration session. ${company} · ${desk}. Alerts are ${alerts ? 'on' : 'off'}.`,
    })
  }

  if (activeId === 'finance') {
    return <FinanceView />
  }

  if (activeId === 'reports') {
    const residentialAvgKw = calculateResidentialAverage(installations)
    const residentialCount = (installations || []).filter((item) => {
      const text = String(item.customer || '').toLowerCase()
      const cat = String(item.category || '').toLowerCase()
      return text.includes('(home)') || text.includes('home') || cat === 'home'
    }).length

    const completedCount = (installations || []).filter((item) => item.status === 'Completed').length
    const totalJobs = (installations || []).length
    const completionRate = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0

    return (
      <div className="dashboard">
        <DemoBanner />
        <InstallationChart />
        <section className="insight-grid" aria-label="Demonstration insights">
          <article className="stat-card">
            <p className="stat-label">Completion rate</p>
            <p className="stat-value">{completionRate}%</p>
            <p className="stat-note">{completedCount} of {totalJobs} active demonstration jobs completed</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Average residential system</p>
            <p className="stat-value">{residentialAvgKw} kW</p>
            <p className="stat-note">Calculated from {residentialCount} displayed residential records (1–5 kW)</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Monthly pace benchmark</p>
            <p className="stat-value">~40</p>
            <p className="stat-note">Official business target scale (15 technicians)</p>
          </article>
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Snapshot</h2>
              <p>Refresh keeps a note in this session. Nothing is exported or sent to a server.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => recordNote('Analytics snapshot')}>
              Refresh snapshot
            </button>
          </div>
          {notes.length > 0 && (
            <ul className="note-list">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  if (activeId === 'settings') {
    return (
      <div className="dashboard">
        <DemoBanner />
        <section className="panel settings-panel">
          <div className="section-head">
            <div>
              <h2>Workspace settings</h2>
              <p>Preferences stay in this browser session and are not sent to a server.</p>
            </div>
          </div>
          <form className="settings-form" onSubmit={saveSettings}>
            <label className="field">
              <span>Company name</span>
              <input name="company" defaultValue={workspace.company} />
            </label>
            <label className="field">
              <span>Operations desk</span>
              <input name="desk" defaultValue={workspace.desk} />
            </label>
            <label className="check-field">
              <input type="checkbox" name="alerts" defaultChecked={workspace.alerts} />
              <span>Show demonstration alerts on the notification bell</span>
            </label>
            <button type="submit" className="btn btn-primary">
              Save settings
            </button>
          </form>
          {settingsMessage && (
            <p className={settingsMessage.tone === 'error' ? 'form-error' : 'form-success'}>{settingsMessage.text}</p>
          )}
        </section>
      </div>
    )
  }

  if (!module) return null

  const baseRows = (module.rows || []).map((cells, index) => ({
    id: `${activeId}-${index}`,
    cells,
  }))
  const extraRows = sessionRecords
    .filter((record) => record.type === SESSION_TYPE[activeId])
    .map((record) => ({ id: record.id, isNew: true, cells: sessionCells(record) }))
  const rows = [...extraRows, ...baseRows]
  const visibleRows = rows.filter((row) => matchesQuery(query, row.cells))

  if (activeId === 'installations') {
    return (
      <div className="dashboard">
        <DemoBanner />
        <div className="module-toolbar">
          <p>{module.summary}</p>
          <button type="button" className="btn btn-primary" onClick={() => onAction(module.action)}>
            {module.actionLabel}
          </button>
        </div>
        <InstallationsTable
          rows={installations}
          query={query}
          onClear={onClearSearch}
          onCommission={onCommission}
        />
      </div>
    )
  }

  let rowActionRenderer = null
  if (activeId === 'surveys' && onReviewSurvey) {
    rowActionRenderer = (row) => (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() =>
          onReviewSurvey({
            id: row.cells[0],
            customer: row.cells[1],
            gridSuitability: row.cells[2],
            roofOrientation: row.cells[3],
            status: row.cells[4],
          })
        }
      >
        {row.cells[4] === 'Approved' ? 'Inspect Survey' : 'Review & Approve'}
      </button>
    )
  } else if (activeId === 'quotations' && onInspectQuote) {
    rowActionRenderer = (row) => (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() =>
          onInspectQuote({
            quoteId: row.cells[0],
            customer: row.cells[1],
            surveyRef: row.cells[2],
            packageType: row.cells[3],
            capacity: row.cells[4],
            amount: row.cells[5],
            status: row.cells[6],
          })
        }
      >
        View BOM / Order
      </button>
    )
  } else if (activeId === 'inventory' && onOpenDispatch) {
    rowActionRenderer = (row) => {
      const isSerialTracked = String(row.cells[4] || '').toLowerCase().includes('serial')
      return (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            onOpenDispatch({
              id: row.cells[0],
              sku: row.cells[0],
              item: row.cells[1],
              quantity: row.cells[2],
              warehouse: row.cells[3],
              customer: 'Order Picking / Customer Link',
              capacity: '3.0 kW',
              packageType: 'On-Grid System',
            })
          }
        >
          {isSerialTracked ? 'Scan & Dispatch' : 'Check Stock'}
        </button>
      )
    }
  } else if (activeId === 'service' && onInspectTicket) {
    rowActionRenderer = (row) => (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() =>
          onInspectTicket({
            id: row.cells[0],
            customer: row.cells[1],
            serialNo: row.cells[2],
            issue: row.cells[3],
            coverage: row.cells[4],
            status: row.cells[5],
          })
        }
      >
        Warranty & Resolve
      </button>
    )
  }

  return (
    <div className="dashboard">
      <DemoBanner />
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{heading}</h2>
            <p>{module.summary}</p>
          </div>
          <div className="header-actions">
            <span className="count-pill">{visibleRows.length} shown</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (module.action ? onAction(module.action) : recordNote(module.actionLabel))}
            >
              {module.actionLabel}
            </button>
          </div>
        </div>
        {notes.length > 0 && (
          <ul className="note-list">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        {visibleRows.length === 0 ? (
          <div className="empty">
            <p>No records match “{query.trim()}”.</p>
            <button type="button" className="btn btn-secondary" onClick={onClearSearch}>
              Clear search
            </button>
          </div>
        ) : (
          <RecordTable
            columns={module.columns}
            rows={visibleRows}
            onRowAction={rowActionRenderer}
          />
        )}
      </section>
    </div>
  )
}
