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
