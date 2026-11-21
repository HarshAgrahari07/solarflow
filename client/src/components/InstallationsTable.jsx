import { statusClass } from '../data/demoData'

export default function InstallationsTable({ rows, query, onClear, onCommission }) {
  return (
    <section className="panel" aria-labelledby="recent-installations-title">
      <div className="section-head">
        <div>
          <h2 id="recent-installations-title">Recent installations</h2>
          <p>Demonstration rooftop jobs (strictly 1 kW to 5 kW, representing the 15-person technician crew). Search checks customer, location, capacity, date, technician, and status.</p>
        </div>
        <span className="count-pill">{rows.length} shown</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <p>No installations match “{query.trim()}”.</p>
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear search
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Customer name & category</th>
                <th scope="col">Location</th>
                <th scope="col">Capacity (1–5 kW)</th>
                <th scope="col">Package type</th>
                <th scope="col">Installation date</th>
                <th scope="col">Assigned technician</th>
                <th scope="col">Installation status</th>
                <th scope="col">Handover / Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isNew ? 'is-new' : undefined}>
                  <td>
                    <span className="cell-title">{row.customer}</span>
                    {row.isNew && <span className="mini-pill">Added now</span>}
                  </td>
                  <td>{row.location}</td>
                  <td>{row.capacity}</td>
                  <td>{row.package || 'On-Grid System'}</td>
                  <td>{row.date}</td>
                  <td>{row.technician}</td>
                  <td>
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td>
                    {row.status === 'Ongoing' && onCommission && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onCommission(row)}
                      >
                        Complete Handover
                      </button>
                    )}
                    {row.status === 'Completed' && (
                      <span className="mini-pill mini-pill-green">
                        {row.testOutput || 'Signed & Tested ✓'}
                      </span>
                    )}
                    {row.status === 'Pending' && (
                      <span className="text-muted" style={{ fontSize: '12px' }}>
                        Awaiting dispatch
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
