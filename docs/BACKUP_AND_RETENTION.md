# Backup and Retention

## Atlas Backup Strategy
- Enable automated snapshots (daily minimum).
- Enable PITR if cluster tier supports it.
- Retain backups for at least 30 days during beta.

## Restore Drill (Monthly)
1. Create temporary restore target in Atlas.
2. Restore latest snapshot to temporary cluster.
3. Connect staging backend to restored cluster.
4. Run smoke tests: auth, chat list, retention dry-run.
5. Record restore duration and issues.

## Retention Verification
- Dry run command:
  - POST /api/internal/retention/run?dryRun=true
  - Authorization: Bearer INTERNAL_JOB_TOKEN
- Actual run command:
  - POST /api/internal/retention/run?dryRun=false
  - Authorization: Bearer INTERNAL_JOB_TOKEN

## Evidence to Capture
- retention_cycle_complete structured log rows with:
  - trigger
  - retentionDays
  - eligibleCount
  - deletedCount
  - durationMs
- retention_cycle_failed rows if failures occur

## Compliance Notes
- Message content retention window is 7 days by default.
- Hard-delete path used for eligible records.
- Do not auto-delete user accounts; deletion is request-and-review flow.
- Keep only minimal audit metrics and never message plaintext in logs.
