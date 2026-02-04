import mongoose from 'mongoose';

const sharedThreadSchema = new mongoose.Schema({
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread',
    required: true,
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sharedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permissions: {
    canEdit: {
      type: Boolean,
      default: false,
    },
    canDelete: {
      type: Boolean,
      default: false,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

// Compound indexes
sharedThreadSchema.index({ threadId: 1, sharedWith: 1 }, { unique: true });
sharedThreadSchema.index({ sharedWith: 1, status: 1 });
sharedThreadSchema.index({ sharedBy: 1 });

// Instance method to accept share
sharedThreadSchema.methods.accept = async function () {
  this.status = 'accepted';
  await this.save();

  // Add user to thread participants
  const Thread = mongoose.model('Thread');
  await Thread.findByIdAndUpdate(this.threadId, {
    $addToSet: { participants: this.sharedWith },
    isShared: true,
  });

  return this;
};

// Instance method to reject share
sharedThreadSchema.methods.reject = async function () {
  this.status = 'rejected';
  return this.save();
};

// Static method to get pending shares for a user
sharedThreadSchema.statics.getPendingShares = async function (userId) {
  return this.find({
    sharedWith: userId,
    status: 'pending',
  })
    .populate('threadId', 'name icon')
    .populate('sharedBy', 'name avatar')
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to remove user from shared thread
sharedThreadSchema.statics.removeShare = async function (threadId, userId) {
  const share = await this.findOneAndDelete({
    threadId,
    sharedWith: userId,
  });

  if (share) {
    // Remove user from thread participants
    const Thread = mongoose.model('Thread');
    const thread = await Thread.findByIdAndUpdate(
      threadId,
      { $pull: { participants: userId } },
      { new: true }
    );

    // Update isShared flag if no more participants
    if (thread && thread.participants.length === 0) {
      thread.isShared = false;
      await thread.save();
    }
  }

  return share;
};

const SharedThread = mongoose.model('SharedThread', sharedThreadSchema);

export default SharedThread;
