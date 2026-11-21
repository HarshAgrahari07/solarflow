import { useState } from 'react'
import { MODULES, matchesQuery, statusClass } from '../data/demoData'
import DemoBanner from './DemoBanner'
import InstallationChart from './InstallationChart'
import InstallationsTable from './InstallationsTable'

const SESSION_TYPE = {
  customers: 'customer',
  quotations: 'quotation',
  inventory: 'inventory',
}

function sessionCells(record) {
  if (record.type === 'customer') return [record.name, record.city, record.phone, 'New lead']
  if (record.type === 'quotation') {
    return [record.quoteId, record.customer, record.capacity, record.amount, 'Draft']
  }
  if (record.type === 'inventory') {
    return [record.sku, record.item, record.quantity, record.warehouse, 'In stock']
  }
  return []
}

function RecordTable({ columns, rows }) {
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
}) {
  const [notesById, setNotesById] = useState({})
  const [settingsMessage, setSettingsMessage] = useState(null)

  const module = MODULES[activeId]
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

  if (activeId === 'reports') {
    return (
      <div className="dashboard">
        <DemoBanner />
        <InstallationChart />
        <section className="insight-grid" aria-label="Demonstration insights">
          <article className="stat-card">
            <p className="stat-label">Completion rate</p>
            <p className="stat-value">61%</p>
            <p className="stat-note">86 of 141 demo sites are commissioned</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Average residential system</p>
            <p className="stat-value">5.4 kW</p>
            <p className="stat-note">Sample figure from household jobs</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Quote approval rate</p>
            <p className="stat-value">72%</p>
            <p className="stat-note">Demo pipeline for the current month</p>
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
        <InstallationsTable rows={installations} query={query} onClear={onClearSearch} />
      </div>
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
          <RecordTable columns={module.columns} rows={visibleRows} />
        )}
      </section>
    </div>
  )
}
