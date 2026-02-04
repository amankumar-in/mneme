import mongoose from 'mongoose';

const threadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  icon: {
    type: String, // emoji or image URL
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  isShared: {
    type: Boolean,
    default: false,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  isSystemThread: {
    type: Boolean,
    default: false,
  },
  systemThreadType: {
    type: String,
    enum: ['locked_notes', null],
    default: null,
  },
  wallpaper: {
    type: String,
  },
  lastNote: {
    content: String,
    type: {
      type: String,
      enum: ['text', 'image', 'voice', 'file', 'location'],
    },
    timestamp: Date,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
threadSchema.index({ ownerId: 1, isPinned: -1, updatedAt: -1 });
threadSchema.index({ participants: 1 });
threadSchema.index({ ownerId: 1, isSystemThread: 1, systemThreadType: 1 });

// Pre-save middleware
threadSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check if user has access
threadSchema.methods.hasAccess = function (userId) {
  const userIdStr = userId.toString();
  return (
    this.ownerId.toString() === userIdStr ||
    this.participants.some((p) => p.toString() === userIdStr)
  );
};

// Instance method to check if user can edit
threadSchema.methods.canEdit = function (userId) {
  return this.ownerId.toString() === userId.toString();
};

// Static method to get or create locked notes thread
threadSchema.statics.getLockedNotesThread = async function (userId) {
  let lockedThread = await this.findOne({
    ownerId: userId,
    isSystemThread: true,
    systemThreadType: 'locked_notes',
  });

  if (!lockedThread) {
    lockedThread = await this.create({
      name: 'Locked Notes',
      icon: '🔒',
      ownerId: userId,
      isSystemThread: true,
      systemThreadType: 'locked_notes',
      isPinned: true,
    });
  }

  return lockedThread;
};

// Static method to get user's threads with pagination
threadSchema.statics.getUserThreads = async function (userId, options = {}) {
  const {
    page = 1,
    limit = 50,
    filter = 'all',
    search = '',
  } = options;

  const query = {
    $or: [
      { ownerId: userId },
      { participants: userId },
    ],
  };

  // Apply search filter
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  // Apply category filter
  if (filter === 'pinned') {
    query.isPinned = true;
  }

  const total = await this.countDocuments(query);
  const threads = await this.find(query)
    .sort({ isPinned: -1, 'lastNote.timestamp': -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    threads,
    total,
    page,
    hasMore: page * limit < total,
  };
};

const Thread = mongoose.model('Thread', threadSchema);

export default Thread;
