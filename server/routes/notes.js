import express from 'express';
import Thread from '../models/Thread.js';
import Note from '../models/Note.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * Middleware to validate thread access
 */
const validateThreadAccess = asyncHandler(async (req, res, next) => {
  const thread = await Thread.findById(req.params.threadId);

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

  req.thread = thread;
  next();
});

/**
 * GET /api/threads/:threadId/notes
 * Get notes for a thread
 */
router.get('/:threadId/notes', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const { before, after, limit = 50 } = req.query;

  const result = await Note.getThreadNotes(req.thread._id, {
    before,
    after,
    limit: parseInt(limit),
  });

  res.json(result);
}));

/**
 * POST /api/threads/:threadId/notes
 * Create a new note
 */
router.post('/:threadId/notes', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const { content, type = 'text', attachment, location } = req.body;

  // Validate content based on type
  if (type === 'text' && !content?.trim()) {
    return res.status(400).json({
      error: 'Content required',
      message: 'Text notes must have content',
    });
  }

  if (['image', 'voice', 'file'].includes(type) && !attachment?.url) {
    return res.status(400).json({
      error: 'Attachment required',
      message: `${type} notes must have an attachment URL`,
    });
  }

  if (type === 'location' && (!location?.latitude || !location?.longitude)) {
    return res.status(400).json({
      error: 'Location required',
      message: 'Location notes must have latitude and longitude',
    });
  }

  const note = await Note.create({
    threadId: req.thread._id,
    senderId: req.user._id,
    content: content?.trim(),
    type,
    attachment,
    location,
  });

  // Update thread's last note
  await Thread.findByIdAndUpdate(req.thread._id, {
    lastNote: {
      content: type === 'text' ? content : '',
      type,
      timestamp: note.createdAt,
    },
    updatedAt: new Date(),
  });

  res.status(201).json({ note });
}));

/**
 * GET /api/threads/:threadId/notes/:id
 * Get a specific note
 */
router.get('/:threadId/notes/:id', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  const thread = await Thread.findById(note.threadId);

  if (!thread?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this note',
    });
  }

  res.json({ note });
}));

/**
 * PUT /api/threads/:threadId/notes/:id
 * Edit a note
 */
router.put('/:threadId/notes/:id', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const { content } = req.body;

  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  // Only sender can edit
  if (note.senderId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only the sender can edit this note',
    });
  }

  // Only text notes can be edited
  if (note.type !== 'text') {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'Only text notes can be edited',
    });
  }

  note.content = content?.trim();
  note.isEdited = true;
  await note.save();

  res.json({ note });
}));

/**
 * DELETE /api/threads/:threadId/notes/:id
 * Delete a note
 */
router.delete('/:threadId/notes/:id', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  const thread = await Thread.findById(note.threadId);

  if (!thread?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this note',
    });
  }

  // Locked notes cannot be deleted
  if (note.isLocked) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'Locked notes cannot be deleted. Unlock it first.',
    });
  }

  // Soft delete
  note.isDeleted = true;
  await note.save();

  res.json({
    success: true,
    message: 'Note deleted successfully',
  });
}));

/**
 * PUT /api/threads/:threadId/notes/:id/lock
 * Toggle lock status of a note
 */
router.put('/:threadId/notes/:id/lock', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const { isLocked } = req.body;

  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  const thread = await Thread.findById(note.threadId);

  if (!thread?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this note',
    });
  }

  note.isLocked = isLocked !== undefined ? isLocked : !note.isLocked;
  await note.save();

  res.json({
    note,
    locked: note.isLocked,
  });
}));

/**
 * PUT /api/threads/:threadId/notes/:id/star
 * Toggle star status of a note
 */
router.put('/:threadId/notes/:id/star', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const { isStarred } = req.body;

  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  const thread = await Thread.findById(note.threadId);

  if (!thread?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this note',
    });
  }

  note.isStarred = isStarred !== undefined ? isStarred : !note.isStarred;
  await note.save();

  res.json({
    note,
    starred: note.isStarred,
  });
}));

/**
 * PUT /api/threads/:threadId/notes/:id/task
 * Convert note to task or update task
 */
router.put('/:threadId/notes/:id/task', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const { isTask, reminderAt } = req.body;

  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  const thread = await Thread.findById(note.threadId);

  if (!thread?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this note',
    });
  }

  const { isCompleted } = req.body;

  note.task.isTask = isTask !== undefined ? isTask : true;
  if (reminderAt) {
    note.task.reminderAt = new Date(reminderAt);
  }
  // Allow explicitly setting isCompleted to false (uncomplete a task)
  if (isCompleted === false) {
    note.task.isCompleted = false;
    note.task.completedAt = null;
  }
  if (!isTask) {
    note.task.reminderAt = null;
    note.task.isCompleted = false;
    note.task.completedAt = null;
  }

  await note.save();

  res.json({ note });
}));

/**
 * PUT /api/threads/:threadId/notes/:id/task/complete
 * Mark task as complete
 */
router.put('/:threadId/notes/:id/task/complete', authenticate, validateThreadAccess, asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Note not found',
    });
  }

  if (!note.task.isTask) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'This note is not a task',
    });
  }

  const thread = await Thread.findById(note.threadId);

  if (!thread?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this note',
    });
  }

  note.task.isCompleted = !note.task.isCompleted;
  note.task.completedAt = note.task.isCompleted ? new Date() : null;

  await note.save();

  res.json({ note });
}));

export default router;
