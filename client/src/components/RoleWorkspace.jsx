import { useState } from 'react'
import { getNavigationForRole, getRoleLabel, ROLE_WORKSPACES } from '../auth/roleAccess'
import DemoBanner from './DemoBanner'
import Icon from './Icon'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function RoleWorkspace({ user, onLogout }) {
  const [activeId, setActiveId] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const items = getNavigationForRole(user.role)
  const workspace = ROLE_WORKSPACES[user.role]
  const activeItem = items.find((item) => item.id === activeId)
  const pageHeading = activeId === 'overview' ? workspace.title : activeItem?.heading

  function selectNav(id) {
    if (!items.some((item) => item.id === id)) return
    setActiveId(id)
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
          query=""
          onQueryChange={() => {}}
          onMenu={() => setSidebarOpen(true)}
          onLogout={onLogout}
          alertsEnabled={false}
          showSearch={false}
          showNotifications={false}
        />
        <main className="content role-content">
          <DemoBanner />
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

              <section className="panel role-data-note">
                <h3>Business data connection</h3>
                <p>
                  Role navigation is restricted in the interface and protected API routes enforce access on the server.
                  Live workflow and reporting APIs are not connected yet; no live statistics are shown here.
                </p>
              </section>
            </section>
          ) : (
            <section className="panel role-area-panel">
              <div className="role-area-panel-head">
                <span className="role-area-icon"><Icon name={activeItem?.icon} /></span>
                <div>
                  <p className="role-kicker">{getRoleLabel(user.role)} workflow</p>
                  <h2>{activeItem?.label}</h2>
                </div>
              </div>
              <p>{workspace.areas[activeId]}</p>
              <div className="role-empty-state">
                <strong>Live workflow API not connected</strong>
                <p>
                  This workspace is ready for {activeItem?.label.toLowerCase()} data. Existing records are synthetic
                  demonstration data and are not presented as live assignments or customer-owned information.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => selectNav('overview')}>
                Back to my workspace
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
