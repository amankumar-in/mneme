import express from 'express';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * Middleware to validate chat access
 */
async function validateChatAccess(req, res, next) {
  const chat = await Chat.findById(req.params.chatId);

  if (!chat) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Chat not found',
    });
  }

  if (!chat.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this chat',
    });
  }

  req.chat = chat;
  next();
}

/**
 * GET /api/chats/:chatId/messages
 * Get messages for a chat
 */
router.get('/:chatId/messages', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const { before, after, limit = 50 } = req.query;

  const result = await Message.getChatMessages(req.chat._id, {
    before,
    after,
    limit: parseInt(limit),
  });

  res.json(result);
}));

/**
 * POST /api/chats/:chatId/messages
 * Create a new message
 */
router.post('/:chatId/messages', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const { content, type = 'text', attachment, location } = req.body;

  // Validate content based on type
  if (type === 'text' && !content?.trim()) {
    return res.status(400).json({
      error: 'Content required',
      message: 'Text messages must have content',
    });
  }

  if (['image', 'voice', 'file'].includes(type) && !attachment?.url) {
    return res.status(400).json({
      error: 'Attachment required',
      message: `${type} messages must have an attachment URL`,
    });
  }

  if (type === 'location' && (!location?.latitude || !location?.longitude)) {
    return res.status(400).json({
      error: 'Location required',
      message: 'Location messages must have latitude and longitude',
    });
  }

  const message = await Message.create({
    chatId: req.chat._id,
    senderId: req.user._id,
    content: content?.trim(),
    type,
    attachment,
    location,
  });

  // Update chat's last message
  await Chat.findByIdAndUpdate(req.chat._id, {
    lastMessage: {
      content: type === 'text' ? content : '',
      type,
      timestamp: message.createdAt,
    },
    updatedAt: new Date(),
  });

  res.status(201).json({ message });
}));

/**
 * GET /api/chats/:chatId/messages/:id
 * Get a specific message
 */
router.get('/:chatId/messages/:id', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  const chat = await Chat.findById(message.chatId);

  if (!chat?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this message',
    });
  }

  res.json({ message });
}));

/**
 * PUT /api/chats/:chatId/messages/:id
 * Edit a message
 */
router.put('/:chatId/messages/:id', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const { content } = req.body;

  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  // Only sender can edit
  if (message.senderId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only the sender can edit this message',
    });
  }

  // Only text messages can be edited
  if (message.type !== 'text') {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'Only text messages can be edited',
    });
  }

  message.content = content?.trim();
  message.isEdited = true;
  await message.save();

  res.json({ message });
}));

/**
 * DELETE /api/chats/:chatId/messages/:id
 * Delete a message
 */
router.delete('/:chatId/messages/:id', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  const chat = await Chat.findById(message.chatId);

  if (!chat?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this message',
    });
  }

  // Locked messages cannot be deleted
  if (message.isLocked) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'Locked messages cannot be deleted. Unlock it first.',
    });
  }

  // Soft delete
  message.isDeleted = true;
  await message.save();

  res.json({
    success: true,
    message: 'Message deleted successfully',
  });
}));

/**
 * PUT /api/chats/:chatId/messages/:id/lock
 * Toggle lock status of a message
 */
router.put('/:chatId/messages/:id/lock', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const { isLocked } = req.body;

  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  const chat = await Chat.findById(message.chatId);

  if (!chat?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this message',
    });
  }

  message.isLocked = isLocked !== undefined ? isLocked : !message.isLocked;
  await message.save();

  res.json({
    message,
    locked: message.isLocked,
  });
}));

/**
 * PUT /api/chats/:chatId/messages/:id/star
 * Toggle star status of a message
 */
router.put('/:chatId/messages/:id/star', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const { isStarred } = req.body;

  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  const chat = await Chat.findById(message.chatId);

  if (!chat?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this message',
    });
  }

  message.isStarred = isStarred !== undefined ? isStarred : !message.isStarred;
  await message.save();

  res.json({
    message,
    starred: message.isStarred,
  });
}));

/**
 * PUT /api/chats/:chatId/messages/:id/task
 * Convert message to task or update task
 */
router.put('/:chatId/messages/:id/task', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const { isTask, reminderAt } = req.body;

  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  const chat = await Chat.findById(message.chatId);

  if (!chat?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this message',
    });
  }

  message.task.isTask = isTask !== undefined ? isTask : true;
  if (reminderAt) {
    message.task.reminderAt = new Date(reminderAt);
  }
  if (!isTask) {
    message.task.reminderAt = null;
    message.task.isCompleted = false;
    message.task.completedAt = null;
  }

  await message.save();

  res.json({ message });
}));

/**
 * PUT /api/chats/:chatId/messages/:id/task/complete
 * Mark task as complete
 */
router.put('/:chatId/messages/:id/task/complete', authenticate, validateChatAccess, asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
    });
  }

  if (!message.task.isTask) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'This message is not a task',
    });
  }

  const chat = await Chat.findById(message.chatId);

  if (!chat?.hasAccess(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this message',
    });
  }

  message.task.isCompleted = !message.task.isCompleted;
  message.task.completedAt = message.task.isCompleted ? new Date() : null;

  await message.save();

  res.json({ message });
}));

export default router;
