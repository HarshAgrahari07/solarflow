# SunPower Solutions

Solar Installation Management System – Odoo x LPU Hackathon 2026.

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
npm install
npm run setup
npm run dev
```

Setup creates `server/.env`, initializes `server/data/sunpower.sqlite`, seeds
eight role-specific demo accounts, and generates a shared strong demo password
in the ignored `server/data/demo-credentials.txt` file. Do not copy that file
into source control. The password remains stable across repeat seed runs.

Useful backend commands (run from `server/`):

- `npm run db:init` initializes the SQLite schema.
- `npm run seed` creates or refreshes the demo accounts.
- `npm test` runs the API and authorization tests.
- `npm start` starts the API on port 4000.

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
public registration at `/register` creates CUSTOMER accounts only. The session
role is loaded from `/api/auth/me`; the browser never stores a JWT. ADMIN users
retain the existing demonstration dashboard and can create allowed internal
staff roles from **Staff Accounts**. Each staff role has separate navigation
and searchable, role-specific synthetic work queues. The finance workspace
includes illustrative invoices, advances, expenses, and project profitability;
other workspaces show relevant demonstration enquiries, surveys, inventory,
installations, warranty, and service records. These records are clearly marked
as synthetic and workflow actions are not persisted to a business API.

The customer portal shows the signed-in user's own profile and private empty
states for quotations, payments, order progress, installation, warranties, and
complaints. It does not expose other customers' synthetic records. Live
customer-specific project APIs, workflow persistence, staff time tracking,
commissioning submissions, and warehouse dispatch APIs are not connected yet.

Authentication endpoints:

- `POST /api/auth/login` and `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/register-customer` (`fullName`, `email`, `phone`, `address`, `password`)
- `POST /api/admin/users` (ADMIN only; supports SALES, SURVEYOR, WAREHOUSE, TECHNICIAN, SUPPORT, FINANCE)

The admin endpoint authorizes against the current database user, not a role sent
by the browser or a JWT role claim.
