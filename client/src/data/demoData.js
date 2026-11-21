export const DEMO_USER = {
  name: 'Aanya Malhotra',
  role: 'Admin',
  title: 'Operations lead',
}

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', heading: 'Dashboard', icon: 'overview' },
  { id: 'customers', label: 'Customers & Leads', heading: 'Customers & Leads', icon: 'customers' },
  { id: 'surveys', label: 'Roof Surveys', heading: 'Roof Surveys', icon: 'surveys' },
  { id: 'quotations', label: 'Quotations', heading: 'Quotations', icon: 'quotations' },
  { id: 'inventory', label: 'Inventory', heading: 'Inventory', icon: 'inventory' },
  { id: 'installations', label: 'Installations', heading: 'Installations', icon: 'installations' },
  { id: 'technicians', label: 'Technicians', heading: 'Technicians', icon: 'technicians' },
  { id: 'warranties', label: 'Warranties', heading: 'Warranties', icon: 'warranties' },
  { id: 'service', label: 'Service Requests', heading: 'Service Requests', icon: 'service' },
  { id: 'reports', label: 'Reports & Analytics', heading: 'Reports & Analytics', icon: 'reports' },
  { id: 'settings', label: 'Settings', heading: 'Settings', icon: 'settings' },
]

export const STATS = [
  {
    id: 'customers',
    label: 'Total Customers',
    value: '148',
    note: 'Demo count, including open leads',
    icon: 'customers',
  },
  {
    id: 'installations',
    label: 'Active Installations',
    value: '34',
    note: 'Demo crews currently on site',
    icon: 'installations',
  },
  {
    id: 'quotations',
    label: 'Pending Quotations',
    value: '17',
    note: 'Demo quotes waiting for approval',
    icon: 'quotations',
  },
  {
    id: 'tickets',
    label: 'Open Service Tickets',
    value: '9',
    note: 'Demo tickets still unresolved',
    icon: 'service',
  },
]

export const INSTALLATION_MIX = [
  { label: 'Completed installations', value: 86, color: '#0f6b3c' },
  { label: 'Ongoing installations', value: 34, color: '#3d9b68' },
  { label: 'Pending installations', value: 21, color: '#c8962e' },
]

export const TECHNICIANS = ['Arjun Singh', 'Simran Kaur', 'Harpreet Gill', 'Navjot Brar']

export const INSTALLATIONS = [
  {
    id: 'INS-1842',
    customer: 'Meera Kapoor',
    location: 'Ludhiana',
    capacity: '5.2 kW',
    date: '12 Nov 2026',
    technician: 'Arjun Singh',
    status: 'Completed',
  },
  {
    id: 'INS-1850',
    customer: 'Rajesh Gupta',
    location: 'Jalandhar',
    capacity: '8.0 kW',
    date: '18 Nov 2026',
    technician: 'Simran Kaur',
    status: 'Ongoing',
  },
  {
    id: 'INS-1854',
    customer: 'GreenLeaf Hotels',
    location: 'Amritsar',
    capacity: '25 kW',
    date: '20 Nov 2026',
    technician: 'Harpreet Gill',
    status: 'Ongoing',
  },
  {
    id: 'INS-1858',
    customer: 'Anil Verma',
    location: 'Phagwara',
    capacity: '3.6 kW',
    date: '22 Nov 2026',
    technician: 'Arjun Singh',
    status: 'Pending',
  },
  {
    id: 'INS-1811',
    customer: 'Punjab Agro Mills',
    location: 'Moga',
    capacity: '40 kW',
    date: '04 Nov 2026',
    technician: 'Navjot Brar',
    status: 'Completed',
  },
  {
    id: 'INS-1848',
    customer: 'Sneha Iyer',
    location: 'Chandigarh',
    capacity: '6.4 kW',
    date: '15 Nov 2026',
    technician: 'Simran Kaur',
    status: 'Ongoing',
  },
  {
    id: 'INS-1796',
    customer: 'City School Trust',
    location: 'Patiala',
    capacity: '15 kW',
    date: '28 Oct 2026',
    technician: 'Harpreet Gill',
    status: 'Completed',
  },
  {
    id: 'INS-1861',
    customer: 'Vikram Sethi',
    location: 'Bathinda',
    capacity: '4.8 kW',
    date: '25 Nov 2026',
    technician: 'Navjot Brar',
    status: 'Pending',
  },
]

export const ACTIVITIES = [
  {
    id: 'act-1',
    kind: 'customer',
    title: 'New customer registered',
    detail: 'Vikram Sethi was added after the Bathinda site visit.',
    time: '2 hours ago',
  },
  {
    id: 'act-2',
    kind: 'installation',
    title: 'Installation assigned',
    detail: 'The 8.0 kW Jalandhar system was assigned to Simran Kaur.',
    time: '5 hours ago',
  },
  {
    id: 'act-3',
    kind: 'quotation',
    title: 'Quotation approved',
    detail: 'QT-2041 for GreenLeaf Hotels was approved in the demo pipeline.',
    time: 'Yesterday',
  },
  {
    id: 'act-4',
    kind: 'warranty',
    title: 'Warranty activated',
    detail: 'A 10-year panel warranty started for Punjab Agro Mills.',
    time: 'Yesterday',
  },
]

export const NOTIFICATIONS = [
  {
    id: 'nt-1',
    title: 'Quotation approved',
    body: 'QT-2041 for GreenLeaf Hotels moved to approved in the demo pipeline.',
    time: '1 hour ago',
  },
  {
    id: 'nt-2',
    title: 'Survey waiting on access',
    body: 'The Amritsar rooftop survey is paused until the site is unlocked.',
    time: '3 hours ago',
  },
  {
    id: 'nt-3',
    title: 'Inverter stock is low',
    body: '5 kW inverters at the Ludhiana warehouse are below the demo threshold.',
    time: 'Yesterday',
  },
]

export const MODULES = {
  customers: {
    summary: 'Household and commercial leads captured by the SolarFlow desk. Sample records only.',
    action: 'customer',
    actionLabel: 'Add Customer',
    columns: ['Name', 'City', 'Phone', 'Stage'],
    rows: [
      ['Meera Kapoor', 'Ludhiana', '98150 22014', 'Installed'],
      ['Rajesh Gupta', 'Jalandhar', '98722 11840', 'Installation'],
      ['GreenLeaf Hotels', 'Amritsar', '0163 440 2190', 'Quoted'],
      ['Anil Verma', 'Phagwara', '98881 67320', 'Survey booked'],
      ['Northwind Residency', 'Mohali', '0172 509 4411', 'New lead'],
    ],
  },
  surveys: {
    summary: 'Roof measurements and shading notes from field visits. Sample records only.',
    actionLabel: 'Record survey update',
    columns: ['Site', 'City', 'Roof type', 'Finding', 'Status'],
    rows: [
      ['Kapoor residence', 'Ludhiana', 'Concrete flat', 'Clear south pitch', 'Completed'],
      ['Gupta residence', 'Jalandhar', 'Metal sheet', 'Minor west shade', 'Completed'],
      ['GreenLeaf block B', 'Amritsar', 'RCC terrace', 'Access pending', 'Surveying'],
      ['Verma farmhouse', 'Phagwara', 'Tile slope', 'Visit booked', 'Pending'],
    ],
  },
  quotations: {
    summary: 'System sizes and prices prepared for customer approval. Sample records only.',
    action: 'quotation',
    actionLabel: 'Create Quotation',
    columns: ['Quote', 'Customer', 'Capacity', 'Amount', 'Status'],
    rows: [
      ['QT-2041', 'GreenLeaf Hotels', '25 kW', '₹18,40,000', 'Approved'],
      ['QT-2048', 'Anil Verma', '3.6 kW', '₹2,15,000', 'Pending'],
      ['QT-2033', 'Sneha Iyer', '6.4 kW', '₹3,82,000', 'Approved'],
      ['QT-2052', 'Northwind Residency', '12 kW', '₹7,60,000', 'Draft'],
    ],
  },
  inventory: {
    summary: 'Panels, inverters, and mounting stock across demo warehouses.',
    action: 'inventory',
    actionLabel: 'Add Inventory',
    columns: ['SKU', 'Item', 'Quantity', 'Warehouse', 'Status'],
    rows: [
      ['PAN-540', '540 W mono panel', '860', 'Ludhiana', 'In stock'],
      ['INV-5K', '5 kW hybrid inverter', '18', 'Ludhiana', 'Low'],
      ['INV-25K', '25 kW string inverter', '6', 'Amritsar', 'In stock'],
      ['MNT-RCC', 'RCC mounting kit', '240', 'Jalandhar', 'In stock'],
    ],
  },
  installations: {
    summary: 'Scheduled, active, and completed jobs. The same demonstration list used on the dashboard.',
    action: 'installation',
    actionLabel: 'Schedule Installation',
  },
  technicians: {
    summary: 'Field crew availability for the current demonstration week.',
    actionLabel: 'Record crew update',
    columns: ['Technician', 'Skill', 'Active jobs', 'Availability'],
    rows: [
      ['Arjun Singh', 'Residential rooftops', '2', 'On site'],
      ['Simran Kaur', 'Hybrid systems', '2', 'On site'],
      ['Harpreet Gill', 'Commercial plants', '1', 'On site'],
      ['Navjot Brar', 'Commissioning', '1', 'Available'],
    ],
  },
  warranties: {
    summary: 'Panel, inverter, and workmanship coverage started after commissioning.',
    actionLabel: 'Record warranty update',
    columns: ['Customer', 'System', 'Coverage', 'Expires', 'Status'],
    rows: [
      ['Punjab Agro Mills', '40 kW', 'Panels, 10 years', '04 Nov 2036', 'Active'],
      ['City School Trust', '15 kW', 'Workmanship, 5 years', '28 Oct 2031', 'Active'],
      ['Meera Kapoor', '5.2 kW', 'Inverter, 8 years', '12 Nov 2034', 'Active'],
      ['Heritage Villas', '7 kW', 'Panels, 10 years', '02 Jan 2027', 'Expiring'],
    ],
  },
  service: {
    summary: 'Support tickets raised after handover. Sample records only.',
    actionLabel: 'Record service update',
    columns: ['Ticket', 'Customer', 'Issue', 'Priority', 'Status'],
    rows: [
      ['SR-318', 'Heritage Villas', 'Inverter alarm after sunset', 'High', 'Open'],
      ['SR-322', 'Meera Kapoor', 'Generation below estimate', 'Medium', 'In progress'],
      ['SR-307', 'City School Trust', 'Annual cleaning request', 'Low', 'Scheduled'],
      ['SR-299', 'Punjab Agro Mills', 'String offline on block C', 'High', 'Open'],
    ],
  },
}

export const QUICK_ACTIONS = [
  {
    id: 'customer',
    label: 'Add Customer',
    detail: 'Register a household or business lead',
    icon: 'customers',
  },
  {
    id: 'quotation',
    label: 'Create Quotation',
    detail: 'Draft a system size and price',
    icon: 'quotations',
  },
  {
    id: 'installation',
    label: 'Schedule Installation',
    detail: 'Assign a crew and installation date',
    icon: 'installations',
  },
  {
    id: 'inventory',
    label: 'Add Inventory',
    detail: 'Record panels, inverters, or kits',
    icon: 'inventory',
  },
]

export function matchesQuery(query, values) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return values.some((value) => String(value).toLowerCase().includes(needle))
}

export function statusClass(status) {
  const slug = String(status).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
  return `status status-${slug}`
}

export function formatDisplayDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatInr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value))
}
