import express from 'express';
import Thread from '../models/Thread.js';
import Note from '../models/Note.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/search
 * Search across threads and notes
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { q, type = 'all', page = 1, limit = 20 } = req.query;

  if (!q?.trim()) {
    return res.status(400).json({
      error: 'Query required',
      message: 'Search query is required',
    });
  }

  const results = {
    threads: [],
    notes: [],
  };
  let total = 0;

  // Search threads
  if (type === 'all' || type === 'threads') {
    const threads = await Thread.find({
      $or: [
        { ownerId: req.user._id },
        { participants: req.user._id },
      ],
      name: { $regex: q, $options: 'i' },
    })
      .limit(parseInt(limit))
      .lean();

    results.threads = threads;
    total += threads.length;
  }

  // Search notes
  if (type === 'all' || type === 'notes') {
    const noteResult = await Note.searchNotes(req.user._id, q, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    results.notes = noteResult.notes;
    total += noteResult.total;
  }

  res.json({
    results,
    total,
    query: q,
  });
}));

/**
 * GET /api/search/thread/:threadId
 * Search within a specific thread
 */
router.get('/thread/:threadId', authenticate, asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;

  if (!q?.trim()) {
    return res.status(400).json({
      error: 'Query required',
      message: 'Search query is required',
    });
  }

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

  const result = await Note.searchNotes(req.user._id, q, {
    threadId: thread._id,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json(result);
}));

export default router;
