import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Thread from '../models/Thread.js';
import Note from '../models/Note.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /api/sync/changes
 * Get all changes since a given timestamp
 */
router.get('/changes', authenticate, asyncHandler(async (req, res) => {
  const { since } = req.query;
  const userId = req.user._id;
  const serverTime = new Date().toISOString();

  // Parse the since timestamp
  const sinceDate = since ? new Date(since) : new Date(0);

  // Get user if updated since last sync
  let user = null;
  if (req.user.updatedAt > sinceDate) {
    user = {
      _id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      email: req.user.email,
      phone: req.user.phone,
      avatar: req.user.avatar,
      settings: req.user.settings,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };
  }

  // Get all threads owned by user (including deleted ones for sync)
  const allThreads = await Thread.find({
    ownerId: userId,
  }).lean();

  // Filter to only return threads updated since last sync
  const threads = allThreads
    .filter(thread => new Date(thread.updatedAt) > sinceDate && !thread.deletedAt)
    .map(thread => ({
      _id: thread._id,
      name: thread.name,
      icon: thread.icon,
      isPinned: thread.isPinned,
      wallpaper: thread.wallpaper,
      lastNote: thread.lastNote,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }));

  // Get deleted thread IDs
  const deletedThreadIds = allThreads
    .filter(thread => thread.deletedAt && new Date(thread.deletedAt) > sinceDate)
    .map(thread => thread._id.toString());

  // Get thread IDs for note queries
  const threadIds = allThreads.map(thread => thread._id);

  // Get all notes in user's threads (including deleted ones for sync)
  const allNotes = await Note.find({
    threadId: { $in: threadIds },
    updatedAt: { $gt: sinceDate },
  }).lean();

  // Filter to active notes
  const notes = allNotes
    .filter(note => !note.isDeleted && !note.deletedAt)
    .map(note => ({
      _id: note._id,
      threadId: note.threadId,
      content: note.content,
      type: note.type,
      attachment: note.attachment,
      location: note.location,
      isLocked: note.isLocked,
      isStarred: note.isStarred,
      isEdited: note.isEdited,
      isDeleted: note.isDeleted,
      task: note.task,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));

  // Get deleted note IDs
  const deletedNoteIds = allNotes
    .filter(note => note.isDeleted || note.deletedAt)
    .map(note => note._id.toString());

  res.json({
    user,
    threads,
    notes,
    deletedThreadIds,
    deletedNoteIds,
    serverTime,
  });
}));

/**
 * POST /api/sync/push
 * Push local changes to server
 */
router.post('/push', authenticate, asyncHandler(async (req, res) => {
  const { user: userChanges, threads: threadChanges, notes: noteChanges } = req.body;
  const userId = req.user._id;

  const result = {
    user: null,
    threads: [],
    notes: [],
  };

  // Process user changes
  if (userChanges) {
    const { localId, data } = userChanges;

    // Validate unique fields before update to prevent E11000 duplicate key errors
    if (data.username) {
      const existingUsername = await User.findOne({
        username: data.username.toLowerCase(),
        _id: { $ne: userId }
      });
      if (existingUsername) {
        return res.status(409).json({ error: 'Username already taken', field: 'username' });
      }
    }

    if (data.email) {
      const existingEmail = await User.findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: userId }
      });
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already taken', field: 'email' });
      }
    }

    if (data.phone) {
      const existingPhone = await User.findOne({
        phone: data.phone,
        _id: { $ne: userId }
      });
      if (existingPhone) {
        return res.status(409).json({ error: 'Phone number already taken', field: 'phone' });
      }
    }

    const updatePayload = {
      name: data.name,
      avatar: data.avatar,
      settings: data.settings,
    };

    if (data.username) {
      updatePayload.username = data.username.toLowerCase();
    }
    if (data.email) {
      updatePayload.email = data.email.toLowerCase();
    }
    if (data.phone) {
      updatePayload.phone = data.phone;
    }

    await User.findByIdAndUpdate(userId, updatePayload);

    result.user = {
      localId,
      serverId: userId.toString(),
    };
  }

  // Process thread changes (with merge: new thread with same name as existing → use existing)
  if (threadChanges && threadChanges.length > 0) {
    for (const { localId, serverId, data, deleted } of threadChanges) {
      if (deleted) {
        // Handle deletion
        if (serverId) {
          await Thread.findOneAndUpdate(
            { _id: serverId, ownerId: userId },
            { deletedAt: new Date() }
          );
          // Also mark all notes as deleted
          await Note.updateMany(
            { threadId: serverId },
            { isDeleted: true, deletedAt: new Date() }
          );
        }
        result.threads.push({ localId, serverId: serverId || localId });
      } else if (serverId) {
        // Update existing thread if it exists; otherwise create (client had stale/wrong serverId)
        const existing = await Thread.findOne({ _id: serverId, ownerId: userId }).lean();
        if (existing) {
          await Thread.findOneAndUpdate(
            { _id: serverId, ownerId: userId },
            {
              name: data.name,
              icon: data.icon,
              isPinned: data.isPinned,
              wallpaper: data.wallpaper,
            }
          );
          result.threads.push({ localId, serverId });
        } else {
          const thread = await Thread.create({
            name: data.name,
            icon: data.icon,
            isPinned: data.isPinned,
            wallpaper: data.wallpaper,
            ownerId: userId,
          });
          result.threads.push({ localId, serverId: thread._id.toString() });
        }
      } else {
        // New thread (no serverId): merge into existing thread with same name if any (reinstall scenario)
        const nameTrimmed = data.name && typeof data.name === 'string' ? data.name.trim() : '';
        const existing = nameTrimmed
          ? await Thread.findOne({
              ownerId: userId,
              name: nameTrimmed,
              $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            }).lean()
          : null;
        if (existing) {
          result.threads.push({ localId, serverId: existing._id.toString() });
        } else {
          const thread = await Thread.create({
            name: data.name,
            icon: data.icon,
            isPinned: data.isPinned,
            wallpaper: data.wallpaper,
            ownerId: userId,
          });
          result.threads.push({ localId, serverId: thread._id.toString() });
        }
      }
    }
  }

  // Build a map of local thread IDs to server IDs
  const threadIdMap = new Map();
  for (const { localId, serverId } of result.threads) {
    threadIdMap.set(localId, serverId);
  }

  // Process note changes
  if (noteChanges && noteChanges.length > 0) {
    for (const { localId, serverId, threadLocalId, data, deleted } of noteChanges) {
      // Resolve thread ID (use server ID if available, otherwise look up from map)
      let threadServerId = threadIdMap.get(threadLocalId);
      if (!threadServerId) {
        // Try to find existing thread by looking at the note's current server ID
        if (serverId) {
          const existingNote = await Note.findById(serverId);
          if (existingNote) {
            threadServerId = existingNote.threadId.toString();
          }
        }
      }

      // Skip if we can't find the thread
      if (!threadServerId && !serverId) {
        console.warn(`Skipping note ${localId}: no thread found`);
        continue;
      }

      if (deleted) {
        // Handle deletion
        if (serverId) {
          await Note.findByIdAndUpdate(serverId, {
            isDeleted: true,
            deletedAt: new Date(),
          });
        }
        result.notes.push({ localId, serverId: serverId || localId });
      } else if (serverId) {
        // Update existing note
        await Note.findByIdAndUpdate(serverId, {
          content: data.content,
          isLocked: data.isLocked,
          isStarred: data.isStarred,
          isEdited: data.isEdited,
          task: data.task,
        });
        result.notes.push({ localId, serverId });
      } else if (threadServerId) {
        // Create new note
        const note = await Note.create({
          threadId: threadServerId,
          senderId: userId,
          content: data.content,
          type: data.type,
          attachment: data.attachment,
          location: data.location,
          isLocked: data.isLocked,
          isStarred: data.isStarred,
          isEdited: data.isEdited,
          task: data.task,
        });

        // Update thread's last note
        await Thread.findByIdAndUpdate(threadServerId, {
          lastNote: {
            content: data.content,
            type: data.type,
            timestamp: note.createdAt,
          },
        });

        result.notes.push({ localId, serverId: note._id.toString() });
      }
    }
  }

  res.json(result);
}));

/**
 * DELETE /api/sync/remote-data
 * Delete all remote threads and notes for the authenticated user
 */
router.delete('/remote-data', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get all threads owned by user
  const userThreads = await Thread.find({ ownerId: userId });
  const threadIds = userThreads.map(t => t._id);

  // Delete all notes in those threads
  const deletedNotes = await Note.deleteMany({ threadId: { $in: threadIds } });

  // Delete all threads
  const deletedThreads = await Thread.deleteMany({ ownerId: userId });

  res.json({
    success: true,
    message: 'Remote data deleted successfully',
    stats: {
      threadsDeleted: deletedThreads.deletedCount,
      notesDeleted: deletedNotes.deletedCount,
    },
  });
}));

export default router;
