# Claude Rules for LaterBox

## Development Principles

### Fix Problems Properly
- When something breaks, fix the actual issue - don't switch to alternative libraries or workarounds
- Native module not linking? Rebuild the app. Don't swap to a different package.
- If a solution requires a rebuild, say so. Don't avoid it by changing the approach.

### Use debug logs to confirm the issue before making any edits.

### Follow the Plan
- Always follow IMPLEMENTATION_PLAN.md exactly
- No shortcuts, no "I'll simplify this" bullshit
- If the plan says to do something, do it that way

### Theme and Styling
- NEVER hardcode colors like "white", "gray", "#3b82f6"
- Always use Tamagui theme tokens: $color, $colorSubtle, $background, $brandBackground, etc.
- Use useThemeColor hook for Ionicons and other components that need hex strings
- Test in both light AND dark mode

### Code Quality
- Don't over-engineer or add unnecessary abstractions
- Don't create fallbacks and workarounds that hide real problems
- If something is broken, it should fail loudly so we can fix it properly

### No Bullshit Claims
- NEVER make claims without reading documentation first
- Don't blame libraries/frameworks without evidence
- If you don't know why something doesn't work, say "I don't know" and investigate
- Compare working vs broken projects to find differences, then read docs to understand why

### Naming
- "Boards" are called "Scrapbook" / "Scraps" in the UI. Internal code (DB, hooks, repos, types, file names) uses `board` everywhere.

### Commands Reference
- `npx expo start --clear` - Start with clean cache
- `npx expo run:android` - Rebuild Android native app
- `npx expo run:ios` - Rebuild iOS native app
- `npm run server` - Start backend server
