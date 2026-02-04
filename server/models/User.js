import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // deviceId is no longer required - kept for backwards compatibility during migration
  deviceId: {
    type: String,
    sparse: true,
    index: true,
  },
  name: {
    type: String,
    default: 'Me',
    trim: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-z0-9_]+$/,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    select: false, // Don't include in queries by default
  },
  linkedDevices: [{
    deviceId: {
      type: String,
      required: true,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
    },
  }],
  avatar: {
    type: String,
  },
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    notifications: {
      taskReminders: {
        type: Boolean,
        default: true,
      },
      sharedNotes: {
        type: Boolean,
        default: false,
      },
    },
    privacy: {
      visibility: {
        type: String,
        enum: ['public', 'private', 'contacts'],
        default: 'contacts',
      },
    },
  },
}, {
  timestamps: true,
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check if user can be found by others
userSchema.methods.isDiscoverable = function () {
  return this.settings.privacy.visibility !== 'private';
};

// Instance method to get public profile
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    name: this.name,
    username: this.username,
    avatar: this.avatar,
  };
};

// Static method to find by identifier (username, email, or phone)
userSchema.statics.findByIdentifier = async function (identifier) {
  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : identifier.match(/^\+?[\d\s-]+$/)
      ? { phone: identifier.replace(/[\s-]/g, '') }
      : { username: identifier.toLowerCase() };

  return this.findOne(query);
};

const User = mongoose.model('User', userSchema);

export default User;
