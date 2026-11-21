import { STATS } from '../data/demoData'
import Icon from './Icon'

export default function StatCards() {
  return (
    <section className="stats" aria-label="Dashboard statistics">
      {STATS.map((stat) => (
        <article key={stat.id} className="stat-card">
          <div className="stat-icon">
            <Icon name={stat.icon} />
          </div>
          <p className="stat-label">{stat.label}</p>
          <p className="stat-value">{stat.value}</p>
          <p className="stat-note">{stat.note}</p>
        </article>
      ))}
    </section>
  )
}
