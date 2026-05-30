# Launch QA Checklist

## Core Auth
- [ ] Signup works
- [ ] Login works
- [ ] Logout works
- [ ] Refresh token flow works

## Profile and Social
- [ ] Profile edit works
- [ ] Avatar URL update works from edit form
- [ ] Follow works
- [ ] Unfollow works
- [ ] Followers list actions (Chat + Remove) work
- [ ] Following list actions (Chat + Unfollow) work

## Chat and Realtime
- [ ] Create/open direct chat works
- [ ] Realtime message send/receive works in two browsers
- [ ] Typing indicator appears and clears correctly
- [ ] Read receipts follow user setting
- [ ] Online/last seen follows user setting

## Encryption and Fallback
- [ ] E2EE message path works for encrypted direct chat
- [ ] Plaintext fallback works when encryption disabled
- [ ] No plaintext leakage in encrypted message API responses

## Data and Retention
- [ ] Weekly deletion dry-run works
- [ ] Weekly deletion actual run works
- [ ] Retention logs contain counts and duration

## Settings and Policies
- [ ] Settings toggles save correctly
- [ ] Account deletion request flow works
- [ ] Privacy page accessible
- [ ] Terms page accessible
- [ ] Safety page accessible
- [ ] Data policy page accessible

## UX Smoke
- [ ] Landing/auth pages show legal footer links
- [ ] Mobile responsive smoke check (320px and 390px widths)
