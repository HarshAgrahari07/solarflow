# SunPower Solutions

Solar Installation Management System – Odoo x LPU Hackathon 2026.

The official operational requirements are maintained in
[`docs/requirements/Solar_Installation_Management_System.pdf`](./docs/requirements/Solar_Installation_Management_System.pdf).
For Railway deployment, environment variables, persistent storage, admin
provisioning, backups, and troubleshooting, see
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Overview
Management platform tailored for **SunPower Solutions** (~40 rooftop projects per month benchmark scale, 15-person technician crew, residential and small factory installations).

- **System Capacity Scope**: Strictly 1 kW to 5 kW inclusive (On-Grid & Off-Grid).
- **Mandatory Package Components**:
  - **Solar Panel Set**: Solar panels, connectors, and wires.
  - **On-Grid System**: Inverter, wiring boxes, battery charge controller, solar panels, safety earthing, and metal stands.
  - **Off-Grid System**: All On-Grid components + large battery storage bank.
  - **Installation Service**: Separate service for fitting and testing at the customer site.
  - *(Note: Technical specifics such as MC4 connectors, ACDB/DCDB, isolators, and SPDs are illustrative electrical engineering examples and not PDF mandates).*
- **Warranties**:
  - Solar Panels: 20 years
  - Inverter: 2 years
  - Battery: 2 years
  - Charge Controller: Not specified in the official problem statement.
  - Warranty begins strictly upon completed delivery date.
- **Demonstration Data**: All displayed records and technician profiles are synthetic demonstration data representing the company's operating scale for evaluation purposes.

## Local backend and authentication

The Express API is in `server/`; the existing React dashboard remains in `client/`.
Node.js 26 is required.

From the repository root, initialize the local backend and generated demonstration
accounts:

```powershell
cd server
npm ci
npm run setup
npm run dev
```

`npm run setup` is a local-development command. It creates `server/.env`,
initializes `server/data/sunpower.sqlite`, seeds eight role-specific demo
accounts, and writes their generated shared password to the ignored
`server/data/demo-credentials.txt` file. Do not copy that file into source
control. The password remains stable across repeat seed runs.

Useful backend commands (run from `server/`):

- `npm run db:init` applies pending, versioned SQLite migrations.
- `npm run db:seed` applies migrations and inserts idempotent synthetic business workflow records without changing users.
- `npm run seed` creates or refreshes the demo accounts.
- `npm run admin:create -- --email admin@example.com` provisions an initial administrator; its generated password is saved under `DATA_DIR/initial-admin-credentials.txt`.
- `npm test` runs the API and authorization tests.
- `npm start` starts the API on port 4000.

Production runs as a single service: Express serves both the built React app
and `/api/*`. The root `Dockerfile` builds the client and starts the server;
Railway configuration and the exact persistent-volume settings are documented
in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

The relational workflow schema and authenticated APIs cover the CRM, surveys,
quotations, orders, payments, inventory, dispatch, installations, warranties,
service, and finance. Admin, Sales, Surveyor, Warehouse, Technician, Support,
Finance, and Customer workspaces are connected to records and actions permitted
for their role. The Admin KPI overview and explicitly marked demo records remain
synthetic. See the [database model and operations guide](./docs/DATA_MODEL.md)
for relationships, API scope, migration/seed instructions, file storage, and
backup/restore guidance.

The demo accounts are `admin@sunpower.demo`, `sales@sunpower.demo`,
`surveyor@sunpower.demo`, `warehouse@sunpower.demo`,
`technician@sunpower.demo`, `support@sunpower.demo`,
`finance@sunpower.demo`, and `customer@sunpower.demo`. Use the generated
password in `server/data/demo-credentials.txt`.

The API can be checked with `Invoke-RestMethod http://localhost:4000/api/health`.
For cookie-based login testing in PowerShell:

```powershell
$body = @{ email = 'admin@sunpower.demo'; password = '<local demo password>' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method Post `
  -ContentType 'application/json' -Body $body -SessionVariable sunpowerSession
Invoke-RestMethod -Uri http://localhost:4000/api/auth/me -WebSession $sunpowerSession
Invoke-WebRequest -Uri http://localhost:4000/api/auth/logout -Method Post -WebSession $sunpowerSession
```

The Vite development server proxies `/api` requests to the backend on port 4000.
Run `npm test`, `npm run lint`, and `npm run build` from `client/` to verify the
role-access configuration and frontend.

## Run the authenticated application

Start the API in one terminal:

```powershell
cd server
npm run dev
```

Start the React application in a second terminal:

```powershell
cd client
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Sign-in is at `/login`;
public registration at `/register` creates a CUSTOMER account and a linked,
persistent CRM profile. Registration accepts only Home or Small Factory, one
On-Grid or Off-Grid connection preference, and a required 1–5 kW capacity.
Solar Panel Set is a configurable package template, not a connection preference.
The session role is loaded from `/api/auth/me`; the browser never stores a JWT. ADMIN users
retain the existing demonstration dashboard and can create allowed internal
staff roles from **Staff Accounts**. Each staff role has separate navigation.
The Admin overview still contains synthetic operating-scale metrics; role
workspaces use the persistent APIs described below. Seeded demo records are
visibly synthetic and are kept separate from newly created operational records.

**Customers & Leads** is backed by SQLite: ADMIN and SALES can create and edit
customer profiles, track the New, Contacted, Qualified, Survey Pending,
Quotation, Converted, and Lost stages, record lead sources and notes, assign
Sales owners, and schedule, reassign, and complete follow-ups. The directory
supports search, category/stage/owner filters, sorting, and pagination.
Synthetic records are explicitly labelled and can be filtered separately;
live customer records are the default. New records require Home or Small
Factory, an On-Grid or Off-Grid preference, and a 1–5 kW capacity. Sales users
see unassigned leads and leads assigned to them. Public registration links to
an existing unlinked lead with the same email instead of creating a duplicate
CRM record.

The customer portal loads and edits only the signed-in user's linked profile.
It does not expose other customers' information. It also shows the customer's
own quotations, order/payment balance summary, installation schedule and
handover, warranties, and service requests. Customers can submit service
requests, record installation sign-off notes, and confirm or reopen service
resolutions. Linked customer accounts cannot be archived; unlinked leads can
be archived by ADMIN.

Authentication endpoints:

- `POST /api/auth/login` and `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/register-customer` (`fullName`, `email`, `phone`, `address`, `category`, `solarRequirement`, `capacityKw`, `password`)
- `POST /api/admin/users` (ADMIN only; supports SALES, SURVEYOR, WAREHOUSE, TECHNICIAN, SUPPORT, FINANCE)

CRM endpoints:

- `GET /api/customers` (ADMIN/SALES; supports `search`, `category`, `leadStatus`, `assignedTo`, `recordType`, `sortBy`, `sortOrder`, `page`, `pageSize`, and ADMIN-only `includeArchived`)
- `POST /api/customers` (ADMIN/SALES)
- `GET /api/customers/:customerId` (ADMIN/SALES or the owning CUSTOMER)
- `PATCH /api/customers/:customerId` (ADMIN/SALES)
- `DELETE /api/customers/:customerId` (ADMIN; archives unlinked leads only)
- `GET` and `PATCH /api/customers/me` (the signed-in CUSTOMER's own profile)
- `GET` and `POST /api/customers/:customerId/follow-ups`; `PATCH /api/customers/:customerId/follow-ups/:followUpId` (ADMIN/SALES with ownership/assignment checks)

Lead categories are restricted to `Home` and `Small Factory`; new solar system
capacity is required and must be 1–5 kW inclusive. Customer, lead, and
follow-up records are migrated and persisted in SQLite. Existing customer
accounts are backfilled with their stored contact profile; category and system
requirements stay unset until the customer or staff supplies them.

## Roof surveys and quotations

The Admin and Sales survey screens create and reschedule appointments linked
to valid CRM customers and active Surveyor accounts. Surveyors see only their
assigned visits, record initial qualification and physical roof measurements,
save drafts, upload site photographs, and submit findings. Admins review
submitted findings and photographs, then approve, reject, or request
corrections with a reason; the reviewer and decision history are persisted.
The customer portal lists only surveys linked to the signed-in customer.

Photographs are limited to JPEG, PNG, or WebP up to 5 MB and are written
through managed filesystem storage. The database stores metadata and a
server-generated storage key, not image content or unrestricted paths.
`FILE_STORAGE_PATH` optionally configures the storage root; the default is
`server/data/uploads/`. The directory is ignored by Git and must be backed up
separately from SQLite when photograph retention is required.

Sales and Admin can create quotation drafts from approved surveys and
configurable package templates. The quotation API rejects release before
survey approval, with a SQLite trigger providing a second enforcement layer.
The quotation editor supports versioned, priced line items and customer
acceptance or rejection after release; accepted quotations can be converted to
orders. The quote workflow does not invent prices or fixed component
quantities.

Survey endpoints:

- `GET /api/surveys` and `GET /api/surveys/:surveyId` (role- and record-scoped)
- `GET /api/surveys/surveyors` (ADMIN/SALES)
- `POST /api/surveys` and `PATCH /api/surveys/:surveyId/schedule` (ADMIN/SALES)
- `PATCH /api/surveys/:surveyId` (assigned Surveyor draft findings)
- `POST /api/surveys/:surveyId/photos` and `GET /api/surveys/:surveyId/photos/:photoId` (validated upload and authorized retrieval)
- `POST /api/surveys/:surveyId/submit` and `POST /api/surveys/:surveyId/review`
- `PATCH /api/surveys/:surveyId/status` (assigned Surveyor visit start or permitted cancellation)
- `GET /api/quotations` (ADMIN/SALES or the owning CUSTOMER), `GET /api/quotations/:quoteId`, and `POST /api/quotations/:quoteId/respond` (CUSTOMER)
- `GET /api/quotations/options`, `POST /api/quotations`, `PUT /api/quotations/:quoteId/items`, and `PATCH /api/quotations/:quoteId/status` (ADMIN/SALES)
- `PUT /api/quotations/templates/:templateId` (ADMIN)

## Orders, inventory, installation, service, and finance

Accepted quotations can be converted into persistent orders. Admin confirms
orders, after which dispatch and installation records are created. Finance or
Admin can record payments against configured quotation balances. Warehouse
staff can receive stock, create/receive stock purchases, assign dispatches to
warehouses, reserve mapped BOM items, verify dispatch-specific serials, and
record delivery. Delivery starts the applicable product warranties.

Admins schedule confirmed installation jobs and assign active technicians.
Assigned technicians update checklists, record time, save commissioning test
results, and complete eligible jobs. Customers can see their own job and submit
textual installation sign-off notes. Support can search delivered equipment,
assign and resolve service tickets, and validate warranty coverage. Customers
can create tickets for their own records and confirm or reopen resolutions.

Finance can issue invoices, record expenses and technician payroll, create
stock purchase orders, and review project cost-completeness and profitability
reports. Amounts, prices, costs, and operational measurements are user-entered
or synthetic; none are presented as official prices, wages, or company results.

Operational API routes are under `/api/operations`:

- Orders/payments: `/orders`, `/orders/:orderId`, `/orders/:orderId/confirm`, and `/orders/:orderId/payments`.
- Inventory/dispatch: `/inventory`, `/inventory/receipts`, `/dispatches`, `/dispatches/:dispatchId/warehouse`, `/dispatches/:dispatchId/serials`, and `/dispatches/:dispatchId/status`.
- Installation: `/installations`, `/installations/:jobId`, scheduling, start, checklist, time-log, commissioning, sign-off, and completion routes.
- Service: `/service-tickets`, assignment, resolution, customer confirmation, and `/serials/:serialNumber`.
- Finance: `/finance/report`, `/finance/expenses`, `/finance/payroll`, `/finance/invoices`, and `/finance/purchases` with their create, update, and receive routes.
- Customer-scoped summary: `/customer-records` (CUSTOMER only).

Role middleware and service-level record checks enforce staff assignment and
customer ownership; the frontend is not the security boundary. Survey and
quotation records persist from migration 7. Migration 8 adds quotation response
and revision history, inventory reorder levels, component product mappings,
commissioning/service fields, and full-payment checks. Migration 9 corrects
stock-balance updates for reservation movements.

Remaining limitations: subsidy case/document tables are present but do not
have operational APIs or a dedicated UI. Installation sign-off stores
authenticated customer notes and a timestamp, not a captured signature.
Customer orders show paid and outstanding totals rather than a detailed
payment transaction ledger. Survey photographs use local managed filesystem
storage and require a separately backed-up storage directory.

The admin endpoint authorizes against the current database user, not a role sent
by the browser or a JWT role claim.
