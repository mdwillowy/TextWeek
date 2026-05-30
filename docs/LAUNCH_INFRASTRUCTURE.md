# Launch Infrastructure Plan

## Option Chosen
Option C:
- Frontend on Vercel
- Backend on Render
- MongoDB Atlas managed database

## Why this path
- Lowest operational overhead for solo founder
- Managed SSL and process restarts
- Simple rollback and environment management

## Environment Layout
- dev: local machine
- staging: optional mirrored env for final validation
- prod: real users

## Zero/Low Downtime Notes
- Deploy backend first and wait for /ready healthy.
- Deploy frontend second.
- Keep previous backend release ready for rollback.

## Secrets Handling
- Render secret env vars for backend.
- Vercel secret env vars for frontend.
- No secrets in repo or client bundle.
