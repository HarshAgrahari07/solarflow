import { useState } from 'react'
import { getRoleLabel } from '../auth/roleAccess'
import { NOTIFICATIONS } from '../data/demoData'
import Icon from './Icon'

export default function TopBar({
  heading,
  user,
  query,
  onQueryChange,
  onMenu,
  onLogout,
  alertsEnabled,
  showSearch = true,
  showNotifications = true,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [readIds, setReadIds] = useState([])
  const [logoutError, setLogoutError] = useState('')

  const unread = alertsEnabled ? NOTIFICATIONS.filter((item) => !readIds.includes(item.id)).length : 0
  const userName = user?.fullName || 'SunPower user'
  const roleLabel = getRoleLabel(user?.role)

  function toggleNotifications() {
    setProfileOpen(false)
    setNotificationsOpen((open) => !open)
  }

  function toggleProfile() {
    setNotificationsOpen(false)
    setProfileOpen((open) => !open)
  }

  function markRead(id) {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]))
  }

  async function handleLogout() {
    setLogoutError('')
    try {
      await onLogout()
    } catch (error) {
      setLogoutError(error.message)
    }
  }

  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')

  return (
    <header className="topbar">
      <button type="button" className="icon-button menu-button" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>

      <div className="heading-block">
        <p className="eyebrow">SunPower Solutions</p>
        <h1>{heading}</h1>
      </div>

      {showSearch && (
        <label className="search">
          <Icon name="search" />
          <span className="sr-only">Search installations and records</span>
          <input
            type="search"
            value={query}
            placeholder="Search customers, sites, technicians"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      )}

      <div className="top-actions">
        {showNotifications && <div className="pop-anchor">
          <button
            type="button"
            className="icon-button"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            aria-expanded={notificationsOpen}
            onClick={toggleNotifications}
          >
            <Icon name="bell" />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          {notificationsOpen && (
            <div className="pop-panel" role="region" aria-label="Notifications">
              <div className="pop-head">
                <strong>Notifications</strong>
                <span>Demo alerts</span>
              </div>
              {alertsEnabled ? (
                <ul>
                  {NOTIFICATIONS.map((item) => {
                    const read = readIds.includes(item.id)
                    return (
                      <li key={item.id}>
                        <button type="button" className={read ? 'is-read' : ''} onClick={() => markRead(item.id)}>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                          </span>
                          <em>{read ? 'Read' : item.time}</em>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="pop-empty">Demonstration alerts are turned off in Settings.</p>
              )}
            </div>
          )}
        </div>}

        <div className="pop-anchor">
          <button type="button" className="profile" aria-expanded={profileOpen} onClick={toggleProfile}>
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="profile-copy">
              <strong>{userName}</strong>
              <small>{roleLabel}</small>
            </span>
          </button>
          {profileOpen && (
            <div className="pop-panel profile-panel" role="region" aria-label="Signed-in user">
              <strong>{userName}</strong>
              <p>{user?.email}</p>
              <p>Signed in as {roleLabel}. Access is verified by SunPower services.</p>
              {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
              <button type="button" className="btn btn-secondary profile-signout" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>

        <span className="role-pill">{user?.role}</span>
      </div>
    </header>
  )
}
