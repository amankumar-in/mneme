import express from 'express';
import Note from '../models/Note.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/tasks
 * Get all tasks for current user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { filter = 'pending', threadId, page = 1, limit = 50 } = req.query;

  const result = await Note.getTasks(req.user._id, {
    filter,
    threadId,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json(result);
}));

/**
 * GET /api/tasks/upcoming
 * Get upcoming tasks for the next N days
 */
router.get('/upcoming', authenticate, asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + parseInt(days));

  const Thread = (await import('../models/Thread.js')).default;

  // Get user's threads
  const userThreads = await Thread.find({
    $or: [
      { ownerId: req.user._id },
      { participants: req.user._id },
    ],
  }).select('_id name');

  const threadIds = userThreads.map((t) => t._id);
  const threadMap = new Map(userThreads.map((t) => [t._id.toString(), t.name]));

  const tasks = await Note.find({
    threadId: { $in: threadIds },
    'task.isTask': true,
    'task.isCompleted': false,
    'task.reminderAt': { $gte: now, $lte: futureDate },
    isDeleted: false,
  })
    .sort({ 'task.reminderAt': 1 })
    .lean();

  // Add thread name to each task
  const tasksWithThreadName = tasks.map((t) => ({
    ...t,
    threadName: threadMap.get(t.threadId.toString()) || 'Unknown',
  }));

  res.json({ tasks: tasksWithThreadName });
}));

export default router;
