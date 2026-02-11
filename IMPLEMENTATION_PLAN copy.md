# LaterBoards — Infinite Canvas

## What Is It

A new surface in LaterBox — an infinite canvas where you draw, type, place images/shapes/audio, and connect things with lines. It lives alongside Threads as a "Boards" tab on the home screen. Think Apple Freeform meets Excalidraw (shapes with connections).

---

## How It Works — No Modes

There are no mode switches. A drawing panel sits at the bottom with color swatches and stroke thickness (see **Drawing** section), but there is no "select a tool then use it" flow. The canvas responds to what your fingers do:

| You do this | This happens |
|---|---|
| **Tap** empty space | Keyboard opens. A small fly menu appears at the tap point (Image, Rectangle, Audio). Start typing → fly menu fades, text appears at that point. Tap a fly menu option → place that object instead. |
| **Drag** on empty space | Freehand stroke drawn under your finger. Saved instantly when you lift. No flicker, no refresh. |
| **Tap** existing text | Cursor placed at end of that text. Keyboard opens. Continue typing. |
| **Long press** any object (text, stroke, image, shape, audio) | Selects it. Haptic feedback. |
| **2-finger pan** | Pan the canvas. Must be smooth — no parallax, no jitter. |
| **Pinch** | Zoom in/out. |

---

## Selected Item

When you long-press something, it becomes selected. A selected item shows:

- **4 corner handles** — drag any corner to resize (not available on audio circles)
- **Center area** — drag to reposition the item on the canvas
- **4 side midpoint dots** — drag from a dot toward another item to create a connection line
- **Delete action** — visible somewhere on the selection UI

Only one item can be selected at a time. Tap empty space to deselect.

---

## Text

- Text is placed directly on the canvas. No visible text box — just text floating on the surface.
- Text wraps at approximately **600px width**.
- The invisible "box" is only revealed when the text is selected (via long press).
- **Tap on existing text** → cursor goes to end, keyboard opens, user continues typing.
- **Saving**: text is saved on any of: tap away, navigate back, keyboard dismiss, any other action. There is no explicit save button.
- **Keyboard avoidance**: when typing, the canvas must adjust so the text being typed is not hidden behind the keyboard.

---

## Drawing

A **drawing panel** is fixed at the bottom of the screen (outside the canvas transform, always visible):

- **Color swatches** — theme-aware colors. Each swatch has a light-mode and dark-mode variant (e.g., dark yellow in light theme, light yellow in dark theme). Black and white are the **same swatch** — it shows black in light mode, white in dark mode. This ensures sketches remain legible when switching themes. Reference the wallpaper overlay color picker for how this works.
- **3 thickness levels** — thin, medium, thick.
- **Undo / Redo** buttons.

Strokes are saved to the database **immediately on finger lift**. There must be no visual refresh or re-render flicker after saving.

**Long press a stroke** → selects it → can move or delete it (same selection behavior as other items).

---

## Fly Menu

When you tap empty space, a small floating pill menu appears at the tap location with 3 options:

1. **Image** — opens the existing image source picker (camera/gallery). Image is placed at the tap point in its original uncropped aspect ratio, with a default width of **150px**. Can be resized via corner handles when selected.
2. **Rectangle** — places an outline rectangle at the tap point. No sub-picker, no other shapes for now. Can be resized.
3. **Audio** — starts the voice recorder (same flow as thread voice notes — recording UI with duration, stop, cancel). When recording finishes, a **play/pause circle** is placed at the tap point. Single tap on the circle → play/pause. Long press → select (can move, can delete, **cannot resize**).

If the user starts typing instead of tapping a menu option, the fly menu fades away and text is placed at the tap point.

---

## Connections

Items can be connected with lines:

1. Long press an item to select it.
2. Drag from one of the **4 side midpoint dots** toward another item.
3. Release on the target item → a persistent connection line is created between them.
4. Release on empty space → connection discarded.

Connection lines:
- **Straight by default**. Auto-curves when a straight line can't reach cleanly.
- Have an **arrowhead**.
- **Tap on a connection line** → selects it → can change arrow direction or delete.

---

## Navigation

### Home Screen

The existing filter chips row (`Threads`, `Tasks`) gets a third option: **`Boards`**. Selecting it shows the board list in the same area where threads appear.

### Board List

Same pattern as the thread list:
- List of boards showing icon, name, last modified.
- Tap → opens that board's canvas.
- Long press → select (for delete, etc.)
- **FAB** to create a new board.

### Board Header

Follows the **ThreadHeader** pattern:
- **Left**: back arrow
- **Center**: board icon + board name (tappable → navigates to board info page)
- **Right**: share button

### Board Info Page

Follows the thread info page pattern:
- Editable name + emoji picker
- **Background pattern picker** — 4 options shown as small preview tiles:
  - Plain (solid background)
  - Grid (vertical + horizontal lines)
  - Dots
  - Rules (horizontal lines only)
- Delete board with confirmation

---

## Canvas Behavior

- **2-finger pan** must be perfectly smooth with no jitter or parallax.
- **Pinch to zoom** with reasonable limits.
- **Viewport persistence** — when you leave a board and come back, it remembers where you were (position + zoom level).
- **Background pattern** renders across the infinite canvas based on the board's pattern setting.

---

## Theme Requirements

- All UI uses Tamagui theme tokens (`$color`, `$background`, `$backgroundStrong`, etc.) — never hardcoded colors.
- Drawing swatch colors have light/dark variants that flip with the theme.
- The entire board must look correct in both light and dark mode.
- Use `useThemeColor()` hook for Ionicons and native components needing hex strings.

---

## What Already Exists That Can Be Reused

- `useAttachmentHandler().showImageSourcePicker()` — for placing images
- `useVoiceRecorder()` — for recording audio
- `useAudioPlayer()` — for playing audio
- `ThreadHeader` pattern — for the board header layout
- Thread info page pattern — for board info
- Thread list pattern — for board list
- `FilterChips` component — already on home screen, just needs "Boards" added
- `FAB` component — for creating new boards
- Wallpaper overlay color picker — reference for theme-aware color swatches
