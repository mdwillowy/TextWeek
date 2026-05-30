# Runbook

## Monitoring Baseline
- Health endpoints:
  - GET /health
  - GET /ready
- Uptime monitors:
  - Better Stack or UptimeRobot every 60 seconds for /ready
  - Alert on 2 consecutive failures
- Error monitoring placeholder:
  - Add Sentry DSN in backend and frontend when moving from beta to wider rollout

## Alert Thresholds
- High error rate: 5xx > 3% for 5 minutes
- High latency: p95 > 800ms for 10 minutes
- Retention job failure: any failed run or 0 successful runs in 24 hours
- DB instability: reconnect loops or ready endpoint failures > 2 minutes

## Incident: Service Down
1. Check /ready from monitor and terminal curl.
2. Check backend logs for crash reason and request IDs.
3. Verify process is running and port bound.
4. Roll back to previous deployment if crash caused by latest release.
5. Confirm /ready is healthy before re-opening traffic.

## Incident: Database Issue
1. Verify Atlas cluster status and connection limits.
2. Test Atlas connectivity from backend host.
3. Temporarily reduce non-critical traffic by disabling new registrations.
4. If incident persists, fail over according to Atlas tier features.
5. Run smoke tests: auth login, chat list, send message.

## Incident: Token Abuse
1. Set ENABLE_NEW_REGISTRATIONS=false.
2. Rotate JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.
3. Force logout-all by clearing refresh sessions for affected users.
4. Tighten RATE_LIMIT_AUTH_MAX temporarily.
5. Review suspicious IP ranges and block at host/CDN layer.

## Incident: Websocket Outage
1. Validate backend HTTP health first.
2. Check socket CORS origin config and token auth errors.
3. Verify sticky-session requirements if scaled beyond single instance.
4. Fallback: keep REST message sending path available.
5. Post-incident: review socket connect/disconnect error logs.

## First 72 Hours Checklist
- Every 2 hours: verify /ready and error-rate dashboard.
- Twice daily: inspect auth failure spikes.
- Daily: validate retention job run log row exists.
- Daily: review abuse reports and blocklist activity.
