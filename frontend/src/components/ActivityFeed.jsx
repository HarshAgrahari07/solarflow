import Icon from './Icon'

const ICONS = {
  customer: 'customers',
  installation: 'installations',
  quotation: 'quotations',
  warranty: 'warranties',
  inventory: 'inventory',
}

export default function ActivityFeed({ activities }) {
  return (
    <section className="panel" aria-labelledby="activity-title">
      <div className="section-head">
        <div>
          <h2 id="activity-title">Recent activities</h2>
          <p>Latest demonstration events on the operations desk.</p>
        </div>
      </div>
      <ol className="activity-list">
        {activities.map((activity) => (
          <li key={activity.id} className={activity.isNew ? 'is-new' : undefined}>
            <span className={`activity-icon activity-${activity.kind}`}>
              <Icon name={ICONS[activity.kind] || 'overview'} />
            </span>
            <div>
              <div className="activity-line">
                <strong>{activity.title}</strong>
                <span>{activity.time}</span>
              </div>
              <p>{activity.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
