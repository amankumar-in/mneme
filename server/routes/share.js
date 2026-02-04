import express from 'express';
import User from '../models/User.js';
import Thread from '../models/Thread.js';
import SharedThread from '../models/SharedThread.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /api/share/lookup
 * Lookup a user by username, email, or phone
 */
router.post('/lookup', authenticate, asyncHandler(async (req, res) => {
  const { query } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({
      error: 'Query required',
      message: 'Please provide a username, email, or phone number',
    });
  }

  const user = await User.findByIdentifier(query);

  if (!user) {
    return res.json({ user: null });
  }

  // Check if user is discoverable
  if (!user.isDiscoverable()) {
    return res.json({ user: null });
  }

  // Don't return self
  if (user._id.toString() === req.user._id.toString()) {
    return res.json({ user: null, message: 'Cannot share with yourself' });
  }

  res.json({
    user: user.toPublicProfile(),
  });
}));

/**
 * POST /api/share/thread/:threadId
 * Share a thread with another user
 */
router.post('/thread/:threadId', authenticate, asyncHandler(async (req, res) => {
  const { userId, permissions = {} } = req.body;

  // Check if current user has required profile fields
  if (!req.user.username && !req.user.email && !req.user.phone) {
    return res.status(400).json({
      error: 'Profile incomplete',
      message: 'You must set a username, email, or phone number before sharing',
    });
  }

  const thread = await Thread.findById(req.params.threadId);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  if (!thread.canEdit(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only the owner can share this thread',
    });
  }

  // System threads cannot be shared
  if (thread.isSystemThread) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'System threads cannot be shared',
    });
  }

  // Check if target user exists
  const targetUser = await User.findById(userId);

  if (!targetUser) {
    return res.status(404).json({
      error: 'User not found',
      message: 'The user you want to share with was not found',
    });
  }

  // Check if already shared
  const existingShare = await SharedThread.findOne({
    threadId: thread._id,
    sharedWith: userId,
  });

  if (existingShare) {
    return res.status(409).json({
      error: 'Already shared',
      message: 'This thread is already shared with this user',
      status: existingShare.status,
    });
  }

  // Create share record
  const sharedThread = await SharedThread.create({
    threadId: thread._id,
    sharedBy: req.user._id,
    sharedWith: userId,
    permissions: {
      canEdit: permissions.canEdit || false,
      canDelete: permissions.canDelete || false,
    },
  });

  res.status(201).json({ sharedThread });
}));

/**
 * GET /api/share/pending
 * Get pending share requests for current user
 */
router.get('/pending', authenticate, asyncHandler(async (req, res) => {
  const pendingShares = await SharedThread.getPendingShares(req.user._id);
  res.json({ pendingShares });
}));

/**
 * PUT /api/share/accept/:shareId
 * Accept a share request
 */
router.put('/accept/:shareId', authenticate, asyncHandler(async (req, res) => {
  const share = await SharedThread.findOne({
    _id: req.params.shareId,
    sharedWith: req.user._id,
    status: 'pending',
  });

  if (!share) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Share request not found or already processed',
    });
  }

  await share.accept();

  res.json({
    success: true,
    message: 'Share request accepted',
  });
}));

/**
 * PUT /api/share/reject/:shareId
 * Reject a share request
 */
router.put('/reject/:shareId', authenticate, asyncHandler(async (req, res) => {
  const share = await SharedThread.findOne({
    _id: req.params.shareId,
    sharedWith: req.user._id,
    status: 'pending',
  });

  if (!share) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Share request not found or already processed',
    });
  }

  await share.reject();

  res.json({
    success: true,
    message: 'Share request rejected',
  });
}));

/**
 * DELETE /api/share/thread/:threadId/user/:userId
 * Remove a user from a shared thread
 */
router.delete('/thread/:threadId/user/:userId', authenticate, asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.threadId);

  if (!thread) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Thread not found',
    });
  }

  // Only owner can remove others, or user can remove themselves
  const isOwner = thread.canEdit(req.user._id);
  const isSelf = req.params.userId === req.user._id.toString();

  if (!isOwner && !isSelf) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You cannot remove this user from the thread',
    });
  }

  const removed = await SharedThread.removeShare(thread._id, req.params.userId);

  if (!removed) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User is not a participant in this thread',
    });
  }

  res.json({
    success: true,
    message: 'User removed from thread',
  });
}));

export default router;
