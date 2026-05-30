# TextWeek MVP (Weeks 1-4)

MERN social messaging app with auth, profiles, follow system, direct chat, realtime Socket.IO, baseline E2EE path, weekly retention deletion, moderation scaffolding, settings/privacy controls, and operational readiness basics.

## Stack
- Frontend: React + Vite + CSS
- Backend: Node.js + Express + Mongoose + Socket.IO
- Database: MongoDB Atlas (or local MongoDB)
- Media storage: Cloudinary (images)
- Crypto: Browser Web Crypto APIs (no custom primitives)

## Project Structure
- `backend/` API, models, sockets, jobs, services, tests
- `frontend/` React app
- `docs/` deployment and QA docs
- `frontend/vercel.json` SPA rewrites for Vercel

## Install and Run
### Backend
```bash
cd backend
npm ci
npm run dev
```

### Frontend
```bash
cd frontend
npm ci
npm run dev
```

### Tests (backend critical paths)
```bash
cd backend
npm test
```

## Monolithic Deployment (Render)
- The backend serves the Vite build in production from `frontend/dist`.
- Build the frontend during deployment and ensure `NODE_ENV=production`.
- API routes (`/api/*`) are registered before the SPA catch-all.

## Local vs Render Environments
- Render runs its own copy of your code in the cloud.
- Your Mac runs a separate local copy.
- Both can run at the same time and point to the same Atlas/Cloudinary accounts.
- Use separate env configs if you want to avoid mixing test data with production.

## Health and Readiness
- `GET /health`
- `GET /ready`

## Security Model (MVP)
- JWT access + refresh cookie flow
- Refresh token rotation and per-user refresh-session tracking
- Logout-all sessions endpoint with refresh-session revocation
- Helmet + strict CORS allowlist + request-size limits
- Request ID + structured logs with redaction safeguards
- Input sanitization and route-level validation
- Rate limits: auth, messaging, follow/search, moderation reports
- Blocklist and abuse report scaffolding
- Centralized encryption payload normalization on backend (metadata only, no decryption)
- Chat media uses Cloudinary URLs and is not E2EE (text-only E2EE for encrypted chats)
- Admin-only endpoints guarded by role checks

## Media Storage (Cloudinary)
- Avatar and chat image uploads are stored in Cloudinary; MongoDB stores the public HTTPS URL.
- When a user uploads a new avatar, the old Cloudinary image is deleted automatically.
- Encrypted chats block image attachments.

### Required Backend Env Vars
```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## E2EE Path (MVP)
For direct chats with encryption enabled:
- Sender encrypts message client-side using Web Crypto (ECDH + HKDF + AES-GCM).
- Server stores ciphertext fields + key metadata only.
- Receiver decrypts client-side.

Server stores key bundles (public material only):
- identity public key
- signed prekey public key/signature
- one-time prekeys (public)

### Security Limitations (Explicit)
- This is not full Signal protocol parity yet.
- No complete Double Ratchet implementation across all session states.
- No full multi-device secure key synchronization.
- Prekey lifecycle exists (upload/rotate endpoint), but advanced exhaustion/replenishment and trust verification UX are limited.
- Metadata (participant IDs, timestamps, delivery/read signals) remains visible to server.
- Image attachments are not E2EE.

## Presence (Socket.IO)
- Online/offline state is driven strictly by socket connect/disconnect.
- Multi-tab safe: a user stays online while any socket remains open.
- Presence updates are broadcast with `presence:update`.

## Data Retention & Deletion
- Daily retention job enforces 7-day message window (configurable via `RETENTION_DAYS`).
- Hard delete only (no soft-delete fallback for retained message data).
- Internal endpoint for dry-run and actual execution:
  - `POST /api/internal/retention/run?dryRun=true|false`
  - `Authorization: Bearer <INTERNAL_JOB_TOKEN>`

## Settings
Route: `/settings`
- Read receipts toggle
- Show online status toggle
- Theme mode toggle (light/dark/system)
- Session security: logout all sessions
- Account deletion request flow with password confirmation
- Privacy explainer text

## Moderation / Safety Baseline
- Report user endpoint scaffold
- User block/unblock/list endpoints scaffold
- Block rules enforced for direct chat open/send paths
- Admin reports endpoint: `GET /api/admin/reports`
- Admin reports are paginated and rate-limited
- Admin report access is logged to the server console (audit log)

## Admin Access
- User role field: `role` (`user` or `admin`).
- Admin dashboard route: `/admin` (UI access for admins only).
- Admin dashboard is available from the Home topbar and opens in the dashboard modal.

## Incident Response Basics
1. Identify active issue via structured logs and request IDs.
2. Validate service health (`/health`) and dependency readiness (`/ready`).
3. Contain abuse via rate-limit tightening / temporary origin restrictions.
4. Rotate auth secrets if token compromise suspected.
5. Communicate impact and recovery timeline.

## Post-MVP Roadmap
- Group chats with secure sender-key strategy
- Media attachments with encrypted object storage path
- Full multi-device key management and trust verification UX
- Complete Double Ratchet/session healing
- Admin moderation panel + case workflow + audit tooling

## Additional Docs
- Deployment: `docs/DEPLOYMENT.md`
- Manual QA checklist: `docs/QA_CHECKLIST.md`
- Production env examples:
  - `backend/.env.production.example`
  - `frontend/.env.production.example`
