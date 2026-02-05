# LaterBox App - Implementation Plan & Bug Tracker

## Session Summary (Feb 4, 2026)

---

## CRITICAL REQUIREMENT: Equal-Rank Authentication

**All 3 identifiers (username, email, phone) must have EQUAL rank:**
- User can authenticate with ANY of the three
- Verifying one auto-fetches the others from existing account
- Example: Reinstall app → verify phone → username and email auto-fetched
- Sync can be enabled if any of these is set but sync is optional.


# Do not use tamagui input fields if placeholder is needed. instead use react native

i want to implement file and media sharing on my app. in thread view we have 6 share options  - images, video, document, location, contact, audio.    
  Remember that we will not use permissions that we dont need. for instance to share media files just media picker is fine and no file permission is needed. for document i want to allow any type of file to be shared upto 100MB. location, contact, will work as they do on apps like whatsapp  


tested with app in foreground, background both. do not make any edits. do not create any plans. only find the issue. use context7 mcp to learn.