import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
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

  // Get all chats owned by user (including deleted ones for sync)
  const allChats = await Chat.find({
    ownerId: userId,
  }).lean();

  // Filter to only return chats updated since last sync
  const chats = allChats
    .filter(chat => new Date(chat.updatedAt) > sinceDate && !chat.deletedAt)
    .map(chat => ({
      _id: chat._id,
      name: chat.name,
      icon: chat.icon,
      isPinned: chat.isPinned,
      wallpaper: chat.wallpaper,
      lastMessage: chat.lastMessage,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));

  // Get deleted chat IDs
  const deletedChatIds = allChats
    .filter(chat => chat.deletedAt && new Date(chat.deletedAt) > sinceDate)
    .map(chat => chat._id.toString());

  // Get chat IDs for message queries
  const chatIds = allChats.map(chat => chat._id);

  // Get all messages in user's chats (including deleted ones for sync)
  const allMessages = await Message.find({
    chatId: { $in: chatIds },
    updatedAt: { $gt: sinceDate },
  }).lean();

  // Filter to active messages
  const messages = allMessages
    .filter(msg => !msg.isDeleted && !msg.deletedAt)
    .map(msg => ({
      _id: msg._id,
      chatId: msg.chatId,
      content: msg.content,
      type: msg.type,
      attachment: msg.attachment,
      location: msg.location,
      isLocked: msg.isLocked,
      isStarred: msg.isStarred,
      isEdited: msg.isEdited,
      isDeleted: msg.isDeleted,
      task: msg.task,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

  // Get deleted message IDs
  const deletedMessageIds = allMessages
    .filter(msg => msg.isDeleted || msg.deletedAt)
    .map(msg => msg._id.toString());

  res.json({
    user,
    chats,
    messages,
    deletedChatIds,
    deletedMessageIds,
    serverTime,
  });
}));

/**
 * POST /api/sync/push
 * Push local changes to server
 */
router.post('/push', authenticate, asyncHandler(async (req, res) => {
  const { user: userChanges, chats: chatChanges, messages: messageChanges } = req.body;
  const userId = req.user._id;

  const result = {
    user: null,
    chats: [],
    messages: [],
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

    await User.findByIdAndUpdate(userId, {
      name: data.name,
      username: data.username,
      email: data.email,
      phone: data.phone,
      avatar: data.avatar,
      settings: data.settings,
    });

    result.user = {
      localId,
      serverId: userId.toString(),
    };
  }

  // Process chat changes
  if (chatChanges && chatChanges.length > 0) {
    for (const { localId, serverId, data, deleted } of chatChanges) {
      if (deleted) {
        // Handle deletion
        if (serverId) {
          await Chat.findOneAndUpdate(
            { _id: serverId, ownerId: userId },
            { deletedAt: new Date() }
          );
          // Also mark all messages as deleted
          await Message.updateMany(
            { chatId: serverId },
            { isDeleted: true, deletedAt: new Date() }
          );
        }
        result.chats.push({ localId, serverId: serverId || localId });
      } else if (serverId) {
        // Update existing chat
        await Chat.findOneAndUpdate(
          { _id: serverId, ownerId: userId },
          {
            name: data.name,
            icon: data.icon,
            isPinned: data.isPinned,
            wallpaper: data.wallpaper,
          }
        );
        result.chats.push({ localId, serverId });
      } else {
        // Create new chat
        const chat = await Chat.create({
          name: data.name,
          icon: data.icon,
          isPinned: data.isPinned,
          wallpaper: data.wallpaper,
          ownerId: userId,
        });
        result.chats.push({ localId, serverId: chat._id.toString() });
      }
    }
  }

  // Build a map of local chat IDs to server IDs
  const chatIdMap = new Map();
  for (const { localId, serverId } of result.chats) {
    chatIdMap.set(localId, serverId);
  }

  // Process message changes
  if (messageChanges && messageChanges.length > 0) {
    for (const { localId, serverId, chatLocalId, data, deleted } of messageChanges) {
      // Resolve chat ID (use server ID if available, otherwise look up from map)
      let chatServerId = chatIdMap.get(chatLocalId);
      if (!chatServerId) {
        // Try to find existing chat by looking at the message's current server ID
        if (serverId) {
          const existingMsg = await Message.findById(serverId);
          if (existingMsg) {
            chatServerId = existingMsg.chatId.toString();
          }
        }
      }

      // Skip if we can't find the chat
      if (!chatServerId && !serverId) {
        console.warn(`Skipping message ${localId}: no chat found`);
        continue;
      }

      if (deleted) {
        // Handle deletion
        if (serverId) {
          await Message.findByIdAndUpdate(serverId, {
            isDeleted: true,
            deletedAt: new Date(),
          });
        }
        result.messages.push({ localId, serverId: serverId || localId });
      } else if (serverId) {
        // Update existing message
        await Message.findByIdAndUpdate(serverId, {
          content: data.content,
          isLocked: data.isLocked,
          isStarred: data.isStarred,
          isEdited: data.isEdited,
          task: data.task,
        });
        result.messages.push({ localId, serverId });
      } else if (chatServerId) {
        // Create new message
        const message = await Message.create({
          chatId: chatServerId,
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

        // Update chat's last message
        await Chat.findByIdAndUpdate(chatServerId, {
          lastMessage: {
            content: data.content,
            type: data.type,
            timestamp: message.createdAt,
          },
        });

        result.messages.push({ localId, serverId: message._id.toString() });
      }
    }
  }

  res.json(result);
}));

/**
 * DELETE /api/sync/remote-data
 * Delete all remote chats and messages for the authenticated user
 */
router.delete('/remote-data', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get all chats owned by user
  const userChats = await Chat.find({ ownerId: userId });
  const chatIds = userChats.map(c => c._id);

  // Delete all messages in those chats
  const deletedMessages = await Message.deleteMany({ chatId: { $in: chatIds } });

  // Delete all chats
  const deletedChats = await Chat.deleteMany({ ownerId: userId });

  res.json({
    success: true,
    message: 'Remote data deleted successfully',
    stats: {
      chatsDeleted: deletedChats.deletedCount,
      messagesDeleted: deletedMessages.deletedCount,
    },
  });
}));

export default router;
