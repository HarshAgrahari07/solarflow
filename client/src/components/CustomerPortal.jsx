import { getRoleLabel } from '../auth/roleAccess'
import SunPowerBrand from './SunPowerBrand'

const CUSTOMER_RECORD_SECTIONS = [
  'Quotations',
  'Payments',
  'Order progress',
  'Installation details',
  'Warranties',
  'Complaints',
]

export default function CustomerPortal({ user, onLogout }) {
  return (
    <main className="customer-portal">
      <header className="customer-portal-header">
        <SunPowerBrand subtitle="Customer portal" />
        <div className="customer-portal-user">
          <span>{user.fullName}</span>
          <button type="button" className="btn btn-secondary" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <section className="customer-portal-content">
        <p className="role-kicker">Your account</p>
        <h1>Welcome, {user.fullName}</h1>
        <p className="customer-portal-intro">
          This portal shows only the information on your own account. Project, installation, and warranty details will
          appear when customer-specific business APIs are connected.
        </p>

        <section className="panel customer-profile" aria-labelledby="profile-heading">
          <div className="customer-profile-heading">
            <div>
              <h2 id="profile-heading">Account profile</h2>
              <p>Details associated with your SunPower account.</p>
            </div>
            <span className="role-pill">{getRoleLabel(user.role)}</span>
          </div>
          <dl className="customer-profile-grid">
            <div><dt>Full name</dt><dd>{user.fullName}</dd></div>
            <div><dt>Email address</dt><dd>{user.email}</dd></div>
            <div><dt>Phone number</dt><dd>{user.phone || 'Not provided'}</dd></div>
            <div><dt>Address</dt><dd>{user.address || 'Not provided'}</dd></div>
          </dl>
        </section>

        <section className="customer-record-section" aria-labelledby="customer-records-heading">
          <div className="customer-record-heading">
            <h2 id="customer-records-heading">Your solar project</h2>
            <p>Only records linked to your signed-in account will appear here.</p>
          </div>
          <div className="customer-record-grid">
            {CUSTOMER_RECORD_SECTIONS.map((section) => (
              <article className="panel customer-record-card" key={section}>
                <h3>{section}</h3>
                <p>No customer-specific records are connected yet.</p>
                <span>Private to your account</span>
              </article>
            ))}
          </div>
        </section>

        <div className="customer-data-note" role="status">
          <strong>Project services are not connected yet.</strong>
          <span>This portal intentionally does not display other customers' quotations, payments or installation records.</span>
        </div>
      </section>
    </main>
  )
}
