# Manual QA Checklist (Week 4 MVP)

## Setup
- Run backend: `cd backend && npm run dev`
- Run frontend: `cd frontend && npm run dev`
- Use two users in two different browsers (or normal + incognito).

## 1) Two-user encrypted chat path
- Create/open direct chat between User A and User B.
- Enable encryption for the chat.
- Send messages both directions.
- Expected:
  - sender leaves pending state and gets ack,
  - receiver gets message in realtime,
  - server stores encrypted fields (`encryptionMode=e2ee`, `encryptedPayload`, `nonce`, `aad`, `keyInfo`) and not plaintext.

## 2) Plaintext fallback path
- Disable encryption in direct chat.
- Send message from A to B.
- Expected:
  - message appears immediately,
  - `encryptionMode=plain`, `text` populated,
  - no decrypt errors in UI.

## 3) Weekly deletion simulation
- Trigger dry run:
  - `POST /api/internal/retention/run?dryRun=true`
  - Header: `Authorization: Bearer <INTERNAL_JOB_TOKEN>`
- Trigger actual run:
  - `POST /api/internal/retention/run?dryRun=false`
- Expected:
  - response includes eligible/deleted counts and duration,
  - only messages older than retention window (or expired) are removed.

## 4) Read receipts toggle behavior
- Turn OFF read receipts in settings for User A.
- User A reads unread messages from User B.
- Expected:
  - messages are marked read for A internally,
  - B does not receive read-receipt update events.
- Turn ON read receipts and repeat.
- Expected:
  - B receives read-receipt updates.

## 5) Online visibility toggle behavior
- Turn OFF "Show Online Status" for User A.
- Reconnect A socket and search from User B.
- Expected:
  - A appears offline / no last seen in public presence surfaces.
- Turn ON and verify online status appears again.

## 6) Account deletion request flow
- Go to settings danger zone.
- Submit wrong password.
- Expected: 401 error.
- Submit correct password.
- Expected:
  - request succeeds,
  - `deletionRequestedAt` set for user.

## 7) Abuse report + blocklist baseline
- A blocks B via moderation API.
- Expected:
  - direct chat create blocked,
  - send message blocked if chat already exists.
- A unblocks B and retest.
- Expected: chat and message operations work again.
