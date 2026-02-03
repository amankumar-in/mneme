import express from 'express';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/chats
 * Get all chats for current user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { search, filter, page = 1, limit = 50 } = req.query;

  const result = await Chat.getUserChats(req.user._id, {
    search,
    filter,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json(result);
}));

/**
 * POST /api/chats
 * Create a new chat
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, icon } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({
      error: 'Name required',
      message: 'Chat name is required',
    });
  }

  const chat = await Chat.create({
    name: name.trim(),
    icon,
    ownerId: req.user._id,
  });

  res.status(201).json({ chat });
}));

/**
 * GET /api/chats/:id
 * Get a specific chat
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);

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

  res.json({ chat });
}));

/**
 * PUT /api/chats/:id
 * Update a chat
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { name, icon, isPinned, wallpaper } = req.body;

  const chat = await Chat.findById(req.params.id);

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

  // System chats cannot be renamed
  if (chat.isSystemChat && name) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'System chats cannot be renamed',
    });
  }

  // Update fields
  if (name !== undefined) chat.name = name;
  if (icon !== undefined) chat.icon = icon;
  if (isPinned !== undefined) chat.isPinned = isPinned;
  if (wallpaper !== undefined) chat.wallpaper = wallpaper;

  await chat.save();

  res.json({ chat });
}));

/**
 * DELETE /api/chats/:id
 * Delete a chat
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Chat not found',
    });
  }

  if (!chat.canEdit(req.user._id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only the owner can delete this chat',
    });
  }

  // System chats cannot be deleted
  if (chat.isSystemChat) {
    return res.status(400).json({
      error: 'Invalid Operation',
      message: 'System chats cannot be deleted',
    });
  }

  // Check for locked messages
  const lockedMessages = await Message.find({
    chatId: chat._id,
    isLocked: true,
  });

  let lockedMessagesCount = 0;

  if (lockedMessages.length > 0) {
    // Get or create locked notes chat
    const lockedChat = await Chat.getLockedNotesChat(req.user._id);

    // Move locked messages to locked notes chat
    await Message.updateMany(
      { chatId: chat._id, isLocked: true },
      {
        chatId: lockedChat._id,
        originalChatName: chat.name,
      }
    );

    lockedMessagesCount = lockedMessages.length;
  }

  // Delete unlocked messages
  await Message.deleteMany({
    chatId: chat._id,
    isLocked: false,
  });

  // Delete the chat
  await Chat.findByIdAndDelete(chat._id);

  res.json({
    success: true,
    lockedMessagesCount,
    message: lockedMessagesCount > 0
      ? `Chat deleted. ${lockedMessagesCount} locked message(s) preserved.`
      : 'Chat deleted successfully',
  });
}));

/**
 * GET /api/chats/:id/export
 * Export a chat as text or JSON
 */
router.get('/:id/export', authenticate, asyncHandler(async (req, res) => {
  const { format = 'txt' } = req.query;

  const chat = await Chat.findById(req.params.id);

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

  // Get all messages for the chat
  const messages = await Message.find({
    chatId: chat._id,
    isDeleted: false,
  }).sort({ createdAt: 1 }).lean();

  if (format === 'json') {
    res.json({
      chat: {
        name: chat.name,
        createdAt: chat.createdAt,
        exportedAt: new Date().toISOString(),
      },
      messages: messages.map(m => ({
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

    let text = `${chat.name}\n`;
    text += `Exported: ${formatDate(new Date())}\n`;
    text += `${'─'.repeat(40)}\n\n`;

    for (const msg of messages) {
      const date = formatDateTime(msg.createdAt);
      const prefix = msg.task?.isTask ? '☐ ' : '';
      const locked = msg.isLocked ? ' 🔒' : '';

      if (msg.type === 'text') {
        text += `${prefix}${msg.content}${locked}\n`;
        text += `  ${date}\n\n`;
      } else {
        text += `[${msg.type}]${locked}\n`;
        text += `  ${date}\n\n`;
      }
    }

    res.type('text/plain').send(text);
  }
}));

/**
 * GET /api/chats/:id/media
 * Get media from a chat
 */
router.get('/:id/media', authenticate, asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;

  const chat = await Chat.findById(req.params.id);

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

  const query = {
    chatId: chat._id,
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

  const total = await Message.countDocuments(query);
  const media = await Message.find(query)
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
