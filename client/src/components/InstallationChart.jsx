import { INSTALLATION_MIX } from '../data/demoData'

export default function InstallationChart() {
  const total = INSTALLATION_MIX.reduce((sum, item) => sum + item.value, 0)
  const radius = 62
  const circumference = 2 * Math.PI * radius
  const gap = 4
  let cursor = 0

  const segments = INSTALLATION_MIX.map((item) => {
    const full = (item.value / total) * circumference
    const length = Math.max(full - gap, 0)
    const segment = { ...item, length, offset: cursor }
    cursor += full
    return segment
  })

  const summary = INSTALLATION_MIX.map((item) => `${item.value} ${item.label.toLowerCase()}`).join(', ')

  return (
    <section className="panel" aria-labelledby="install-overview-title">
      <div className="section-head">
        <div>
          <h2 id="install-overview-title">Installation overview</h2>
          <p>Demonstration mix for every SolarFlow site in this preview. Recent jobs are listed separately below.</p>
        </div>
        <span className="count-pill">{total} demo sites</span>
      </div>

      <div className="chart-layout">
        <svg
          className="donut"
          viewBox="0 0 180 180"
          role="img"
          aria-label={`Installation overview. ${summary}. Total ${total} demonstration sites.`}
        >
          <circle cx="90" cy="90" r={radius} fill="none" stroke="#e6efe9" strokeWidth="16" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="16"
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 90 90)"
            />
          ))}
          <text x="90" y="86" textAnchor="middle" fill="#143026" stroke="none" fontSize="28" fontWeight="700">
            {total}
          </text>
          <text x="90" y="108" textAnchor="middle" fill="#5e7067" stroke="none" fontSize="12">
            Demo sites
          </text>
        </svg>

        <div className="bars">
          {INSTALLATION_MIX.map((item) => {
            const percent = Math.round((item.value / total) * 100)
            return (
              <div key={item.label} className="bar-row">
                <div className="bar-label">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="bar-track" aria-hidden="true">
                  <div className="bar-fill" style={{ width: `${percent}%`, background: item.color }} />
                </div>
                <span className="bar-percent">{percent}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
