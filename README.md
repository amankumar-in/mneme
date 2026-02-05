# LaterBox

A privacy-focused, offline-first notes app with a familiar messaging interface. Your data stays on your device by default -- cloud sync is entirely optional.

Named after the Greek Muse of memory.

## Why LaterBox

- **Offline by default** -- everything lives in a local SQLite database on your device. No account required.
- **Optional sync** -- set up a username, email, or phone number to enable bidirectional sync with cloud. Turn it off anytime.
- **Chat-style interface** -- notes are organized into threads that look and feel like messaging conversations. If you can use WhatsApp, you can use LaterBox.
- **Rich media** -- attach images, videos, documents, voice recordings, audio files, locations, and contacts.
- **Tasks built in** -- convert any note into a task with reminders and due dates. No separate app needed.
- **Privacy controls** -- lock sensitive notes into a protected vault, control who can find you, and delete your remote data at any time.

## Features

### Notes & Threads
- Create threads to organize notes by topic, project, or anything else
- Send text notes, edit them, star favorites, and lock important ones
- Full-text search across all notes or within a single thread
- Pin threads to the top of your list
- Custom thread icons (emoji or photo)
- Export any thread as a formatted text file

### Media Attachments
- **Images** -- capture from camera or pick from gallery
- **Videos** -- record or select (up to 5 minutes), with auto-generated thumbnails
- **Voice notes** -- record with live waveform visualization, M4A format
- **Audio files** -- attach any audio file up to 100MB
- **Documents** -- attach any file type up to 100MB, open with system viewer
- **Location** -- share current location with reverse-geocoded address, opens in Maps
- **Contacts** -- pick from device contacts

### Media Gallery
- Browse all media in a thread organized by type (Photos, Videos, Files)
- Grouped by month with grid layout
- Full-screen image viewer and video player

### Task Management
- Convert any note to a task with a checkbox
- Set reminder date and time with local push notifications
- Filter tasks: Pending, Completed, or All
- Overdue indicators for missed deadlines
- View tasks across all threads or filtered to one
- Tap a task to jump to its note in the thread

### Privacy & Security
- **Protected Notes** -- lock notes into a dedicated system thread
- **Data control** -- delete remote data, delete account info, delete all media, or nuke everything
- Notes remain private regardless of discoverability setting

### Theming
- Light, Dark, or Auto (follows system)
- Visual mockup previews before selecting
- Persisted in user settings

### Sync & Authentication
- **Offline-first** -- the app works entirely without a network connection
- **Equal-rank identifiers** -- authenticate with username, email, or phone (all have equal rank)
- **Email/phone verification** -- OTP-based verification flow
- **Bidirectional sync** -- push local changes to server, pull remote changes on launch
- **Conflict resolution** -- server wins on pull, with smart handling for reinstalls (merges by thread name)
- **Privacy-safe** -- only filenames are synced to the server, never local file paths

### Other
- Home screen shortcuts for quick access to threads
- Multi-select mode for bulk actions (delete, lock, pin, copy, star)
- Pull-to-refresh sync
- QR scan placeholder for future web access (web.laterbox.app)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo SDK 54) |
| UI | Tamagui |
| Navigation | expo-router (file-based) |
| Local DB | SQLite (expo-sqlite) with FTS5 full-text search |
| State | React Query (TanStack) |
| Server | Express.js + MongoDB (Mongoose) |
| Media | expo-image-picker, expo-av, expo-video, expo-video-thumbnails |
| Files | expo-file-system, expo-document-picker |
| Location | expo-location |
| Contacts | expo-contacts |
| Notifications | expo-notifications |
| Animations | react-native-reanimated |

## Project Structure

```
laterbox/
  app/                          # Screens (file-based routing)
    index.tsx                   #   Home -- thread list, search, FAB
    tasks.tsx                   #   Tasks -- cross-thread task view
    qr-scan.tsx                 #   QR scanner placeholder
    contact-picker.tsx          #   Device contact picker
    thread/[id]/
      index.tsx                 #   Thread detail -- notes, input, media
      media.tsx                 #   Media gallery (photos/videos/files)
      info.tsx                  #   Thread info -- avatar, name, actions
    settings/
      index.tsx                 #   Settings hub
      profile.tsx               #   User profile & authentication
      privacy.tsx               #   Discoverability controls
      customize.tsx             #   Theme selection
  components/                   # Reusable UI components
  hooks/                        # Custom React hooks
  services/
    database/                   #   SQLite schema, types, migrations
    repositories/               #   Data access layer (thread, note, user)
    sync/                       #   Sync service (push/pull with server)
    fileStorage.ts              #   Local file attachment management
    notifications/              #   Push notification scheduling
  contexts/                     # React contexts (theme, database)
  server/                       # Express.js backend
    models/                     #   Mongoose schemas (User, Thread, Note)
    routes/                     #   REST API (auth, sync, threads, notes, tasks, search, share, verify)
    middleware/                 #   Error handling
```

## Getting Started

### Prerequisites

- Node.js 18+
- iOS Simulator (Xcode) or Android Emulator (Android Studio)
- MongoDB (optional, only for sync)

### Install & Run

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start --clear

# Build native app (required for native modules)
npx expo run:ios
# or
npx expo run:android
```

### Backend (optional)

Only needed if you want cloud sync:

```bash
# Start the Express server (connects to MongoDB on localhost:27017)
npm run server
```

Set `MONGODB_URI` environment variable to point to your MongoDB instance.

## Database

Local SQLite database with WAL mode. Three versioned migrations:

- **v1**: Base schema (threads, notes, user, sync_meta, FTS5 index)
- **v2**: System threads (Protected Notes)
- **v3**: Notification IDs for task reminders

All data uses soft deletes (`deleted_at` timestamps). Entities track `sync_status` ('pending' or 'synced') and maintain dual IDs (local UUID + server ObjectId).

## License

Private.
