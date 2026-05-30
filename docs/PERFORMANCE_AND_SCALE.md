# Performance and Scale Sanity

## Basic Load Tests (cost-aware)
Use autocannon from local machine against production or staging.

## Measured Local Baseline (April 2026)
- Endpoint: /ready
- Command: npx autocannon -c 10 -d 5 http://localhost:5050/ready
- Result summary:
	- Average latency: about 84ms
	- p99 latency: about 764ms
	- Average throughput: about 102 requests/second
	- Total requests in 5s: 521

### Health endpoint
- npx autocannon -c 20 -d 20 https://api.example.com/health

### Auth login endpoint
- npx autocannon -c 10 -d 20 -m POST -H "content-type: application/json" -b '{"username":"seed_user","password":"Password123"}' https://api.example.com/api/auth/login

### Chat list endpoint
- npx autocannon -c 10 -d 20 -H "authorization: Bearer ACCESS_TOKEN" https://api.example.com/api/chats

### Message send endpoint
- npx autocannon -c 5 -d 20 -m POST -H "content-type: application/json" -H "authorization: Bearer ACCESS_TOKEN" -b '{"text":"load test message"}' https://api.example.com/api/chats/CHAT_ID/messages

## Websocket Beta Target
- Initial target: 100-300 concurrent socket connections on single instance.
- If growth exceeds this, plan Redis socket adapter and sticky sessions.

## Index Verification Quick List
- User: username unique index
- Follow: (follower, following) unique index
- Chat: participantKey unique index, lastMessageAt index
- Message: (chat, createdAt) index
- Message: encryptionMode index
- KeyBundle: user unique index

## Slow Query Checks
- In Atlas, monitor slow queries and scan for high COLLSCAN rates.
- Confirm pagination queries on messages use chat + createdAt index path.

## Quick Wins
- Add API response caching only for public/static resources, not chat payloads.
- Keep pagination limits tight (already bounded).
- Move to Redis for presence state if multi-instance socket scaling starts.
- Keep retention jobs in separate worker process for larger traffic.

## Caveats for Horizontal Scaling
- Socket.IO requires sticky sessions or shared adapter.
- In-memory dedupe/presence state should move to Redis before multi-instance rollout.
