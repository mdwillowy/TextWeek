# Iteration 4.1 Delta

## Purpose
Stabilize and harden Week 4 implementation by closing consistency gaps discovered in full-audit validation.

## Changes Included
- Deterministic follow idempotency check before relation creation.
- Added backend encryption metadata helper service:
  - shared normalization/validation for REST + socket message send paths.
- Added frontend session security control:
  - Logout all sessions button on settings page.
- Extended auth integration test:
  - verifies refresh token becomes invalid after logout-all.

## Validation
- Backend tests: pass
- Frontend production build: pass
- Workspace diagnostics: no errors

## Why this matters
- Reduces behavior drift between REST and socket message paths.
- Prevents index-timing edge cases from breaking idempotent follow behavior.
- Makes session hardening usable by end users, not only API clients.
