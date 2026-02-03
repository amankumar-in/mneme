# Mneme App - Implementation Plan & Bug Tracker

## Session Summary (Feb 4, 2026)

---

## CRITICAL REQUIREMENT: Equal-Rank Authentication

**All 3 identifiers (username, email, phone) must have EQUAL rank:**
- User can authenticate with ANY of the three
- Verifying one auto-fetches the others from existing account
- Example: Reinstall app → verify phone → username and email auto-fetched

### Current Backend State
- `POST /api/auth/signup` - username + password (unauthenticated) ✅
- `POST /api/auth/login` - username + password (unauthenticated) ✅
- `POST /api/auth/check-username` - check availability (unauthenticated) ✅
- `POST /api/verify/email/send` - REQUIRES AUTH ❌
- `POST /api/verify/email/verify` - REQUIRES AUTH ❌
- `POST /api/verify/phone/send` - REQUIRES AUTH ❌
- `POST /api/verify/phone/verify` - REQUIRES AUTH ❌

### Required Backend Changes
Add unauthenticated routes to `server/routes/auth.js`:

1. `POST /api/auth/phone/send` - Send verification code (no auth)
2. `POST /api/auth/phone/verify` - Verify code, return JWT + user profile
3. `POST /api/auth/email/send` - Send verification code (no auth)
4. `POST /api/auth/email/verify` - Verify code, return JWT + user profile

### Required Frontend Changes
1. `services/api.ts` - Add functions for phone/email auth without token
2. `app/settings/profile.tsx` - Allow verification when not authenticated

---

### Current State Testing:
1. [ ] Create thread locally
2. [ ] Set username + password
3. [ ] Verify sync uploads thread to server
4. [ ] Delete app data
5. [ ] Login with username
6. [ ] Verify thread syncs back down
