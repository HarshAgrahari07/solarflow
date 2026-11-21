# Copilot Development Instructions

Follow these project rules for all SunPower Solutions development work.

## 1. Source of truth

Use the official Solar Installation Management System problem statement as the source of truth for business requirements.

## 2. Incremental development

Build one complete functional feature or module at a time. Preserve previously working functionality.

## 3. Testing

After each completed milestone:

- Run relevant backend tests.
- Run frontend lint.
- Run the production build.
- Fix errors before committing.

Avoid repeating full-project audits unnecessarily.

## 4. Development log

Maintain `CHANGELOG.md` at the repository root. For every completed milestone, record:

- Date.
- Feature implemented.
- Important files changed.
- Tests passed.
- Known limitations.

Do not claim incomplete features are completed.

## 5. GitHub commits

After each independently working milestone:

- Review the Git diff.
- Check for secrets and sensitive files.
- Check `.gitignore`.
- Stage only intended project files.
- Create a descriptive commit, preferably using `feat(module): description`, `fix(module): description`, `docs: description`, or `test(module): description`.
- Push the completed milestone to `origin/main` only when explicitly approved and the branch safety requirements below are satisfied.

## 6. Branch safety

Push directly to `main` only when the current branch is `main` and is synchronized with `origin/main`. If working on another branch, do not force-push, reset, delete branches, or merge automatically. Report the branch and request the proper integration workflow.

## 7. Security

Never commit:

- `.env` files.
- Passwords or JWT secrets.
- Demo credential files.
- SQLite database files.
- `node_modules`.
- `dist` build output.
- Private customer information.

Check `.gitignore` before every commit.

## 8. Git safety

Never force-push or discard uncommitted changes. Never delete an index lock without first checking that no Git process is running and obtaining authorization.

## 9. Commit frequency

Commit after each completed meaningful feature, not after every individual file edit or command. Do not wait until an entire phase is finished.

## 10. Documentation

Keep `README.md` updated as major application capabilities become functional.
