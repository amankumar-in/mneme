import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread',
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
  deletedAt: {
    type: Date,
    default: null,
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
  // For notes moved from deleted threads
  originalThreadName: String,
}, {
  timestamps: true,
});

// Indexes for efficient queries
noteSchema.index({ threadId: 1, createdAt: -1 });
noteSchema.index({ threadId: 1, isLocked: 1 });
noteSchema.index({ 'task.isTask': 1, 'task.reminderAt': 1, 'task.isCompleted': 1 });
noteSchema.index({ senderId: 1 });
noteSchema.index({ threadId: 1, isDeleted: 1, createdAt: -1 });

// Text search index for content
noteSchema.index({ content: 'text' });

// Pre-save middleware
noteSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check if note can be deleted
noteSchema.methods.canDelete = function () {
  return !this.isLocked;
};

// Instance method to mark as edited
noteSchema.methods.markAsEdited = function () {
  this.isEdited = true;
  return this.save();
};

// Static method to get notes for a thread with cursor pagination
noteSchema.statics.getThreadNotes = async function (threadId, options = {}) {
  const {
    before,
    after,
    limit = 50,
  } = options;

  const query = {
    threadId,
    isDeleted: false,
  };

  // Cursor-based pagination
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  } else if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  const notes = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1) // Get one extra to check if there are more
    .lean();

  const hasMore = notes.length > limit;
  if (hasMore) {
    notes.pop(); // Remove the extra one
  }

  return {
    notes: notes.reverse(), // Return in chronological order
    hasMore,
  };
};

// Static method to get tasks
noteSchema.statics.getTasks = async function (userId, options = {}) {
  const {
    filter = 'pending',
    threadId,
    page = 1,
    limit = 50,
  } = options;

  // First, get all threads the user has access to
  const Thread = mongoose.model('Thread');
  const userThreads = await Thread.find({
    $or: [
      { ownerId: userId },
      { participants: userId },
    ],
  }).select('_id');

  const threadIds = userThreads.map((t) => t._id);

  const query = {
    threadId: threadId ? threadId : { $in: threadIds },
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
    .populate('threadId', 'name')
    .sort({ 'task.reminderAt': 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Transform to keep threadId as string and add threadName
  const transformedTasks = tasks.map((task) => ({
    ...task,
    threadName: task.threadId?.name || 'Unknown',
    threadId: task.threadId?._id || task.threadId,
  }));

  return {
    tasks: transformedTasks,
    total,
    page,
    hasMore: page * limit < total,
  };
};

// Static method to search notes
noteSchema.statics.searchNotes = async function (userId, searchQuery, options = {}) {
  const {
    threadId,
    page = 1,
    limit = 20,
  } = options;

  // Get user's threads
  const Thread = mongoose.model('Thread');
  const userThreads = await Thread.find({
    $or: [
      { ownerId: userId },
      { participants: userId },
    ],
  }).select('_id name');

  const threadIds = threadId ? [threadId] : userThreads.map((t) => t._id);
  const threadMap = new Map(userThreads.map((t) => [t._id.toString(), t.name]));

  const query = {
    threadId: { $in: threadIds },
    isDeleted: false,
    $text: { $search: searchQuery },
  };

  const total = await this.countDocuments(query);
  const notes = await this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Add thread name to each note
  const notesWithThreadName = notes.map((n) => ({
    ...n,
    threadName: threadMap.get(n.threadId.toString()) || 'Unknown',
  }));

  return {
    notes: notesWithThreadName,
    total,
    page,
    hasMore: page * limit < total,
  };
};

const Note = mongoose.model('Note', noteSchema);

export default Note;
