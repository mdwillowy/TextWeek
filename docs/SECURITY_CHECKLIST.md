# Security Checklist

| Item | Status | Notes |
|---|---|---|
| Helmet enabled with strict defaults | Pass | Configured in backend app bootstrap |
| CORS exact allowlist (no wildcard) | Pass | Uses explicit origins from env |
| Secure cookie strategy for production | Pass | httpOnly + secure + sameSite from env |
| Access/refresh token separation | Pass | Access token bearer, refresh cookie |
| Refresh rotation and revocation | Pass | Rotation on refresh + logout-all revocation |
| Request size limits | Pass | JSON and URL encoded limits from env |
| Route-level rate limits | Pass | Auth, message, search, follow, report limiters |
| Input sanitization | Pass | Sanitize middleware for body/query |
| Structured logs with redaction | Pass | Request IDs and redacted sensitive fields |
| Production-safe error responses | Pass | Generic 5xx response body in production mode |
| Registration kill switch | Pass | ENABLE_NEW_REGISTRATIONS env gate |
| Feature flags for risky features | Pass | Read receipts, online status, e2ee flags |
| Retention internal trigger auth | Pass | Internal bearer token required |
| Dependency audit (prod deps) backend | Pass | npm audit --omit=dev found 0 vulnerabilities |
| Dependency audit (prod deps) frontend | Pass | npm audit --omit=dev found 0 vulnerabilities |

## Hardening Follow-ups
- Add WAF/CDN bot rules at edge (Cloudflare free plan baseline).
- Add per-IP failed login counter persistence if brute force increases.
- Add automated dependency update policy and monthly audit cadence.
