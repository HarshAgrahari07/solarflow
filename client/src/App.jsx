import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import './App.css'
import './AuthPages.css'
import AuthProvider from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import ActionDialog from './components/ActionDialog'
import BOMDialog from './components/BOMDialog'
import CommissioningDialog from './components/CommissioningDialog'
import CustomerPortal from './components/CustomerPortal'
import CustomerRegistrationPage from './components/CustomerRegistrationPage'
import Dashboard from './components/Dashboard'
import DispatchDialog from './components/DispatchDialog'
import LoginPage from './components/LoginPage'
import ModuleView from './components/ModuleView'
import RoleWorkspace from './components/RoleWorkspace'
import ServiceTicketDialog from './components/ServiceTicketDialog'
import Sidebar from './components/Sidebar'
import StaffAccounts from './components/StaffAccounts'
import SurveyApprovalDialog from './components/SurveyApprovalDialog'
import TopBar from './components/TopBar'
import { ROLE_WORKSPACES } from './auth/roleAccess'
import {
  ACTIVITIES,
  INSTALLATIONS,
  MODULES,
  NAV_ITEMS,
  formatDisplayDate,
  formatInr,
  matchesQuery,
} from './data/demoData'

function AdminWorkspace({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('overview')
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState(null)
  const [workspace, setWorkspace] = useState({
    company: 'SunPower Solutions',
    desk: 'Operations desk',
    alerts: true,
  })
  const [installations, setInstallations] = useState(INSTALLATIONS)
  const [activities, setActivities] = useState(ACTIVITIES)
  const [sessionRecords, setSessionRecords] = useState([])
  const [modulesData, setModulesData] = useState(() => JSON.parse(JSON.stringify(MODULES)))

  // Dialog targets
  const [commissioningJob, setCommissioningJob] = useState(null)
  const [dispatchOrder, setDispatchOrder] = useState(null)
  const [reviewSurvey, setReviewSurvey] = useState(null)
  const [inspectQuote, setInspectQuote] = useState(null)
  const [inspectTicket, setInspectTicket] = useState(null)

  const heading = NAV_ITEMS.find((item) => item.id === activeNav)?.heading ?? 'Dashboard'
  const filteredInstallations = installations.filter((row) =>
    matchesQuery(query, [
      row.customer,
      row.category,
      row.location,
      row.capacity,
      row.package,
      row.date,
      row.technician,
      row.status,
    ]),
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
      const category = fields.category || 'Home'
      setSessionRecords((current) => [
        {
          id: `CUS-${Date.now()}`,
          type: 'customer',
          name,
          category,
          city: fields.city.trim(),
          phone: fields.phone.trim(),
        },
        ...current,
      ])
      addActivity(
        'customer',
        'New customer registered',
        `${name} (${category}) was registered at the SunPower Solutions operations desk.`,
      )
      setActiveNav('customers')
      setNotice({ text: `Customer saved. ${name} (${category}) now appears in Customers & Leads.` })
    } else if (type === 'quotation') {
      const customer = fields.customer.trim()
      const capacityVal = Number(fields.capacity)
      if (Number.isNaN(capacityVal) || capacityVal < 1.0 || capacityVal > 5.0) {
        setNotice({ text: 'Error: System capacity must be between 1.0 kW and 5.0 kW inclusive.' })
        return
      }
      const quoteId = `QT-${String(Date.now()).slice(-4)}`
      const packageType = fields.packageType || 'On-Grid System'
      const surveyRef = fields.surveyRef ? fields.surveyRef.split(' ')[0] + ' (Approved)' : 'SRV-Approved'
      setSessionRecords((current) => [
        {
          id: quoteId,
          type: 'quotation',
          quoteId,
          customer,
          surveyRef,
          packageType,
          capacity: `${capacityVal} kW`,
          amount: `${formatInr(fields.amount)}*`,
          status: 'Draft (Pending Delivery)',
        },
        ...current,
      ])
      addActivity(
        'quotation',
        'Quotation created',
        `${quoteId} (${capacityVal} kW ${packageType}) for ${customer} saved under ${surveyRef}.`,
      )
      setActiveNav('quotations')
      setNotice({
        text: `Quotation ${quoteId} created for ${customer} (${capacityVal} kW ${packageType}) linked to ${surveyRef}. Marked as draft.`,
      })
    } else if (type === 'installation') {
      const customer = fields.customer.trim()
      const capacityVal = Number(fields.capacity)
      if (Number.isNaN(capacityVal) || capacityVal < 1.0 || capacityVal > 5.0) {
        setNotice({ text: 'Error: System capacity must be between 1.0 kW and 5.0 kW inclusive.' })
        return
      }
      const technician = fields.technician
      const packageType = fields.packageType || 'On-Grid System'
      const category = fields.category || (customer.toLowerCase().includes('factory') ? 'Small Factory' : 'Home')
      setInstallations((current) => [
        {
          id: `INS-${Date.now()}`,
          customer,
          category,
          location: fields.location.trim(),
          capacity: `${capacityVal} kW`,
          package: packageType,
          date: formatDisplayDate(fields.date),
          technician,
          status: 'Ongoing',
          isNew: true,
        },
        ...current,
      ])
      addActivity(
        'installation',
        'Installation assigned',
        `${customer} (${capacityVal} kW) assigned to ${technician} in the 15-person demonstration roster.`,
      )
      if (activeNav !== 'overview' && activeNav !== 'installations') {
        setActiveNav('installations')
      }
      setNotice({
        text: `Installation scheduled for ${customer}. Job is at the top of the installations table.`,
      })
    } else if (type === 'inventory') {
      const item = fields.item.trim()
      const warehouse = fields.warehouse.trim()
      const serialTracking = fields.serialTracking || 'Standard kit item'
      setSessionRecords((current) => [
        {
          id: `INV-${Date.now()}`,
          type: 'inventory',
          sku: fields.sku.trim(),
          item,
          quantity: String(Number(fields.quantity)),
          warehouse,
          serialTracking,
        },
        ...current,
      ])
      addActivity(
        'inventory',
        'Inventory added',
        `${item} (${serialTracking}) received at ${warehouse} warehouse.`,
      )
      setActiveNav('inventory')
      setNotice({ text: `${item} added to ${warehouse} demonstration inventory.` })
    }

    setQuery('')
    setAction(null)
    setSidebarOpen(false)
  }

  function handleApproveSurvey(surveyId) {
    setModulesData((prev) => {
      const updatedRows = prev.surveys.rows.map((row) => {
        if (row[0] === surveyId) {
          const next = [...row]
          next[4] = 'Approved'
          return next
        }
        return row
      })
      return {
        ...prev,
        surveys: {
          ...prev.surveys,
          rows: updatedRows,
        },
      }
    })
    addActivity(
      'surveys',
      'Roof survey approved',
      `Survey ${surveyId} verified and approved. Customer quotation is now unlocked.`,
    )
    setNotice({
      text: `Survey ${surveyId} approved! Quotation creation is now unlocked for this customer.`,
    })
    setReviewSurvey(null)
  }

  function handleConfirmOrder(quoteId) {
    setModulesData((prev) => {
      const updatedRows = prev.quotations.rows.map((row) => {
        if (row[0] === quoteId) {
          const next = [...row]
          next[6] = 'Order Confirmed'
          return next
        }
        return row
      })
      return {
        ...prev,
        quotations: {
          ...prev.quotations,
          rows: updatedRows,
        },
      }
    })
    setSessionRecords((current) =>
      current.map((rec) =>
        rec.quoteId === quoteId ? { ...rec, status: 'Order Confirmed' } : rec,
      ),
    )
    addActivity(
      'quotation',
      'Order confirmed',
      `Quotation ${quoteId} confirmed with 50% advance. Warehouse picking scheduled.`,
    )
    setNotice({
      text: `Order confirmed for quote ${quoteId}. Warehouse picking & serial scan now scheduled.`,
    })
    setInspectQuote(null)
  }

  function handleDispatch(dispatchData) {
    const isOffGrid = dispatchData.packageType.toLowerCase().includes('off-grid')
    const warrantyCoverage = isOffGrid
      ? 'Panels: 20y · Inverter: 2y · Battery: 2y (Charge controller: Not specified in official problem statement)'
      : 'Panels: 20y · Inverter: 2y (Charge controller: Not specified in official problem statement)'
    const expiry = isOffGrid
      ? `${dispatchData.deliveryDate.slice(0, 4) - 0 + 20} (Panels) / ${dispatchData.deliveryDate.slice(0, 4) - 0 + 2} (Inv/Bat)`
      : `${dispatchData.deliveryDate.slice(0, 4) - 0 + 20} (Panels) / ${dispatchData.deliveryDate.slice(0, 4) - 0 + 2} (Inverter)`

    const newWarranty = [
      dispatchData.customer,
      `${dispatchData.capacity} ${dispatchData.packageType}`,
      formatDisplayDate(dispatchData.deliveryDate),
      warrantyCoverage,
      expiry,
      'Active',
    ]

    setModulesData((prev) => ({
      ...prev,
      warranties: {
        ...prev.warranties,
        rows: [newWarranty, ...prev.warranties.rows],
      },
    }))
    addActivity(
      'warranty',
      'Warehouse dispatched & serials linked',
      `${dispatchData.customer}: Inverter SN ${dispatchData.serials.inverter} dispatched. Warranties start on ${formatDisplayDate(dispatchData.deliveryDate)}.`,
    )
    setNotice({
      text: `Warehouse dispatch confirmed for ${dispatchData.customer}. Serial numbers linked and official warranty activated from ${formatDisplayDate(dispatchData.deliveryDate)}.`,
    })
    setDispatchOrder(null)
  }

  function handleCompleteCommissioning(jobId, handoverData) {
    setInstallations((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'Completed',
              testOutput: handoverData.testOutput,
              startTime: handoverData.startTime,
              finishTime: handoverData.finishTime,
            }
          : job,
      ),
    )
    addActivity(
      'installation',
      'Installation commissioning completed',
      `Job ${jobId} signed and tested (${handoverData.testOutput}). Customer digital signature verified.`,
    )
    setNotice({
      text: `Installation ${jobId} successfully commissioned. Generation test: ${handoverData.testOutput}. Digital signature filed.`,
    })
    setCommissioningJob(null)
  }

  function handleResolveTicket(ticketId) {
    setModulesData((prev) => {
      const updatedRows = prev.service.rows.map((row) => {
        if (row[0] === ticketId) {
          const next = [...row]
          next[5] = 'Resolved (Customer Confirmed)'
          return next
        }
        return row
      })
      return {
        ...prev,
        service: {
          ...prev.service,
          rows: updatedRows,
        },
      }
    })
    addActivity(
      'service',
      'Service ticket resolved',
      `Ticket ${ticketId} resolved following mandatory customer resolution confirmation.`,
    )
    setNotice({
      text: `Ticket ${ticketId} closed after homeowner / customer confirmed satisfactory resolution.`,
    })
    setInspectTicket(null)
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeId={activeNav}
        items={NAV_ITEMS}
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
          heading={heading}
          user={user}
          query={query}
          onQueryChange={setQuery}
          onMenu={() => setSidebarOpen(true)}
          onLogout={onLogout}
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
          {activeNav === 'users' ? (
            <StaffAccounts />
          ) : activeNav === 'overview' ? (
            <Dashboard
              installations={filteredInstallations}
              activities={activities}
              query={query}
              onClearSearch={() => setQuery('')}
              onAction={setAction}
              onCommission={setCommissioningJob}
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
              modules={modulesData}
              onCommission={setCommissioningJob}
              onReviewSurvey={setReviewSurvey}
              onInspectQuote={setInspectQuote}
              onOpenDispatch={setDispatchOrder}
              onInspectTicket={setInspectTicket}
            />
          )}
        </main>
      </div>

      {action && (
        <ActionDialog type={action} onClose={() => setAction(null)} onSubmit={handleCreate} />
      )}

      {reviewSurvey && (
        <SurveyApprovalDialog
          survey={reviewSurvey}
          onClose={() => setReviewSurvey(null)}
          onApprove={handleApproveSurvey}
        />
      )}

      {inspectQuote && (
        <BOMDialog
          quote={inspectQuote}
          onClose={() => setInspectQuote(null)}
          onConfirmOrder={handleConfirmOrder}
        />
      )}

      {dispatchOrder && (
        <DispatchDialog
          order={dispatchOrder}
          onClose={() => setDispatchOrder(null)}
          onDispatch={handleDispatch}
        />
      )}

      {commissioningJob && (
        <CommissioningDialog
          job={commissioningJob}
          onClose={() => setCommissioningJob(null)}
          onComplete={handleCompleteCommissioning}
        />
      )}

      {inspectTicket && (
        <ServiceTicketDialog
          ticket={inspectTicket}
          onClose={() => setInspectTicket(null)}
          onResolve={handleResolveTicket}
        />
      )}
    </div>
  )
}

function getPathname() {
  return window.location.pathname
}

function subscribeToPathname(callback) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function AppController() {
  const auth = useAuth()
  const pathname = useSyncExternalStore(subscribeToPathname, getPathname, getPathname)
  const [registrationNotice, setRegistrationNotice] = useState('')

  const navigate = useCallback((path, { replace = false } = {}) => {
    if (replace) {
      window.history.replaceState({}, '', path)
    } else {
      window.history.pushState({}, '', path)
    }
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  useEffect(() => {
    if (auth.status === 'loading') return
    const isAuthPage = pathname === '/login' || pathname === '/register'
    if (!auth.user && !isAuthPage) {
      navigate('/login', { replace: true })
    } else if (auth.user && isAuthPage) {
      navigate('/dashboard', { replace: true })
    }
  }, [auth.status, auth.user, pathname, navigate])

  async function handleLogin(email, password) {
    await auth.login(email, password)
    setRegistrationNotice('')
    navigate('/dashboard', { replace: true })
  }

  async function handleRegisterCustomer(data) {
    await auth.registerCustomer(data)
    setRegistrationNotice('Customer account created. Sign in with your new email and password.')
    navigate('/login', { replace: true })
  }

  async function handleLogout() {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  if (auth.status === 'loading') {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Verifying your SunPower session…</p>
      </main>
    )
  }

  if (!auth.user) {
    const serviceError = auth.status === 'unavailable' ? auth.error : ''
    if (pathname === '/register') {
      return (
        <CustomerRegistrationPage
          onRegister={handleRegisterCustomer}
          onNavigate={navigate}
          busy={auth.busy}
        />
      )
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        onNavigate={navigate}
        onRetry={auth.loadCurrentUser}
        notice={registrationNotice}
        serviceError={serviceError}
        busy={auth.busy}
      />
    )
  }

  if (auth.user.role === 'ADMIN') {
    return <AdminWorkspace user={auth.user} onLogout={handleLogout} />
  }
  if (auth.user.role === 'CUSTOMER') {
    return <CustomerPortal user={auth.user} onLogout={handleLogout} />
  }
  if (!ROLE_WORKSPACES[auth.user.role]) {
    return (
      <main className="auth-loading">
        <p role="alert">This account role has no available workspace. Contact an administrator.</p>
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
      </main>
    )
  }
  return <RoleWorkspace user={auth.user} onLogout={handleLogout} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppController />
    </AuthProvider>
  )
}
