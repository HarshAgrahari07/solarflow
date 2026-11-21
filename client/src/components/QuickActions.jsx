import { QUICK_ACTIONS } from '../data/demoData'
import Icon from './Icon'

export default function QuickActions({ onAction }) {
  return (
    <section className="panel" aria-labelledby="quick-actions-title">
      <div className="section-head">
        <div>
          <h2 id="quick-actions-title">Quick actions</h2>
          <p>Create a demonstration record. It stays in this browser session only.</p>
        </div>
      </div>
      <div className="quick-grid">
        {QUICK_ACTIONS.map((action) => (
          <button key={action.id} type="button" className="quick-card" onClick={() => onAction(action.id)}>
            <span className="stat-icon">
              <Icon name={action.icon} />
            </span>
            <span>
              <strong>{action.label}</strong>
              <small>{action.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
