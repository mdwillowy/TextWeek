# Deployment Guide (Launch Week)

## Chosen Path
Option C for low-cost controlled launch:
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Domain and TLS
1. Create app domain: app.example.com -> Vercel.
2. Create api domain: api.example.com -> Render.
3. Use managed SSL certificates on both hosts.

## Backend on Render
Config file:
- deploy/render-backend.yaml

Steps:
1. Push repository to GitHub.
2. In Render, create service from Blueprint and select repository.
3. Confirm rootDir is backend and healthCheckPath is /ready.
4. Set secrets in Render environment:
  - DATABASE_URL
  - JWT_ACCESS_SECRET
  - JWT_REFRESH_SECRET
  - INTERNAL_JOB_TOKEN
  - CORS_ALLOWED_ORIGINS=https://app.example.com
  - SOCKET_CORS_ORIGIN=https://app.example.com
5. Deploy.
6. Verify endpoints:
  - https://api.example.com/health
  - https://api.example.com/ready

## Frontend on Vercel
Steps:
1. Open frontend directory in Vercel project setup.
2. Set environment variable:
  - VITE_API_BASE_URL=https://api.example.com/api
3. Ensure SPA rewrites are configured so deep links (e.g. /chat/:chatId) do not 404.
   - This repo includes frontend/vercel.json with a catch-all rewrite to index.html.
4. Deploy production.

CLI alternative:
1. npm i -g vercel
2. cd frontend
3. vercel
4. vercel --prod

## Environment Segregation
- development: local env and local DB/dev Atlas
- staging: separate frontend/backend services and separate Atlas database
- production: separate service instances and production-only secrets

## Secrets Strategy
- Never commit secrets.
- Store secrets only in Render and Vercel environment settings.
- Rotate JWT secrets and INTERNAL_JOB_TOKEN on incident.

## Uploads Privacy Note
- Uploads are served through authenticated routes (not public).
- Users must be logged in to view avatars or chat image attachments.

## Restart and Downtime Strategy
- Render process manager handles restarts automatically.
- Low downtime deploy by releasing backend first, frontend second.
- Keep previous stable backend deploy ready for rollback.

## Ordered Terminal Commands
1. cd /Users/mdwillowy/Desktop/Coding/TextWeek/backend
2. npm ci
3. npm test
4. cd /Users/mdwillowy/Desktop/Coding/TextWeek/frontend
5. npm ci
6. npm run build
7. git add .
8. git commit -m "launch-week rollout prep"
9. git push origin main
10. trigger Render deploy
11. trigger Vercel deploy
12. curl https://api.example.com/ready

## Atlas Production Checklist
- Dedicated production project and cluster
- Least-privilege DB user
- Snapshot backups enabled
- Slow query monitor enabled
- IP/access policy reviewed regularly
