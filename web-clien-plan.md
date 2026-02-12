 Context

 Build a WhatsApp Web-style companion web client for LaterBox. The phone acts as a local network
 server — no cloud data relay. User visits web.laterbox.com, scans a QR code from the phone app,
 and the browser connects directly to the phone over LAN for all data. Scope: threads and notes
 only (no boards/scrapbook).

 Architecture

 [Browser at web.laterbox.com]
     |
     |-- (1) HTTPS → cloud Express server: load SPA + QR signaling
     |
     |-- (2) LAN HTTP/WS → phone: all data, files, real-time events
     |
 [Cloud Server (existing Express)]  ←  serves SPA + signaling relay
     |
 [Phone App (Expo 54)]  ←  local HTTP+WS server over WiFi
     |
     expo-sqlite (source of truth)
     attachments on disk

 QR Handshake Flow

 1. Browser loads SPA from web.laterbox.com (served by existing Express server)
 2. SPA calls POST /api/web-session/create → gets { sessionId, token }
 3. SPA shows QR containing { type: "laterbox-web", v: 1, sessionId, token, relay:
 "wss://api.laterbox.com/ws/signaling" }
 4. SPA opens WebSocket to wss://api.laterbox.com/ws/signaling?sessionId=X&role=browser
 5. Phone app scanner screen scans QR → parses JSON
 6. Phone starts local HTTP server on random high port
 7. Phone discovers its LAN IP
 8. Phone sends to signaling relay: { type: "phone-ready", ip, port, token }
 9. Relay verifies token matches session, forwards { ip, port } to browser
 10. Browser connects to http://{ip}:{port}/api/handshake?token=X → all subsequent requests use
 Authorization: Bearer <token>
 11. Browser opens WebSocket to ws://{ip}:{port}/ws?token=X for real-time events
 12. Relay closes both connections — job done

 ---
 Phase 1: Custom Expo Module — expo-local-server

 Creates a local HTTP + WebSocket server from within the Expo app.

 Directory: /modules/expo-local-server/

 modules/expo-local-server/
   expo-module.config.json
   index.ts                          # JS API
   src/ExpoLocalServerModule.ts      # JS module definition
   ios/
     ExpoLocalServerModule.swift     # GCDWebServer wrapper
     ExpoLocalServer.podspec         # Links GCDWebServer CocoaPod
   android/
     src/main/java/.../
       ExpoLocalServerModule.kt     # NanoHTTPD wrapper
     build.gradle                    # NanoHTTPD + Java-WebSocket deps

 JS API

 startServer(port: number): Promise<{ url: string }>
 stopServer(): Promise<void>
 onRequest(cb: (req: { id, method, path, headers, query, body }) => void): void
 sendResponse(requestId, statusCode, headers, body: string | Uint8Array): void
 sendFileResponse(requestId, statusCode, headers, filePath: string): void
 onWebSocketConnect(cb: (clientId: string) => void): void
 onWebSocketMessage(cb: (clientId, message) => void): void
 sendWebSocketMessage(clientId, message): void
 broadcastWebSocket(message): void
 getLocalIpAddress(): Promise<string>

 Native implementations

 - iOS: Swift wrapping GCDWebServer (CocoaPod) — HTTP + file streaming + WebSocket
 - Android: Kotlin wrapping NanoHTTPD (Gradle) + org.java-websocket — same capabilities

 New dependencies

 - iOS: GCDWebServer pod
 - Android: org.nanohttpd:nanohttpd:2.3.1, org.java-websocket:Java-WebSocket:1.5.4

 ---
 Phase 2: Phone-Side Local Server Routes

 Directory: /services/localServer/

 services/localServer/
   index.ts                  # start/stop lifecycle, session management
   router.ts                 # Path-based request dispatcher
   middleware/
     sessionAuth.ts          # Validates Bearer token on every request
   routes/
     handshake.ts            # GET /api/handshake — validates connection
     threads.ts              # CRUD — calls ThreadRepository directly
     notes.ts                # CRUD + lock/star/pin/task — calls NoteRepository
     search.ts               # Global + in-thread search via repo FTS
     tasks.ts                # List tasks, complete task
     files.ts                # Serve attachments + handle uploads
   websocket/
     handler.ts              # WS connection management + auth
     eventBroadcaster.ts     # Singleton, broadcasts mutations to connected browsers
     changeDetector.ts       # 1s polling of SQLite for phone-side changes
   utils/
     rewriteUrls.ts          # Rewrite relative attachment paths to
 http://phone:port/api/files/...

 API Endpoints (served by phone on LAN)
 Method: GET
 Path: /api/handshake
 Handler: Validate session
 Repository Method: —
 ────────────────────────────────────────
 Method: GET
 Path: /api/threads
 Handler: List threads
 Repository Method: threadRepo.getAll(params)
 ────────────────────────────────────────
 Method: GET
 Path: /api/threads/:id
 Handler: Get thread
 Repository Method: threadRepo.getById(id)
 ────────────────────────────────────────
 Method: POST
 Path: /api/threads
 Handler: Create thread
 Repository Method: threadRepo.create(input)
 ────────────────────────────────────────
 Method: PUT
 Path: /api/threads/:id
 Handler: Update thread
 Repository Method: threadRepo.update(id, input)
 ────────────────────────────────────────
 Method: DELETE
 Path: /api/threads/:id
 Handler: Delete thread
 Repository Method: threadRepo.delete(id)
 ────────────────────────────────────────
 Method: GET
 Path: /api/threads/:id/notes
 Handler: List notes (cursor)
 Repository Method: noteRepo.getByThread(id, cursor)
 ────────────────────────────────────────
 Method: POST
 Path: /api/threads/:id/notes
 Handler: Create note
 Repository Method: noteRepo.create(input) + threadRepo.updateLastNote()
 ────────────────────────────────────────
 Method: PUT
 Path: /api/threads/:id/notes/:nid
 Handler: Update note
 Repository Method: noteRepo.update(nid, input)
 ────────────────────────────────────────
 Method: DELETE
 Path: /api/threads/:id/notes/:nid
 Handler: Delete note
 Repository Method: noteRepo.delete(nid)
 ────────────────────────────────────────
 Method: PUT
 Path: /api/threads/:id/notes/:nid/lock
 Handler: Toggle lock
 Repository Method: noteRepo.setLocked(nid, bool)
 ────────────────────────────────────────
 Method: PUT
 Path: /api/threads/:id/notes/:nid/star
 Handler: Toggle star
 Repository Method: noteRepo.setStarred(nid, bool)
 ────────────────────────────────────────
 Method: PUT
 Path: /api/threads/:id/notes/:nid/pin
 Handler: Toggle pin
 Repository Method: noteRepo.setPinned(nid, bool)
 ────────────────────────────────────────
 Method: PUT
 Path: /api/threads/:id/notes/:nid/task
 Handler: Set task
 Repository Method: noteRepo.setTask(nid, input)
 ────────────────────────────────────────
 Method: GET
 Path: /api/search
 Handler: Global search
 Repository Method: noteRepo.search(params)
 ────────────────────────────────────────
 Method: GET
 Path: /api/search/thread/:id
 Handler: Thread search
 Repository Method: noteRepo.searchInThread(id, q)
 ────────────────────────────────────────
 Method: GET
 Path: /api/tasks
 Handler: List tasks
 Repository Method: noteRepo.getTasks(params)
 ────────────────────────────────────────
 Method: PUT
 Path: /api/tasks/:id/complete
 Handler: Complete task
 Repository Method: noteRepo.completeTask(id)
 ────────────────────────────────────────
 Method: GET
 Path: /api/files/*
 Handler: Serve file
 Repository Method: resolveAttachmentUri(path) → stream
 ────────────────────────────────────────
 Method: POST
 Path: /api/files/upload
 Handler: Upload file
 Repository Method: saveAttachment() → metadata
 ────────────────────────────────────────
 Method: GET
 Path: /api/threads/:id/media
 Handler: Thread media
 Repository Method: noteRepo.getMediaByThread(id, types)
 URL Rewriting

 All note responses rewrite relative paths to full URLs:
 - attachment.url: laterbox/attachments/images/x.jpg →
 http://192.168.1.5:8765/api/files/laterbox/attachments/images/x.jpg
 - attachment.thumbnail: same treatment
 - linkPreview.image: same (unless already http://)

 Real-Time Events via WebSocket

 Phone broadcasts these events to connected browser:

 note:created   { threadId, note }
 note:updated   { threadId, note }
 note:deleted   { threadId, noteId }
 thread:created { thread }
 thread:updated { thread }
 thread:deleted { threadId }
 session:expired { reason }
 ping           { timestamp }    (every 30s)

 Change detection: 1-second polling of notes and threads tables where updated_at > lastCheck. Uses
  existing indexes (idx_notes_updated_at). Broadcasts diffs as events.

 Security

 - Every request requires Authorization: Bearer <token> (32-byte random hex)
 - Rate limit: 5 auth failures per minute per IP → 5min block
 - One active session at a time
 - Session expires: 5min of app in background, or app killed
 - Locked notes return content: null unless unlocked via phone
 - CORS: Allow only the web client origin

 ---
 Phase 3: Cloud Server Signaling

 Files to modify/create

 New: /server/routes/web-session.js
 Modify: /server/index.js (add ws, mount new route)

 New dependency: ws npm package

 Endpoints

 POST /api/web-session/create
   → generates sessionId (uuid) + token (32 random bytes hex)
   → stores in in-memory Map with 5min TTL
   → Response: { sessionId, token }

 WebSocket /ws/signaling?sessionId=X&role=browser|phone
   → browser connects first, waits
   → phone connects, sends { type: "phone-ready", ip, port, token }
   → server verifies token matches session
   → server forwards { type: "phone-ready", ip, port } to browser
   → server closes both connections + deletes session

 Serve web client SPA

 Add to server/index.js:
 app.use('/web', express.static(path.join(__dirname, '../web/dist')))
 app.get('/web/*', (req, res) => res.sendFile('index.html', { root: '../web/dist' }))

 Route web.laterbox.com → /web path on existing server.

 ---
 Phase 4: Phone QR Scanner

 File: /app/qr-scan.tsx (replace placeholder)

 New dependency: expo-camera

 Implementation

 - Request camera permission
 - Use expo-camera CameraView with onBarcodeScanned
 - Parse QR JSON: validate type === "laterbox-web" and v === 1
 - On valid scan:
   a. Start local server via startServer(randomPort)
   b. Get LAN IP via getLocalIpAddress()
   c. Connect to signaling relay WebSocket
   d. Send { type: "phone-ready", ip, port, token }
   e. Navigate to a "Web Client Active" screen showing connection status
 - Add "Web Client" entry point in settings or home screen menu

 New screen: /app/web-session.tsx

 - Shows "Connected to web client" status
 - Shows browser info / connection duration
 - "Disconnect" button → stops local server, kills session
 - Auto-disconnect on app background timeout (5min)

 ---
 Phase 5: Web Client SPA

 Directory: /web/

 web/
   package.json
   vite.config.ts
   tsconfig.json
   index.html
   src/
     main.tsx
     App.tsx                         # Router + connection state machine
     api/
       client.ts                     # fetch wrapper, baseUrl from connection store
       types.ts                      # API response types (mirrors shared/types)
     store/
       connectionStore.ts            # Zustand: qr-loading → qr-displayed → connecting → connected
  → disconnected
     hooks/
       useThreads.ts                 # React Query: GET /api/threads
       useNotes.ts                   # React Query: infinite query GET /api/threads/:id/notes
       useSearch.ts                  # GET /api/search
       useTasks.ts                   # GET /api/tasks
       useWebSocket.ts               # WS connection + event → query invalidation
     components/
       connection/
         QRScreen.tsx                # Shows QR, waiting spinner, retry
         ConnectingScreen.tsx        # "Connecting to phone..." progress
         DisconnectedScreen.tsx      # "Connection lost" + retry/rescan
       layout/
         AppLayout.tsx               # Two-pane shell
         Sidebar.tsx                 # 350px left panel
         MainPanel.tsx               # Flex right panel
       threads/
         ThreadList.tsx              # Scrollable list with search
         ThreadListItem.tsx          # Avatar, name, preview, time, pin/lock badges
                                     # Hover → dropdown arrow → fly menu (pin, lock, delete)
       notes/
         NoteArea.tsx                # Selected thread's notes + input
         NoteBubble.tsx              # All note types rendered
                                     # Hover → dropdown arrow → fly menu (pin, star, lock, task,
 edit, delete, copy)
         NoteInput.tsx               # TextArea + file upload + send
         DateSeparator.tsx
         LinkPreviewCard.tsx
         VoiceWaveform.tsx           # Web Audio API waveform playback
         ImageViewer.tsx             # Lightbox modal
         VideoPlayer.tsx             # HTML5 <video>
       thread-info/
         ThreadInfoPanel.tsx         # Slide-out right panel
         MediaGallery.tsx            # Grid of images/videos/files
       common/
         Avatar.tsx
         Dropdown.tsx                # Hover/click flyout menu
         Modal.tsx
         Spinner.tsx
     utils/
       formatters.ts                 # Date, file size, relative time
     styles/
       globals.css                   # Tailwind imports + scrollbar styling

 Dependencies

 react, react-dom, react-router-dom
 @tanstack/react-query
 zustand
 axios
 qrcode.react (QR display)
 tailwindcss, @tailwindcss/vite
 lucide-react (icons)
 date-fns
 vite, @vitejs/plugin-react, typescript

 Connection State Machine

 qr-loading → qr-displayed → connecting → connected → disconnected
                                               ↑              |
                                               └──────────────┘ (auto-reconnect up to 10 attempts)
                                                      |
                                               qr-displayed  (if session expired, rescan)

 Layout

 +------------------------------------------------------------------+
 |  LaterBox Web              [Connection: Connected]  [Disconnect]  |
 +-------------------+----------------------------------------------+
 |  [Search........] |  Thread Name               [Info] [Search]   |
 |                   |----------------------------------------------|
 |  Thread 1     [v] |                                              |
 |  Thread 2         |     Note bubbles (bottom-up scroll)          |
 |  Thread 3         |     Each note: hover → [v] dropdown arrow    |
 |  ...              |                                              |
 |                   |----------------------------------------------|
 |  [+ New Thread]   |  [+Attach] [Type a note...          ] [Send] |
 +-------------------+----------------------------------------------+

 Hover Actions (replacing long press)

 Thread list items: On hover, show a small ChevronDown icon on the right. Click opens dropdown:
 - Pin / Unpin
 - Lock / Unlock
 - Delete

 Note bubbles: On hover, show a small ChevronDown icon in top-right corner. Click opens dropdown:
 - Copy
 - Edit (text notes only)
 - Pin / Unpin
 - Star / Unstar
 - Lock / Unlock
 - Set as Task / Remove Task
 - Delete

 Note Types Rendering
 ┌──────────┬──────────────────────────────────────────────────────────────────┐
 │   Type   │                          Web Rendering                           │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ text     │ <p> with URL detection + LinkPreviewCard below                   │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ image    │ <img src="http://phone/api/files/..."> → click opens ImageViewer │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ video    │ <video> with poster thumbnail, native controls                   │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ voice    │ Custom waveform bars (canvas/SVG) + Web Audio API playback       │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ audio    │ <audio> player with filename display                             │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ file     │ File icon + name + size → click downloads                        │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ location │ Static map embed or link to Google Maps                          │
 ├──────────┼──────────────────────────────────────────────────────────────────┤
 │ contact  │ Contact card with name/details                                   │
 └──────────┴──────────────────────────────────────────────────────────────────┘
 File Upload Flow

 1. User clicks attachment button or drags file onto NoteInput
 2. POST /api/files/upload with multipart form-data → phone saves via saveAttachment()
 3. Phone returns { attachment: { url, filename, mimeType, size, ... } }
 4. POST /api/threads/:id/notes with { type, content, attachment } → creates note
 5. WebSocket broadcasts note:created → UI updates

 ---
 Phase 6: Polish & Edge Cases

 - Keyboard shortcuts: Escape (deselect), Ctrl+K (search), Enter (send), Shift+Enter (newline)
 - Dark mode: Tailwind dark mode class, toggle in header
 - Reconnection UX: Toast "Reconnecting..." with attempt count, auto-switch to QR if session
 expired
 - Phone background handling: iOS background task (5min), Android foreground notification service
 - Multiple tabs: Only one tab active at a time (use BroadcastChannel API)
 - Responsive: On narrow screens, show thread list or notes (not both), with back button

 ---
 Implementation Order

 1. expo-local-server module — the foundation, nothing works without it
 2. Phone-side API routes — wire up repositories to HTTP endpoints, test with curl
 3. Cloud signaling — web-session route + WebSocket relay on existing server
 4. Phone QR scanner — implement expo-camera scanning in qr-scan.tsx
 5. Web client shell — Vite project, connection flow, QR screen
 6. Web client thread list — fetch + display threads
 7. Web client notes area — fetch + display all note types
 8. Web client note input — text + file upload + send
 9. Web client actions — hover dropdowns, mutations
 10. WebSocket real-time — event broadcasting + change detection
 11. Thread info panel — media gallery, settings
 12. Polish — dark mode, keyboard shortcuts, reconnection, responsive

 ---
 Key Files to Modify
 ┌──────────────────┬─────────────────────────────────────────────────────────────────┐
 │       File       │                             Change                              │
 ├──────────────────┼─────────────────────────────────────────────────────────────────┤
 │ /app/qr-scan.tsx │ Replace placeholder with actual camera scanning + session logic │
 ├──────────────────┼─────────────────────────────────────────────────────────────────┤
 │ /server/index.js │ Add ws, mount web-session route, serve SPA static files         │
 ├──────────────────┼─────────────────────────────────────────────────────────────────┤
 │ /app.json        │ Add expo-camera plugin                                          │
 ├──────────────────┼─────────────────────────────────────────────────────────────────┤
 │ /package.json    │ Add expo-camera dependency                                      │
 └──────────────────┴─────────────────────────────────────────────────────────────────┘
 Key Files to Create
 ┌───────────────────────────────┬─────────────────────────────────────┐
 │             File              │               Purpose               │
 ├───────────────────────────────┼─────────────────────────────────────┤
 │ /modules/expo-local-server/*  │ Custom native HTTP+WS server module │
 ├───────────────────────────────┼─────────────────────────────────────┤
 │ /services/localServer/*       │ Phone-side API route handlers       │
 ├───────────────────────────────┼─────────────────────────────────────┤
 │ /server/routes/web-session.js │ Signaling relay endpoint            │
 ├───────────────────────────────┼─────────────────────────────────────┤
 │ /app/web-session.tsx          │ "Web client active" status screen   │
 ├───────────────────────────────┼─────────────────────────────────────┤
 │ /web/*                        │ Entire web client SPA               │
 ├───────────────────────────────┼─────────────────────────────────────┤
 │ /shared/types/*               │ Shared TypeScript types             │
 └───────────────────────────────┴─────────────────────────────────────┘
 Verification

 1. Module test: Start local server on phone, curl http://phone-ip:port/api/handshake from laptop
 2. Signaling test: Create session via API, connect two WebSocket clients (browser + phone role),
 verify relay
 3. End-to-end: Visit web client → scan QR → see threads → open thread → see notes → send note →
 see it on phone
 4. File test: View image note in browser (served from phone), upload image from browser
 5. Real-time test: Add note on phone → appears in browser within 1-2 seconds
 6. Disconnect test: Kill phone app → browser shows disconnected → reopen app + rescan →
 reconnects