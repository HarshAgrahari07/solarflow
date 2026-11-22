import { INSTALLATION_MIX } from '../data/demoData'

export default function InstallationChart() {
  const total = INSTALLATION_MIX.reduce((sum, item) => sum + item.value, 0)
  const radius = 62
  const circumference = 2 * Math.PI * radius
  const gap = 4

  const { segments } = INSTALLATION_MIX.reduce(
    (acc, item) => {
      const full = (item.value / total) * circumference
      const length = Math.max(full - gap, 0)
      acc.segments.push({ ...item, length, offset: acc.offset })
      acc.offset += full
      return acc
    },
    { segments: [], offset: 0 },
  )

  const summary = INSTALLATION_MIX.map((item) => `${item.value} ${item.label.toLowerCase()}`).join(', ')

  return (
    <section className="panel" aria-labelledby="install-overview-title">
      <div className="section-head">
        <div>
          <h2 id="install-overview-title">Installation status breakdown (Synthetic preview)</h2>
          <p>The company benchmark is approximately 40 rooftop projects per month. The 26 completed + 8 ongoing + 6 pending distribution is illustrative synthetic monthly workload data, not 40 verified project records.</p>
        </div>
        <span className="count-pill">{total} demo projects</span>
      </div>

      <div className="chart-layout">
        <svg
          className="donut"
          viewBox="0 0 180 180"
          role="img"
          aria-label={`Installation status breakdown. ${summary}. Total ${total} illustrative demo jobs.`}
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
            Demo workload
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
