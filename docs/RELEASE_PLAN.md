# Release Plan

## Deployment Path Chosen
Option C: frontend on Vercel, backend on Render, MongoDB Atlas.

## Environments
- dev: local machine
- staging: optional clone service + test DB
- production: public beta users

## Phase 0: Internal Testing
- Test accounts only.
- ENABLE_NEW_REGISTRATIONS=false
- Verify runbook drills and retention trigger endpoint.

## Phase 1: Closed Beta (20-100 users)
- Enable registrations by invite process.
- Keep strict rate limits.
- Daily monitor review and triage.

## Phase 2: Wider Invite Rollout
- Increase registration flow and monitor p95 latency.
- Tune rate limits and DB indexes as usage grows.

## Kill Switch Controls
- Disable registrations: ENABLE_NEW_REGISTRATIONS=false
- Disable read receipts: FEATURE_READ_RECEIPTS=false
- Disable online status: FEATURE_ONLINE_STATUS=false
- Disable encrypted mode: FEATURE_E2EE=false

## Go/No-Go Gates
- All backend tests pass.
- Frontend build passes.
- /health and /ready pass in production.
- SECURITY_CHECKLIST.md all critical controls marked Pass.
- Legal pages reachable from landing/auth screens.
- Retention dry-run and actual run validated.

## Rollback Plan
1. Keep previous stable backend deployment available.
2. Redeploy previous backend image/version.
3. Keep database unchanged unless migration rollback is required.
4. Re-validate auth + chat smoke tests.
5. Re-open traffic after stable 15-minute observation.
