// SQLite schema definitions for offline-first architecture

export const DATABASE_VERSION = 8
export const DATABASE_NAME = 'laterbox.db'

// Schema for version 1
export const SCHEMA_V1 = `
  -- Enable WAL mode for better concurrent access
  PRAGMA journal_mode = WAL;

  -- Threads table
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT UNIQUE,
    name TEXT NOT NULL,
    icon TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_system_thread INTEGER NOT NULL DEFAULT 0,
    is_locked INTEGER NOT NULL DEFAULT 0,
    wallpaper TEXT,
    last_note_content TEXT,
    last_note_type TEXT,
    last_note_timestamp TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Index for thread queries
  CREATE INDEX IF NOT EXISTS idx_threads_deleted_at ON threads(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at);
  CREATE INDEX IF NOT EXISTS idx_threads_sync_status ON threads(sync_status);
  CREATE INDEX IF NOT EXISTS idx_threads_is_pinned ON threads(is_pinned);

  -- Notes table
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT UNIQUE,
    thread_id TEXT NOT NULL,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'text',
    -- Attachment fields
    attachment_url TEXT,
    attachment_filename TEXT,
    attachment_mime_type TEXT,
    attachment_size INTEGER,
    attachment_duration INTEGER,
    attachment_thumbnail TEXT,
    attachment_width INTEGER,
    attachment_height INTEGER,
    -- Location fields
    location_latitude REAL,
    location_longitude REAL,
    location_address TEXT,
    -- Flags
    is_locked INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_edited INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    -- Task fields
    is_task INTEGER NOT NULL DEFAULT 0,
    reminder_at TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    notification_id TEXT,
    -- Link preview fields
    link_preview_url TEXT,
    link_preview_title TEXT,
    link_preview_description TEXT,
    link_preview_image TEXT,
    -- Waveform data for voice notes (JSON array of 0-100 integers)
    attachment_waveform TEXT,
    -- Sync fields
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
  );

  -- Indexes for note queries
  CREATE INDEX IF NOT EXISTS idx_notes_thread_id ON notes(thread_id);
  CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
  CREATE INDEX IF NOT EXISTS idx_notes_sync_status ON notes(sync_status);
  CREATE INDEX IF NOT EXISTS idx_notes_is_task ON notes(is_task);
  CREATE INDEX IF NOT EXISTS idx_notes_is_completed ON notes(is_completed);
  CREATE INDEX IF NOT EXISTS idx_notes_reminder_at ON notes(reminder_at);

  -- FTS5 virtual table for full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    thread_id UNINDEXED,
    content,
    content='notes',
    content_rowid='rowid'
  );

  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, id, thread_id, content)
    VALUES (NEW.rowid, NEW.id, NEW.thread_id, NEW.content);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, thread_id, content)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.thread_id, OLD.content);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, thread_id, content)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.thread_id, OLD.content);
    INSERT INTO notes_fts(rowid, id, thread_id, content)
    VALUES (NEW.rowid, NEW.id, NEW.thread_id, NEW.content);
  END;

  -- User table (single row for current user)
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT UNIQUE,
    device_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    username TEXT,
    email TEXT,
    phone TEXT,
    avatar TEXT,
    -- Settings (flattened)
    settings_theme TEXT NOT NULL DEFAULT 'system',
    settings_notifications_task_reminders INTEGER NOT NULL DEFAULT 1,
    settings_notifications_shared_notes INTEGER NOT NULL DEFAULT 1,
    settings_privacy_visibility TEXT NOT NULL DEFAULT 'private',
    -- Sync fields
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Sync metadata table
  CREATE TABLE IF NOT EXISTS sync_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync_timestamp TEXT,
    last_push_timestamp TEXT,
    is_syncing INTEGER NOT NULL DEFAULT 0
  );

  -- Initialize sync_meta with single row
  INSERT OR IGNORE INTO sync_meta (id) VALUES (1);

  -- Create Protected Notes system thread
  INSERT OR IGNORE INTO threads (id, name, icon, is_pinned, is_system_thread, sync_status, created_at, updated_at)
  VALUES ('system-protected-notes', 'Protected Notes', '🔒', 0, 1, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

  -- Boards table
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT UNIQUE,
    name TEXT NOT NULL,
    icon TEXT,
    pattern_type TEXT NOT NULL DEFAULT 'plain',
    viewport_x REAL NOT NULL DEFAULT 0,
    viewport_y REAL NOT NULL DEFAULT 0,
    viewport_zoom REAL NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_boards_deleted_at ON boards(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_boards_updated_at ON boards(updated_at);

  -- Board items table
  CREATE TABLE IF NOT EXISTS board_items (
    id TEXT PRIMARY KEY NOT NULL,
    board_id TEXT NOT NULL,
    type TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 0,
    height REAL NOT NULL DEFAULT 0,
    rotation REAL NOT NULL DEFAULT 0,
    z_index INTEGER NOT NULL DEFAULT 0,
    content TEXT,
    image_uri TEXT,
    audio_uri TEXT,
    audio_duration INTEGER,
    stroke_color TEXT,
    stroke_width REAL,
    fill_color TEXT,
    font_size REAL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_board_items_board_id ON board_items(board_id);
  CREATE INDEX IF NOT EXISTS idx_board_items_deleted_at ON board_items(deleted_at);

  -- Board strokes table
  CREATE TABLE IF NOT EXISTS board_strokes (
    id TEXT PRIMARY KEY NOT NULL,
    board_id TEXT NOT NULL,
    path_data TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#000000',
    width REAL NOT NULL DEFAULT 2,
    opacity REAL NOT NULL DEFAULT 1,
    z_index INTEGER NOT NULL DEFAULT 0,
    x_offset REAL NOT NULL DEFAULT 0,
    y_offset REAL NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_board_strokes_board_id ON board_strokes(board_id);
  CREATE INDEX IF NOT EXISTS idx_board_strokes_deleted_at ON board_strokes(deleted_at);

  -- Board connections table
  CREATE TABLE IF NOT EXISTS board_connections (
    id TEXT PRIMARY KEY NOT NULL,
    board_id TEXT NOT NULL,
    from_item_id TEXT NOT NULL,
    to_item_id TEXT NOT NULL,
    from_side TEXT NOT NULL DEFAULT 'right',
    to_side TEXT NOT NULL DEFAULT 'left',
    color TEXT NOT NULL DEFAULT '#888888',
    stroke_width REAL NOT NULL DEFAULT 2,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (from_item_id) REFERENCES board_items(id) ON DELETE CASCADE,
    FOREIGN KEY (to_item_id) REFERENCES board_items(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_board_connections_board_id ON board_connections(board_id);
  CREATE INDEX IF NOT EXISTS idx_board_connections_deleted_at ON board_connections(deleted_at);
`

// Migrations for future versions
export const MIGRATIONS: Record<number, string> = {
  2: `
    ALTER TABLE threads ADD COLUMN is_system_thread INTEGER NOT NULL DEFAULT 0;

    INSERT OR IGNORE INTO threads (id, name, icon, is_pinned, is_system_thread, sync_status, created_at, updated_at)
    VALUES ('system-protected-notes', 'Protected Notes', '🔒', 0, 1, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  `,
  3: `
    ALTER TABLE notes ADD COLUMN notification_id TEXT;
  `,
  4: `
    ALTER TABLE notes ADD COLUMN link_preview_url TEXT;
    ALTER TABLE notes ADD COLUMN link_preview_title TEXT;
    ALTER TABLE notes ADD COLUMN link_preview_description TEXT;
    ALTER TABLE notes ADD COLUMN link_preview_image TEXT;
  `,
  5: `
    ALTER TABLE notes ADD COLUMN attachment_waveform TEXT;
  `,
  6: `
    ALTER TABLE threads ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
  `,
  7: `
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT UNIQUE,
      name TEXT NOT NULL,
      icon TEXT,
      pattern_type TEXT NOT NULL DEFAULT 'plain',
      viewport_x REAL NOT NULL DEFAULT 0,
      viewport_y REAL NOT NULL DEFAULT 0,
      viewport_zoom REAL NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_boards_deleted_at ON boards(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_boards_updated_at ON boards(updated_at);

    CREATE TABLE IF NOT EXISTS board_items (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL,
      type TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 0,
      height REAL NOT NULL DEFAULT 0,
      rotation REAL NOT NULL DEFAULT 0,
      z_index INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      image_uri TEXT,
      audio_uri TEXT,
      audio_duration INTEGER,
      stroke_color TEXT,
      stroke_width REAL,
      fill_color TEXT,
      font_size REAL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_items_board_id ON board_items(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_items_deleted_at ON board_items(deleted_at);

    CREATE TABLE IF NOT EXISTS board_strokes (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL,
      path_data TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#000000',
      width REAL NOT NULL DEFAULT 2,
      opacity REAL NOT NULL DEFAULT 1,
      z_index INTEGER NOT NULL DEFAULT 0,
      x_offset REAL NOT NULL DEFAULT 0,
      y_offset REAL NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_strokes_board_id ON board_strokes(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_strokes_deleted_at ON board_strokes(deleted_at);

    CREATE TABLE IF NOT EXISTS board_connections (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL,
      from_item_id TEXT NOT NULL,
      to_item_id TEXT NOT NULL,
      from_side TEXT NOT NULL DEFAULT 'right',
      to_side TEXT NOT NULL DEFAULT 'left',
      color TEXT NOT NULL DEFAULT '#888888',
      stroke_width REAL NOT NULL DEFAULT 2,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (from_item_id) REFERENCES board_items(id) ON DELETE CASCADE,
      FOREIGN KEY (to_item_id) REFERENCES board_items(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_connections_board_id ON board_connections(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_connections_deleted_at ON board_connections(deleted_at);
  `,
  8: `
    -- Re-run board table creation for devices where old migration 7 ran without these tables
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT UNIQUE,
      name TEXT NOT NULL,
      icon TEXT,
      pattern_type TEXT NOT NULL DEFAULT 'plain',
      viewport_x REAL NOT NULL DEFAULT 0,
      viewport_y REAL NOT NULL DEFAULT 0,
      viewport_zoom REAL NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_boards_deleted_at ON boards(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_boards_updated_at ON boards(updated_at);

    CREATE TABLE IF NOT EXISTS board_items (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL,
      type TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 0,
      height REAL NOT NULL DEFAULT 0,
      rotation REAL NOT NULL DEFAULT 0,
      z_index INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      image_uri TEXT,
      audio_uri TEXT,
      audio_duration INTEGER,
      stroke_color TEXT,
      stroke_width REAL,
      fill_color TEXT,
      font_size REAL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_items_board_id ON board_items(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_items_deleted_at ON board_items(deleted_at);

    CREATE TABLE IF NOT EXISTS board_strokes (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL,
      path_data TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#000000',
      width REAL NOT NULL DEFAULT 2,
      opacity REAL NOT NULL DEFAULT 1,
      z_index INTEGER NOT NULL DEFAULT 0,
      x_offset REAL NOT NULL DEFAULT 0,
      y_offset REAL NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_strokes_board_id ON board_strokes(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_strokes_deleted_at ON board_strokes(deleted_at);

    CREATE TABLE IF NOT EXISTS board_connections (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL,
      from_item_id TEXT NOT NULL,
      to_item_id TEXT NOT NULL,
      from_side TEXT NOT NULL DEFAULT 'right',
      to_side TEXT NOT NULL DEFAULT 'left',
      color TEXT NOT NULL DEFAULT '#888888',
      stroke_width REAL NOT NULL DEFAULT 2,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (from_item_id) REFERENCES board_items(id) ON DELETE CASCADE,
      FOREIGN KEY (to_item_id) REFERENCES board_items(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_connections_board_id ON board_connections(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_connections_deleted_at ON board_connections(deleted_at);
  `,
}
