import express from 'express';
import Thread from '../models/Thread.js';
import Note from '../models/Note.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/threads
 * Get all threads for current user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { search, filter, page = 1, limit = 50 } = req.query;

  const result = await Thread.getUserThreads(req.user._id, {
    search,
    filter,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json(result);
}));

/**
 * POST /api/threads
 * Create a new thread
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, icon } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({
      error: 'Name required',
      message: 'Thread name is required',
    });
  }

  const thread = await Thread.create({
    name: name.trim(),
    icon,
    ownerId: req.user._id,
  });

  res.status(201).json({ thread });
}));

/**
 * GET /api/threads/:id
 * Get a specific thread
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  if (!thread.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this thread',
    });
  }

  res.json({ thread });
}));

/**
 * PUT /api/threads/:id
 * Update a thread
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { name, icon, isPinned, wallpaper } = req.body;

  const thread = await Thread.findById(req.params.id);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  if (!thread.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this thread',
    });
  }

  // System threads cannot be renamed
  if (thread.isSystemThread && name) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'System threads cannot be renamed',
    });
  }

  // Update fields
  if (name !== undefined) thread.name = name;
  if (icon !== undefined) thread.icon = icon;
  if (isPinned !== undefined) thread.isPinned = isPinned;
  if (wallpaper !== undefined) thread.wallpaper = wallpaper;

  await thread.save();

  res.json({ thread });
}));

/**
 * DELETE /api/threads/:id
 * Delete a thread
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  if (!thread.canEdit(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only the owner can delete this thread',
    });
  }

  // System threads cannot be deleted
  if (thread.isSystemThread) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'System threads cannot be deleted',
    });
  }

  // Check for locked notes
  const lockedNotes = await Note.find({
    threadId: thread._id,
    isLocked: true,
  });

  let lockedNotesCount = 0;

  if (lockedNotes.length > 0) {
    // Get or create locked notes thread
    const lockedThread = await Thread.getLockedNotesThread(req.user._id);

    // Move locked notes to locked notes thread
    await Note.updateMany(
      { threadId: thread._id, isLocked: true },
      {
        threadId: lockedThread._id,
        originalThreadName: thread.name,
      }
    );

    lockedNotesCount = lockedNotes.length;
  }

  // Delete unlocked notes
  await Note.deleteMany({
    threadId: thread._id,
    isLocked: false,
  });

  // Delete the thread
  await Thread.findByIdAndDelete(thread._id);

  res.json({
    success: true,
    lockedNotesCount,
    message: lockedNotesCount > 0
      ? `Thread deleted. ${lockedNotesCount} locked note(s) preserved.`
      : 'Thread deleted successfully',
  });
}));

/**
 * GET /api/threads/:id/export
 * Export a thread as text or JSON
 */
router.get('/:id/export', authenticate, asyncHandler(async (req, res) => {
  const { format = 'txt' } = req.query;

  const thread = await Thread.findById(req.params.id);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  if (!thread.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this thread',
    });
  }

  // Get all notes for the thread
  const notes = await Note.find({
    threadId: thread._id,
    isDeleted: false,
  }).sort({ createdAt: 1 }).lean();

  if (format === 'json') {
    res.json({
      thread: {
        name: thread.name,
        createdAt: thread.createdAt,
        exportedAt: new Date().toISOString(),
      },
      notes: notes.map(m => ({
        content: m.content,
        type: m.type,
        createdAt: m.createdAt,
        isLocked: m.isLocked,
        isTask: m.task?.isTask || false,
      })),
    });
  } else {
    // Text format
    const formatDate = (d) => {
      const date = new Date(d);
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    const formatDateTime = (d) => {
      const date = new Date(d);
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${day} ${month} ${year}, ${time}`;
    };

    let text = `${thread.name}\n`;
    text += `Exported: ${formatDate(new Date())}\n`;
    text += `${'─'.repeat(40)}\n\n`;

    for (const note of notes) {
      const date = formatDateTime(note.createdAt);
      const prefix = note.task?.isTask ? '☐ ' : '';
      const locked = note.isLocked ? ' 🔒' : '';

      if (note.type === 'text') {
        text += `${prefix}${note.content}${locked}\n`;
        text += `  ${date}\n\n`;
      } else {
        text += `[${note.type}]${locked}\n`;
        text += `  ${date}\n\n`;
      }
    }

    res.type('text/plain').send(text);
  }
}));

/**
 * GET /api/threads/:id/media
 * Get media from a thread
 */
router.get('/:id/media', authenticate, asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;

  const thread = await Thread.findById(req.params.id);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  if (!thread.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this thread',
    });
  }

  const query = {
    threadId: thread._id,
    isDeleted: false,
  };

  // Filter by type
  if (type === 'images') {
    query.type = 'image';
  } else if (type === 'voice') {
    query.type = 'voice';
  } else if (type === 'files') {
    query.type = 'file';
  } else if (type === 'links') {
    query.content = { $regex: /https?:\/\//, $options: 'i' };
  } else {
    query.type = { $in: ['image', 'voice', 'file'] };
  }

  const total = await Note.countDocuments(query);
  const media = await Note.find(query)
    .sort({ createdAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit))
    .lean();

  res.json({
    media,
    total,
    page: parseInt(page),
    hasMore: parseInt(page) * parseInt(limit) < total,
  });
}));

export default router;
