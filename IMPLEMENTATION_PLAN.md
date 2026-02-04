# Mneme App - Implementation Plan & Bug Tracker

## Session Summary (Feb 4, 2026)

---

## CRITICAL REQUIREMENT: Equal-Rank Authentication

**All 3 identifiers (username, email, phone) must have EQUAL rank:**
- User can authenticate with ANY of the three
- Verifying one auto-fetches the others from existing account
- Example: Reinstall app → verify phone → username and email auto-fetched
- Sync can be enabled if any of these is set but sync is optional.


# Do not use tamagui input fields if placeholder is needed. instead use react native
