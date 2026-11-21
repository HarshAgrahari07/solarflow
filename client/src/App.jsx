import { useState } from 'react'
import './App.css'
import ActionDialog from './components/ActionDialog'
import Dashboard from './components/Dashboard'
import ModuleView from './components/ModuleView'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import {
  ACTIVITIES,
  INSTALLATIONS,
  NAV_ITEMS,
  formatDisplayDate,
  formatInr,
  matchesQuery,
} from './data/demoData'

export default function App() {
  const [activeNav, setActiveNav] = useState('overview')
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState(null)
  const [workspace, setWorkspace] = useState({
    company: 'SolarFlow Energy',
    desk: 'Ludhiana operations',
    alerts: true,
  })
  const [installations, setInstallations] = useState(INSTALLATIONS)
  const [activities, setActivities] = useState(ACTIVITIES)
  const [sessionRecords, setSessionRecords] = useState([])

  const heading = NAV_ITEMS.find((item) => item.id === activeNav)?.heading ?? 'Dashboard'
  const filteredInstallations = installations.filter((row) =>
    matchesQuery(query, [row.customer, row.location, row.capacity, row.date, row.technician, row.status]),
  )

  function selectNav(id) {
    setActiveNav(id)
    setSidebarOpen(false)
    setQuery('')
  }

  function addActivity(kind, title, detail) {
    setActivities((current) => [
      {
        id: `act-${Date.now()}`,
        kind,
        title,
        detail,
        time: 'Just now',
        isNew: true,
      },
      ...current,
    ])
  }

  function handleCreate(type, fields) {
    if (type === 'customer') {
      const name = fields.name.trim()
      setSessionRecords((current) => [
        {
          id: `CUS-${Date.now()}`,
          type: 'customer',
          name,
          city: fields.city.trim(),
          phone: fields.phone.trim(),
        },
        ...current,
      ])
      addActivity('customer', 'New customer registered', `${name} was added from the operations desk.`)
      setActiveNav('customers')
      setNotice({ text: `Customer saved. ${name} now appears in Customers & Leads.` })
    } else if (type === 'quotation') {
      const customer = fields.customer.trim()
      const quoteId = `QT-${String(Date.now()).slice(-4)}`
      setSessionRecords((current) => [
        {
          id: quoteId,
          type: 'quotation',
          quoteId,
          customer,
          capacity: `${Number(fields.capacity)} kW`,
          amount: formatInr(fields.amount),
        },
        ...current,
      ])
      addActivity('quotation', 'Quotation created', `${quoteId} for ${customer} was saved as a draft.`)
      setActiveNav('quotations')
      setNotice({ text: `Quotation ${quoteId} created for ${customer} and marked as a draft.` })
    } else if (type === 'installation') {
      const customer = fields.customer.trim()
      const technician = fields.technician
      setInstallations((current) => [
        {
          id: `INS-${Date.now()}`,
          customer,
          location: fields.location.trim(),
          capacity: `${Number(fields.capacity)} kW`,
          date: formatDisplayDate(fields.date),
          technician,
          status: 'Pending',
          isNew: true,
        },
        ...current,
      ])
      addActivity(
        'installation',
        'Installation assigned',
        `${customer} was assigned to ${technician} in the demonstration schedule.`,
      )
      if (activeNav !== 'overview' && activeNav !== 'installations') {
        setActiveNav('installations')
      }
      setNotice({
        text: `Installation scheduled for ${customer}. The job is at the top of the installations table.`,
      })
    } else if (type === 'inventory') {
      const item = fields.item.trim()
      const warehouse = fields.warehouse.trim()
      setSessionRecords((current) => [
        {
          id: `INV-${Date.now()}`,
          type: 'inventory',
          sku: fields.sku.trim(),
          item,
          quantity: String(Number(fields.quantity)),
          warehouse,
        },
        ...current,
      ])
      addActivity('inventory', 'Inventory added', `${item} was received at the ${warehouse} warehouse.`)
      setActiveNav('inventory')
      setNotice({ text: `${item} added to the ${warehouse} demonstration inventory.` })
    }

    setQuery('')
    setAction(null)
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeId={activeNav}
        open={sidebarOpen}
        onSelect={selectNav}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="workspace">
        <TopBar
          heading={heading}
          query={query}
          onQueryChange={setQuery}
          onMenu={() => setSidebarOpen(true)}
          alertsEnabled={workspace.alerts}
        />
        <main className="content">
          {notice && (
            <div className="notice" role="status">
              <p>{notice.text}</p>
              <button type="button" className="btn btn-ghost" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </div>
          )}
          {activeNav === 'overview' ? (
            <Dashboard
              installations={filteredInstallations}
              activities={activities}
              query={query}
              onClearSearch={() => setQuery('')}
              onAction={setAction}
            />
          ) : (
            <ModuleView
              activeId={activeNav}
              heading={heading}
              query={query}
              onClearSearch={() => setQuery('')}
              onAction={setAction}
              installations={filteredInstallations}
              sessionRecords={sessionRecords}
              workspace={workspace}
              onSaveWorkspace={setWorkspace}
            />
          )}
        </main>
      </div>

      {action && (
        <ActionDialog type={action} onClose={() => setAction(null)} onSubmit={handleCreate} />
      )}
    </div>
  )
}
