import { NAV_ITEMS } from '../data/demoData'
import Icon from './Icon'

export default function Sidebar({ activeId, items = NAV_ITEMS, open, onSelect, onClose }) {
  return (
    <aside id="primary-navigation" className={`sidebar${open ? ' is-open' : ''}`} aria-label="Primary navigation">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <circle cx="16" cy="13" r="4.2" />
            <path d="M16 5.2v2.1M16 18.7v2.1M7.6 13H5.4M26.6 13h-2.2M9.4 6.6l1.5 1.5M21.1 18.3l1.5 1.5M22.6 6.6l-1.5 1.5M10.9 18.3 9.4 19.8" />
            <path d="M6.5 24.5h19l-2.2-4.2H8.7z" />
          </svg>
        </span>
        <span className="brand-copy">
          <strong>SunPower Solutions</strong>
          <span>Solar Installation Management</span>
        </span>
        <button
          type="button"
          className="icon-button sidebar-close"
          onClick={onClose}
          aria-label="Close navigation menu"
          aria-controls="primary-navigation"
        >
          <Icon name="close" />
        </button>
      </div>

      <nav className="nav-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${item.id === activeId ? ' is-active' : ''}`}
            aria-current={item.id === activeId ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <p className="sidebar-foot">Access is role-limited. Customer and lead records are stored in the CRM; other workflows remain demonstrations.</p>
    </aside>
  )
}
