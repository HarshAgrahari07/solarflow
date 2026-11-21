# Changelog

## 2026-11-22 — Development policy documentation

- **Feature implemented:** Added repository development instructions and established the milestone changelog.
- **Important files changed:** `.github/copilot-instructions.md`, `CHANGELOG.md`.
- **Tests passed:** Not run; documentation-only change.
- **Known limitations:** None. Application functionality was not changed.

## 2026-11-22 — Authentication integration and role-based workspaces

- **Feature implemented:** Connected the React client to cookie-based authentication, restored sessions through `/api/auth/me`, added customer registration and an own-profile customer portal, role-scoped staff workspaces, and an administrator staff-account workflow. Added an admin-only staff creation API and persisted customer phone/address fields.
- **Important files changed:** `client/src/App.jsx`, `client/src/auth/`, `client/src/components/`, `client/src/data/demoData.js`, `server/src/app.js`, `server/src/database/`, `server/src/routes/`, `server/src/controllers/`, `server/src/services/`, `server/src/validation/`, `server/test/auth.test.js`, `README.md`.
- **Tests passed:** Backend tests 13/13; frontend lint; frontend production build. Browser-validated customer registration, login, refresh restoration, logout, role-restricted navigation, and admin staff creation.
- **Known limitations:** Staff workflow pages are preparation views; live business APIs and live workflow statistics are not connected. The customer portal shows only the authenticated account profile until customer-specific project APIs are implemented. The existing administrator dashboard continues to use clearly labeled synthetic demonstration data.

## 2026-11-22 — Expanded role dashboards and access regression tests

- **Feature implemented:** Added searchable, role-specific synthetic work queues and dashboard metrics for Sales, Surveyor, Warehouse, Technician, Support, and Finance; expanded the customer portal with private empty states; added the requested admin operational and financial KPI cards; added session-restoration skeletons; centralized frontend navigation checks; and covered inactive accounts, own-profile responses, and staff-creation authorization.
- **Important files changed:** `client/src/App.jsx`, `client/src/App.css`, `client/src/AuthPages.css`, `client/src/auth/roleAccess.js`, `client/src/components/RoleWorkspace.jsx`, `client/src/components/CustomerPortal.jsx`, `client/src/components/TopBar.jsx`, `client/src/data/demoData.js`, `client/test/roleAccess.test.js`, `client/package.json`, `server/src/auth/rolePermissions.js`, `server/src/middleware/authenticate.js`, `server/src/routes/admin.js`, `server/test/auth.test.js`, `README.md`.
- **Tests passed:** Backend tests 15/15; frontend role-access tests 2/2; frontend lint; frontend production build; `git diff --check`.
- **Known limitations:** Workflow queues, dashboard figures, serials, and financial data remain synthetic and read-only; business-record APIs and durable workflow actions are not present. Customer-specific quotations, payments, installations, warranty and complaint records therefore remain private empty states. Scoped backend permission middleware is covered by tests, but finance, warehouse and survey business API routes do not exist yet; internal staff creation is server-enforced as ADMIN-only.
