import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'voice', 'file', 'location'],
    default: 'text',
  },
  attachment: {
    url: String,
    filename: String,
    mimeType: String,
    size: Number, // bytes
    duration: Number, // seconds (for voice/video)
    thumbnail: String,
    width: Number,
    height: Number,
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  isStarred: {
    type: Boolean,
    default: false,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  task: {
    isTask: {
      type: Boolean,
      default: false,
    },
    reminderAt: Date,
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
  },
  // For messages moved from deleted chats
  originalChatName: String,
}, {
  timestamps: true,
});

// Indexes for efficient queries
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, isLocked: 1 });
messageSchema.index({ 'task.isTask': 1, 'task.reminderAt': 1, 'task.isCompleted': 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ chatId: 1, isDeleted: 1, createdAt: -1 });

// Text search index for content
messageSchema.index({ content: 'text' });

// Pre-save middleware
messageSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check if message can be deleted
messageSchema.methods.canDelete = function () {
  return !this.isLocked;
};

// Instance method to mark as edited
messageSchema.methods.markAsEdited = function () {
  this.isEdited = true;
  return this.save();
};

// Static method to get messages for a chat with cursor pagination
messageSchema.statics.getChatMessages = async function (chatId, options = {}) {
  const {
    before,
    after,
    limit = 50,
  } = options;

  const query = {
    chatId,
    isDeleted: false,
  };

  // Cursor-based pagination
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  } else if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  const messages = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1) // Get one extra to check if there are more
    .lean();

  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop(); // Remove the extra one
  }

  return {
    messages: messages.reverse(), // Return in chronological order
    hasMore,
  };
};

// Static method to get tasks
messageSchema.statics.getTasks = async function (userId, options = {}) {
  const {
    filter = 'pending',
    chatId,
    page = 1,
    limit = 50,
  } = options;

  // First, get all chats the user has access to
  const Chat = mongoose.model('Chat');
  const userChats = await Chat.find({
    $or: [
      { ownerId: userId },
      { participants: userId },
    ],
  }).select('_id');

  const chatIds = userChats.map((c) => c._id);

  const query = {
    chatId: chatId ? chatId : { $in: chatIds },
    'task.isTask': true,
    isDeleted: false,
  };

  // Apply filter
  const now = new Date();
  if (filter === 'pending') {
    query['task.isCompleted'] = false;
  } else if (filter === 'completed') {
    query['task.isCompleted'] = true;
  } else if (filter === 'overdue') {
    query['task.isCompleted'] = false;
    query['task.reminderAt'] = { $lt: now };
  }

  const total = await this.countDocuments(query);
  const tasks = await this.find(query)
    .populate('chatId', 'name')
    .sort({ 'task.reminderAt': 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    tasks,
    total,
    page,
    hasMore: page * limit < total,
  };
};

// Static method to search messages
messageSchema.statics.searchMessages = async function (userId, searchQuery, options = {}) {
  const {
    chatId,
    page = 1,
    limit = 20,
  } = options;

  // Get user's chats
  const Chat = mongoose.model('Chat');
  const userChats = await Chat.find({
    $or: [
      { ownerId: userId },
      { participants: userId },
    ],
  }).select('_id name');

  const chatIds = chatId ? [chatId] : userChats.map((c) => c._id);
  const chatMap = new Map(userChats.map((c) => [c._id.toString(), c.name]));

  const query = {
    chatId: { $in: chatIds },
    isDeleted: false,
    $text: { $search: searchQuery },
  };

  const total = await this.countDocuments(query);
  const messages = await this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Add chat name to each message
  const messagesWithChatName = messages.map((m) => ({
    ...m,
    chatName: chatMap.get(m.chatId.toString()) || 'Unknown',
  }));

  return {
    messages: messagesWithChatName,
    total,
    page,
    hasMore: page * limit < total,
  };
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
