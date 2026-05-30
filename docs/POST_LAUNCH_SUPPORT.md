# Post-Launch Support Plan

## First 72 Hours
- Hourly:
  - Check /ready uptime monitor status.
  - Check 5xx error-rate panel.
- Every 4 hours:
  - Review auth failure spikes.
  - Review message send error rates.
- Daily:
  - Confirm retention job success log entry.
  - Review abuse reports and blocklist actions.

## Daily Metrics to Review
- DAU
- Message send success rate
- Median latency and p95 latency
- Auth failure rate
- Abuse/report count

## Bug Triage Template
- Summary:
- Severity: critical/high/medium/low
- Impacted users:
- Repro steps:
- Request IDs / timestamps:
- Suspected component:
- Mitigation applied:
- Fix owner and ETA:
- Verification notes:

## Rollback Decision Framework
Rollback immediately if any condition is true:
- Sustained 5xx > 5% for 10 minutes
- Auth/login failure rate doubles baseline for 15 minutes
- Message send success < 95% for 10 minutes
- Ready endpoint unstable for > 2 minutes

Rollback process:
1. Disable new registrations.
2. Redeploy previous stable backend.
3. Verify /ready.
4. Run smoke checks for auth and chat.
5. Re-enable traffic gradually.
