export const COMPANY_BENCHMARKS = {
  name: 'SunPower Solutions',
  monthlyProjectBenchmark: 40, // Approximate 40 rooftop projects per month benchmark (target scale, not guaranteed actual)
  technicianCrewCount: 15, // Official 15-person technician crew
  minCapacityKw: 1.0, // Enforced minimum capacity
  maxCapacityKw: 5.0, // Enforced maximum capacity
  customerSegments: 'Homes and small factories',
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
  { id: 'finance', label: 'Finance & Accounts', heading: 'Finance & Accounts', icon: 'finance' },
  { id: 'reports', label: 'Reports & Analytics', heading: 'Reports & Analytics', icon: 'reports' },
  { id: 'settings', label: 'Settings', heading: 'Settings', icon: 'settings' },
  { id: 'users', label: 'Staff Accounts', heading: 'Staff Accounts', icon: 'technicians' },
]

export const STATS = [
  {
    id: 'customers',
    label: 'Demonstration Customers',
    value: '42',
    note: 'Synthetic demo records (Homes & Small Factories)',
    icon: 'customers',
  },
  {
    id: 'benchmark',
    label: 'Monthly Target Scale',
    value: '~40',
    note: 'Approx. rooftop projects/month (Official business benchmark)',
    icon: 'installations',
  },
  {
    id: 'technicians',
    label: 'Technician Crew Capacity',
    value: '15',
    note: 'Official crew size (Represented by synthetic roster)',
    icon: 'technicians',
  },
  {
    id: 'tickets',
    label: 'Open Service Tickets',
    value: '4',
    note: 'Synthetic demo tickets awaiting customer resolution',
    icon: 'service',
  },
  {
    id: 'active-installations',
    label: 'Active Installations',
    value: '8',
    note: 'Synthetic monthly workload distribution',
    icon: 'installations',
  },
  {
    id: 'pending-quotations',
    label: 'Pending Quotations',
    value: '2',
    note: 'Synthetic drafts and reviews',
    icon: 'quotations',
  },
  {
    id: 'inventory-alerts',
    label: 'Inventory Alerts',
    value: '1',
    note: 'Synthetic inverter reorder alert',
    icon: 'inventory',
  },
  {
    id: 'invoiced-revenue',
    label: 'Demo Invoiced Revenue',
    value: '₹28.8L',
    note: 'Synthetic financial summary; not live revenue',
    icon: 'finance',
  },
]

// The company benchmark is approximately 40 rooftop projects per month.
// The 26 completed + 8 ongoing + 6 pending distribution is illustrative synthetic monthly workload data, not 40 verified project records.
export const INSTALLATION_MIX = [
  { label: 'Completed installations', value: 26, color: '#0f6b3c' },
  { label: 'Ongoing installations', value: 8, color: '#3d9b68' },
  { label: 'Pending installations', value: 6, color: '#c8962e' },
]

// Synthetic demonstration roster representing the company's official 15-person technician crew.
// All technician identifiers and focus areas are fictional demonstration records, not actual SunPower personnel.
export const TECHNICIANS = [
  'Demo Tech 01 (Arjun Singh)',
  'Demo Tech 02 (Simran Kaur)',
  'Demo Tech 03 (Harpreet Gill)',
  'Demo Tech 04 (Navjot Brar)',
  'Demo Tech 05 (Gurpreet Dhillon)',
  'Demo Tech 06 (Amit Sharma)',
  'Demo Tech 07 (Manpreet Vohra)',
  'Demo Tech 08 (Balwinder Deol)',
  'Demo Tech 09 (Rohit Chawla)',
  'Demo Tech 10 (Jasleen Grewal)',
  'Demo Tech 11 (Kamaljeet Bhatia)',
  'Demo Tech 12 (Sandeep Virk)',
  'Demo Tech 13 (Tarun Khanna)',
  'Demo Tech 14 (Deepinder Sidhu)',
  'Demo Tech 15 (Rajat Bassi)',
]

export const SOLAR_PACKAGES = {
  panelSet: {
    name: 'Solar Panel Set',
    officialRequired: ['Panels', 'Connectors', 'Wires'],
    description: 'Mandatory official components: solar panels, connectors, and wires. (Illustrative technical details like MC4 connectors or DC/AC cable grades are site-specific examples, not PDF mandates).',
  },
  onGrid: {
    name: 'On-Grid System (1 kW to 5 kW)',
    officialRequired: [
      'Inverter',
      'Wiring boxes',
      'Battery charge controller',
      'Panels',
      'Safety earthing',
      'Metal stands',
    ],
    description: 'Mandatory official components: inverter, wiring boxes, battery charge controller, solar panels set, safety earthing, and metal stands. (Components like ACDB/DCDB, isolator switches, and SPDs are illustrative electrical engineering examples).',
  },
  offGrid: {
    name: 'Off-Grid System (1 kW to 5 kW)',
    officialRequired: [
      'Inverter',
      'Wiring boxes',
      'Battery charge controller',
      'Panels',
      'Safety earthing',
      'Metal stands',
      'Large battery',
    ],
    description: 'Mandatory official components: all On-Grid components plus a large battery for energy storage.',
  },
  installationService: {
    name: 'Installation Service',
    officialRequired: ['Fitting at customer site', 'Testing at customer site'],
    description: 'Mandatory official requirement: Installation is a separate service covering on-site fitting and testing.',
  },
}

// Every solar system has a capacity strictly between 1.0 kW and 5.0 kW inclusive.
export const INSTALLATIONS = [
  {
    id: 'INS-1842',
    customer: 'Meera Kapoor (Home)',
    category: 'Home',
    location: 'Ludhiana',
    capacity: '3.0 kW',
    package: 'On-Grid System',
    date: '12 Nov 2026',
    technician: 'Demo Tech 01 (Arjun Singh)',
    status: 'Completed',
  },
  {
    id: 'INS-1850',
    customer: 'Rajesh Gupta (Home)',
    category: 'Home',
    location: 'Jalandhar',
    capacity: '4.0 kW',
    package: 'On-Grid System',
    date: '18 Nov 2026',
    technician: 'Demo Tech 02 (Simran Kaur)',
    status: 'Ongoing',
  },
  {
    id: 'INS-1854',
    customer: 'Apex Auto Components (Small Factory)',
    category: 'Small Factory',
    location: 'Amritsar',
    capacity: '5.0 kW',
    package: 'On-Grid System',
    date: '20 Nov 2026',
    technician: 'Demo Tech 03 (Harpreet Gill)',
    status: 'Ongoing',
  },
  {
    id: 'INS-1858',
    customer: 'Anil Verma (Home)',
    category: 'Home',
    location: 'Phagwara',
    capacity: '3.6 kW',
    package: 'Off-Grid System',
    date: '22 Nov 2026',
    technician: 'Demo Tech 04 (Navjot Brar)',
    status: 'Pending',
  },
  {
    id: 'INS-1811',
    customer: 'Punjab Tool Works (Small Factory)',
    category: 'Small Factory',
    location: 'Moga',
    capacity: '5.0 kW',
    package: 'Off-Grid System',
    date: '04 Nov 2026',
    technician: 'Demo Tech 05 (Gurpreet Dhillon)',
    status: 'Completed',
  },
  {
    id: 'INS-1848',
    customer: 'Sneha Iyer (Home)',
    category: 'Home',
    location: 'Chandigarh',
    capacity: '4.5 kW',
    package: 'On-Grid System',
    date: '15 Nov 2026',
    technician: 'Demo Tech 06 (Amit Sharma)',
    status: 'Ongoing',
  },
  {
    id: 'INS-1796',
    customer: 'Golden Grain Processing (Small Factory)',
    category: 'Small Factory',
    location: 'Patiala',
    capacity: '5.0 kW',
    package: 'On-Grid System',
    date: '28 Oct 2026',
    technician: 'Demo Tech 07 (Manpreet Vohra)',
    status: 'Completed',
  },
  {
    id: 'INS-1861',
    customer: 'Vikram Sethi (Home)',
    category: 'Home',
    location: 'Bathinda',
    capacity: '2.5 kW',
    package: 'Off-Grid System',
    date: '25 Nov 2026',
    technician: 'Demo Tech 08 (Balwinder Deol)',
    status: 'Pending',
  },
]

export const ACTIVITIES = [
  {
    id: 'act-1',
    kind: 'customer',
    title: 'New customer registered',
    detail: 'Vikram Sethi (Home) was added following rooftop shadow verification in Bathinda.',
    time: '2 hours ago',
  },
  {
    id: 'act-2',
    kind: 'installation',
    title: 'Installation assigned',
    detail: 'The 4.0 kW On-Grid system for Rajesh Gupta (Home, Jalandhar) was assigned to Demo Tech 02 (Simran Kaur).',
    time: '5 hours ago',
  },
  {
    id: 'act-3',
    kind: 'quotation',
    title: 'Quotation approved',
    detail: 'QT-1022 (5.0 kW On-Grid) for Apex Auto Components was approved following survey sign-off.',
    time: 'Yesterday',
  },
  {
    id: 'act-4',
    kind: 'warranty',
    title: 'Warranty registered upon delivery',
    detail: 'Official 20-year solar panel and 2-year inverter warranties registered upon completed delivery for Punjab Tool Works (Charge-controller warranty: Not specified in the official problem statement).',
    time: 'Yesterday',
  },
]

export const NOTIFICATIONS = [
  {
    id: 'nt-1',
    title: 'Quotation approved',
    body: 'QT-1022 (5.0 kW On-Grid) for Apex Auto Components approved following roof survey sign-off.',
    time: '1 hour ago',
  },
  {
    id: 'nt-2',
    title: 'Survey in progress',
    body: 'Rooftop shadow analysis underway for Sunrise Textiles Unit (Small Factory) in Amritsar.',
    time: '3 hours ago',
  },
  {
    id: 'nt-3',
    title: 'Inverter stock alert',
    body: '5 kW On-Grid inverters at Ludhiana warehouse are near the demonstration reorder point.',
    time: 'Yesterday',
  },
]

export const MODULES = {
  customers: {
    summary: 'Homes and small factories registered at the SunPower Solutions operations desk. Synthetic demonstration records only.',
    action: 'customer',
    actionLabel: 'Add Customer',
    columns: ['Name', 'Customer Category', 'City', 'Phone', 'Pipeline Stage'],
    rows: [
      ['Meera Kapoor', 'Home', 'Ludhiana', '98150 22014', 'Installed'],
      ['Rajesh Gupta', 'Home', 'Jalandhar', '98722 11840', 'Installation'],
      ['Apex Auto Components', 'Small Factory', 'Amritsar', '98761 44021', 'Quoted'],
      ['Anil Verma', 'Home', 'Phagwara', '98881 67320', 'Survey approved'],
      ['Sneha Iyer', 'Home', 'Chandigarh', '98140 33810', 'Survey approved'],
      ['Vikram Sethi', 'Home', 'Bathinda', '98782 55920', 'Survey approved'],
      ['Sunrise Textiles Unit', 'Small Factory', 'Amritsar', '98144 55210', 'Surveying'],
      ['Harjit Sandhu', 'Home', 'Mohali', '98155 33112', 'New lead'],
    ],
  },
  surveys: {
    summary: 'Rooftop assessments checking monthly bill history, shadow-free area, grid connection suitability, orientation, tilt, and cable distance feasibility. Survey approval is compulsory before quotation. Technical evaluations are recorded qualitatively without invented measurements.',
    actionLabel: 'Record survey update',
    columns: ['Survey ID', 'Customer & Category', 'Grid Connection Suitability', 'Roof Feasibility Assessment', 'Survey Status'],
    rows: [
      ['SRV-101', 'Meera Kapoor (Home)', 'Grid connected · Shadow-free verified', 'South orientation · Feasible cable run', 'Approved'],
      ['SRV-102', 'Rajesh Gupta (Home)', 'Grid connected · Shadow-free verified', 'South-West orientation · Feasible cable run', 'Approved'],
      ['SRV-103', 'Apex Auto Components (Small Factory)', 'Grid connected (3-phase) · Clear roof space', 'South pitch · Feasible cable run', 'Approved'],
      ['SRV-104', 'Anil Verma (Home)', 'Off-grid candidate · Shadow-free verified', 'South orientation · Feasible cable run', 'Approved'],
      ['SRV-105', 'Sneha Iyer (Home)', 'Grid connected · Shadow-free verified', 'South orientation · Feasible cable run', 'Approved'],
      ['SRV-106', 'Vikram Sethi (Home)', 'Off-grid candidate · Shadow-free verified', 'South orientation · Feasible cable run', 'Approved'],
      ['SRV-107', 'Sunrise Textiles Unit (Small Factory)', 'Shadow analysis pending site access', 'Roof evaluation in progress', 'Surveying (Under Review)'],
      ['SRV-108', 'Harjit Sandhu (Home)', 'Site visit scheduled', 'Pending physical assessment', 'Pending Visit'],
    ],
  },
  quotations: {
    summary: 'System sizes strictly 1 kW to 5 kW inclusive. All quotations reference an associated roof survey with approved status before release. Quotations are not prepared or marked ready for customer delivery without an approved survey. Amounts are illustrative demo values.',
    action: 'quotation',
    actionLabel: 'Create Quotation',
    columns: ['Quote ID', 'Customer & Category', 'Associated Approved Survey', 'Package Type', 'Capacity (1–5 kW)', 'Demo Amount*', 'Status'],
    rows: [
      ['QT-1011', 'Meera Kapoor (Home)', 'SRV-101 (Approved)', 'On-Grid System', '3.0 kW', '₹1,85,000', 'Approved'],
      ['QT-1015', 'Rajesh Gupta (Home)', 'SRV-102 (Approved)', 'On-Grid System', '4.0 kW', '₹2,40,000', 'Approved'],
      ['QT-1022', 'Apex Auto (Small Factory)', 'SRV-103 (Approved)', 'On-Grid System', '5.0 kW', '₹2,95,000', 'Approved'],
      ['QT-1028', 'Anil Verma (Home)', 'SRV-104 (Approved)', 'Off-Grid System', '3.6 kW', '₹2,75,000', 'Pending Review'],
      ['QT-1033', 'Sneha Iyer (Home)', 'SRV-105 (Approved)', 'On-Grid System', '4.5 kW', '₹2,68,000', 'Approved'],
      ['QT-1039', 'Vikram Sethi (Home)', 'SRV-106 (Approved)', 'Off-Grid System', '2.5 kW', '₹2,10,000', 'Draft (Pending Delivery)'],
    ],
  },
  inventory: {
    summary: 'Inventory components for 1 kW to 5 kW systems. Serial numbers required for inverters, batteries, and charge controllers before dispatch.',
    action: 'inventory',
    actionLabel: 'Add Inventory',
    columns: ['SKU', 'Component Item', 'Quantity', 'Warehouse', 'Official Requirement / Serial Tracking'],
    rows: [
      ['PAN-SET', 'Solar Panels (Solar Panel Set)', '420 units', 'Ludhiana', 'Required · Batch tracked (20-yr warranty)'],
      ['INV-ONGRID', 'Inverter (On-Grid / Off-Grid)', '28 units', 'Ludhiana', 'Required · Serial number required (2-yr warranty)'],
      ['BAT-LARGE', 'Large Battery (Off-Grid System)', '28 units', 'Ludhiana', 'Required for Off-Grid · Serial required (2-yr warranty)'],
      ['CHG-CTRL', 'Battery Charge Controller (On-Grid / Off-Grid)', '35 units', 'Ludhiana', 'Required · Serial required · Warranty: Not specified in the official problem statement'],
      ['WIRING-BOX', 'Wiring Boxes (On-Grid / Off-Grid)', '64 sets', 'Jalandhar', 'Required · Standard package component (e.g. distribution/isolators)'],
      ['EARTH-SYS', 'Safety Earthing (On-Grid / Off-Grid)', '95 sets', 'Ludhiana', 'Required · Safety grounding component'],
      ['STAND-MTL', 'Metal Stands (On-Grid / Off-Grid)', '180 sets', 'Amritsar', 'Required · Structural metal stands'],
      ['CONN-WIRE', 'Connectors and Wires (Solar Panel Set)', '1200 m', 'Ludhiana', 'Required · Connectors & wires (e.g. MC4 & cables)'],
    ],
  },
  installations: {
    summary: 'Scheduled, active, and completed 1 kW to 5 kW installations. Assigned across the 15-technician demonstration crew.',
    action: 'installation',
    actionLabel: 'Schedule Installation',
  },
  technicians: {
    summary: 'Synthetic demonstration roster representing the company\'s official 15-person technician crew. All names and illustrative role tags are fictional demonstration records, not actual SunPower Solutions employees.',
    actionLabel: 'Record crew update',
    columns: ['Demonstration Crew Member', 'Illustrative Role / Skill Focus', 'Assigned Demo Jobs', 'Roster Availability'],
    rows: [
      ['Demo Tech 01 (Arjun Singh)', 'Illustrative focus: Residential On-Grid', '2', 'On site'],
      ['Demo Tech 02 (Simran Kaur)', 'Illustrative focus: Small Factory On-Grid', '2', 'On site'],
      ['Demo Tech 03 (Harpreet Gill)', 'Illustrative focus: Workshop Rooftops', '1', 'On site'],
      ['Demo Tech 04 (Navjot Brar)', 'Illustrative focus: Off-Grid Battery Systems', '1', 'Available'],
      ['Demo Tech 05 (Gurpreet Dhillon)', 'Illustrative focus: Commissioning & Testing', '1', 'Available'],
      ['Demo Tech 06 (Amit Sharma)', 'Illustrative focus: Residential Rooftops', '1', 'On site'],
      ['Demo Tech 07 (Manpreet Vohra)', 'Illustrative focus: Safety Earthing & Wiring Boxes', '1', 'Available'],
      ['Demo Tech 08 (Balwinder Deol)', 'Illustrative focus: Off-Grid Systems & Batteries', '1', 'Standby'],
      ['Demo Tech 09 (Rohit Chawla)', 'Illustrative focus: Wiring Boxes & Switches', '0', 'Available'],
      ['Demo Tech 10 (Jasleen Grewal)', 'Illustrative focus: Power-Generation Testing', '0', 'Standby'],
      ['Demo Tech 11 (Kamaljeet Bhatia)', 'Illustrative focus: Metal Stands & Alignment', '0', 'Available'],
      ['Demo Tech 12 (Sandeep Virk)', 'Illustrative focus: Cable & Conduit Routing', '0', 'Available'],
      ['Demo Tech 13 (Tarun Khanna)', 'Illustrative focus: Small Factory Hookups', '0', 'Standby'],
      ['Demo Tech 14 (Deepinder Sidhu)', 'Illustrative focus: Inverter Configuration', '0', 'Available'],
      ['Demo Tech 15 (Rajat Bassi)', 'Illustrative focus: Commissioning Handover', '0', 'Available'],
    ],
  },
  warranties: {
    summary: 'Official warranty coverage starting strictly upon completed delivery date: Solar panels: 20 years; Inverter: 2 years; Battery: 2 years; Charge controller: Not specified in the official problem statement.',
    actionLabel: 'Record warranty update',
    columns: ['Customer', 'System', 'Completed Delivery Date', 'Official Coverage Terms', 'Expiry Date', 'Status'],
    rows: [
      ['Punjab Tool Works', '5.0 kW Off-Grid', '04 Nov 2026', 'Panels: 20y · Inverter: 2y · Battery: 2y (Charge controller: Not specified in official problem statement)', '04 Nov 2046 (Panels) / 04 Nov 2028 (Inv/Bat)', 'Active'],
      ['Golden Grain Processing', '5.0 kW On-Grid', '28 Oct 2026', 'Panels: 20y · Inverter: 2y (Charge controller: Not specified in official problem statement)', '28 Oct 2046 (Panels) / 28 Oct 2028 (Inverter)', 'Active'],
      ['Meera Kapoor', '3.0 kW On-Grid', '12 Nov 2026', 'Panels: 20y · Inverter: 2y (Charge controller: Not specified in official problem statement)', '12 Nov 2046 (Panels) / 12 Nov 2028 (Inverter)', 'Active'],
      ['Anil Verma', '3.6 kW Off-Grid', '02 Jan 2025', 'Panels: 20y · Inverter: 2y · Battery: 2y (Charge controller: Not specified in official problem statement)', '02 Jan 2045 (Panels) / 02 Jan 2027 (Inv/Bat)', 'Active'],
    ],
  },
  service: {
    summary: 'Support tickets for commissioned systems. Searchable by customer and serial number. Tickets remain open until customer confirms resolution.',
    actionLabel: 'Record service update',
    columns: ['Ticket ID', 'Customer & Category', 'System & Serial No.', 'Issue Description', 'Warranty Coverage', 'Status'],
    rows: [
      ['SR-318', 'Apex Auto (Small Factory)', '5.0 kW · SN-INV-5K-8812', 'Inverter alarm after sunset', 'Covered under 2-year inverter warranty (Free to customer)', 'Open'],
      ['SR-322', 'Meera Kapoor (Home)', '3.0 kW · SN-INV-3K-4109', 'Generation query after rain', 'Covered under 20-year panel warranty (Free to customer)', 'In progress'],
      ['SR-307', 'Golden Grain (Small Factory)', '5.0 kW · SN-INV-5K-7741', 'Non-warranty wiring extension', 'Non-covered service (Parts and labour charges calculate)', 'Scheduled'],
      ['SR-299', 'Punjab Tool Works (Small Factory)', '5.0 kW · SN-BAT-100-3301', 'Battery backup voltage check', 'Covered under 2-year battery warranty (Free to customer)', 'Open'],
    ],
  },
}

export const QUICK_ACTIONS = [
  {
    id: 'customer',
    label: 'Add Customer',
    detail: 'Register a Home or Small Factory lead',
    icon: 'customers',
  },
  {
    id: 'quotation',
    label: 'Create Quotation',
    detail: 'Draft 1 kW–5 kW On-Grid or Off-Grid quote',
    icon: 'quotations',
  },
  {
    id: 'installation',
    label: 'Schedule Installation',
    detail: 'Assign crew from 15 technicians (1–5 kW)',
    icon: 'installations',
  },
  {
    id: 'inventory',
    label: 'Add Inventory',
    detail: 'Record inverters, batteries, panels, kits',
    icon: 'inventory',
  },
]

export function calculateResidentialAverage(installations) {
  const residential = (installations || []).filter((item) => {
    const text = String(item.customer || '').toLowerCase()
    const cat = String(item.category || '').toLowerCase()
    return text.includes('(home)') || text.includes('home') || cat === 'home'
  })
  if (residential.length === 0) return 0
  const sum = residential.reduce((acc, item) => {
    const val = parseFloat(String(item.capacity).replace(/[^0-9.]/g, ''))
    return acc + (Number.isNaN(val) ? 0 : val)
  }, 0)
  return +(sum / residential.length).toFixed(2)
}

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

export function getBOMForSystem(capacityKw, packageType = 'On-Grid System') {
  const cap = Math.min(5.0, Math.max(1.0, Number(capacityKw) || 3.0))
  const panelCount = Math.ceil((cap * 1000) / 400) // 400W solar panels
  const isOffGrid = packageType.toLowerCase().includes('off-grid')
  const isPanelSetOnly = packageType.toLowerCase().includes('panel set')

  if (isPanelSetOnly) {
    return [
      { component: 'Solar Panels Set', spec: `${panelCount}x 400W Monocrystalline PV Panels (${cap} kW)`, type: 'Mandatory (Official Package)' },
      { component: 'Connectors', spec: 'Weatherproof MC4 & T-Branch Connectors', type: 'Mandatory (Official Package)' },
      { component: 'Wires', spec: 'UV-Resistant DC Solar Cable (4 sq mm / 6 sq mm)', type: 'Mandatory (Official Package)' },
      { component: 'Installation Service', spec: 'Fitting and testing at customer site (Unbundled)', type: 'Separate Service' },
    ]
  }

  const items = [
    { component: 'Solar Panels', spec: `${panelCount}x 400W Monocrystalline PV Panels (${cap} kW)`, type: 'Mandatory (Official Package)' },
    { component: 'Inverter', spec: `${cap} kW Pure Sine Wave Solar Inverter (Serial tracked, 2-yr warranty)`, type: 'Mandatory (Official Package)' },
    { component: 'Battery Charge Controller', spec: 'MPPT Solar Charge Controller (Serial tracked; Warranty: Not specified in official problem statement)', type: 'Mandatory (Official Package)' },
    { component: 'Wiring Boxes', spec: 'Weatherproof ACDB & DCDB Distribution Boxes with Isolator Switches & SPDs', type: 'Mandatory (Official Package)' },
    { component: 'Safety Earthing', spec: 'Chemical Grounding Rods & Copper Earth Bonding Wire', type: 'Mandatory (Official Package)' },
    { component: 'Metal Stands', spec: 'Corrosion-Resistant Galvanized Steel Mounting Structures', type: 'Mandatory (Official Package)' },
    { component: 'Connectors and Wires', spec: 'MC4 Pair Sets & High-Grade Copper Conductors', type: 'Mandatory (Official Package)' },
  ]

  if (isOffGrid) {
    items.push({
      component: 'Large Battery',
      spec: `${cap >= 4 ? '4x' : '2x'} High-Capacity Deep Cycle Solar Battery Bank (Serial tracked, 2-yr warranty)`,
      type: 'Mandatory (Off-Grid Requirement)',
    })
  }

  items.push({
    component: 'Installation Service',
    spec: 'On-site fitting, safety earthing check & power-generation testing (Unbundled separate service)',
    type: 'Separate Service',
  })

  return items
}

export const SERIAL_REGISTRY = {
  inverters: [
    { sn: 'SN-INV-3K-4109', capacity: '3.0 kW', model: 'GridTie-3000', warehouse: 'Ludhiana', assignedCustomer: 'Meera Kapoor (Home)', deliveryDate: '12 Nov 2026' },
    { sn: 'SN-INV-4K-5211', capacity: '4.0 kW', model: 'GridTie-4000', warehouse: 'Ludhiana', assignedCustomer: 'Rajesh Gupta (Home)', deliveryDate: '18 Nov 2026' },
    { sn: 'SN-INV-5K-8812', capacity: '5.0 kW', model: 'GridTie-5000', warehouse: 'Ludhiana', assignedCustomer: 'Apex Auto Components (Small Factory)', deliveryDate: '20 Nov 2026' },
    { sn: 'SN-INV-3K-9021', capacity: '3.6 kW', model: 'OffGrid-3600', warehouse: 'Jalandhar', assignedCustomer: null, deliveryDate: null },
    { sn: 'SN-INV-5K-7741', capacity: '5.0 kW', model: 'GridTie-5000', warehouse: 'Amritsar', assignedCustomer: 'Golden Grain Processing (Small Factory)', deliveryDate: '28 Oct 2026' },
  ],
  batteries: [
    { sn: 'SN-BAT-100-3301', capacity: '100 Ah 48V', model: 'PowerVault-DeepCycle', warehouse: 'Ludhiana', assignedCustomer: 'Punjab Tool Works (Small Factory)', deliveryDate: '04 Nov 2026' },
    { sn: 'SN-BAT-100-4412', capacity: '100 Ah 48V', model: 'PowerVault-DeepCycle', warehouse: 'Ludhiana', assignedCustomer: 'Anil Verma (Home)', deliveryDate: null },
    { sn: 'SN-BAT-200-8891', capacity: '200 Ah 48V', model: 'MegaVault-DeepCycle', warehouse: 'Jalandhar', assignedCustomer: null, deliveryDate: null },
  ],
  chargeControllers: [
    { sn: 'SN-CC-MPPT-104', rating: '60A MPPT', model: 'SolarTrack-Pro', warehouse: 'Ludhiana', assignedCustomer: 'Meera Kapoor (Home)', deliveryDate: '12 Nov 2026' },
    { sn: 'SN-CC-MPPT-205', rating: '80A MPPT', model: 'SolarTrack-Max', warehouse: 'Ludhiana', assignedCustomer: 'Rajesh Gupta (Home)', deliveryDate: '18 Nov 2026' },
    { sn: 'SN-CC-MPPT-309', rating: '100A MPPT', model: 'SolarTrack-Ultra', warehouse: 'Amritsar', assignedCustomer: 'Apex Auto Components (Small Factory)', deliveryDate: '20 Nov 2026' },
  ],
}

export const FINANCE_DATA = {
  kpis: {
    advanceCollected: '₹14,50,000',
    stockPurchases: '₹18,20,000',
    technicianPayroll: '₹3,75,000',
    invoicedRevenue: '₹28,80,000',
    subsidyPending: '₹4,60,000',
    grossMarginPercent: '24.2%',
  },
  timeframes: {
    today: {
      label: 'Today',
      advances: '₹1,40,000',
      stockPurchases: '₹75,000',
      technicianHours: '38 hrs logged',
      payrollExpense: '₹19,000',
      invoiced: '₹2,95,000',
      openRepairsCost: '₹4,700',
    },
    weekly: {
      label: 'Weekly',
      advances: '₹6,80,000',
      stockPurchases: '₹4,50,000',
      technicianHours: '280 hrs logged',
      payrollExpense: '₹1,40,000',
      invoiced: '₹12,40,000',
      openRepairsCost: '₹14,200',
    },
    monthly: {
      label: 'Monthly (~40 Benchmark)',
      advances: '₹14,50,000',
      stockPurchases: '₹18,20,000',
      technicianHours: '1,120 hrs logged',
      payrollExpense: '₹3,75,000',
      invoiced: '₹28,80,000',
      openRepairsCost: '₹28,500',
    },
  },
  invoices: [
    {
      id: 'INV-2026-081',
      customer: 'Meera Kapoor (Home)',
      quoteRef: 'QT-1011',
      system: '3.0 kW On-Grid',
      totalAmount: 185000,
      advancePaid: 92500,
      balanceDue: 92500,
      status: 'Paid in Full',
      subsidyPaperwork: 'Disbursed',
    },
    {
      id: 'INV-2026-085',
      customer: 'Rajesh Gupta (Home)',
      quoteRef: 'QT-1015',
      system: '4.0 kW On-Grid',
      totalAmount: 240000,
      advancePaid: 120000,
      balanceDue: 120000,
      status: 'Advance Paid',
      subsidyPaperwork: 'Approved (Disbursement Pending)',
    },
    {
      id: 'INV-2026-088',
      customer: 'Apex Auto Components (Small Factory)',
      quoteRef: 'QT-1022',
      system: '5.0 kW On-Grid',
      totalAmount: 295000,
      advancePaid: 147500,
      balanceDue: 147500,
      status: 'Advance Paid',
      subsidyPaperwork: 'Application Submitted',
    },
    {
      id: 'INV-2026-074',
      customer: 'Punjab Tool Works (Small Factory)',
      quoteRef: 'QT-1002',
      system: '5.0 kW Off-Grid',
      totalAmount: 340000,
      advancePaid: 170000,
      balanceDue: 170000,
      status: 'Paid in Full',
      subsidyPaperwork: 'Not Applicable (Off-Grid)',
    },
    {
      id: 'INV-2026-069',
      customer: 'Golden Grain Processing (Small Factory)',
      quoteRef: 'QT-0994',
      system: '5.0 kW On-Grid',
      totalAmount: 295000,
      advancePaid: 147500,
      balanceDue: 147500,
      status: 'Paid in Full',
      subsidyPaperwork: 'Disbursed',
    },
  ],
  subsidies: [
    { id: 'SUB-PB-991', customer: 'Meera Kapoor (Home)', capacity: '3.0 kW', portalStatus: 'Paperwork Approved & Disbursed', claimAmount: '₹78,000' },
    { id: 'SUB-PB-994', customer: 'Rajesh Gupta (Home)', capacity: '4.0 kW', portalStatus: 'Site Inspection Cleared · Awaiting Credit', claimAmount: '₹78,000' },
    { id: 'SUB-PB-998', customer: 'Apex Auto (Small Factory)', capacity: '5.0 kW', portalStatus: 'Application Documents Submitted', claimAmount: '₹78,000' },
    { id: 'SUB-PB-982', customer: 'Golden Grain Processing', capacity: '5.0 kW', portalStatus: 'Paperwork Approved & Disbursed', claimAmount: '₹78,000' },
  ],
  technicianPayroll: [
    { id: 'T01', name: 'Demo Tech 01 (Arjun Singh)', hoursLogged: 76, hourlyRate: 350, totalPay: 26600, status: 'Processed' },
    { id: 'T02', name: 'Demo Tech 02 (Simran Kaur)', hoursLogged: 82, hourlyRate: 350, totalPay: 28700, status: 'Processed' },
    { id: 'T03', name: 'Demo Tech 03 (Harpreet Gill)', hoursLogged: 74, hourlyRate: 350, totalPay: 25900, status: 'Processed' },
    { id: 'T04', name: 'Demo Tech 04 (Navjot Brar)', hoursLogged: 68, hourlyRate: 350, totalPay: 23800, status: 'Pending Approval' },
    { id: 'T05', name: 'Demo Tech 05 (Gurpreet Dhillon)', hoursLogged: 70, hourlyRate: 350, totalPay: 24500, status: 'Processed' },
    { id: 'T06', name: 'Demo Tech 06 (Amit Sharma)', hoursLogged: 78, hourlyRate: 350, totalPay: 27300, status: 'Processed' },
    { id: 'T07', name: 'Demo Tech 07 (Manpreet Vohra)', hoursLogged: 64, hourlyRate: 350, totalPay: 22400, status: 'Pending Approval' },
    { id: 'T08', name: 'Demo Tech 08 (Balwinder Deol)', hoursLogged: 60, hourlyRate: 350, totalPay: 21000, status: 'Pending Approval' },
  ],
  projectPnL: [
    {
      project: 'Meera Kapoor (Home)',
      capacity: '3.0 kW On-Grid',
      contractValue: 185000,
      materialCost: 112000,
      labourCost: 18500,
      otherExpense: 6500,
      netProfit: 48000,
      marginPercent: '25.9%',
      status: 'Completed Handover',
    },
    {
      project: 'Rajesh Gupta (Home)',
      capacity: '4.0 kW On-Grid',
      contractValue: 240000,
      materialCost: 148000,
      labourCost: 24000,
      otherExpense: 8200,
      netProfit: 59800,
      marginPercent: '24.9%',
      status: 'Ongoing Installation',
    },
    {
      project: 'Apex Auto Components (Small Factory)',
      capacity: '5.0 kW On-Grid',
      contractValue: 295000,
      materialCost: 184000,
      labourCost: 29500,
      otherExpense: 9500,
      netProfit: 72000,
      marginPercent: '24.4%',
      status: 'Ongoing Installation',
    },
    {
      project: 'Punjab Tool Works (Small Factory)',
      capacity: '5.0 kW Off-Grid',
      contractValue: 340000,
      materialCost: 228000,
      labourCost: 32000,
      otherExpense: 11000,
      netProfit: 69000,
      marginPercent: '20.3%',
      status: 'Completed Handover',
    },
    {
      project: 'Golden Grain Processing (Small Factory)',
      capacity: '5.0 kW On-Grid',
      contractValue: 295000,
      materialCost: 182000,
      labourCost: 28000,
      otherExpense: 9000,
      netProfit: 76000,
      marginPercent: '25.8%',
      status: 'Completed Handover',
    },
  ],
  operationalHealth: {
    unfinishedJobs: 2, // 2 ongoing jobs (Rajesh Gupta & Apex Auto)
    pendingVisits: 2, // SRV-107, SRV-108
    openRepairs: 3, // SR-318, SR-322, SR-299
    scheduledRepairs: 1, // SR-307
  },
}
