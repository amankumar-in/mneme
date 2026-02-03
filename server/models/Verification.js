import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['email', 'phone'],
    required: true,
  },
  target: {
    type: String,
    required: true,
    // email address or phone number being verified
  },
  code: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    // Used to store additional data like targetUserId for account linking
  },
}, {
  timestamps: true,
});

// Index for lookups and auto-cleanup
verificationSchema.index({ userId: 1, type: 1, target: 1 });
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate a 6-digit code
verificationSchema.statics.generateCode = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const Verification = mongoose.model('Verification', verificationSchema);

export default Verification;
